/** Compact call activity within the existing composer toolbar. */
import { useEffect } from 'react'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { Button, IconMicrophoneOutlineRegular, IconStopFillRegular, StateDot, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CallState } from './call.ts'
import { NS } from './locales.ts'
import css from './VoiceConversation.module.css'

/** Plain call commands and the renderer-bound state source. */
export interface VoiceConversationInjected {
  /** Begin a call or replace one that ended with an error. */
  start: (sessionId: SessionId) => void
  /** Close the Session's call and release its own audio resources. */
  hangup: (sessionId: SessionId) => void
  hooks: { voiceCalls: HostObservable<ReadonlyMap<SessionId, CallState>> }
}

/** Composer activity props derived from its declared slot and injected contribution. */
export type VoiceConversationProps = Pick<PropsRuntime<'conversation.input.activity'>, 'sessionId' | 'locked' | 'onActiveChange'>
  & PropsLocale<typeof NS> & InjectFace<VoiceConversationInjected>

/** Render a call action, its in-place state, and recoverable failures. */
export function VoiceConversation({ sessionId, locked, onActiveChange, start, hangup, useVoiceCalls, t }: VoiceConversationProps) {
  const state = useVoiceCalls(calls => calls.get(sessionId))
  const active = state !== undefined && state.phase !== 'idle' && state.phase !== 'error'
  useEffect(() => { onActiveChange(active); return () => { onActiveChange(false) } }, [active, onActiveChange])
  useEffect(() => () => { hangup(sessionId) }, [sessionId, hangup])
  if (state === undefined || state.phase === 'idle' || state.phase === 'error') return <div className={css.row} data-voice-conversation={state?.phase ?? 'idle'}>
    <Tooltip label={t(state?.phase === 'error' ? 'retry' : 'start')} portal side="top">
      <Button type="button" size="sm" disabled={locked} aria-label={t(state?.phase === 'error' ? 'retry' : 'start')}
        onClick={() => { start(sessionId) }}><IconMicrophoneOutlineRegular size={18} /></Button>
    </Tooltip>
    {state?.phase === 'error' && <span className={css.error} role="alert">{t(state.failure)}</span>}
  </div>
  return <div className={css.row} data-voice-conversation={state.phase}>
    <span className={css.status} role="status"><StateDot state="ongoing" />{t(state.phase)}</span>
    <Tooltip label={t('hangup')} portal side="top">
      <Button type="button" size="sm" disabled={state.phase === 'stopping'} aria-label={t('hangup')}
        onClick={() => { hangup(sessionId) }}><IconStopFillRegular size={16} /></Button>
    </Tooltip>
  </div>
}
