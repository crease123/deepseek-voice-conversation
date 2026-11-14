/** Editable personal instructions and a read-only preview of the saved rule layers. */
import { useEffect, useState } from 'react'
import type { HostObservable, InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { Button, IconLoadingOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PersonalSettingsController, PersonalSettingsState } from './personal-settings-controller.ts'
import { PERSONAL_NS } from './personal-locales.ts'
import css from './PersonalAgentSettings.module.css'

/** The page receives only its own observable state and narrow editor commands. */
export interface PersonalAgentSettingsInjected {
  hooks: { personalSettings: HostObservable<PersonalSettingsState> }
  open: () => void
  close: () => void
  edit: PersonalSettingsController['edit']
  cancel: () => void
  apply: () => Promise<void>
}
/** Localized page props from its settings contribution. */
export type PersonalAgentSettingsProps = PropsLocale<typeof PERSONAL_NS> & InjectFace<PersonalAgentSettingsInjected>

/**
 * Render the two prompt layers without applying unsaved drafts to the Agent.
 * @param props - bound editor state, commands and locale.
 * @returns one personal Agent settings page.
 */
export function PersonalAgentSettings({ open, close, edit, cancel, apply, usePersonalSettings, t }: PersonalAgentSettingsProps) {
  const state = usePersonalSettings(value => value)
  const [preview, setPreview] = useState<'text' | 'call'>('text')
  useEffect(() => { open(); return close }, [open, close])
  const disabled = state.busy || !state.writable
  return <section className={css.section} data-personal-agent-settings>
    <header className={css.header}><h2 className={css.title}>{t('title')}</h2><p className={css.hint}>{t('description')}</p></header>
    {!state.draft ? state.failure ? <div className={css.error} role="alert">{t(state.failure)}</div>
      : <div className={css.loading} role="status" aria-label={t('loading')}><IconLoadingOutlineRegular className={css.spinner} size={20} /></div> : <>
      <p className={css.hint}>{t('usage')}</p>
      <label className={css.field}><span className={css.label}>{t('basePrompt')}</span><span className={css.hint}>{t('baseHint')}</span>
        <textarea aria-label={t('basePrompt')} rows={8} disabled={disabled} value={state.draft.basePrompt}
          onChange={(event) => { edit('basePrompt', event.target.value) }} /></label>
      <label className={css.field}><span className={css.label}>{t('callPrompt')}</span><span className={css.hint}>{t('callHint')}</span>
        <textarea aria-label={t('callPrompt')} rows={7} disabled={disabled} value={state.draft.callPrompt}
          onChange={(event) => { edit('callPrompt', event.target.value) }} /></label>
      <div className={css.actions}><p className={css.hint}>{t(state.writable ? 'timing' : 'readonly')}</p><div className={css.buttons}>
        <Button disabled={state.busy || (!state.dirty && !state.failure)} onClick={cancel}>{t('cancel')}</Button>
        <Button variant="primary" disabled={disabled || !state.dirty} onClick={() => { void apply() }}>{t(state.busy ? 'saving' : 'save')}</Button>
      </div></div>
      <div className={css.feedback} aria-live="polite">{state.failure && <p role="alert" className={css.error}>{t(state.failure)}</p>}</div>
      <details className={css.preview}><summary>{t('preview')}</summary><div className={css.previewContent}>
        <label className={css.previewMode}><span>{t('previewMode')}</span><select aria-label={t('previewMode')} value={preview}
          onChange={(event) => { setPreview(event.target.value === 'call' ? 'call' : 'text') }}>
          <option value="text">{t('textMode')}</option><option value="call">{t('callMode')}</option></select></label>
        <p className={css.hint}>{t('previewHint')}</p>
        <pre className={css.rules} aria-label={t('savedRules')}>{state.saved?.basePrompt}{preview === 'call' && state.saved?.callPrompt ? `\n\n${state.saved.callPrompt}` : ''}</pre>
      </div></details>
    </>}
  </section>
}
