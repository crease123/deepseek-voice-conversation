/** Optional voice-conversation Client entry. */
import type { Context } from '@deepseek-ai/cordis'
import contribution from '@deepseek-ai/dsh-voice-speech-doubao/remote'
import { mountVoiceConversation } from './mount.ts'
import { mountPersonalAgentSettings } from './mount-personal.ts'

export { inject } from './mount.ts'

/**
 * Mount personal prompt settings before calls that use their Host registration.
 * @param ctx - Client runtime.
 * @returns joined disposer.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const personal = await mountPersonalAgentSettings(ctx)
  let voice: () => Promise<void>
  try { voice = await mountVoiceConversation(ctx, contribution) }
  catch (error) { await personal(); throw error }
  return async () => { try { await voice() } finally { await personal() } }
}
