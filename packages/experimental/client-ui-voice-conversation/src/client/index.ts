/** Optional voice-conversation Client entry. */
import type { Context } from '@deepseek-ai/cordis'
import contribution from '@deepseek-ai/dsh-voice-speech-doubao/remote'
import { mountVoiceConversation } from './mount.ts'

export { inject } from './mount.ts'

/**
 * Mount call UI and generated speech methods.
 * @param ctx - Client runtime.
 * @returns joined disposer.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  return await mountVoiceConversation(ctx, contribution)
}
