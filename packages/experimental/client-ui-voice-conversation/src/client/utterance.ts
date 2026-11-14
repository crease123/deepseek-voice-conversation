/** Sample-counted utterance detection and bounded, incremental speech text. */
import type { VoiceSpeechCatalog } from '@deepseek-ai/dsh-voice-speech-doubao/types'

/** ASR accepts mono PCM16 at this protocol-defined rate. */
export const CAPTURE_RATE = 16000

/** Retain one second before speech onset and emit duration-bounded utterances. */
export class UtteranceDetector {
  private chunks: Float32Array[] = []
  private samples = 0
  private onsetSamples = 0
  private silence = 0
  private active = false
  private detection: Pick<VoiceSpeechCatalog, 'threshold' | 'minSpeechMs'>

  constructor(private readonly config: Pick<VoiceSpeechCatalog, 'threshold' | 'minSpeechMs' | 'silenceMs' | 'maxUtteranceMs'>,
    private readonly onStart: () => void, private readonly onUtterance: (samples: Float32Array) => void) { this.detection = config }

  /**
   * Change onset detection while preserving an utterance already being recorded.
   * @param detection - saved threshold and minimum continuous speech duration.
   */
  configure(detection: Pick<VoiceSpeechCatalog, 'threshold' | 'minSpeechMs'>): void { this.detection = detection }

  /** Discard partial microphone input when capture is suspended. */
  reset(): void { this.chunks = []; this.samples = 0; this.onsetSamples = 0; this.silence = 0; this.active = false }

  private retainRecent(limit: number): void {
    while (this.samples > limit) {
      const first = this.chunks[0]!
      const remove = Math.min(first.length, this.samples - limit)
      if (remove === first.length) this.chunks.shift()
      else this.chunks[0] = first.slice(remove)
      this.samples -= remove
    }
  }

  /**
   * Consume one microphone frame and emit a bounded utterance when its recording ends.
   * @param frame - consecutive mono 16 kHz microphone samples.
   */
  push(frame: Float32Array): void {
    if (frame.length === 0) return
    let power = 0
    for (const sample of frame) power += sample * sample
    const speech = Math.sqrt(power / frame.length) >= this.detection.threshold
    this.chunks.push(frame.slice())
    this.samples += frame.length
    if (!this.active) {
      this.onsetSamples = speech ? this.onsetSamples + frame.length : 0
      // Short recording limits reserve room for onset confirmation and trailing silence.
      const availableMs = Math.max(0, this.config.maxUtteranceMs - this.detection.minSpeechMs - this.config.silenceMs)
      const preRollSamples = Math.min(CAPTURE_RATE, Math.floor(availableMs * CAPTURE_RATE / 1000))
      this.retainRecent(preRollSamples + this.onsetSamples)
      if (!speech || this.onsetSamples * 1000 < this.detection.minSpeechMs * CAPTURE_RATE) return
      this.active = true
      this.onStart()
    }
    this.silence = speech ? 0 : this.silence + frame.length
    if (this.silence * 1000 < this.config.silenceMs * CAPTURE_RATE
      && this.samples * 1000 < this.config.maxUtteranceMs * CAPTURE_RATE) return
    const limit = Math.min(this.samples, Math.floor(this.config.maxUtteranceMs * CAPTURE_RATE / 1000))
    const joined = new Float32Array(limit)
    let offset = 0
    for (const chunk of this.chunks) {
      const part = chunk.subarray(0, limit - offset)
      joined.set(part, offset)
      offset += part.length
    }
    this.reset()
    this.onUtterance(joined)
  }
}

/**
 * Encode one utterance as canonical mono PCM16 WAV.
 * @param samples - 16 kHz samples.
 * @returns WAV bytes.
 */
export function encodeUtterance(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2), view = new DataView(bytes.buffer)
  const write = (offset: number, text: string): void => { for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i) }
  write(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); write(8, 'WAVE'); write(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, CAPTURE_RATE, true); view.setUint32(28, CAPTURE_RATE * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples.length * 2, true)
  for (const [index, sample] of samples.entries()) {
    const value = Math.max(-1, Math.min(1, sample))
    view.setInt16(44 + index * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true)
  }
  return bytes
}

/**
 * Encode binary request fields.
 * @param bytes - recording bytes.
 * @returns canonical base64.
 */
export function base64(bytes: Uint8Array): string {
  let text = ''
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(text)
}

/** Split bounded sentences by Unicode code points, omitting text without letters or numbers. */
export class SpeechSentences {
  private pending = ''
  constructor(private readonly limit: number) {}

  /**
   * Append text and release each complete sentence within the provider limit.
   * @param text - new assistant text delta.
   * @returns complete bounded sentences containing readable text.
   */
  push(text: string): string[] {
    this.pending = (this.pending + text).trimStart()
    const sentences: string[] = []
    for (;;) {
      const points = Array.from(this.pending)
      const end = points.findIndex(point => /[。！？!?；;\n]/u.test(point))
      const period = this.pending.search(/\.(?:\s|$)/u)
      const periodEnd = period < 0 ? -1 : Array.from(this.pending.slice(0, period + 1)).length - 1
      const boundary = end < 0 ? periodEnd : periodEnd < 0 ? end : Math.min(end, periodEnd)
      const size = boundary >= 0 ? Math.min(boundary + 1, this.limit) : points.length >= this.limit ? this.limit : 0
      if (size === 0) break
      const sentence = points.slice(0, size).join('').trim()
      this.pending = points.slice(size).join('').trimStart()
      if (/[\p{L}\p{N}]/u.test(sentence)) sentences.push(sentence)
    }
    return sentences
  }

  /**
   * Release the last incomplete sentence after a successful assistant settlement.
   * @returns the remaining text when it contains letters or numbers.
   */
  finish(): string[] {
    const text = this.pending.trim(); this.pending = ''
    return /[\p{L}\p{N}]/u.test(text) ? [text] : []
  }
}
