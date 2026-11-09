/** Opt-in Doubao round trip uses only speech credentials from the process environment. */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { LocalCredentialProvider } from '@deepseek-ai/dsh-credentials-local'
import { afterEach, describe, expect, it } from 'vitest'
import VoiceSpeechDoubao, { type Options } from '../src/index.ts'

const hasCredentials = Boolean(process.env.SPEECH_API_KEY
  || (process.env.SPEECH_APP_ID && process.env.SPEECH_ACCESS_TOKEN))
const enabled = process.env.DSH_VOICE_REAL_API === '1' && hasCredentials
const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

describe.skipIf(!enabled)('Doubao speech real API', () => {
  it('synthesizes Mandarin PCM and transcribes the resulting WAV', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-doubao-e2e-'))
    cleanups.push(async () => { await rm(home, { recursive: true, force: true }) })
    const ctx = new Context()
    cleanups.push(async () => { await ctx.fiber.dispose() })
    await ctx.plugin(LocalCredentialProvider, { dshHome: home, watch: false })
    const config: Options = { sampleRate: 16000, timeoutMs: 40000 }
    if (process.env.SPEECH_ASR_RESOURCE_ID) config.asrResourceId = process.env.SPEECH_ASR_RESOURCE_ID
    if (process.env.SPEECH_TTS_RESOURCE_ID) config.ttsResourceId = process.env.SPEECH_TTS_RESOURCE_ID
    if (process.env.SPEECH_TTS_SPEAKER) config.speaker = process.env.SPEECH_TTS_SPEAKER
    const api = new VoiceSpeechDoubao(ctx, VoiceSpeechDoubao.Config(config))
    const signal = new AbortController().signal
    const chunks: Buffer[] = []
    for await (const chunk of api.synthesize({ text: '你好，这是一段语音识别测试。' }, signal)) {
      chunks.push(Buffer.from(chunk.audio, 'base64'))
    }
    const pcm = Buffer.concat(chunks)
    expect(pcm.length).toBeGreaterThan(0)
    expect(pcm.length % 2).toBe(0)
    const header = Buffer.alloc(44)
    header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8)
    header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22)
    header.writeUInt32LE(16000, 24); header.writeUInt32LE(32000, 28); header.writeUInt16LE(2, 32)
    header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40)
    const wavBase64 = Buffer.concat([header, pcm]).toString('base64')
    const transcript = await api.transcribe({ wavBase64 }, signal)
    expect(transcript.text.trim()).toMatch(/\p{Script=Han}/u)
  })
})
