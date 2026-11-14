/** Browser-safe request, catalog, and audio types for Doubao voice calls. */
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings/types'

/** Delivery styles available on voices with verified instruction support. */
export type VoiceStyle = 'natural' | 'gentle' | 'lively'

/** Complete synthesis selection, saved on the Host or supplied for one preview. */
export interface VoicePreferences {
  /** Doubao speaker identifier. */
  speaker: string
  /** Integer provider rate from -50 through 100; zero keeps the original rate. */
  speechRate: number
  /** Integer provider pitch adjustment from -12 through 12. */
  pitch: number
  /** Instruction preset; natural sends no style instruction. */
  style: VoiceStyle
}

/** One compatible speaker and its supported instruction presets. */
export interface VoiceSpeaker {
  /** Doubao speaker identifier. */
  speaker: string
  /** Official speaker name; a custom speaker uses its configured identifier. */
  name: string
  /** Styles verified for this speaker; unknown custom speakers allow natural only. */
  styles: VoiceStyle[]
}

/** Recording and playback settings shared with the voice-call Client. */
export interface VoiceSpeechCatalog {
  /** Reference names only; secret values never leave the Host. */
  credentialRefs?: { apiKey: string; appId: string; accessToken: string }
  asrProvider?: 'deepseek' | 'doubao'
  ttsProvider?: 'deepseek' | 'doubao'
  deepseekSpeaker?: 'stella' | 'tide'
  /** Current saved selection; a request preview never changes it. */
  voice: VoicePreferences
  /** Compatible speaker presets, including the configured custom speaker when needed. */
  voices: VoiceSpeaker[]
  /** Loader entry id used by ConfigForm; absent outside a profile composition. */
  settingsNamespace?: SettingsNamespace
  /** Mono PCM16 synthesis sample rate in Hz. */
  sampleRate: number
  /** Silence duration ending one recorded utterance. */
  silenceMs: number
  /** Maximum duration of one utterance. */
  maxUtteranceMs: number
  /** Minimum microphone RMS treated as speech. */
  threshold: number
  /** Minimum sustained microphone speech before interrupting playback. */
  minSpeechMs: number
  /** Maximum Unicode code points accepted by one synthesis request. */
  maxTextLength: number
}

/** One complete 16 kHz mono PCM16 WAV, encoded as canonical base64. */
export interface VoiceTranscriptionRequest {
  /** Complete WAV bytes; audio remains transient. */
  wavBase64: string
}

/** Final recognized text, ready for the Client's ordinary Session submission. */
export interface VoiceTranscript {
  /** Recognized text; an empty string means no speech was recognized. */
  text: string
}

/** One sentence to synthesize using the configured voice. */
export interface VoiceSynthesisRequest {
  deepseekSpeaker?: 'stella' | 'tide'
  /** Plain text to speak. */
  text: string
  /** Complete preview selection; omission captures the current saved Host defaults. */
  voice?: VoicePreferences
}

/** One consecutive PCM16 little-endian mono audio chunk. */
export interface VoiceAudioChunk {
  /** Actual rate for this request, including after provider changes. */
  sampleRate?: number
  /** Canonical base64 audio, using the catalog's sample rate. */
  audio: string
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** Invalid recording, synthesis text, or configured limit. */
    'voice-speech/invalid-request': { reason: 'audio' | 'text' | 'voice' | 'limit' }
    /** Neither supported credential combination resolved. */
    'voice-speech/missing-credentials': { operation: 'asr' | 'tts' }
    /** Speech provider failure; partial synthesis may already have been emitted. */
    'voice-speech/provider-failed': { operation: 'asr' | 'tts'; reason: 'network' | 'protocol' | 'rejected' | 'timeout' }
  }
}
