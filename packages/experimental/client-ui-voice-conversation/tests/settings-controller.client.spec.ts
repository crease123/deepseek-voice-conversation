/** Draft persistence, preview ownership and teardown use controlled remote completions. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings/types'
import type { VoiceSpeechCatalog, VoiceAudioChunk } from '@deepseek-ai/dsh-voice-speech-doubao/types'
import type { RemoteStreamHandle } from '@deepseek-ai/dsh-typert-protocol'
import { expect, it, vi } from 'vitest'
import { VoiceSettingsController, type VoiceSettingsValues } from '../src/client/settings-controller.ts'
import type { CallAudio } from '../src/client/audio.ts'
import type { SpeechRemote } from '../src/client/call.ts'

const initial: VoiceSettingsValues = { speaker: 'voice', speechRate: 0, pitch: 0, style: 'natural', threshold: 0.012, minSpeechMs: 200 }
function fixture() {
  const snapshot = createSnapshotStore<ConfigFormSnapshot<VoiceSettingsValues>>({ status: 'ready', value: initial,
    base: initial, user: {}, revision: 1, writable: true })
  const mutate = vi.fn<ConfigForm<VoiceSettingsValues>['mutate']>(async (ops) => {
    const next = { ...initial }
    for (const op of ops) if (op.op === 'set') Object.assign(next, { [op.path[0]!]: op.value })
    snapshot.set({ ...snapshot.getSnapshot(), value: next, revision: 2 })
    return true
  })
  const form: ConfigForm<VoiceSettingsValues> = { ...snapshot, mutate, set: vi.fn(async () => true), unset: vi.fn(async () => true) }
  const catalog: VoiceSpeechCatalog = { voice: { speaker: 'voice', speechRate: 0, pitch: 0, style: 'natural' },
    voices: [{ speaker: 'voice', name: 'Voice', styles: ['natural', 'gentle'] }], settingsNamespace: 'voice-speech-doubao' as SettingsNamespace,
    sampleRate: 24000, silenceMs: 650, maxUtteranceMs: 15000, threshold: 0.012, minSpeechMs: 200, maxTextLength: 600 }
  const synthesize = vi.fn<SpeechRemote['synthesize']>(() => ({ async *[Symbol.asyncIterator]() { yield { audio: 'AAA=' } },
    send: vi.fn(), end: vi.fn(), dispose: vi.fn() }))
  const remote: SpeechRemote = { catalog: vi.fn(async () => ({ ok: true, value: catalog })), synthesize,
    transcribe: vi.fn(async () => ({ ok: true, value: { text: '' } })) }
  const activate = vi.fn(async () => {}), capture = vi.fn(async () => {}), dispose = vi.fn(async () => {})
  const audio: CallAudio = { activate, capture, append: vi.fn(),
    drain: vi.fn(async () => {}), stopPlayback: vi.fn(), pause: vi.fn(async () => {}), resume: vi.fn(async () => {}), dispose }
  const resume = vi.fn(async () => {}), pauseCalls = vi.fn<() => Promise<() => Promise<void>>>(async () => resume)
  const ensure = vi.fn(async () => {})
  const volume = createSnapshotStore({ volume: 0.8 })
  const controller = new VoiceSettingsController({ remote, form: () => form, ensure, inherited: () => initial,
    volume, audio: () => audio, pauseCalls })
  return { controller, snapshot, form, mutate, catalog, remote, synthesize, audio,
    activate, capture, dispose, volume, resume, pauseCalls, ensure }
}
async function opened(b: ReturnType<typeof fixture>): Promise<void> {
  b.controller.open('Example text')
  await vi.waitFor(() => { expect(b.controller.state.getSnapshot().draft).toBeDefined() })
}

it('keeps edits in a draft, previews them, and saves Host fields only on Apply', async () => {
  const b = fixture(); await opened(b)
  b.controller.edit('speechRate', 25); b.controller.edit('volume', 0.4); b.controller.example('Draft preview')
  expect(b.mutate).not.toHaveBeenCalled(); expect(b.volume.getSnapshot().volume).toBe(0.8)
  b.controller.play()
  await vi.waitFor(() => { expect(b.resume).toHaveBeenCalledOnce() })
  expect(b.synthesize).toHaveBeenCalledWith({ text: 'Draft preview', voice: { speaker: 'voice', speechRate: 25, pitch: 0, style: 'natural' } }, expect.any(AbortSignal))
  expect(b.pauseCalls).toHaveBeenCalledOnce(); expect(b.capture).not.toHaveBeenCalled(); expect(b.mutate).not.toHaveBeenCalled()
  await b.controller.apply()
  expect(b.mutate).toHaveBeenCalledOnce(); expect(b.mutate.mock.calls[0]![0]).toHaveLength(6)
  expect(b.mutate.mock.calls[0]![0].some(op => op.path.includes('volume'))).toBe(false)
  expect(b.volume.getSnapshot().volume).toBe(0.4); expect(b.controller.state.getSnapshot().open).toBe(false)
  await b.controller.dispose()
})

it('discards cancelled edits and restores inherited fields through unset operations', async () => {
  const b = fixture(); await opened(b)
  b.controller.edit('pitch', 4); b.controller.close(); await opened(b)
  expect(b.controller.state.getSnapshot().draft?.pitch).toBe(0); expect(b.mutate).not.toHaveBeenCalled()
  b.controller.defaults(); await b.controller.apply()
  expect(b.mutate.mock.calls[0]![0].every(op => op.op === 'unset')).toBe(true)
  await b.controller.dispose()
})

it('waits for shared form initialization before exposing editable preferences', async () => {
  const b = fixture(), ensured = Promise.withResolvers<undefined>()
  b.snapshot.set({ ...b.snapshot.getSnapshot(), status: 'loading', value: undefined })
  b.ensure.mockReturnValue(ensured.promise)
  b.controller.open('Example')
  await vi.waitFor(() => { expect(b.ensure).toHaveBeenCalledOnce() })
  expect(b.controller.state.getSnapshot().draft).toBeUndefined()
  b.snapshot.set({ ...b.snapshot.getSnapshot(), status: 'ready', value: initial }); ensured.resolve(undefined)
  await vi.waitFor(() => { expect(b.controller.state.getSnapshot().writable).toBe(true) })
  await b.controller.dispose()
})

it('aborts and joins preview before another playback can take ownership', async () => {
  const b = fixture(), exited = Promise.withResolvers<undefined>()
  b.synthesize.mockImplementation((
    _request: Parameters<SpeechRemote['synthesize']>[0], signal?: AbortSignal,
  ): RemoteStreamHandle<VoiceAudioChunk, never> => ({
    async *[Symbol.asyncIterator]() {
      await new Promise<void>((resolve) => { signal?.addEventListener('abort', () => { resolve() }, { once: true }) })
      await exited.promise
    }, send: vi.fn(), end: vi.fn(), dispose: vi.fn(),
  }))
  await opened(b); b.controller.play()
  await vi.waitFor(() => { expect(b.synthesize).toHaveBeenCalledOnce() })
  b.controller.close(); b.controller.open('New draft'); b.controller.play()
  expect(b.synthesize).toHaveBeenCalledOnce(); expect(b.resume).not.toHaveBeenCalled()
  const disposed = b.controller.dispose()
  exited.resolve(undefined); await disposed
  expect(b.resume).toHaveBeenCalledOnce(); expect(b.dispose).toHaveBeenCalled()
})

it('joins an admitted Apply during disposal and ignores its late local continuation', async () => {
  const b = fixture(), accepted = Promise.withResolvers<boolean>()
  b.mutate.mockReturnValueOnce(accepted.promise)
  await opened(b); b.controller.edit('volume', 0.2)
  const applying = b.controller.apply()
  await vi.waitFor(() => { expect(b.mutate).toHaveBeenCalledOnce() })
  let released = false
  const disposed = b.controller.dispose().then(() => { released = true })
  await Promise.resolve(); expect(released).toBe(false)
  const before = b.controller.state.getSnapshot()
  accepted.resolve(true); await applying; await disposed
  expect(b.volume.getSnapshot().volume).toBe(0.8); expect(b.controller.state.getSnapshot()).toBe(before)
})

it('resumes paused calls even when preview audio teardown fails', async () => {
  const b = fixture(); await opened(b)
  b.dispose.mockRejectedValue(new Error('audio closed unexpectedly'))
  b.controller.play()
  await vi.waitFor(() => { expect(b.resume).toHaveBeenCalledOnce() })
  expect(b.controller.state.getSnapshot().preview).toBe(false)
  await b.controller.dispose()
})

it('contains activation failure while pause is pending and restores the call once pause settles', async () => {
  const b = fixture(), paused = Promise.withResolvers<() => Promise<void>>()
  b.pauseCalls.mockReturnValueOnce(paused.promise)
  b.activate.mockRejectedValueOnce(new Error('playback blocked'))
  await opened(b); b.controller.play()
  await vi.waitFor(() => { expect(b.controller.state.getSnapshot().failure).toBe('previewError') })
  expect(b.resume).not.toHaveBeenCalled()
  const closing = b.controller.dispose()
  paused.resolve(b.resume)
  await closing
  expect(b.resume).toHaveBeenCalledOnce(); expect(b.synthesize).not.toHaveBeenCalled()
})
