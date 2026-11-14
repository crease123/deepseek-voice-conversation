/** One Session-bound call owns capture, recognition, speech and cancellation. */
import type { SessionBinding, SessionEventLike } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionRequestId } from '@deepseek-ai/dsh-api-session-controller/types'
import type { MessageId } from '@deepseek-ai/dsh-llm/brand'
import type { VoiceSpeechCatalog } from '@deepseek-ai/dsh-voice-speech-doubao/types'
import type { TypertClientRemote } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-voice-speech-doubao/remote'
import type {} from '@deepseek-ai/dsh-personal-agent/remote'
import { type CallAudio, VoiceAudioError } from './audio.ts'
import { base64, encodeUtterance, UtteranceDetector } from './utterance.ts'
import { VoiceOutput } from './output.ts'

/** Localized call feedback; raw Host diagnostics are not displayed. */
export type CallFailure = 'unavailable' | 'permission' | 'microphone' | 'playback' | 'connection' | 'recognition' | 'submission' | 'cancellation' | 'backlog'
/** A complete local call state; a synthesis warning lasts until the next speech onset. */
export type CallState = { phase: 'idle' | 'connecting' | 'listening' | 'recognizing' | 'thinking' | 'speaking' | 'stopping' | 'paused'; warning?: 'synthesis' } | { phase: 'error'; failure: CallFailure }
/** Generated speech methods, shared by the mounted Client namespace. */
export type SpeechRemote = TypertClientRemote['voiceSpeech']
/** Host call registration; the stream owns the current Session's communication state. */
export type PersonalCallRemote = Pick<TypertClientRemote['personalAgent'], 'call'>

interface PendingVoiceInput {
  readonly requestId: SessionRequestId
  readonly afterSeq: number
  occurrence?: { id: MessageId; target: 'next-turn' | 'next-step'; index: number }
  outcome: 'unseen' | 'queued' | 'claimed' | 'canceled'
}

/** One call; closing it leaves already submitted Agent work under ordinary Session control. */
export class VoiceCall {
  private readonly lifetime = new AbortController()
  private speech = new AbortController()
  private readonly tasks = new Set<Promise<void>>()
  private output: VoiceOutput | undefined
  private speechTail = Promise.resolve()
  private recognitionTail = Promise.resolve()
  private cancellation = Promise.resolve()
  private admission = Promise.resolve()
  private recognition: AbortController | undefined
  private generation = 0
  private eventSeq = -1
  private lastTurnStartSeq = -1
  private lastTurnEndSeq = -1
  private pendingInput: PendingVoiceInput | undefined
  private recording = false
  private transcriptParts: string[] = []
  private queuedUtterances = 0
  private speaking = 0
  private disposeEvents = (): void => {}
  private disposeStatus = (): void => {}
  private disposal: Promise<void> | undefined
  private readonly pauseLeases = new Set<symbol>()
  private backgroundPause: symbol | undefined
  private audioTransitions = Promise.resolve()
  private audioReady = false
  private audioPaused = false
  private warning: 'synthesis' | undefined
  private vad: UtteranceDetector | undefined

  private get paused(): boolean { return this.pauseLeases.size > 0 }

  constructor(private readonly binding: SessionBinding, private readonly remote: SpeechRemote, private readonly personal: PersonalCallRemote,
    private readonly audio: CallAudio, private readonly publish: (state: CallState) => void,
    private readonly release: () => void, private readonly ready: Promise<SessionBinding> = Promise.resolve(binding),
    private readonly detection: (initial: Pick<VoiceSpeechCatalog, 'threshold' | 'minSpeechMs'>) => Pick<VoiceSpeechCatalog, 'threshold' | 'minSpeechMs'> = initial => initial) {}

  /**
   * Start capture with playback unlocked by the user's click.
   * @returns after startup settles.
   */
  start(): Promise<void> {
    this.publish({ phase: 'connecting' })
    return this.track(this.begin())
  }

  private async begin(): Promise<void> {
    try {
      await this.audio.activate()
      this.audioReady = true
      await this.synchronizeAudio()
      await this.withLifetime(this.ready)
      const result = await this.withLifetime(this.remote.catalog(this.lifetime.signal))
      if (!result.ok) { this.fail('connection'); return }
      await this.connectPresence()
      this.lifetime.signal.throwIfAborted()
      const catalog = result.value
      this.output = new VoiceOutput(catalog.maxTextLength,
        (sentence) => { this.speak(sentence, catalog.sampleRate) }, () => { this.stopSpeech() })
      const initial = this.binding.eventSource.getSnapshot()
      this.eventSeq = initial.entries.reduce((maximum, entry) => Math.max(maximum, entry.event.seq), -1)
      let revision = initial.revision
      this.disposeEvents = this.binding.eventSource.subscribe(() => {
        const snapshot = this.binding.eventSource.getSnapshot()
        if (snapshot.revision === revision || this.lifetime.signal.aborted) return
        revision = snapshot.revision
        const change = snapshot.change
        if (change.kind === 'append') {
          for (const { event } of change.entries) {
            this.eventSeq = Math.max(this.eventSeq, event.seq)
            this.observeInput(event)
            if (event.type === 'turn/start') this.lastTurnStartSeq = event.seq
            if (event.type === 'turn/end') {
              this.lastTurnEndSeq = event.seq
              if (this.pendingInput?.outcome === 'claimed' && event.seq > this.pendingInput.afterSeq) this.pendingInput = undefined
            }
          }
          this.output?.accept(change.entries)
        }
        else if (change.kind === 'settle-assistant' && change.entry) this.output?.accept([change.entry])
        else if (change.kind === 'replace') this.fail('connection')
      })
      this.disposeStatus = this.binding.session.subscribe(() => {
        if (this.binding.session.getSnapshot().openState === 'error') this.fail('connection')
        else if (!this.binding.session.getSnapshot().running && this.speaking === 0 && this.queuedUtterances === 0) this.publishLive('listening')
      })
      let utteranceGeneration = 0
      const vad = new UtteranceDetector(catalog, () => { utteranceGeneration = this.interrupt() }, (samples) => {
        this.recording = false
        this.recognize(samples, utteranceGeneration)
      })
      this.vad = vad
      await this.audio.capture((samples) => {
        if (this.paused) return
        vad.configure(this.detection(catalog))
        vad.push(samples)
      }, () => { this.fail('microphone') }, this.lifetime.signal)
      this.publishLive('listening')
    } catch (error) {
      if (!this.lifetime.signal.aborted) this.fail(error instanceof VoiceAudioError ? error.kind : 'connection')
    }
  }

  private connectPresence(): Promise<void> {
    const ready = Promise.withResolvers<void>()
    const stream = this.personal.call(this.binding.sessionId, this.lifetime.signal)
    this.track((async () => {
      try {
        for await (const _state of stream) ready.resolve()
        if (!this.stopped()) throw new Error('Voice context connection closed')
      } catch (error) {
        ready.reject(error)
        if (!this.stopped()) this.fail('connection')
      } finally {
        stream.dispose()
        ready.reject(new DOMException('Voice call ended', 'AbortError'))
      }
    })())
    return this.withLifetime(ready.promise)
  }

  private interrupt(): number {
    const generation = this.generation
    this.recording = true
    if (this.lifetime.signal.aborted) return generation
    if (this.warning !== undefined) { this.warning = undefined; this.publishLive('listening') }
    const pending = this.pendingInput
    this.output?.reset()
    const admission = this.admission, previous = this.cancellation
    this.cancellation = this.track((async () => {
      await previous
      await admission
      if (this.lifetime.signal.aborted) return
      if (pending === undefined && !this.binding.session.getSnapshot().running) return
      let afterSeq = this.lastTurnStartSeq > this.lastTurnEndSeq ? this.lastTurnStartSeq : undefined
      if (pending !== undefined) {
        if (pending.outcome === 'unseen') { this.fail('cancellation'); return }
        if (pending.outcome === 'queued' && pending.occurrence !== undefined) {
          const removed = await this.withLifetime(this.binding.session.updateQueue(pending.occurrence.id, { kind: 'remove' }))
          if (removed.ok) {
            pending.outcome = 'canceled'
            if (this.pendingInput === pending) this.pendingInput = undefined
          } else if (removed.error.code !== 'session/queue-item-not-found' || !this.wasClaimed(pending)) {
            this.fail('cancellation'); return
          }
        }
        if (pending.outcome === 'claimed') afterSeq = pending.afterSeq
      }
      const result = await this.withLifetime(this.binding.session.cancel())
      if (!result.ok) { this.fail('cancellation'); return }
      await this.waitIdle(afterSeq)
    })().catch(() => { if (!this.lifetime.signal.aborted) this.fail('cancellation') }))
    return generation
  }

  private observeInput(event: SessionEventLike): void {
    const pending = this.pendingInput
    if (!pending || event.type !== 'agent/inbox/spliced') return
    const splice = event.data, occurrence = pending.occurrence, removed = splice.removedCount ?? 0
    if (occurrence?.target === splice.target && pending.outcome === 'queued' && occurrence.index >= splice.start) {
      if (occurrence.index < splice.start + removed) pending.outcome = splice.outcome === 'canceled' ? 'canceled' : 'claimed'
      else occurrence.index += splice.inserted.length - removed
    }
    for (const [index, message] of splice.inserted.entries()) {
      if (message.source.kind !== 'user' || !('rpcId' in message.source) || message.source.rpcId !== pending.requestId) continue
      pending.occurrence = { id: message.id, target: splice.target, index: splice.start + index }
      pending.outcome = 'queued'
    }
  }

  private wasClaimed(input: PendingVoiceInput): boolean { return input.outcome === 'claimed' }

  private waitIdle(afterSeq?: number): Promise<void> {
    const session = this.binding.session
    const settled = (): boolean => !session.getSnapshot().running && (afterSeq === undefined || this.lastTurnEndSeq > afterSeq)
    if (settled() || this.lifetime.signal.aborted) return Promise.resolve()
    return new Promise((resolve) => {
      let observedEnd = this.lastTurnEndSeq
      const done = (): void => { disposeStatus(); disposeEvents(); this.lifetime.signal.removeEventListener('abort', done); resolve() }
      const check = (): void => { if (!session.getSnapshot().running && (afterSeq === undefined || observedEnd > afterSeq)) done() }
      const disposeStatus = session.subscribe(check)
      const disposeEvents = this.binding.eventSource.subscribe(() => {
        const change = this.binding.eventSource.getSnapshot().change
        if (change.kind === 'append') for (const { event } of change.entries) {
          if (event.type === 'turn/end') observedEnd = Math.max(observedEnd, event.seq)
        }
        check()
      })
      this.lifetime.signal.addEventListener('abort', done, { once: true })
      if (settled() || this.lifetime.signal.aborted) done()
    })
  }

  private withLifetime<T>(operation: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const abort = (): void => { reject(new DOMException('Voice call ended', 'AbortError')) }
      this.lifetime.signal.addEventListener('abort', abort, { once: true })
      void operation.then((value) => {
        this.lifetime.signal.removeEventListener('abort', abort)
        if (this.stopped()) abort()
        else resolve(value)
      }, (error: unknown) => {
        this.lifetime.signal.removeEventListener('abort', abort)
        reject(error instanceof Error ? error : new Error('Voice operation failed', { cause: error }))
      })
      if (this.lifetime.signal.aborted) abort()
    })
  }

  private recognize(samples: Float32Array, generation: number): void {
    if (this.lifetime.signal.aborted) return
    // One waiting utterance bounds audio retained behind a slow recognizer.
    if (this.queuedUtterances >= 2) { this.fail('backlog'); return }
    this.queuedUtterances++
    this.recognitionTail = this.track(this.recognitionTail.then(async () => {
      try {
        if (this.stopped() || generation !== this.generation) return
        this.publishLive('recognizing')
        const recognition = new AbortController()
        this.recognition = recognition
        const signal = AbortSignal.any([recognition.signal, this.lifetime.signal])
        const result = await this.remote.transcribe({ wavBase64: base64(encodeUtterance(samples)) }, signal)
        if (signal.aborted || generation !== this.generation) return
        if (!result.ok) { this.fail('recognition'); return }
        const text = result.value.text.trim()
        if (text) this.transcriptParts.push(text)
      } catch (_error) { if (!this.lifetime.signal.aborted && generation === this.generation) this.fail('recognition') }
      finally {
        this.queuedUtterances--
        await this.submitTranscript(generation)
      }
    }))
  }

  private async submitTranscript(generation: number): Promise<void> {
    await this.cancellation
    if (this.stopped() || generation !== this.generation || this.recording || this.queuedUtterances > 0) return
    const text = this.transcriptParts.join(' ').trim()
    this.transcriptParts = []
    if (!text) { this.publishLive('listening'); return }
    const submission = this.binding.session.beginSubmission({ text, mode: 'queue', attachments: [] })
    this.pendingInput = { requestId: submission.requestId, afterSeq: this.eventSeq, outcome: 'unseen' }
    this.output?.expect(submission.requestId)
    this.publishLive('thinking')
    this.admission = (async () => {
      try {
        const accepted = await this.binding.session.prompt([{ type: 'text', text }], 'queue', this.lifetime.signal, submission.requestId)
        if (!accepted.ok && !this.lifetime.signal.aborted) this.fail('submission')
      } catch (_error) {
        submission.abandon()
        if (!this.lifetime.signal.aborted) this.fail('submission')
      }
    })()
    await this.admission
  }

  private speak(text: string, sampleRate: number): void {
    const signal = this.speech.signal
    const stopped = (): boolean => signal.aborted || this.stopped()
    this.speaking++
    this.speechTail = this.track(this.speechTail.then(async () => {
      if (stopped()) return
      let stream: ReturnType<SpeechRemote['synthesize']> | undefined
      let operation: 'synthesis' | 'playback' = 'synthesis'
      try {
        stream = this.remote.synthesize({ text }, signal)
        this.publishLive('speaking')
        for await (const chunk of stream) {
          if (stopped()) break
          operation = 'playback'
          this.audio.append(chunk.audio, chunk.sampleRate ?? sampleRate)
          operation = 'synthesis'
        }
        operation = 'playback'
        await this.audio.drain()
      } catch (_error) {
        if (stopped()) return
        if (operation === 'playback') { this.fail('playback'); return }
        try { this.audio.stopPlayback() }
        catch (_playbackError) { this.fail('playback'); return }
        this.warning = 'synthesis'
        this.publishLive(this.binding.session.getSnapshot().running ? 'thinking' : 'listening')
      }
      finally { stream?.dispose() }
    }).finally(() => {
      this.speaking--
      if (this.speaking === 0 && this.queuedUtterances === 0 && !this.binding.session.getSnapshot().running) this.publishLive('listening')
    }))
  }

  private stopSpeech(): void {
    this.speech.abort(); this.speech = new AbortController(); this.audio.stopPlayback()
  }

  private stopped(): boolean { return this.lifetime.signal.aborted }

  private publishLive(phase: 'listening' | 'recognizing' | 'thinking' | 'speaking'): void {
    if (!this.lifetime.signal.aborted) this.publish({ phase: this.paused ? 'paused' : phase,
      ...(this.warning === undefined ? {} : { warning: this.warning }) })
  }

  /**
   * Keep the call paused while its page is hidden.
   * @param hidden - whether the owning page is hidden.
   * @returns after capture and playback reach the requested state.
   */
  async setBackgrounded(hidden: boolean): Promise<void> {
    if (this.stopped()) return
    if (hidden) {
      if (this.backgroundPause !== undefined) return
      const lease = Symbol('background')
      this.backgroundPause = lease
      await this.acquirePause(lease)
      return
    }
    const lease = this.backgroundPause
    if (lease === undefined) return
    this.backgroundPause = undefined
    await this.releasePause(lease)
  }

  /**
   * Pause microphone admission and audio without cancelling Agent work.
   * @returns a resume command for the same still-live call.
   */
  async pauseForPreview(): Promise<() => Promise<void>> {
    if (this.stopped()) return async () => {}
    const lease = Symbol('preview')
    await this.acquirePause(lease)
    let released = false
    return async () => {
      if (released) return
      released = true
      await this.releasePause(lease)
    }
  }

  private async acquirePause(lease: symbol): Promise<void> {
    const wasPaused = this.paused
    this.pauseLeases.add(lease)
    if (!wasPaused) { this.recording = false; this.transcriptParts = []; this.generation++; this.recognition?.abort(); this.vad?.reset() }
    this.publishLive('listening')
    try { await this.synchronizeAudio() }
    catch (error) { if (!this.stopped()) this.fail('playback'); throw error }
  }

  private async releasePause(lease: symbol): Promise<void> {
    if (this.stopped() || !this.pauseLeases.delete(lease)) return
    try { await this.synchronizeAudio() }
    catch (error) { if (!this.stopped()) this.fail('playback'); throw error }
  }

  private synchronizeAudio(): Promise<void> {
    const operation = this.audioTransitions.then(async () => {
      if (this.stopped() || !this.audioReady) return
      const shouldPause = this.paused
      if (shouldPause === this.audioPaused) return
      if (shouldPause) await this.audio.pause()
      else await this.audio.resume()
      if (this.stopped()) return
      this.audioPaused = shouldPause
      if (!shouldPause) this.publishLive(this.speaking > 0 ? 'speaking' : this.binding.session.getSnapshot().running ? 'thinking' : 'listening')
    })
    this.audioTransitions = operation.catch((error: unknown) => {
      // The caller reports the playback failure; keep later transitions and teardown ordered.
      void error
    })
    return operation
  }

  private fail(failure: CallFailure): void {
    if (this.lifetime.signal.aborted) return
    this.publish({ phase: 'stopping' })
    void this.dispose(false).then(() => { this.publish({ phase: 'error', failure }) }, () => {
      this.publish({ phase: 'error', failure: 'microphone' })
    })
  }

  private track(task: Promise<void>): Promise<void> {
    this.tasks.add(task)
    void task.finally(() => { this.tasks.delete(task) }).catch(() => {})
    return task
  }

  /**
   * Stop self-owned audio and requests without cancelling already submitted Agent work.
   * @param showIdle - clear call feedback on explicit hangup; false preserves an error.
   * @returns after self-owned work settles.
   */
  dispose(showIdle = true): Promise<void> {
    if (this.disposal) return this.disposal
    this.lifetime.abort(); this.speech.abort(); this.disposeEvents(); this.disposeStatus()
    if (showIdle) this.publish({ phase: 'stopping' })
    const closing = this.audioTransitions.then(() => this.audio.dispose())
    this.disposal = (async () => {
      try {
        try { await closing } finally { await Promise.allSettled([...this.tasks]) }
        if (showIdle) this.publish({ phase: 'idle' })
      }
      finally { this.release() }
    })()
    return this.disposal
  }
}
