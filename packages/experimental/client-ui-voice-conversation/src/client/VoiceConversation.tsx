/** Compact call activity within the existing composer toolbar. */
import { useEffect, useRef } from 'react'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { Button, IconMicrophoneOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CallState } from './call.ts'
import { NS } from './locales.ts'
import { subscribeVoiceLevel } from './levels.ts'
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
  const panel = useRef<HTMLDivElement>(null)
  const state = useVoiceCalls(calls => calls.get(sessionId))
  const active = state !== undefined && state.phase !== 'idle' && state.phase !== 'error'
  useEffect(() => {
    if (!active) return
    return subscribeVoiceLevel(sessionId, level => { panel.current?.style.setProperty('--voice-level', String(level)) })
  }, [active, sessionId])
  useEffect(() => { onActiveChange(active); return () => { onActiveChange(false) } }, [active, onActiveChange])
  useEffect(() => () => { hangup(sessionId) }, [sessionId, hangup])
  if (state === undefined || state.phase === 'idle' || state.phase === 'error') return <div className={css.row} data-voice-conversation={state?.phase ?? 'idle'}>
    <Tooltip label={t(state?.phase === 'error' ? 'retry' : 'start')} portal side="top">
      <Button type="button" size="sm" disabled={locked} aria-label={t(state?.phase === 'error' ? 'retry' : 'start')}
        onClick={() => { start(sessionId) }}><IconMicrophoneOutlineRegular size={18} /></Button>
    </Tooltip>
    {state?.phase === 'error' && <span className={css.error} role="alert">{t(state.failure)}</span>}
  </div>
  return <div ref={panel} className={css.call} data-voice-active data-voice-conversation={state.phase}>
    <div className={css.bars} aria-hidden="true" data-voice-bars>
      <span /><span /><span /><span /><span />
    </div>
    <span className={css.status} role="status">{t(state.phase)}</span>
    {state.warning && <span className={css.error} role="alert">{t(state.warning)}</span>}
    <Tooltip label={t('hangup')} portal side="top">
      <Button type="button" size="sm" disabled={state.phase === 'stopping'} aria-label={t('hangup')}
        onClick={() => { hangup(sessionId) }}><span aria-hidden>☎</span><span>{t('hangup')}</span></Button>
    </Tooltip>
  </div>
}
