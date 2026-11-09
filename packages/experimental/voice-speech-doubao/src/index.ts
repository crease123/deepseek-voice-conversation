/** Authenticated Doubao speech operations for optional browser voice calls. */
import { Context, type Volatile } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings/types'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import z from '@deepseek-ai/schemastery'
import { Remote, RemoteError, TypertRemoteService, type RemoteStream } from '@deepseek-ai/dsh-typert-protocol'
import type { VoiceAudioChunk, VoicePreferences, VoiceSpeechCatalog, VoiceStyle, VoiceSynthesisRequest, VoiceTranscript, VoiceTranscriptionRequest } from './types.ts'
import { recognize, recordingPcm, SpeechProviderFailure, synthesizePcm } from './protocol.ts'
import { voicePreferences, voiceSpeakers } from './preferences.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Doubao transcription and synthesis for voice conversations. */
    voiceSpeech: VoiceSpeechDoubao
  }
}

/** Host connection, request limits, and browser recording preferences. */
export interface Config {
  /** Doubao final-result ASR WebSocket URL. */
  asrUrl: string
  /** Doubao unidirectional TTS SSE URL. */
  ttsUrl: string
  /** ASR resource granted to the configured speech credentials. */
  asrResourceId: string
  /** TTS resource matching the selected speaker. */
  ttsResourceId: string
  /** Doubao speaker identifier. */
  speaker: Volatile<string>
  /** Provider speech rate, captured when each synthesis request starts. */
  speechRate: Volatile<number>
  /** Provider pitch adjustment, captured when each synthesis request starts. */
  pitch: Volatile<number>
  /** Instruction preset for speakers with verified support. */
  style: Volatile<VoiceStyle>
  /** Synthesis sample rate in Hz. */
  sampleRate: 16000 | 24000 | 48000
  /** Credential reference for new-console authentication. */
  apiKeyEnv: string
  /** Credential reference for the old-console application identifier. */
  appIdEnv: string
  /** Credential reference for the old-console access token. */
  accessTokenEnv: string
  /** Overall deadline for each provider operation. */
  timeoutMs: number
  /** Maximum decoded WAV bytes. */
  maxAudioBytes: number
  /** Maximum decoded synthesized PCM bytes per request. */
  maxSynthesisBytes: number
  /** Maximum buffered provider message or SSE frame bytes. */
  maxProviderFrameBytes: number
  /** Maximum Unicode code points per synthesis request or transcript. */
  maxTextLength: number
  /** Silence duration ending a browser recording. */
  silenceMs: number
  /** Maximum browser utterance duration. */
  maxUtteranceMs: number
  /** Browser microphone RMS threshold. */
  threshold: Volatile<number>
  /** Sustained speech required before interrupting playback; zero detects immediately. */
  minSpeechMs: Volatile<number>
}

/** Raw plugin configuration; volatile values become stable references after validation. */
export type Options = Partial<{ [K in keyof Config]: Config[K] extends Volatile<infer T> ? T : Config[K] }>

interface Operation {
  controller: AbortController
  signal: AbortSignal
  finish(): void
}

/** Speech audio is transient; the Client owns ordinary Session text submission. */
export default class VoiceSpeechDoubao extends TypertRemoteService {
  static inject = ['credentials', 'typert']
  static Config: z<Options, Config> = z.object({
    asrUrl: z.string().default('wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream'),
    ttsUrl: z.string().default('https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse'),
    asrResourceId: z.string().min(1).default('volc.seedasr.sauc.duration'),
    ttsResourceId: z.string().min(1).default('seed-tts-2.0'),
    speaker: z.string().min(1).default('zh_female_xiaohe_uranus_bigtts').volatile(),
    speechRate: z.number().step(1).min(-50).max(100).default(0).volatile(),
    pitch: z.number().step(1).min(-12).max(12).default(0).volatile(),
    style: z.union(['natural', 'gentle', 'lively']).default('natural').volatile(),
    sampleRate: z.union([24000, 16000, 48000]).default(24000),
    apiKeyEnv: z.string().role('credential-ref').default('SPEECH_API_KEY'),
    appIdEnv: z.string().role('credential-ref').default('SPEECH_APP_ID'),
    accessTokenEnv: z.string().role('credential-ref').default('SPEECH_ACCESS_TOKEN'),
    timeoutMs: z.natural().min(1).max(2147483647).default(60000),
    maxAudioBytes: z.natural().min(46).default(1024 * 1024),
    maxSynthesisBytes: z.natural().min(2).default(8 * 1024 * 1024),
    maxProviderFrameBytes: z.natural().min(128).default(1024 * 1024),
    maxTextLength: z.natural().min(1).default(600),
    silenceMs: z.natural().min(100).default(650),
    maxUtteranceMs: z.natural().min(300).default(15000),
    threshold: z.number().min(0.001).max(1).default(0.012).volatile(),
    minSpeechMs: z.natural().max(1000).default(200).volatile(),
  })

  private readonly lifetime = new AbortController()
  private readonly pending = new Map<AbortController, Promise<void>>()
  private readonly settingsNamespace: SettingsNamespace | undefined

  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'voiceSpeech')
    this.settingsNamespace = ctx.fiber.entry?.options.id as SettingsNamespace | undefined
    credentialRef(config.apiKeyEnv)
    credentialRef(config.appIdEnv)
    credentialRef(config.accessTokenEnv)
    this.validateUrl(config.asrUrl, 'wss:', 'ws:')
    this.validateUrl(config.ttsUrl, 'https:', 'http:')
    this.validatePreferences(config)
    ctx.on('internal/config', (fiber, next) => {
      const raw: unknown = next()
      if (fiber === ctx.fiber) this.validatePreferences(VoiceSpeechDoubao.Config(raw as Options))
      return raw
    })
    ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
    ctx.effect(() => async () => {
      this.lifetime.abort(new Error('Doubao voice service unloaded'))
      await Promise.all(this.pending.values())
    })
  }

  /**
   * Read recording and playback preferences without starting provider requests.
   * @param signal - caller cancellation for this Remote request.
   * @returns safe browser settings; credential values are never included.
   */
  @Remote
  catalog(signal: AbortSignal): VoiceSpeechCatalog {
    signal.throwIfAborted()
    this.lifetime.signal.throwIfAborted()
    const { sampleRate, silenceMs, maxUtteranceMs, maxTextLength } = this.config
    const voice = this.savedVoice()
    const settingsNamespace = this.settingsNamespace
    return { voice, voices: voiceSpeakers(voice.speaker), sampleRate, silenceMs, maxUtteranceMs,
      threshold: this.config.threshold.get(), minSpeechMs: this.config.minSpeechMs.get(), maxTextLength,
      ...settingsNamespace === undefined ? {} : { settingsNamespace } }
  }

  /**
   * Transcribe one complete WAV recording without submitting to an Agent.
   * @param request - canonical base64 16 kHz mono PCM16 WAV.
   * @param signal - caller cancellation; settlement waits for transport cleanup.
   * @returns final recognized text, empty when no speech was recognized.
   */
  @Remote
  async transcribe(request: VoiceTranscriptionRequest, signal: AbortSignal): Promise<VoiceTranscript> {
    const operation = this.begin(signal)
    try {
      let pcm: Buffer
      try { pcm = recordingPcm(request.wavBase64, this.config.maxAudioBytes, this.config.maxUtteranceMs) }
      catch (_invalidRecording) { throw new RemoteError('voice-speech/invalid-request', 'Record a shorter 16 kHz mono PCM16 WAV and try again.', { reason: 'audio' }) }
      const headers = await this.auth('asr')
      operation.signal.throwIfAborted()
      const text = await recognize(pcm, { url: this.config.asrUrl, headers, resourceId: this.config.asrResourceId,
        maxFrameBytes: this.config.maxProviderFrameBytes, maxTextLength: this.config.maxTextLength }, operation.signal)
      return { text }
    } catch (error) { throw this.failure(error, 'asr', operation.signal, signal) }
    finally { operation.finish() }
  }

  /**
   * Stream consecutive PCM16 little-endian mono audio chunks for one sentence.
   * @param request - plain text with optional one-request preview preferences.
   * @param signal - caller cancellation; stops and joins the upstream request.
   * @returns base64 audio chunks; a failure after output leaves partial audio.
   */
  @Remote({ mode: 'stream' })
  async *synthesize(request: VoiceSynthesisRequest, signal: AbortSignal): RemoteStream<VoiceAudioChunk> {
    const operation = this.begin(signal)
    const chunks: VoiceAudioChunk[] = []
    let notify = () => {}
    const state: { done: boolean; failure?: Error } = { done: false }
    const producer = (async () => {
      try {
        const text = request.text.trim()
        if (!text || Array.from(text).length > this.config.maxTextLength) {
          throw new RemoteError('voice-speech/invalid-request', 'Use a shorter nonempty sentence for speech synthesis.', { reason: 'text' })
        }
        let voice: VoicePreferences
        try { voice = voicePreferences(request.voice ?? this.savedVoice(), this.config.speaker.get()) }
        catch (_invalidVoice) { throw new RemoteError('voice-speech/invalid-request', 'Choose a supported voice, delivery style, speech rate, and pitch.', { reason: 'voice' }) }
        const headers = await this.auth('tts')
        operation.signal.throwIfAborted()
        await synthesizePcm(text, { url: this.config.ttsUrl, headers, resourceId: this.config.ttsResourceId,
          voice, sampleRate: this.config.sampleRate, maxFrameBytes: this.config.maxProviderFrameBytes,
          maxAudioBytes: this.config.maxSynthesisBytes }, operation.signal, (audio) => {
          chunks.push({ audio: audio.toString('base64') })
          notify()
        })
      } catch (error) { state.failure = this.failure(error, 'tts', operation.signal, signal) }
      finally { state.done = true; notify(); operation.finish() }
    })()
    try {
      while (true) {
        if (operation.signal.aborted) throw this.failure(operation.signal.reason, 'tts', operation.signal, signal)
        const chunk = chunks.shift()
        if (chunk) { yield chunk; continue }
        if (state.done) break
        await new Promise<void>((resolve) => { notify = resolve })
      }
      if (state.failure !== undefined) throw state.failure
    } finally {
      operation.controller.abort(new Error('Voice synthesis reader closed'))
      await producer
    }
  }

  private savedVoice(config = this.config): VoicePreferences {
    return { speaker: config.speaker.get(), speechRate: config.speechRate.get(), pitch: config.pitch.get(), style: config.style.get() }
  }

  private validatePreferences(config: Config): void {
    voicePreferences(this.savedVoice(config), config.speaker.get())
    if (config.minSpeechMs.get() > config.maxUtteranceMs) throw new Error('minSpeechMs must not exceed maxUtteranceMs')
  }

  private begin(signal: AbortSignal): Operation {
    signal.throwIfAborted()
    this.lifetime.signal.throwIfAborted()
    const controller = new AbortController()
    const done = Promise.withResolvers<void>()
    this.pending.set(controller, done.promise)
    const timer = setTimeout(() => { controller.abort(new DOMException('Speech request timed out', 'TimeoutError')) }, this.config.timeoutMs)
    return {
      controller, signal: AbortSignal.any([signal, controller.signal, this.lifetime.signal]),
      finish: () => { clearTimeout(timer); this.pending.delete(controller); done.resolve() },
    }
  }

  private async auth(operation: 'asr' | 'tts'): Promise<Record<string, string>> {
    const key = await this.ctx.credentials.resolve(credentialRef(this.config.apiKeyEnv))
    if (key?.value) return { 'X-Api-Key': key.value }
    const [app, token] = await Promise.all([
      this.ctx.credentials.resolve(credentialRef(this.config.appIdEnv)),
      this.ctx.credentials.resolve(credentialRef(this.config.accessTokenEnv)),
    ])
    if (!app?.value || !token?.value) {
      throw new RemoteError('voice-speech/missing-credentials', 'Configure speech credentials and enable the selected Doubao ASR and TTS resources.', { operation })
    }
    return { [operation === 'asr' ? 'X-Api-App-Key' : 'X-Api-App-Id']: app.value, 'X-Api-Access-Key': token.value }
  }

  private failure(error: unknown, operation: 'asr' | 'tts', signal: AbortSignal, caller: AbortSignal): Error {
    if (caller.aborted) return caller.reason instanceof Error ? caller.reason : new Error('Speech request cancelled')
    if (this.lifetime.signal.aborted) return new Error('Doubao voice service unloaded')
    if (signal.aborted) return new RemoteError('voice-speech/provider-failed', 'Speech service timed out. Try a shorter utterance or sentence.', { operation, reason: 'timeout' })
    if (error instanceof RemoteError) return error
    const reason = error instanceof SpeechProviderFailure ? error.reason : 'network'
    return new RemoteError('voice-speech/provider-failed', 'Doubao speech failed. Check the configured credentials, resource access, and network before retrying.', { operation, reason })
  }

  private validateUrl(value: string, secure: string, local: string): void {
    const url = new URL(value)
    if (url.username || url.password || url.hash || (url.protocol !== secure
      && !(url.protocol === local && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
      throw new Error(`Doubao voice URL must use ${secure} or a loopback ${local} address without URL credentials`)
    }
  }
}
