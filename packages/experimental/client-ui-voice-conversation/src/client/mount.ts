/** Plugin-owned call instances, Session references, and Remote contribution. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-voice-speech-doubao/remote'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { BrowserCallAudio } from './audio.ts'
import { VoiceCall, type CallState } from './call.ts'
import { VoiceConversation, type VoiceConversationInjected } from './VoiceConversation.tsx'
import { NS, en, zh, ja, es, fr, de, ru, pt } from './locales.ts'
import { VoiceSettingsController, createVoiceVolume, type VoiceSettingsValues } from './settings-controller.ts'
import { VoiceSettingsDialog, VoiceSettingsRow, type VoiceSettingsInjected } from './VoiceSettings.tsx'
import { SETTINGS_NS, settingsEn, settingsZh, settingsJa, settingsEs, settingsFr, settingsDe, settingsRu, settingsPt } from './settings-locales.ts'

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    /** A Client microphone call retains its exact Session generation until cleanup. */
    voiceConversation: true
  }
}

/** Dependencies used when mounting the generated namespace and call UI. */
export const inject = ['remote', 'slots', 'locale', 'sessions', 'configForms', 'settingsSchema']

function registerUi(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh, ja, es, fr, de, ru, pt }))
  const calls = new Map<SessionId, VoiceCall>()
  const volume = createVoiceVolume()
  const settings = new VoiceSettingsController({
    remote: ctx.remote.voiceSpeech,
    form: namespace => ctx.configForms.get<VoiceSettingsValues>(namespace),
    ensure: () => ctx.configForms.describe().ensure(),
    inherited: (namespace, base) => {
      const view = ctx.configForms.describe().getSnapshot().view?.namespaces.find(item => item.ns === namespace)
      if (!view) throw new Error('Voice settings are unavailable')
      return (ctx.settingsSchema.rehydrate(view.schema) as (value: unknown) => VoiceSettingsValues)(base)
    },
    volume,
    audio: gain => new BrowserCallAudio(gain),
    pauseCalls: async () => {
      const resumes = await Promise.allSettled([...calls.values()].map(call => call.pauseForPreview()))
      const resume = async (): Promise<void> => {
        const settled = await Promise.allSettled(resumes.flatMap(result => result.status === 'fulfilled' ? [result.value()] : []))
        if (settled.some(result => result.status === 'rejected')) throw new Error('Voice call could not resume')
      }
      if (resumes.some(result => result.status === 'rejected')) { await resume(); throw new Error('Voice call could not pause') }
      return resume
    },
  })
  const settingsActions: VoiceSettingsInjected = {
    hooks: { voiceSettings: settings.state }, open: (example) => { settings.open(example) }, close: () => { settings.close() },
    edit: (key, value) => { settings.edit(key, value) }, example: (text) => { settings.example(text) },
    play: () => { settings.play() }, stop: () => settings.stop(), defaults: () => { settings.defaults() }, apply: () => settings.apply(),
  }
  ctx.effect(() => ctx.locale.register(SETTINGS_NS, {
    en: settingsEn, zh: settingsZh, ja: settingsJa, es: settingsEs, fr: settingsFr, de: settingsDe, ru: settingsRu, pt: settingsPt,
  }))
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item', id: 'voice-conversation', order: 17, locale: SETTINGS_NS, inject: () => settingsActions,
  }, VoiceSettingsRow))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'voice-conversation.settings', locale: SETTINGS_NS, inject: () => settingsActions,
  }, VoiceSettingsDialog))
  const state = createSnapshotStore<ReadonlyMap<SessionId, CallState>>(new Map())
  const closing = new Set<Promise<void>>()
  let disposed = false
  const publish = (id: SessionId, next: CallState): void => { state.set(new Map(state.getSnapshot()).set(id, next)) }
  const end = (id: SessionId): void => {
    const call = calls.get(id)
    if (!call) return
    const task = call.dispose().catch(() => { publish(id, { phase: 'error', failure: 'microphone' }) })
    closing.add(task)
    void task.finally(() => { closing.delete(task) })
  }
  const actions: VoiceConversationInjected = {
    hooks: { voiceCalls: state },
    hangup: end,
    start: (id) => {
      if (disposed || calls.has(id)) return
      const reference = ctx.sessions.retain(id, { source: 'voiceConversation' })
      const audio = new BrowserCallAudio(() => volume.getSnapshot().volume)
      const call = new VoiceCall(reference.binding, ctx.remote.voiceSpeech, audio, (next) => { publish(id, next) }, () => {
        if (calls.get(id) === call) calls.delete(id)
        reference.release()
      }, reference.ready, initial => settings.detection(initial))
      calls.set(id, call)
      void call.start()
    },
  }
  const hidden = (): void => { if (document.hidden) for (const id of calls.keys()) end(id) }
  document.addEventListener('visibilitychange', hidden)
  ctx.effect(() => async () => {
    disposed = true
    document.removeEventListener('visibilitychange', hidden)
    await Promise.allSettled([settings.dispose(), ...[...calls.values()].map(call => call.dispose())])
    await Promise.allSettled([...closing])
  })
  ctx.slots.inject('conversation.input.activity', () => ctx.slots.register({
    name: 'conversation.input.activity', locale: NS, inject: () => actions,
  }, VoiceConversation))
}

/**
 * Mount optional Remote and UI.
 * @param ctx - Client owner.
 * @param contribution - generated speech definitions.
 * @returns joined disposer.
 */
export async function mountVoiceConversation(ctx: Context, contribution: TypertRemoteContribution): Promise<() => Promise<void>> {
  const remote = await ctx.remote.$mount(contribution)
  const ui = ctx.inject(['remote', 'remote.voiceSpeech', 'slots', 'locale', 'sessions', 'configForms', 'settingsSchema'], registerUi)
  try { await ui } catch (error) { await ui.dispose(); await remote(); throw error }
  return async () => { await ui.dispose(); await remote() }
}
