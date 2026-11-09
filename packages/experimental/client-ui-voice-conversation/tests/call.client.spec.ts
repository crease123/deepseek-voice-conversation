/** Call lifecycle exercises use real sample-counted utterances and controlled Remote completions. */
import { Context } from '@deepseek-ai/cordis'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { createScope, MutableSessionEventSource, type SessionBinding, type SessionSnapshot, type SessionFace } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionRequestId } from '@deepseek-ai/dsh-api-session-controller/types'
import { SessionSeq, type SessionId, type SessionEvent } from '@deepseek-ai/dsh-session/types'
import type { MessageId } from '@deepseek-ai/dsh-llm/brand'
import type { VoiceTranscript, VoiceAudioChunk } from '@deepseek-ai/dsh-voice-speech-doubao/types'
import { RemoteError, type RemoteResult, type RemoteStreamHandle } from '@deepseek-ai/dsh-typert-protocol'
import { describe, expect, it, vi } from 'vitest'
import { VoiceCall, type CallState, type SpeechRemote } from '../src/client/call.ts'
import type { CallAudio } from '../src/client/audio.ts'
import { VoiceSettingsController } from '../src/client/settings-controller.ts'

const id = 'voice-session' as SessionId
function fixture() {
  const status = createSnapshotStore<SessionSnapshot>({ sessionId: id, pendingSubmissions: [], running: false, subagent: null,
    removed: false, openState: 'open', openError: null, hasMore: false, loadingOlder: false, promptError: null, blank: false,
    lastAgentError: null, promptAttempted: false, awaitingFirstTurn: false })
  const eventSource = new MutableSessionEventSource()
  let capture: (frame: Float32Array) => void = () => {}, interrupted = (): void => {}
  const audioDispose = vi.fn(async () => {}), stopPlayback = vi.fn()
  const audioCapture = vi.fn<CallAudio['capture']>(async (frame, failure) => { capture = frame; interrupted = failure })
  const pause = vi.fn(async () => {}), audioResume = vi.fn(async () => {})
  const audio: CallAudio = { activate: vi.fn(async () => {}), capture: audioCapture,
    append: vi.fn(), drain: vi.fn(async () => {}), stopPlayback, pause, resume: audioResume, dispose: audioDispose }
  const prompt = vi.fn<SessionFace['prompt']>(async () => ({ ok: true, value: { accepted: true } }))
  const updateQueue = vi.fn<SessionFace['updateQueue']>(async () => ({ ok: true, value: { accepted: true } }))
  const cancel = vi.fn(async (): Promise<RemoteResult<{ accepted: true }>> => ({ ok: true, value: { accepted: true } }))
  const abandon = vi.fn(), release = vi.fn(), publish = vi.fn<(state: CallState) => void>()
  const binding: SessionBinding = { sessionId: id, eventSource, ctx: createScope(new Context(), id).ctx,
    session: { ...status, sessionId: id, prompt, cancel,
      beginSubmission: () => ({ requestId: 'voice-receipt' as SessionRequestId, abandon }),
      projections: { faceOf: () => createSnapshotStore(undefined) },
      readAttachment: async () => { throw new Error('fixture does not read attachments') },
      updateQueue,
      rename: async title => ({ ok: true, value: { title, seq: SessionSeq(1) } }),
      loadOlder: async () => {}, loadThrough: async () => {}, command: async () => ({ ok: true, value: { matched: false } }),
    } }
  const transcribe = vi.fn<SpeechRemote['transcribe']>(async () => ({ ok: true, value: { text: '你好' } }))
  const synthesize = vi.fn((): RemoteStreamHandle<VoiceAudioChunk, never> => ({
    async *[Symbol.asyncIterator]() { yield { audio: 'AAA=' } }, send: vi.fn(), end: vi.fn(), dispose: vi.fn(),
  }))
  const remote: SpeechRemote = { catalog: vi.fn(async () => ({ ok: true, value: { voice: { speaker: 'voice', speechRate: 0, pitch: 0, style: 'natural' }, voices: [{ speaker: 'voice', name: 'Voice', styles: ['natural'] }], sampleRate: 24000,
    minSpeechMs: 0, silenceMs: 10, maxUtteranceMs: 1000, threshold: 0.1, maxTextLength: 100 } })), transcribe, synthesize }
  const call = new VoiceCall(binding, remote, audio, publish, release)
  const voice = (): void => { capture(new Float32Array(160).fill(0.5)) }
  const silence = (): void => { capture(new Float32Array(160)) }
  const running = (value: boolean): void => { status.set({ ...status.getSnapshot(), running: value }) }
  let seq = 0
  const spliced = (data: SessionEvent<'agent/inbox/spliced'>['data']): void => {
    eventSource.append({ type: 'event', event: { type: 'agent/inbox/spliced', seq: SessionSeq(++seq), time: 0, data } })
  }
  const turnStart = (): void => { eventSource.append({ type: 'event', event: { type: 'turn/start', seq: SessionSeq(++seq), time: 0, data: { turn: 1 } } }) }
  const turnEnd = (): void => { eventSource.append({ type: 'event', event: { type: 'turn/end', seq: SessionSeq(++seq), time: 0, data: { turn: 1, reason: { kind: 'completed' } } } }) }
  return { call, audio, audioDispose, audioCapture, stopPlayback, remote, status, eventSource,
    prompt, cancel, updateQueue, transcribe, synthesize, publish, abandon, release, voice, silence, running,
    spliced, turnStart, turnEnd, pause, audioResume,
    interrupted: () => { interrupted() } }
}

const voiceMessage = { id: 'voice-message' as MessageId, role: 'user' as const,
  content: [{ type: 'text' as const, text: '你好' }], source: { kind: 'user' as const, rpcId: 'voice-receipt' as SessionRequestId } }

describe('voice call admission', () => {
  it('submits a transcript through ordinary Session prompts and releases capture on hangup', async () => {
    const b = fixture()
    await b.call.start(); b.voice(); b.silence()
    await vi.waitFor(() => { expect(b.prompt).toHaveBeenCalledTimes(1) })
    expect(b.prompt).toHaveBeenCalledWith([{ type: 'text', text: '你好' }], 'queue', expect.any(AbortSignal), 'voice-receipt')
    expect(b.transcribe.mock.calls[0]![0].wavBase64.startsWith('UklGR')).toBe(true)
    await b.call.dispose()
    expect(b.audioDispose).toHaveBeenCalledOnce(); expect(b.release).toHaveBeenCalledOnce()
    b.voice(); b.silence(); expect(b.prompt).toHaveBeenCalledTimes(1)
    expect(b.publish).toHaveBeenLastCalledWith({ phase: 'idle' })
    expect(b.cancel).not.toHaveBeenCalled()
  })

  it('stops playback on speech onset and waits for cancellation quiescence before sending', async () => {
    const b = fixture(), cancelled = Promise.withResolvers<RemoteResult<{ accepted: true }>>()
    b.cancel.mockReturnValue(cancelled.promise)
    await b.call.start(); b.running(true); b.voice()
    expect(b.stopPlayback).toHaveBeenCalledOnce()
    b.silence()
    await vi.waitFor(() => { expect(b.cancel).toHaveBeenCalledOnce(); expect(b.transcribe).toHaveBeenCalledOnce() })
    expect(b.prompt).not.toHaveBeenCalled()
    cancelled.resolve({ ok: true, value: { accepted: true } })
    await Promise.resolve(); expect(b.prompt).not.toHaveBeenCalled()
    b.running(false)
    await vi.waitFor(() => { expect(b.prompt).toHaveBeenCalledOnce() })
    await b.call.dispose()
  })

  it('drops late recognition after a new speech onset and admits only the newer utterance', async () => {
    const b = fixture(), first = Promise.withResolvers<RemoteResult<VoiceTranscript>>()
    b.transcribe.mockReturnValueOnce(first.promise)
    await b.call.start(); b.voice(); b.silence()
    await vi.waitFor(() => { expect(b.transcribe).toHaveBeenCalledOnce() })
    b.voice(); b.silence(); first.resolve({ ok: true, value: { text: '旧识别' } })
    await vi.waitFor(() => { expect(b.prompt).toHaveBeenCalledOnce() })
    expect(b.prompt.mock.calls[0]![0]).toEqual([{ type: 'text', text: '你好' }])
    await b.call.dispose()
  })

  it('cancels accepted voice work before a late running notification and waits for its durable end', async () => {
    const b = fixture(), admission = Promise.withResolvers<RemoteResult<{ accepted: true }>>()
    b.prompt.mockReturnValueOnce(admission.promise)
    await b.call.start(); b.voice(); b.silence()
    await vi.waitFor(() => { expect(b.prompt).toHaveBeenCalledTimes(1) })
    // The Host can accept input before its status/follow notifications reach the Client.
    b.voice(); b.silence()
    b.spliced({ target: 'next-turn', start: 0, inserted: [voiceMessage] })
    b.turnStart()
    b.spliced({ target: 'next-turn', start: 0, removedCount: 1, inserted: [] })
    admission.resolve({ ok: true, value: { accepted: true } })
    await vi.waitFor(() => { expect(b.cancel).toHaveBeenCalledOnce() })
    expect(b.status.getSnapshot().running).toBe(false)
    expect(b.prompt).toHaveBeenCalledTimes(1)
    b.turnEnd()
    await vi.waitFor(() => { expect(b.prompt).toHaveBeenCalledTimes(2) })
    await b.call.dispose()
  })

  it('removes only this call input latched behind maintenance before admitting its replacement', async () => {
    const b = fixture()
    await b.call.start(); b.voice(); b.silence()
    await vi.waitFor(() => { expect(b.prompt).toHaveBeenCalledOnce() })
    b.spliced({ target: 'next-turn', start: 0, inserted: [voiceMessage] })
    b.voice(); b.silence()
    await vi.waitFor(() => { expect(b.prompt).toHaveBeenCalledTimes(2) })
    expect(b.updateQueue).toHaveBeenCalledExactlyOnceWith(voiceMessage.id, { kind: 'remove' })
    expect(b.cancel).toHaveBeenCalledOnce()
    await b.call.dispose()
  })

  it('waits for the claimed turn when an owned queue item is consumed during removal', async () => {
    const b = fixture(), removal = Promise.withResolvers<Awaited<ReturnType<SessionFace['updateQueue']>>>()
    b.updateQueue.mockReturnValueOnce(removal.promise)
    await b.call.start(); b.voice(); b.silence()
    await vi.waitFor(() => { expect(b.prompt).toHaveBeenCalledOnce() })
    b.spliced({ target: 'next-turn', start: 0, inserted: [voiceMessage] })
    b.voice(); b.silence()
    await vi.waitFor(() => { expect(b.updateQueue).toHaveBeenCalledOnce() })
    b.turnStart(); b.spliced({ target: 'next-turn', start: 0, removedCount: 1, inserted: [] })
    removal.resolve({ ok: false, error: new RemoteError('session/queue-item-not-found', 'already claimed', { itemId: voiceMessage.id }) })
    await vi.waitFor(() => { expect(b.cancel).toHaveBeenCalledOnce() })
    expect(b.prompt).toHaveBeenCalledOnce()
    b.turnEnd()
    await vi.waitFor(() => { expect(b.prompt).toHaveBeenCalledTimes(2) })
    await b.call.dispose()
  })

  it('stops automatic admission when acceptance lacks enough live queue evidence for cancellation', async () => {
    const b = fixture()
    await b.call.start(); b.voice(); b.silence()
    await vi.waitFor(() => { expect(b.prompt).toHaveBeenCalledOnce() })
    b.voice(); b.silence()
    await vi.waitFor(() => { expect(b.release).toHaveBeenCalledOnce() })
    expect(b.prompt).toHaveBeenCalledOnce(); expect(b.updateQueue).not.toHaveBeenCalled()
    expect(b.publish).toHaveBeenLastCalledWith({ phase: 'error', failure: 'cancellation' })
  })

  it('hangs up while catalog transport is pending and discards the late result', async () => {
    const b = fixture(), catalog = Promise.withResolvers<Awaited<ReturnType<SpeechRemote['catalog']>>>()
    vi.mocked(b.remote.catalog).mockReturnValueOnce(catalog.promise)
    const starting = b.call.start()
    await vi.waitFor(() => { expect(b.remote.catalog).toHaveBeenCalledOnce() })
    await b.call.dispose(); await starting
    expect(b.release).toHaveBeenCalledOnce(); expect(b.audioCapture).not.toHaveBeenCalled()
    catalog.resolve({ ok: false, error: new RemoteError('gateway/internal', 'late error', {}) })
    await Promise.resolve(); expect(b.publish).toHaveBeenLastCalledWith({ phase: 'idle' })
  })

  it('stops safely when cancellation fails and never sends the replacement utterance', async () => {
    const b = fixture()
    b.cancel.mockResolvedValue({ ok: false, error: new RemoteError('gateway/internal', 'failure', {}) })
    await b.call.start(); b.running(true); b.voice(); b.silence()
    await vi.waitFor(() => { expect(b.release).toHaveBeenCalledOnce() })
    expect(b.prompt).not.toHaveBeenCalled()
    expect(b.publish).toHaveBeenLastCalledWith({ phase: 'error', failure: 'cancellation' })
  })

  it('hangs up while cancellation transport is pending without waiting for its late receipt', async () => {
    const b = fixture(), cancellation = Promise.withResolvers<RemoteResult<{ accepted: true }>>()
    b.cancel.mockReturnValueOnce(cancellation.promise)
    await b.call.start(); b.running(true); b.voice(); b.silence()
    await vi.waitFor(() => { expect(b.cancel).toHaveBeenCalledOnce() })
    await b.call.dispose()
    expect(b.release).toHaveBeenCalledOnce(); expect(b.prompt).not.toHaveBeenCalled()
    cancellation.resolve({ ok: true, value: { accepted: true } })
    await Promise.resolve(); expect(b.publish).toHaveBeenLastCalledWith({ phase: 'idle' })
  })

  it('hangup cancels recognition and waits for its settlement, without cancelling the Agent', async () => {
    const b = fixture(), recognition = Promise.withResolvers<RemoteResult<VoiceTranscript>>()
    b.transcribe.mockReturnValueOnce(recognition.promise)
    await b.call.start(); b.voice(); b.silence()
    await vi.waitFor(() => { expect(b.transcribe).toHaveBeenCalledOnce() })
    const closing = b.call.dispose()
    await Promise.resolve(); expect(b.release).not.toHaveBeenCalled()
    recognition.resolve({ ok: true, value: { text: '迟到识别' } })
    await closing
    expect(b.release).toHaveBeenCalledOnce(); expect(b.prompt).not.toHaveBeenCalled(); expect(b.cancel).not.toHaveBeenCalled()
  })

  it('treats empty recognition as silence and surfaces microphone interruptions', async () => {
    const b = fixture()
    b.transcribe.mockResolvedValue({ ok: true, value: { text: '' } })
    await b.call.start(); b.voice(); b.silence()
    await vi.waitFor(() => { expect(b.publish).toHaveBeenLastCalledWith({ phase: 'listening' }) })
    expect(b.prompt).not.toHaveBeenCalled()
    b.interrupted(); await b.call.dispose()
    expect(b.publish).toHaveBeenLastCalledWith({ phase: 'error', failure: 'microphone' })
  })

  it('pauses capture and playback for preview without cancelling the Agent and resumes the same call', async () => {
    const b = fixture(); await b.call.start(); b.running(true)
    const resume = await b.call.pauseForPreview()
    b.voice(); b.silence(); await Promise.resolve()
    expect(b.cancel).not.toHaveBeenCalled(); expect(b.transcribe).not.toHaveBeenCalled()
    expect(b.pause).toHaveBeenCalledOnce(); expect(b.publish).toHaveBeenLastCalledWith({ phase: 'paused' })
    await resume(); b.running(false); b.voice(); b.silence()
    await vi.waitFor(() => { expect(b.prompt).toHaveBeenCalledOnce() })
    expect(b.audioResume).toHaveBeenCalledOnce()
    await b.call.dispose()
  })

  it('ends the call visibly when preview suspension or restoration fails', async () => {
    for (const operation of ['pause', 'resume'] as const) {
      const b = fixture(); await b.call.start()
      if (operation === 'pause') b.pause.mockRejectedValueOnce(new Error('cannot suspend'))
      else b.audioResume.mockRejectedValueOnce(new Error('cannot resume'))
      if (operation === 'pause') await expect(b.call.pauseForPreview()).rejects.toThrow('cannot suspend')
      else { const resume = await b.call.pauseForPreview(); await expect(resume()).rejects.toThrow('cannot resume') }
      await vi.waitFor(() => { expect(b.release).toHaveBeenCalledOnce() })
      expect(b.publish).toHaveBeenLastCalledWith({ phase: 'error', failure: 'playback' })
      expect(b.cancel).not.toHaveBeenCalled()
    }
  })

  it('releases the Session only after recognition settles even when audio teardown rejects', async () => {
    const b = fixture(), recognition = Promise.withResolvers<Awaited<ReturnType<SpeechRemote['transcribe']>>>()
    b.transcribe.mockReturnValueOnce(recognition.promise)
    b.audioDispose.mockRejectedValueOnce(new Error('audio teardown failed'))
    await b.call.start(); b.voice(); b.silence()
    await vi.waitFor(() => { expect(b.transcribe).toHaveBeenCalledOnce() })
    const closing = b.call.dispose()
    const failed = expect(closing).rejects.toThrow('audio teardown failed')
    await Promise.resolve(); expect(b.release).not.toHaveBeenCalled()
    recognition.resolve({ ok: true, value: { text: '' } }); await failed
    expect(b.release).toHaveBeenCalledOnce()
  })

  it('closes a pending preview suspension when settings and call owners dispose together', async () => {
    const b = fixture(), suspended = Promise.withResolvers<undefined>()
    b.pause.mockReturnValueOnce(suspended.promise)
    await b.call.start()
    const settings = new VoiceSettingsController({ remote: b.remote, ensure: async () => {},
      form: () => { throw new Error('no settings namespace in fixture') }, inherited: () => { throw new Error('no inherited form') },
      audio: () => b.audio, volume: createSnapshotStore({ volume: 1 }), pauseCalls: () => b.call.pauseForPreview() })
    settings.open('Preview')
    await vi.waitFor(() => { expect(settings.state.getSnapshot().draft).toBeDefined() })
    settings.play()
    await vi.waitFor(() => { expect(b.pause).toHaveBeenCalledOnce() })
    await Promise.all([settings.dispose(), b.call.dispose()])
    expect(b.release).toHaveBeenCalledOnce(); expect(b.synthesize).not.toHaveBeenCalled()
    suspended.resolve(undefined)
  })
})
