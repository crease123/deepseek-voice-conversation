/** Real preset composition, model input snapshots, and connection-owned voice state. */
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Group from '@deepseek-ai/cordis-plugin-group'
import AgentRegistry, { assembleContextFor, type Agent, type AgentHandle } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import AgentPresets from '@deepseek-ai/dsh-agent-preset-registry'
import type { PresetDefinition } from '@deepseek-ai/dsh-agent-preset-registry'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjections from '@deepseek-ai/dsh-session-projection'
import SystemPrompt, { renderContextSnapshot, renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import Tools from '@deepseek-ai/dsh-tools'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import LlmRuntime, { LlmAdapter, createUserMessage, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { afterEach, expect, it } from 'vitest'
import PersonalAgent from '../src/index.ts'

const contexts: Context[] = []
afterEach(async () => { for (const ctx of contexts.splice(0).reverse()) await ctx.fiber.dispose() })

class Adapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []
  async resolveModel(provider: string, model: string) { return { provider, id: model, name: model } }
  async *stream(request: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(request)
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: '收到' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: '收到' } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

async function fixture() {
  const ctx = new Context(); contexts.push(ctx)
  await ctx.plugin(Loader)
  await ctx.plugin(TypertRegistry)
  ctx.loader.builtins.group = Group
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjections)
  await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false })
  await ctx.plugin(Tools)
  await ctx.plugin(NativeToolExecutor)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(AgentPresets, { default: 'standard' })
  ctx.loader.builtins['standard-tool'] = { inject: ['tools'], apply: (owner: Context) => {
    owner.effect(() => owner.tools.register({ name: 'sample_tool', description: 'A retained Standard tool.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
      execute: async () => 'done' }))
  } }
  const standard: PresetDefinition['plugins'] = [
    { id: 'persona', name: '@deepseek-ai/dsh-persona', config: { prefix: 'Standard coding Agent.' } },
    { id: 'tool', name: 'cordis:standard-tool', disabled: { __jsExpr: 'false' } },
  ]
  ctx.effect(() => ctx.agentPresets.register({ id: 'standard', plugins: standard }))
  await ctx.fiber.await()
  ctx.loader.builtins.personal = PersonalAgent
  const entryId = await ctx.loader.create({ id: 'personal-agent', name: 'cordis:personal', config: { basePrompt: '个人助理：直接回答。', callPrompt: '语音中：每次先说两句。' } })
  const entry = ctx.loader.resolve(entryId)
  await entry.fiber!.await()
  const api = ctx.personalAgent
  if (api === undefined) throw new Error('Personal Agent did not activate')
  const adapter = new Adapter()
  ctx.effect(() => ctx.llm.registerAdapter(['personal-test'], adapter))
  const handles = new Map<SessionId, AgentHandle>()
  const create = async (id: string, preset = 'standard') => {
    const handle = await ctx.agents.create({ sessionId: SessionId(id), meta: { agentPreset: preset },
      agentOptions: { provider: 'personal-test', model: 'personal-test' },
      setup: agentCtx => ctx.agentPresets.mount(agentCtx, preset).then(() => undefined) })
    handles.set(handle.agent.id, handle)
    return handle.agent
  }
  const close = async (id: SessionId) => { await handles.get(id)?.dispose(); handles.delete(id) }
  const prompt = async (agent: Agent) => {
    const assembly = await ctx.systemPrompt.assemble(assembleContextFor(agent))
    return { system: renderPrompt(assembly), context: renderContextSnapshot(assembly) }
  }
  const update = async (basePrompt: string, callPrompt: string) => {
    const fiber = entry.fiber
    const next = { basePrompt, callPrompt }
    entry.fiber!.resolveConfig(next)
    await entry.update({ config: next }); await entry.fiber!.await()
    expect(entry.fiber === fiber).toBe(true)
  }
  return { ctx, api, entry, create, close, prompt, update, adapter }
}

it('does not register a preset or override the existing persona', async () => {
  const b = await fixture(), agent = await b.create('ordinary')
  expect(await b.ctx.agentPresets.list()).toMatchObject([{ id: 'standard' }])
  expect(b.ctx.tools.schemas(agent).map(tool => tool.name)).toEqual(['sample_tool'])
  expect((await b.prompt(agent)).system).toBe('Standard coding Agent.')
  await b.update('This legacy persona must not be injected.', 'Updated call instructions.')
  expect((await b.prompt(agent)).system).toBe('Standard coding Agent.')
  expect((await b.prompt(agent)).context).not.toContain('Updated call instructions.')
})

it('acknowledges voice context before input, retains other clients, and restores explicit text context', async () => {
  const b = await fixture(), agent = await b.create('call-personal')
  const firstAbort = new AbortController(), secondAbort = new AbortController()
  const first = b.api.call(agent.id, firstAbort.signal), second = b.api.call(agent.id, secondAbort.signal)
  expect(await first.next()).toEqual({ done: false, value: { active: true } })
  expect(await second.next()).toEqual({ done: false, value: { active: true } })
  const inCall = await b.prompt(agent)
  firstAbort.abort()
  expect(await b.prompt(agent)).toEqual(inCall)
  secondAbort.abort()
  const afterCall = await b.prompt(agent)
  expect({ inCall, afterCall }).toMatchInlineSnapshot(`
    {
      "afterCall": {
        "context": "Current runtime context. This snapshot supersedes earlier runtime-context snapshots.

    当前交流方式：文字。之前的语音通话状态和仅限通话的表达要求已结束；按当前用户请求决定回答长度。",
        "system": "Standard coding Agent.",
      },
      "inCall": {
        "context": "Current runtime context. This snapshot supersedes earlier runtime-context snapshots.

    当前交流方式：实时语音通话。以下表达要求仅在当前通话期间生效。

    语音中：每次先说两句。",
        "system": "Standard coding Agent.",
      },
    }
  `)
  expect(b.adapter.requests).toHaveLength(0)
  await first.return(); await second.return()
})

it('applies edited call guidance to the next assembly of an active call', async () => {
  const b = await fixture(), agent = await b.create('edited-call')
  const lifetime = new AbortController(), stream = b.api.call(agent.id, lifetime.signal)
  await stream.next()
  await b.update('更新的个人提示。', '更新的通话提示 {{literal}}。')
  expect(await b.prompt(agent)).toMatchInlineSnapshot(`
    {
      "context": "Current runtime context. This snapshot supersedes earlier runtime-context snapshots.

    当前交流方式：实时语音通话。以下表达要求仅在当前通话期间生效。

    更新的通话提示 {{literal}}。",
      "system": "Standard coding Agent.",
    }
  `)
  lifetime.abort(); await stream.return()
})

it('records current voice and text snapshots through the real AgentLoop without fake user messages', async () => {
  const b = await fixture(), agent = await b.create('logged')
  const lifetime = new AbortController(), stream = b.api.call(agent.id, lifetime.signal)
  await stream.next()
  const send = async (text: string) => {
    agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
    await agent.whenIdle()
  }
  await send('你好')
  lifetime.abort(); await stream.return()
  await send('继续')
  const messages = agent.session.snapshotEvents().flatMap(event => event.type !== 'user/message' ? []
    : [{ source: event.data.source.kind, text: event.data.content.filter(block => block.type === 'text').map(block => block.text).join('') }])
  expect(messages).toMatchInlineSnapshot(`
    [
      {
        "source": "user",
        "text": "你好",
      },
      {
        "source": "runtime-context",
        "text": "Current runtime context. This snapshot supersedes earlier runtime-context snapshots.

    当前交流方式：实时语音通话。以下表达要求仅在当前通话期间生效。

    语音中：每次先说两句。",
      },
      {
        "source": "user",
        "text": "继续",
      },
      {
        "source": "runtime-context",
        "text": "Current runtime context. This snapshot supersedes earlier runtime-context snapshots.

    当前交流方式：文字。之前的语音通话状态和仅限通话的表达要求已结束；按当前用户请求决定回答长度。",
      },
    ]
  `)
  expect(b.adapter.requests).toHaveLength(2)
})

it('rejects missing Sessions and aborted callers without leaving voice context', async () => {
  const b = await fixture(), agent = await b.create('live')
  const missing = b.api.call(SessionId('missing'), new AbortController().signal)
  await expect(missing.next()).rejects.toMatchObject({ code: 'personal-agent/session-unavailable' })
  const aborted = new AbortController(); aborted.abort()
  await expect(b.api.call(agent.id, aborted.signal).next()).rejects.toThrow()
  expect((await b.prompt(agent)).context).toContain('当前交流方式：文字')
})

it('applies call guidance to Standard without overriding its persona', async () => {
  const b = await fixture(), agent = await b.create('standard-call', 'standard')
  const lifetime = new AbortController(), stream = b.api.call(agent.id, lifetime.signal)
  await stream.next()
  const inCall = await b.prompt(agent)
  expect(inCall.system).toBe('Standard coding Agent.')
  expect(inCall.context).toContain('当前交流方式：实时语音通话')
  expect(inCall.context).toContain('每次先说两句')
  lifetime.abort(); await stream.return()
  expect((await b.prompt(agent)).context).toContain('当前交流方式：文字')
})

it('withdraws registration when a Session closes and does not delete a replacement call', async () => {
  const b = await fixture(), first = await b.create('replacement')
  const firstStream = b.api.call(first.id, new AbortController().signal)
  await firstStream.next()
  await b.close(first.id)
  const replacement = await b.create('replacement')
  const lifetime = new AbortController(), secondStream = b.api.call(replacement.id, lifetime.signal)
  await secondStream.next()
  await firstStream.return()
  expect((await b.prompt(replacement)).context).toContain('当前交流方式：实时语音通话')
  lifetime.abort(); await secondStream.return()
})

it('clears calls immediately on service unload, including streams paused after acknowledgement', async () => {
  const b = await fixture(), agent = await b.create('unloaded')
  const stream = b.api.call(agent.id, new AbortController().signal)
  await stream.next()
  await b.entry.fiber!.dispose()
  await expect(stream.next()).resolves.toEqual({ done: true, value: undefined })
  expect(() => b.api.catalog(new AbortController().signal)).toThrow()
})
