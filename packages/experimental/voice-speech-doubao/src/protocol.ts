/** Bounded Doubao ASR framing and SSE audio decoding; credential values never enter failures. */
import { randomUUID } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import WebSocket, { type RawData } from 'ws'
import { EventSourceParserStream } from 'eventsource-parser/stream'
import { z } from 'zod'
import type { VoicePreferences } from './types.ts'
import { voiceInstruction } from './preferences.ts'

/** Expected upstream failure, translated to the public Remote failure by its service. */
export class SpeechProviderFailure extends Error {
  /** @param reason - stable upstream failure category without response or credential contents. */
  constructor(readonly reason: 'network' | 'protocol' | 'rejected') {
    super(`Doubao speech ${reason} failure`)
  }
}

/**
 * Validate a canonical browser recording before allocating provider resources.
 * @param encoded - complete WAV encoded as canonical base64.
 * @param maxBytes - maximum admitted decoded recording bytes.
 * @param maxDurationMs - maximum recording duration in milliseconds.
 * @returns PCM16 little-endian mono samples at 16 kHz, sharing the decoded buffer.
 */
export function recordingPcm(encoded: string, maxBytes: number, maxDurationMs: number): Buffer {
  if (!encoded || encoded.length > Math.ceil(maxBytes / 3) * 4) throw new Error('Invalid WAV size')
  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.length > maxBytes || bytes.toString('base64') !== encoded || bytes.length < 46) throw new Error('Invalid WAV encoding')
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const fixed: ReadonlyArray<readonly [number, string]> = [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']]
  if (fixed.some(([offset, text]) => bytes.toString('ascii', offset, offset + text.length) !== text)
    || header.getUint32(4, true) !== bytes.length - 8 || header.getUint32(16, true) !== 16
    || header.getUint16(20, true) !== 1 || header.getUint16(22, true) !== 1
    || header.getUint32(24, true) !== 16000 || header.getUint32(28, true) !== 32000
    || header.getUint16(32, true) !== 2 || header.getUint16(34, true) !== 16
    || header.getUint32(40, true) !== bytes.length - 44 || (bytes.length - 44) % 2 !== 0
    || (bytes.length - 44) / 32 > maxDurationMs) throw new Error('Invalid PCM WAV recording')
  return bytes.subarray(44)
}

/**
 * Encode one version-one gzip-compressed Doubao binary request.
 * @param type - initial configuration or subsequent audio message.
 * @param last - whether this audio message completes the recording.
 * @param payload - JSON configuration or PCM audio bytes.
 * @returns complete binary protocol frame.
 */
export function asrFrame(type: 1 | 2, last: boolean, payload: Buffer): Buffer {
  const compressed = gzipSync(payload)
  const header = Buffer.from([0x11, (type << 4) | (last ? 2 : 0), (type === 1 ? 0x10 : 0) | 1, 0, 0, 0, 0, 0])
  header.writeUInt32BE(compressed.length, 4)
  return Buffer.concat([header, compressed])
}

const transcriptSchema = z.object({ code: z.number().optional(), result: z.object({ text: z.string().optional() }).optional() })

/**
 * Decode one final-result ASR response, rejecting framing and decompression overflow.
 * @param frame - complete provider binary message.
 * @param maxBytes - maximum compressed frame and decompressed payload size.
 * @returns completion flag and the current complete transcript.
 */
export function asrResult(frame: Buffer, maxBytes: number): { last: boolean; text: string } {
  if (frame.length < 8 || frame.length > maxBytes || (frame.readUInt8(0) >> 4) !== 1) throw new SpeechProviderFailure('protocol')
  const headerBytes = (frame.readUInt8(0) & 15) * 4
  const type = frame.readUInt8(1) >> 4
  const flags = frame.readUInt8(1) & 15
  const serialization = frame.readUInt8(2) >> 4
  const compression = frame.readUInt8(2) & 15
  let offset = headerBytes + ((flags & 1) !== 0 ? 4 : 0)
  if (headerBytes < 4 || (type !== 9 && type !== 15) || compression > 1 || serialization !== 1) throw new SpeechProviderFailure('protocol')
  if (type === 15) offset = headerBytes + 4
  if (offset + 4 > frame.length) throw new SpeechProviderFailure('protocol')
  const size = frame.readUInt32BE(offset)
  offset += 4
  if (offset + size !== frame.length) throw new SpeechProviderFailure('protocol')
  if (type === 15) throw new SpeechProviderFailure('rejected')
  let payload: unknown
  try {
    const bytes = compression === 1 ? gunzipSync(frame.subarray(offset), { maxOutputLength: maxBytes }) : frame.subarray(offset)
    payload = JSON.parse(bytes.toString('utf8'))
  } catch (_invalidCompressedJson) { throw new SpeechProviderFailure('protocol') }
  const result = transcriptSchema.safeParse(payload)
  if (!result.success) throw new SpeechProviderFailure('protocol')
  if (result.data.code !== undefined && result.data.code !== 0) throw new SpeechProviderFailure('rejected')
  return { last: (flags & 2) !== 0, text: result.data.result?.text ?? '' }
}

/** Provider settings captured for one ASR operation. */
export interface RecognitionOptions {
  /** Provider WebSocket address. */
  url: string
  /** Already resolved credential headers, retained only for this request. */
  headers: Record<string, string>
  /** Resource granted to these credentials. */
  resourceId: string
  /** Maximum provider message and decompressed JSON bytes. */
  maxFrameBytes: number
  /** Maximum Unicode code points in the transcript. */
  maxTextLength: number
}

/**
 * Recognize a completed recording; every exit joins the socket's close event.
 * @param pcm - validated 16 kHz mono PCM16 audio.
 * @param options - operation-local provider settings and credentials.
 * @param signal - combined caller, deadline, and service lifetime.
 * @returns final transcript, or an empty string when no speech was recognized.
 */
export async function recognize(pcm: Buffer, options: RecognitionOptions, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted()
  const socket = new WebSocket(options.url, {
    headers: { ...options.headers, 'X-Api-Resource-Id': options.resourceId, 'X-Api-Request-Id': randomUUID(), 'X-Api-Connect-Id': randomUUID(), 'X-Api-Sequence': '-1' },
    maxPayload: options.maxFrameBytes,
    perMessageDeflate: false,
    followRedirects: false,
  })
  const closed = Promise.withResolvers<void>()
  const result = Promise.withResolvers<string>()
  const abort = () => { result.reject(signal.reason); socket.terminate() }
  socket.on('error', () => { result.reject(new SpeechProviderFailure('network')) })
  socket.on('close', () => { closed.resolve(); result.reject(new SpeechProviderFailure('protocol')) })
  socket.on('unexpected-response', (_request, response) => {
    response.destroy()
    result.reject(new SpeechProviderFailure('rejected'))
    socket.terminate()
  })
  socket.on('open', () => {
    if (signal.aborted) { abort(); return }
    const settings = { user: { uid: 'deepseek-honeycomb' }, audio: { format: 'pcm', rate: 16000, bits: 16, channel: 1 },
      request: { model_name: 'bigmodel', enable_itn: true, enable_punc: true, result_type: 'full' } }
    const send = (data: Buffer) => { socket.send(data, (error) => { if (error) result.reject(new SpeechProviderFailure('network')) }) }
    send(asrFrame(1, false, Buffer.from(JSON.stringify(settings))))
    for (let offset = 0; offset < pcm.length; offset += 16000) {
      send(asrFrame(2, offset + 16000 >= pcm.length, pcm.subarray(offset, offset + 16000)))
    }
  })
  let text = ''
  socket.on('message', (data: RawData, binary: boolean) => {
    try {
      if (!binary) throw new SpeechProviderFailure('protocol')
      const bytes = Array.isArray(data) ? Buffer.concat(data) : Buffer.isBuffer(data) ? data : Buffer.from(data)
      const parsed = asrResult(bytes, options.maxFrameBytes)
      if (parsed.text) text = parsed.text
      if (Array.from(text).length > options.maxTextLength) throw new SpeechProviderFailure('protocol')
      if (parsed.last) result.resolve(text.trim())
    } catch (error) { result.reject(error) }
  })
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  try { return await result.promise }
  finally {
    signal.removeEventListener('abort', abort)
    if (socket.readyState !== WebSocket.CLOSED) socket.terminate()
    await closed.promise
  }
}

const synthesisEvent = z.object({
  code: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
  data: z.string().nullish(),
})

/** Provider settings captured for one synthesis operation. */
export interface SynthesisOptions {
  /** Provider SSE address. */
  url: string
  /** Already resolved credential headers, retained only for this request. */
  headers: Record<string, string>
  /** Resource compatible with the selected speaker. */
  resourceId: string
  /** Validated request-local voice and delivery preferences. */
  voice: VoicePreferences
  /** Requested mono PCM sampling rate. */
  sampleRate: number
  /** Maximum buffered SSE characters and completed event bytes. */
  maxFrameBytes: number
  /** Maximum decoded PCM bytes across the complete request. */
  maxAudioBytes: number
}

/**
 * Read PCM chunks until explicit provider completion; disconnects remain failures.
 * @param text - validated sentence to synthesize.
 * @param options - operation-local provider settings and credentials.
 * @param signal - combined caller, deadline, and service lifetime.
 * @param emit - synchronous consumer of consecutive complete PCM16 samples.
 * @returns after successful completion or cancellation has closed the response.
 */
export async function synthesizePcm(
  text: string, options: SynthesisOptions, signal: AbortSignal, emit: (audio: Buffer) => void,
): Promise<void> {
  const instruction = voiceInstruction(options.voice.style)
  const response = await fetch(options.url, {
    method: 'POST', signal, redirect: 'error',
    headers: { ...options.headers, 'X-Api-Resource-Id': options.resourceId, 'X-Api-Request-Id': randomUUID(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: { uid: 'deepseek-honeycomb' }, req_params: { text, speaker: options.voice.speaker,
      audio_params: { format: 'pcm', sample_rate: options.sampleRate, speech_rate: options.voice.speechRate },
      additions: JSON.stringify({ post_process: { pitch: options.voice.pitch },
        ...instruction === undefined ? {} : { context_texts: [instruction] } }) } }),
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new SpeechProviderFailure('rejected')
  }
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
    await response.body?.cancel()
    throw new SpeechProviderFailure('protocol')
  }
  const frames = response.body.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream({
    onError: 'terminate', maxBufferSize: options.maxFrameBytes,
  }))
  let audioBytes = 0
  let leftover: Buffer = Buffer.alloc(0)
  try {
    for await (const frame of frames) {
      signal.throwIfAborted()
      if (Buffer.byteLength(frame.data) > options.maxFrameBytes) throw new SpeechProviderFailure('protocol')
      let raw: unknown
      try { raw = JSON.parse(frame.data) } catch (_invalidEventJson) { throw new SpeechProviderFailure('protocol') }
      const parsed = synthesisEvent.safeParse(raw)
      if (!parsed.success) throw new SpeechProviderFailure('protocol')
      const event = parsed.data
      if (event.code !== undefined && event.code !== 0 && event.code !== 20000000) throw new SpeechProviderFailure('rejected')
      if (event.data) {
        if (event.data.length > Math.ceil(options.maxAudioBytes / 3) * 4) throw new SpeechProviderFailure('protocol')
        const audio = Buffer.from(event.data, 'base64')
        if (audio.toString('base64') !== event.data) throw new SpeechProviderFailure('protocol')
        audioBytes += audio.length
        if (audioBytes > options.maxAudioBytes) throw new SpeechProviderFailure('protocol')
        const combined = leftover.length ? Buffer.concat([leftover, audio]) : audio
        const even = combined.length - combined.length % 2
        if (even) emit(combined.subarray(0, even))
        leftover = combined.subarray(even)
      }
      if (event.code === 20000000 || frame.event === '152') {
        if (!audioBytes || leftover.length) throw new SpeechProviderFailure('protocol')
        return
      }
    }
    throw new SpeechProviderFailure('protocol')
  } catch (error) {
    signal.throwIfAborted()
    if (error instanceof SpeechProviderFailure) throw error
    throw new SpeechProviderFailure('protocol')
  }
}
