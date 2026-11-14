/** Local microphone meters; samples and levels are never persisted or sent to the Host. */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
const listeners = new Map<SessionId, Set<(level: number) => void>>()
/** Subscribe a mounted call visual to its own microphone. */
export function subscribeVoiceLevel(id: SessionId, listener: (level: number) => void): () => void {
  const set = listeners.get(id) ?? new Set()
  listeners.set(id, set); set.add(listener)
  return () => { set.delete(listener); if (!set.size) listeners.delete(id) }
}
/** Publish a bounded RMS level to this Session's visible call. */
export function publishVoiceLevel(id: SessionId, level: number): void {
  for (const listener of listeners.get(id) ?? []) listener(level)
}
