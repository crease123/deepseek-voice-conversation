/** Verified Seed TTS 2.0 speakers and complete request-local preference validation. */
import { z } from 'zod'
import type { VoicePreferences, VoiceSpeaker, VoiceStyle } from './types.ts'

const speakers = [
  { speaker: 'zh_female_xiaohe_uranus_bigtts', name: '小何 2.0' },
  { speaker: 'zh_female_vv_uranus_bigtts', name: 'Vivi 2.0' },
  { speaker: 'zh_male_m191_uranus_bigtts', name: '云舟 2.0' },
  { speaker: 'zh_male_taocheng_uranus_bigtts', name: '小天 2.0' },
] as const

const preferenceSchema = z.object({
  speaker: z.string().min(1),
  speechRate: z.number().int().min(-50).max(100),
  pitch: z.number().int().min(-12).max(12),
  style: z.enum(['natural', 'gentle', 'lively']),
})

/**
 * Describe compatible built-in speakers and the deployment's own selected speaker.
 * @param configuredSpeaker - saved custom speaker, when outside the verified presets.
 * @returns detached choices; unverified speakers expose natural delivery only.
 */
export function voiceSpeakers(configuredSpeaker: string): VoiceSpeaker[] {
  const choices: VoiceSpeaker[] = speakers.map(voice => ({ ...voice, styles: ['natural', 'gentle', 'lively'] }))
  if (!choices.some(voice => voice.speaker === configuredSpeaker)) {
    choices.push({ speaker: configuredSpeaker, name: configuredSpeaker, styles: ['natural'] })
  }
  return choices
}

/**
 * Validate complete preferences and the selected speaker's instruction capability.
 * @param value - preview JSON or resolved saved preferences.
 * @param configuredSpeaker - deployment-owned custom speaker admitted alongside presets.
 * @returns detached validated preferences; incompatible styles or unknown speakers throw.
 */
export function voicePreferences(value: unknown, configuredSpeaker: string): VoicePreferences {
  const voice = preferenceSchema.parse(value)
  const speaker = voiceSpeakers(configuredSpeaker).find(item => item.speaker === voice.speaker)
  if (!speaker?.styles.includes(voice.style)) throw new Error('Unsupported speech voice or delivery style')
  return voice
}

/**
 * Resolve a fixed instruction preset without modifying the text to be spoken.
 * @param style - validated speaker-compatible style.
 * @returns no instruction for natural delivery, otherwise the provider's first context instruction.
 */
export function voiceInstruction(style: VoiceStyle): string | undefined {
  switch (style) {
    case 'natural': return undefined
    case 'gentle': return '请用轻柔、温和的语气说话。'
    case 'lively': return '请用轻快、有活力的语气说话。'
  }
}
