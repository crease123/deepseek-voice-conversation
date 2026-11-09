/** Real loopback speech protocols exercise bounds, cancellation, and service teardown. */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { once } from 'node:events'
import { gzipSync, gunzipSync } from 'node:zlib'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebSocketServer } from 'ws'
import VoiceSpeechDoubao, { type Config, type Options, type VoicePreferences } from '../src/index.ts'
import { asrResult, recordingPcm } from '../src/protocol.ts'

const cleanups: Array<() => Promise<void>> = []
interface SynthesisBody { req_params: { speaker: string; audio_params: object; additions: string } }
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup() })

async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = []
  for await (const item of items) values.push(item)
  return values
}

function wave(samples = 1600): Buffer {
  const bytes = Buffer.alloc(44 + samples * 2)
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(samples * 2, 40)
  return bytes
}

function response(text: string, flags = 2): Buffer {
  const payload = gzipSync(Buffer.from(JSON.stringify({ result: { text } })))
  const bytes = Buffer.alloc(8)
  bytes.set([0x11, 0x90 | flags, 0x11, 0]); bytes.writeUInt32BE(payload.length, 4)
  return Buffer.concat([bytes, payload])
}

async function fixture(handler: (request: IncomingMessage, response: ServerResponse) => void = (_request, output) => {
  output.writeHead(200, { 'Content-Type': 'text/event-stream' })
  output.end('data: {"code":0,"data":"AQACAAMA"}\n\ndata: {"code":20000000}\n\n')
}, patch: Options = {}, credentials: Record<string, string> = { SPEECH_API_KEY: 'private-test-key' }, live = false) {
  const server = createServer(handler)
  const sockets = new WebSocketServer({ server, path: '/asr' })
  cleanups.push(async () => {
    for (const socket of sockets.clients) socket.terminate()
    await new Promise<void>((resolve) => { sockets.close(() => { resolve() }) })
    const closed = new Promise<void>((resolve) => { server.close(() => { resolve() }) })
    server.closeAllConnections()
    await closed
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing test server port')
  const ctx = new Context()
  ctx.provide('credentials', { resolve: async (key: string) => credentials[key] === undefined ? undefined : { value: credentials[key], source: 'test' } } as never)
  cleanups.push(async () => { await ctx.fiber.dispose() })
  const raw: Options = { asrUrl: `ws://127.0.0.1:${address.port}/asr`, ttsUrl: `http://127.0.0.1:${address.port}/tts`, ...patch }
  const config = VoiceSpeechDoubao.Config(raw)
  if (!live) return { ctx, api: new VoiceSpeechDoubao(ctx, config), config, sockets, entry: undefined }
  await ctx.plugin(Loader)
  ctx.loader.builtins['voice-test'] = {
    Config: VoiceSpeechDoubao.Config,
    apply: (owner: Context, candidate: Config) => { new VoiceSpeechDoubao(owner, candidate) },
  }
  const id = await ctx.loader.create({ name: 'cordis:voice-test', config: raw })
  const entry = ctx.loader.resolve(id)
  await entry.fiber?.await()
  const api = ctx.get('voiceSpeech')
  if (!api) throw new Error('Missing Loader speech service')
  return { ctx, api, config, sockets, entry }
}

describe('WAV and Doubao binary framing', () => {
  it('admits exact PCM byte and duration limits while rejecting malformed and excessive recordings', () => {
    const bytes = wave()
    expect(recordingPcm(bytes.toString('base64'), bytes.length, 100)).toEqual(bytes.subarray(44))
    for (const encoded of [bytes.toString('base64') + '\n', 'AAAA?', '', Buffer.alloc(44).toString('base64')]) {
      expect(() => recordingPcm(encoded, bytes.length, 100)).toThrow()
    }
    expect(() => recordingPcm(bytes.toString('base64'), bytes.length - 1, 100)).toThrow()
    expect(() => recordingPcm(bytes.toString('base64'), bytes.length, 99)).toThrow()
    const malformed = Buffer.from(bytes); malformed.writeUInt32LE(48000, 24)
    expect(() => recordingPcm(malformed.toString('base64'), malformed.length, 100)).toThrow()
  })

  it('rejects truncated frames, oversized decompression, error frames and malformed JSON', () => {
    expect(asrResult(response('你好'), 1024)).toEqual({ last: true, text: '你好' })
    for (const bytes of [Buffer.alloc(0), response('你好').subarray(0, 9), response('a'.repeat(10000)), Buffer.from([0x11, 0xf0, 0x11, 0, 0, 0, 0, 1, 0, 0, 0, 0])]) {
      expect(() => asrResult(bytes, 1024)).toThrow()
    }
  })
})

it('resolves current credentials, sends gzip ASR frames and reads final text', async () => {
  const f = await fixture()
  const messages: Buffer[] = []
  let auth: string | string[] | undefined
  f.sockets.on('connection', (socket, request) => {
    auth = request.headers['x-api-key']
    socket.on('message', (data) => {
      const bytes = Buffer.isBuffer(data) ? data : Buffer.concat(Array.isArray(data) ? data : [Buffer.from(data)])
      messages.push(bytes)
      if ((bytes[1]! & 2) !== 0) socket.send(response('你好'))
    })
  })
  const bytes = wave()
  expect(await f.api.transcribe({ wavBase64: bytes.toString('base64') }, new AbortController().signal)).toEqual({ text: '你好' })
  expect(auth).toBe('private-test-key')
  expect(JSON.parse(gunzipSync(messages[0]!.subarray(8)).toString())).toMatchObject({ audio: { rate: 16000, channel: 1, bits: 16 } })
  expect(gunzipSync(messages[1]!.subarray(8))).toEqual(bytes.subarray(44))
  expect(f.api.catalog(new AbortController().signal)).not.toHaveProperty('apiKeyEnv')
  expect(() => f.api.catalog(AbortSignal.abort(new Error('caller cancelled')))).toThrow('caller cancelled')
})

it('supports old-console credentials and never exposes provider response secrets', async () => {
  let app: string | string[] | undefined
  let access: string | string[] | undefined
  const f = await fixture((request, output) => {
    app = request.headers['x-api-app-id']; access = request.headers['x-api-access-key']
    output.writeHead(403); output.end('private-provider-content')
  }, {}, { SPEECH_APP_ID: 'test-app', SPEECH_ACCESS_TOKEN: 'private-access-token' })
  const stream = f.api.synthesize({ text: '你好' }, new AbortController().signal)
  await expect(collect(stream)).rejects.toMatchObject({ code: 'voice-speech/provider-failed', details: { operation: 'tts', reason: 'rejected' } })
  expect(app).toBe('test-app'); expect(access).toBe('private-access-token')
  const missing = await fixture(undefined, {}, {})
  await expect(missing.api.transcribe({ wavBase64: wave().toString('base64') }, new AbortController().signal))
    .rejects.toMatchObject({ code: 'voice-speech/missing-credentials' })
})

it('streams audio in order across SSE and PCM split points, requiring explicit completion', async () => {
  const f = await fixture((_request, output) => {
    output.writeHead(200, { 'Content-Type': 'text/event-stream' })
    output.write('event: 352\ndata: {"code":0,"data":"AQ'); output.write('A="}\n\n')
    output.write('event: 352\ndata: {"code":0,"data":"Ag=="}\n\n')
    output.write('event: 351\ndata: {"code":0,"data":null,"sentence":{"text":"你好"}}\n\n')
    output.end('event: 352\ndata: {"code":0,"data":"Aw=="}\n\nevent: 152\ndata: {"code":20000000,"data":null}\n\n')
  })
  const chunks = await collect(f.api.synthesize({ text: '你好' }, new AbortController().signal))
  expect(Buffer.concat(chunks.map(chunk => Buffer.from(chunk.audio, 'base64')))).toEqual(Buffer.from([1, 0, 2, 3]))
  const incomplete = await fixture((_request, output) => { output.writeHead(200, { 'Content-Type': 'text/event-stream' }); output.end('data: {"code":0,"data":"AQACAA=="}\n\n') })
  await expect(collect(incomplete.api.synthesize({ text: '你好' }, new AbortController().signal))).rejects.toMatchObject({ details: { reason: 'protocol' } })
})

it('rejects text and output limits before producing oversized results', async () => {
  let requests = 0
  const f = await fixture((_request, output) => {
    requests++
    output.writeHead(200, { 'Content-Type': 'text/event-stream' })
    output.end('data: {"code":0,"data":"AQACAAMA"}\n\ndata: {"code":20000000}\n\n')
  }, { maxTextLength: 2, maxSynthesisBytes: 4 })
  await expect(collect(f.api.synthesize({ text: '你好啊' }, new AbortController().signal))).rejects.toMatchObject({ code: 'voice-speech/invalid-request' })
  expect(requests).toBe(0)
  await expect(collect(f.api.synthesize({ text: '😀好' }, new AbortController().signal))).rejects.toMatchObject({ details: { reason: 'protocol' } })
  expect(requests).toBe(1)
})

it('validates saved rate, pitch, speech detection, and custom-speaker style preferences', async () => {
  for (const patch of [
    { speechRate: -51 }, { speechRate: 101 }, { speechRate: 0.5 },
    { pitch: -13 }, { pitch: 13 }, { pitch: 0.5 },
    { minSpeechMs: -1 }, { minSpeechMs: 1001 }, { minSpeechMs: 0.5 },
    { threshold: 0 }, { threshold: 1.01 },
  ]) expect(() => VoiceSpeechDoubao.Config(patch)).toThrow()
  for (const patch of [{ speechRate: -50, pitch: -12, minSpeechMs: 0 }, { speechRate: 100, pitch: 12, minSpeechMs: 1000 }]) {
    const f = await fixture(undefined, patch)
    expect(f.api.catalog(new AbortController().signal)).toMatchObject({
      minSpeechMs: patch.minSpeechMs, voice: { speechRate: patch.speechRate, pitch: patch.pitch },
    })
  }
  await expect(fixture(undefined, { minSpeechMs: 1000, maxUtteranceMs: 300 })).rejects.toThrow('minSpeechMs')
  await expect(fixture(undefined, { speaker: 'deployment-speaker', style: 'gentle' })).rejects.toThrow('delivery style')
  const custom = await fixture(undefined, { speaker: 'deployment-speaker' })
  expect(custom.api.catalog(new AbortController().signal).voices).toContainEqual({
    speaker: 'deployment-speaker', name: 'deployment-speaker', styles: ['natural'],
  })
})

it('sends complete preview preferences without changing saved defaults', async () => {
  const bodies: SynthesisBody[] = []
  const f = await fixture((request, output) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => { chunks.push(chunk) })
    request.on('end', () => {
      bodies.push(JSON.parse(Buffer.concat(chunks).toString()) as SynthesisBody)
      output.writeHead(200, { 'Content-Type': 'text/event-stream' })
      output.end('event: 352\ndata: {"code":0,"data":"AQACAA=="}\n\nevent: 152\ndata: {"code":20000000,"data":null}\n\n')
    })
  })
  const signal = new AbortController().signal
  const before = f.api.catalog(signal).voice
  for (const style of ['gentle', 'lively'] as const) {
    await collect(f.api.synthesize({ text: '你好', voice: { speaker: 'zh_female_vv_uranus_bigtts', speechRate: 50, pitch: -4, style } }, signal))
    expect(f.api.catalog(signal).voice).toEqual(before)
  }
  await collect(f.api.synthesize({ text: '你好' }, signal))
  expect(bodies[0]?.req_params).toMatchObject({
    speaker: 'zh_female_vv_uranus_bigtts', audio_params: { format: 'pcm', sample_rate: 24000, speech_rate: 50 },
  })
  expect(JSON.parse(bodies[0]!.req_params.additions)).toEqual({ post_process: { pitch: -4 }, context_texts: ['请用轻柔、温和的语气说话。'] })
  expect(JSON.parse(bodies[1]!.req_params.additions)).toEqual({ post_process: { pitch: -4 }, context_texts: ['请用轻快、有活力的语气说话。'] })
  expect(bodies[2]?.req_params).toMatchObject({ speaker: before.speaker, audio_params: { speech_rate: 0 } })
  expect(JSON.parse(bodies[2]!.req_params.additions)).toEqual({ post_process: { pitch: 0 } })
})

it('rejects invalid and unsupported preview preferences before contacting the provider', async () => {
  let requests = 0
  const f = await fixture((_request, output) => { requests++; output.end() }, { speaker: 'deployment-speaker' })
  const voice: VoicePreferences = { speaker: 'zh_female_xiaohe_uranus_bigtts', speechRate: 0, pitch: 0, style: 'natural' }
  for (const patch of [{ speaker: 'unknown-speaker' }, { speechRate: 101 }, { pitch: 0.5 }, { speaker: 'deployment-speaker', style: 'gentle' as const }]) {
    await expect(collect(f.api.synthesize({ text: '你好', voice: { ...voice, ...patch } }, new AbortController().signal)))
      .rejects.toMatchObject({ code: 'voice-speech/invalid-request', details: { reason: 'voice' } })
  }
  expect(requests).toBe(0)
})

it('updates live preferences without remounting or changing an accepted synthesis request', async () => {
  const started = Promise.withResolvers<undefined>()
  const release = Promise.withResolvers<undefined>()
  const bodies: SynthesisBody[] = []
  const f = await fixture((request, output) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => { chunks.push(chunk) })
    request.on('end', () => {
      bodies.push(JSON.parse(Buffer.concat(chunks).toString()) as SynthesisBody)
      output.writeHead(200, { 'Content-Type': 'text/event-stream' }); output.flushHeaders()
      started.resolve(undefined)
      const finish = () => { output.end('data: {"code":0,"data":"AQACAA=="}\n\ndata: {"code":20000000,"data":null}\n\n') }
      if (bodies.length === 1) void release.promise.then(finish)
      else finish()
    })
  }, {}, undefined, true)
  const entry = f.entry
  if (!entry) throw new Error('Missing live speech entry')
  const fiber = entry.fiber
  const signal = new AbortController().signal
  expect(f.api.catalog(signal).settingsNamespace).toBe(entry.options.id)
  const pending = collect(f.api.synthesize({ text: '你好' }, signal))
  await started.promise
  const next = { speaker: 'zh_male_m191_uranus_bigtts', speechRate: 25, pitch: 3, style: 'lively' as const, threshold: 0.03, minSpeechMs: 400 }
  const raw = { ...entry.options.config as Options, ...next }
  entry.fiber?.resolveConfig(raw)
  await entry.update({ config: raw })
  await entry.fiber?.await()
  expect(entry.fiber === fiber).toBe(true)
  expect(f.api.catalog(signal)).toMatchObject({ voice: { speaker: next.speaker, speechRate: 25, pitch: 3, style: 'lively' }, threshold: 0.03, minSpeechMs: 400 })
  expect(() => entry.fiber?.resolveConfig({ ...raw, maxUtteranceMs: 300 })).toThrow('minSpeechMs')
  expect(() => entry.fiber?.resolveConfig({ ...raw, speaker: 'custom-without-instructions' })).toThrow('delivery style')
  release.resolve(undefined)
  expect(await pending).toEqual([{ audio: 'AQACAA==' }])
  await collect(f.api.synthesize({ text: '再见' }, signal))
  expect(bodies[0]?.req_params).toMatchObject({ speaker: 'zh_female_xiaohe_uranus_bigtts', audio_params: { speech_rate: 0 } })
  expect(JSON.parse(bodies[0]!.req_params.additions)).toEqual({ post_process: { pitch: 0 } })
  expect(bodies[1]?.req_params).toMatchObject({ speaker: next.speaker, audio_params: { speech_rate: 25 } })
  expect(JSON.parse(bodies[1]!.req_params.additions)).toEqual({ post_process: { pitch: 3 }, context_texts: ['请用轻快、有活力的语气说话。'] })
})

it('caller cancellation joins ASR socket closure before rejecting', async () => {
  const f = await fixture()
  const connected = Promise.withResolvers<undefined>()
  const peerClosed = Promise.withResolvers<undefined>()
  f.sockets.on('connection', (socket) => { connected.resolve(undefined); socket.once('close', () => { peerClosed.resolve(undefined) }) })
  const lifetime = new AbortController()
  const result = f.api.transcribe({ wavBase64: wave().toString('base64') }, lifetime.signal)
  const outcome = expect(result).rejects.toThrow('caller cancelled')
  await connected.promise
  lifetime.abort(new Error('caller cancelled'))
  await outcome
  await peerClosed.promise
})

it('service disposal aborts and joins active HTTP synthesis even when its consumer is waiting', async () => {
  const started = Promise.withResolvers<undefined>()
  const peerClosed = Promise.withResolvers<undefined>()
  const f = await fixture((_request, output) => {
    output.writeHead(200, { 'Content-Type': 'text/event-stream' }); output.flushHeaders()
    output.once('close', () => { peerClosed.resolve(undefined) }); started.resolve(undefined)
  })
  const iterator = f.api.synthesize({ text: '你好' }, new AbortController().signal)[Symbol.asyncIterator]()
  const outcome = expect(iterator.next()).rejects.toThrow('unloaded')
  await started.promise
  await f.ctx.fiber.dispose()
  await outcome
  await peerClosed.promise
  expect(() => f.api.catalog(new AbortController().signal)).toThrow('unloaded')
  await expect(f.api.transcribe({ wavBase64: wave().toString('base64') }, new AbortController().signal)).rejects.toThrow('unloaded')
})

it('service disposal closes the upstream stream while its consumer is paused after a chunk', async () => {
  const peerClosed = Promise.withResolvers<undefined>()
  const f = await fixture((_request, output) => {
    output.writeHead(200, { 'Content-Type': 'text/event-stream' })
    output.write('data: {"code":0,"data":"AQACAA=="}\n\n')
    output.once('close', () => { peerClosed.resolve(undefined) })
  })
  const iterator = f.api.synthesize({ text: '你好' }, new AbortController().signal)[Symbol.asyncIterator]()
  expect((await iterator.next()).value).toEqual({ audio: 'AQACAA==' })
  await f.ctx.fiber.dispose()
  await peerClosed.promise
  await expect(iterator.next()).rejects.toThrow('unloaded')
})

it('reports the configured deadline and closes the unfinished provider response', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  try {
    const started = Promise.withResolvers<undefined>()
    const peerClosed = Promise.withResolvers<undefined>()
    const f = await fixture((_request, output) => {
      output.writeHead(200, { 'Content-Type': 'text/event-stream' }); output.flushHeaders()
      output.once('close', () => { peerClosed.resolve(undefined) }); started.resolve(undefined)
    }, { timeoutMs: 1000 })
    const outcome = collect(f.api.synthesize({ text: '你好' }, new AbortController().signal)).then(() => undefined, (error: unknown) => error)
    await started.promise
    await vi.advanceTimersByTimeAsync(1000)
    expect(await outcome).toMatchObject({ code: 'voice-speech/provider-failed', details: { operation: 'tts', reason: 'timeout' } })
    await peerClosed.promise
  } finally { vi.useRealTimers() }
})
