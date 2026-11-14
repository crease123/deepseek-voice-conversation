/** Personal Agent preset, editable guidance, and connection-owned conversation channel. */
import { Context, Service, type Volatile } from '@deepseek-ai/cordis'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import { entryListProblem, type PresetDefinition } from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings/types'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { Remote, RemoteError, TypertRemoteService, type RemoteStream } from '@deepseek-ai/dsh-typert-protocol'
import z from '@deepseek-ai/schemastery'
import { load } from 'js-yaml'
import type { PersonalAgentCallState, PersonalAgentCatalog } from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Personal preset guidance and Session-bound voice state. */
    personalAgent: PersonalAgent
  }
}

/** Deployment defaults and live-editable personal guidance. */
export interface Config {
  /** Source preset whose tools and operating policies are reused. */
  basePreset: string
  /** User-editable personal persona, read at every model request. */
  basePrompt: Volatile<string>
  /** User-editable speech guidance, applied only to personal Sessions in a call. */
  callPrompt: Volatile<string>
}

/** Plain Loader configuration before volatile fields become live references. */
export interface Options { basePreset?: string; basePrompt?: string; callPrompt?: string }

type Lease = { release(): void }

/** No state transition starts a model turn; the next ordinary request records the current channel. */
export default class PersonalAgent extends TypertRemoteService {
  static inject = ['agentPresets', 'sessions', 'systemPrompt', 'typert']
  static Config: z<Options, Config> = z.object({
    basePreset: z.string().min(1).default('standard'),
    basePrompt: z.string().min(1).default('你是用户的语音通话助手，协助处理日常事务、学习讨论、资料整理和具体任务。先理解用户的目标，直接回答核心问题，使用自然、清晰的中文。简单问题简短回答；复杂问题先给结论，再按需要展开。执行任务时沿用当前会话的工具和权限，简短说明必要进展，并在完成后报告实际结果；未完成或不确定的事情如实说明。尊重用户明确表达的偏好，不反复确认已经授权的常规步骤。').volatile(),
    callPrompt: z.string().min(1).default('用户正在通过实时语音与你交谈。先直接回答核心问题，默认每次说 1–3 句，尽量控制在 100 字以内。使用自然口语，避免标题、表格和长列表。复杂问题先讲关键结论，用户要求展开时再详细解释。执行任务时简短说明进展，完成后报告结果。代码、长路径和详细资料留在文字中，不逐字朗读。').volatile(),
  })

  private readonly lifetime = new AbortController()
  private readonly calls = new Map<SessionId, Set<Lease>>()
  private readonly settingsNamespace: SettingsNamespace | undefined

  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'personalAgent')
    this.settingsNamespace = ctx.fiber.entry?.options.id as SettingsNamespace | undefined
    ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
    ctx.effect(() => ctx.systemPrompt.variable('personal_agent_prompt', () => config.basePrompt.get()))
    ctx.effect(() => ctx.systemPrompt.context({
      name: 'personal-agent:channel', order: 1000, required: true, interpolate: false,
      text: ({ agent }) => {
        if (agent === undefined) return ''
        const session = agent.session
        const personal = ctx.agentPresets.presetForSession(session) === 'personal'
        if (!this.calls.has(session.id)) return '当前交流方式：文字。之前的语音通话状态和仅限通话的表达要求已结束；按当前用户请求决定回答长度。'
        return personal
          ? `当前交流方式：实时语音通话。以下表达要求仅在当前通话期间生效。\n\n${config.callPrompt.get()}`
          : '当前交流方式：实时语音通话。用户正在通过麦克风与你交谈，回复将被语音播报。'
      },
    }))
    ctx.on('session/disposed', (session) => {
      for (const lease of [...this.calls.get(session.id) ?? []]) lease.release()
    })
    ctx.effect(() => () => { this.lifetime.abort() })
  }

  protected async *[Service.init]() {
    const document = await this.ctx.agentPresets.readDocument(this.config.basePreset)
    const parsed: unknown = load(document.content, { schema: entryListSchema })
    const problem = entryListProblem(parsed)
    if (problem !== undefined) throw new Error(`Cannot compose personal Agent: ${problem}`)
    // The Loader dialect has been validated with the registry's own entry-list validator.
    const plugins = parsed as PresetDefinition['plugins']
    const persona = { id: 'personal-persona', name: '@deepseek-ai/dsh-persona',
      config: { prefix: '{{personal_agent_prompt}}' } }
    yield await this.ctx.agentPresets.register({
      id: 'personal', name: 'Voice call', description: '面向日常事务、学习讨论和任务执行，通话时使用简短口语', order: 2,
      plugins: [persona, ...plugins.filter(row => row.name !== '@deepseek-ai/dsh-persona')],
    })
  }

  /**
   * Read saved guidance and its configuration namespace without starting a conversation.
   * @param signal - request cancellation.
   * @returns saved prompts and the addressable settings entry, when present.
   */
  @Remote
  catalog(signal: AbortSignal): PersonalAgentCatalog {
    signal.throwIfAborted(); this.lifetime.signal.throwIfAborted()
    return { basePrompt: this.config.basePrompt.get(), callPrompt: this.config.callPrompt.get(),
      ...(this.settingsNamespace === undefined ? {} : { settingsNamespace: this.settingsNamespace }) }
  }

  /**
   * Hold voice context until the caller disconnects, the Session closes, or this service unloads.
   * @param sessionId - existing live Session whose next request receives the voice state.
   * @param signal - call lifetime; cancellation synchronously withdraws this registration.
   * @returns one acknowledgement after registration; closing the stream withdraws only its own call.
   */
  @Remote({ mode: 'stream', resources: { session: (sessionId: SessionId) => sessionId } })
  async *call(sessionId: SessionId, signal: AbortSignal): RemoteStream<PersonalAgentCallState> {
    signal.throwIfAborted(); this.lifetime.signal.throwIfAborted()
    const session = this.ctx.sessions.get(sessionId)
    if (session === undefined) throw new RemoteError('personal-agent/session-unavailable', 'Reopen the conversation before starting a voice call.', { sessionId })
    const stopped = Promise.withResolvers<void>()
    const lifetime = AbortSignal.any([signal, this.lifetime.signal])
    const leases = this.calls.get(sessionId) ?? new Set<Lease>()
    const lease: Lease = { release: () => {
      if (!leases.delete(lease)) return
      if (leases.size === 0) this.calls.delete(sessionId)
      stopped.resolve()
    } }
    leases.add(lease); this.calls.set(sessionId, leases)
    lifetime.addEventListener('abort', lease.release, { once: true })
    try {
      yield { active: true }
      await stopped.promise
    } finally { lifetime.removeEventListener('abort', lease.release); lease.release() }
  }
}
