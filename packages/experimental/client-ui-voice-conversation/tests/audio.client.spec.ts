// @vitest-environment jsdom
/** Browser audio tests control permission settlement, worklet frames and playback completion. */
import { afterEach, expect, it, vi } from 'vitest'
import { BrowserCallAudio, VoiceAudioError } from '../src/client/audio.ts'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

function fixture() {
  const tracks = [{ stop: vi.fn(), addEventListener: vi.fn() }], stream = { getTracks: () => tracks }
  const getUserMedia = vi.fn(async () => stream)
  const played: {
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    onended: (() => void) | null
    buffer: { duration: number } | null
  }[] = []
  const addModule = vi.fn(async () => {}), close = vi.fn(async () => {}), resume = vi.fn(async () => {})
  const worklet = { port: { onmessage: null as ((event: MessageEvent) => void) | null, close: vi.fn() },
    onprocessorerror: null as (() => void) | null, disconnect: vi.fn() }
  const context = { state: 'running', sampleRate: 16000, currentTime: 1, destination: {}, audioWorklet: { addModule }, close, resume, suspend: vi.fn(async () => {}),
    createGain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() })),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    createBuffer: vi.fn((_channels: number, length: number, sampleRate: number) => ({
      duration: length / sampleRate, getChannelData: () => new Float32Array(length),
    })),
    createBufferSource: vi.fn(() => {
      const source = { start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), connect: vi.fn(), onended: null, buffer: null }
      played.push(source)
      return source
    }),
  }
  vi.stubGlobal('AudioContext', function () { return context })
  vi.stubGlobal('AudioWorkletNode', function () { return worklet })
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:worklet')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  return { audio: new BrowserCallAudio(), context, worklet, played, tracks, getUserMedia, addModule, close }
}

it('captures transferable samples and disconnects the microphone/worklet on disposal', async () => {
  const b = fixture(), frame = vi.fn(), fail = vi.fn(), lifetime = new AbortController()
  await b.audio.activate(); await b.audio.capture(frame, fail, lifetime.signal)
  expect(b.getUserMedia).toHaveBeenCalledWith({ audio: {
    channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
  }, video: false })
  const samples = new Float32Array(128)
  b.worklet.port.onmessage?.({ data: samples } as MessageEvent)
  expect(frame).toHaveBeenCalledWith(samples)
  b.worklet.port.onmessage?.({ data: 'invalid worklet output' } as MessageEvent)
  expect(fail).toHaveBeenCalledOnce()
  await b.audio.dispose(); await b.audio.dispose()
  expect(b.tracks[0]!.stop).toHaveBeenCalledOnce(); expect(b.worklet.port.close).toHaveBeenCalledOnce()
  expect(b.close).toHaveBeenCalledOnce(); expect(b.worklet.port.onmessage).toBeNull()
})

it('queues PCM chunks consecutively and interruption unblocks playback waits immediately', async () => {
  const b = fixture()
  await b.audio.activate()
  b.audio.append('AACA/w==', 24000); b.audio.append('AAA=', 24000)
  expect(b.played[0]!.start).toHaveBeenCalledWith(1)
  expect(b.played[1]!.start).toHaveBeenCalledWith(1 + 2 / 24000)
  const draining = b.audio.drain()
  b.audio.stopPlayback(); await draining
  for (const source of b.played) { expect(source.stop).toHaveBeenCalledOnce(); expect(source.disconnect).toHaveBeenCalledOnce() }
  b.audio.append('AAA=', 24000); expect(b.played[2]!.start).toHaveBeenCalledWith(1)
  b.played[2]!.onended?.(); await b.audio.drain(); await b.audio.dispose()
})

it('aborts pending permission without waiting for the grant and stops late granted tracks', async () => {
  const b = fixture(), permission = Promise.withResolvers<{ getTracks: () => typeof b.tracks }>(), lifetime = new AbortController()
  b.getUserMedia.mockReturnValue(permission.promise)
  await b.audio.activate()
  const capturing = b.audio.capture(vi.fn(), vi.fn(), lifetime.signal)
  const error = new Error('call ended')
  lifetime.abort(error)
  await expect(capturing).rejects.toBe(error)
  await b.audio.dispose()
  permission.resolve({ getTracks: () => b.tracks }); await Promise.resolve()
  expect(b.tracks[0]!.stop).toHaveBeenCalledOnce()
})

it('releases a granted microphone when hangup runs before capture takes ownership', async () => {
  const b = fixture(), permission = Promise.withResolvers<{ getTracks: () => typeof b.tracks }>(), lifetime = new AbortController()
  b.getUserMedia.mockReturnValue(permission.promise)
  await b.audio.activate()
  const capturing = b.audio.capture(vi.fn(), vi.fn(), lifetime.signal)
  permission.resolve({ getTracks: () => b.tracks })
  const closing = Promise.withResolvers<undefined>()
  queueMicrotask(() => {
    lifetime.abort()
    void b.audio.dispose().then(() => { closing.resolve(undefined) }, closing.reject)
  })
  await expect(capturing).rejects.toMatchObject({ name: 'AbortError' })
  await closing.promise
  expect(b.tracks[0]!.stop).toHaveBeenCalledOnce()
  expect(b.addModule).not.toHaveBeenCalled()
})

it('reports permission and PCM failures with stable local identities', async () => {
  const b = fixture()
  await b.audio.activate()
  b.getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
  await expect(b.audio.capture(vi.fn(), vi.fn(), new AbortController().signal)).rejects.toMatchObject({ kind: 'permission' })
  expect(() => { b.audio.append('AA==', 24000) }).toThrow(VoiceAudioError)
  await b.audio.dispose()
})

it('refuses unsupported capture APIs and releases contexts whose rate cannot satisfy ASR', async () => {
  const b = fixture()
  b.context.sampleRate = 48000
  await expect(b.audio.activate()).rejects.toMatchObject({ kind: 'unavailable' }); await b.audio.dispose()
  vi.stubGlobal('AudioContext', undefined)
  await expect(new BrowserCallAudio().activate()).rejects.toMatchObject({ kind: 'unavailable' })
})
