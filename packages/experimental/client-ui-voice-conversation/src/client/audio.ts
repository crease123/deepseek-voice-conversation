/** AudioWorklet microphone ownership and ordered PCM playback for one call. */
import { CAPTURE_RATE } from './utterance.ts'

/** Localized failure identity; provider details never enter this browser error. */
export class VoiceAudioError extends Error {
  constructor(readonly kind: 'unavailable' | 'permission' | 'microphone' | 'playback') { super(kind) }
}

/** Audio operations owned by a single call, independently replaceable in tests. */
export interface CallAudio {
  /**
   * Unlock playback from the user's start gesture.
   * @returns after the audio context is running.
   */
  activate(): Promise<void>
  /**
   * Open the microphone for this call.
   * @param frame - consecutive mono 16 kHz samples.
   * @param failure - microphone interruption callback.
   * @param signal - capture lifetime.
   * @returns after capture starts.
   */
  capture(frame: (samples: Float32Array) => void, failure: () => void, signal: AbortSignal): Promise<void>
  /**
   * Schedule one audio chunk after the previously accepted chunk.
   * @param encoded - base64 PCM16 mono audio.
   * @param sampleRate - provider's PCM rate.
   */
  append(encoded: string, sampleRate: number): void
  /**
   * Wait for accepted playback.
   * @returns after all scheduled samples finish or are stopped.
   */
  drain(): Promise<void>
  /** Stop every scheduled source immediately. */
  stopPlayback(): void
  /** Suspend capture processing and playback while a call pause is held.
   * @returns after the audio context is suspended.
   */
  pause(): Promise<void>
  /** Resume the existing audio resources after the call pause ends.
   * @returns after the context resumes.
   */
  resume(): Promise<void>
  /**
   * Close audio resources.
   * @returns after microphone and context resources close.
   */
  dispose(): Promise<void>
}

// The worklet's protocol is one transferable Float32Array per render quantum.
const WORKLET = `class VoiceCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) { const frame = channel.slice(); this.port.postMessage(frame, [frame.buffer]); }
    return true;
  }
}
registerProcessor('dsh-voice-capture', VoiceCapture);`

/** Browser resources for one call; late microphone grants release their tracks. */
export class BrowserCallAudio implements CallAudio {
  private context: AudioContext | undefined
  private stream: MediaStream | undefined
  private source: MediaStreamAudioSourceNode | undefined
  private worklet: AudioWorkletNode | undefined
  private readonly nodes = new Map<AudioBufferSourceNode, { done: Promise<void>; finish: () => void }>()
  private nextTime = 0
  private closed = false
  private disposal: Promise<void> | undefined

  constructor(private readonly volume: () => number = () => 1, private readonly meter: (level: number) => void = () => {}) {}

  async activate(): Promise<void> {
    if (typeof AudioContext === 'undefined' || typeof AudioWorkletNode === 'undefined' || !(navigator as Partial<Navigator>).mediaDevices) {
      throw new VoiceAudioError('unavailable')
    }
    this.context = new AudioContext({ sampleRate: CAPTURE_RATE })
    try { await this.context.resume() } catch (_error) { throw new VoiceAudioError('playback') }
    if (this.closed) return
    if (this.context.sampleRate !== CAPTURE_RATE) throw new VoiceAudioError('unavailable')
  }

  async capture(frame: (samples: Float32Array) => void, failure: () => void, signal: AbortSignal): Promise<void> {
    const context = this.context
    if (!context || !(context as Partial<AudioContext>).audioWorklet) throw new VoiceAudioError('unavailable')
    const acquisition = navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true,
      noiseSuppression: true, autoGainControl: true }, video: false })
    const cancelled = Promise.withResolvers<MediaStream>()
    const abort = (): void => { cancelled.reject(signal.reason) }
    let released = false
    const release = (stream: MediaStream): void => {
      if (released) return
      released = true
      for (const track of stream.getTracks()) track.stop()
    }
    signal.addEventListener('abort', abort, { once: true })
    void acquisition.then((stream) => { if (signal.aborted || this.closed) release(stream) }, () => {})
    try {
      signal.throwIfAborted()
      const stream = await Promise.race([acquisition, cancelled.promise])
      if (signal.aborted || this.closed) {
        release(stream)
        throw signal.reason ?? new DOMException('Voice call ended', 'AbortError')
      }
      this.stream = stream
    } catch (error) {
      if (signal.aborted) throw signal.reason
      throw new VoiceAudioError(error instanceof DOMException && error.name === 'NotAllowedError' ? 'permission' : 'microphone')
    } finally { signal.removeEventListener('abort', abort) }
    signal.throwIfAborted()
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }))
    try { await context.audioWorklet.addModule(url) } finally { URL.revokeObjectURL(url) }
    signal.throwIfAborted()
    this.source = context.createMediaStreamSource(this.stream)
    this.worklet = new AudioWorkletNode(context, 'dsh-voice-capture', { numberOfInputs: 1, numberOfOutputs: 0 })
    this.worklet.port.onmessage = (event: MessageEvent<unknown>) => {
      if (this.closed || signal.aborted) return
      if (!(event.data instanceof Float32Array)) { failure(); return }
      let energy = 0
      for (const sample of event.data) energy += sample * sample
      this.meter(Math.min(1, Math.sqrt(energy / event.data.length) * 8))
      frame(event.data)
    }
    this.worklet.onprocessorerror = failure
    for (const track of this.stream.getTracks()) track.addEventListener('ended', failure, { signal })
    this.source.connect(this.worklet)
  }

  append(encoded: string, sampleRate: number): void {
    const context = this.context
    if (!context || this.closed) return
    const binary = atob(encoded)
    if (binary.length % 2 !== 0) throw new VoiceAudioError('playback')
    if (binary.length === 0) return
    const buffer = context.createBuffer(1, binary.length / 2, sampleRate), samples = buffer.getChannelData(0)
    for (let i = 0; i < samples.length; i++) {
      const value = binary.charCodeAt(i * 2) | binary.charCodeAt(i * 2 + 1) << 8
      samples[i] = (value >= 32768 ? value - 65536 : value) / 32768
    }
    const source = context.createBufferSource(), gain = context.createGain(), done = Promise.withResolvers<void>()
    const finish = (): void => { source.disconnect(); gain.disconnect(); this.nodes.delete(source); done.resolve() }
    this.nodes.set(source, { done: done.promise, finish })
    gain.gain.value = this.volume()
    gain.connect(context.destination)
    source.buffer = buffer; source.connect(gain); source.onended = finish
    const at = Math.max(context.currentTime, this.nextTime)
    this.nextTime = at + buffer.duration
    source.start(at)
  }

  async drain(): Promise<void> { await Promise.all([...this.nodes.values()].map(node => node.done)) }

  stopPlayback(): void {
    for (const [source, node] of [...this.nodes]) { source.stop(); node.finish() }
    this.nextTime = 0
  }

  async pause(): Promise<void> { this.meter(0); if (!this.closed && this.context) await this.context.suspend() }

  async resume(): Promise<void> { if (!this.closed && this.context) await this.context.resume() }

  dispose(): Promise<void> {
    if (this.disposal) return this.disposal
    this.closed = true
    this.meter(0)
    this.stopPlayback()
    this.source?.disconnect()
    if (this.worklet) {
      this.worklet.port.onmessage = null; this.worklet.onprocessorerror = null
      this.worklet.port.close(); this.worklet.disconnect()
    }
    this.stream?.getTracks().forEach((track) => { track.stop() })
    const context = this.context
    this.disposal = context && context.state !== 'closed' ? context.close() : Promise.resolve()
    return this.disposal
  }
}
