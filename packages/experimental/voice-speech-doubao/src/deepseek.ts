/** DeepSeek speech transports with bounded responses and explicit synthesis completion. */
import WebSocket from 'ws'
import { SpeechProviderFailure } from './protocol.ts'

/** Upload a validated WAV and return its bounded final transcript. */
export async function deepseekRecognize(wav: Buffer, url: string, headers: Record<string, string>, maxBytes: number, maxText: number, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted()
  const body = new FormData()
  body.append('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'speech.wav')
  const response = await fetch(url, { method: 'POST', headers, body, signal, redirect: 'error' })
  if (!response.ok || !response.body) { await response.body?.cancel(); throw new SpeechProviderFailure('rejected') }
  const reader = response.body.getReader()
  const parts: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > maxBytes) throw new SpeechProviderFailure('protocol')
      parts.push(value)
    }
    const result: unknown = JSON.parse(Buffer.concat(parts).toString('utf8'))
    if (!result || typeof result !== 'object' || !('text' in result) || typeof result.text !== 'string' || Array.from(result.text).length > maxText) throw new SpeechProviderFailure('protocol')
    return result.text
  } finally { await reader.cancel(); reader.releaseLock() }
}

/** Stream mono 24 kHz PCM, requiring a successful finish event before returning. */
export async function deepseekSynthesize(text: string, speaker: 'stella' | 'tide', endpoint: string, headers: Record<string, string>, maxBytes: number, signal: AbortSignal, emit: (audio: Buffer) => void): Promise<void> {
  signal.throwIfAborted()
  const url = new URL(endpoint)
  url.searchParams.set('voice_id', speaker); url.searchParams.set('format', 'pcm')
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(url, { headers, maxPayload: maxBytes })
    let completed = false, total = 0, pending = Buffer.alloc(0), error: unknown
    const fail = (reason: unknown): void => { error ??= reason; socket.terminate() }
    const abort = (): void => { fail(signal.reason) }
    signal.addEventListener('abort', abort, { once: true })
    socket.on('open', () => {
      if (signal.aborted) { abort(); return }
      socket.send(JSON.stringify({ event: 'text', text }))
      socket.send(JSON.stringify({ event: 'finish_text' }))
    })
    socket.on('message', (data, binary) => {
      try {
        if (completed) throw new SpeechProviderFailure('protocol')
        const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
        if (binary) {
          total += bytes.length
          if (total > maxBytes) throw new SpeechProviderFailure('protocol')
          const audio = Buffer.concat([pending, bytes]), count = audio.length - audio.length % 2
          if (count) emit(audio.subarray(0, count))
          pending = audio.subarray(count)
        } else {
          const finish: unknown = JSON.parse(bytes.toString('utf8'))
          if (!finish || typeof finish !== 'object' || !('event' in finish) || finish.event !== 'finish' || !('code' in finish) || finish.code !== 'success' || pending.length || total === 0) throw new SpeechProviderFailure('rejected')
          completed = true
          socket.close()
        }
      } catch (failure) { fail(failure) }
    })
    socket.on('error', () => { fail(new SpeechProviderFailure('network')) })
    socket.on('close', () => {
      signal.removeEventListener('abort', abort)
      if (error) reject(error)
      else if (!completed) reject(new SpeechProviderFailure('protocol'))
      else resolve()
    })
    if (signal.aborted) abort()
  })
}
