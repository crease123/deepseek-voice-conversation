/** Dedicated voice settings page in the settings navigation. */
import type { HostObservable, InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useId } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { VoiceSpeaker } from '@deepseek-ai/dsh-voice-speech-doubao/types'
import type { VoiceSettingsController, VoiceSettingsState } from './settings-controller.ts'
import { SETTINGS_NS } from './settings-locales.ts'
import css from './VoiceSettings.module.css'

/** Commands and observable state owned by the dedicated settings section. */
export interface VoiceSettingsInjected {
  hooks: { voiceSettings: HostObservable<VoiceSettingsState> }
  open: (example: string) => void
  close: () => void
  credential?: (key: 'apiKey' | 'appId' | 'accessToken', value: string) => void
  edit: VoiceSettingsController['edit']
  example: (text: string) => void
  play: () => void
  stop: () => Promise<void>
  defaults: () => void
  apply: () => Promise<void>
}
type Locale = PropsLocale<typeof SETTINGS_NS>
type VoiceKey = 'xiaohe' | 'vivi' | 'yunzhou' | 'xiaotian'
const VOICE_KEYS: Readonly<Record<string, VoiceKey>> = {
  zh_female_xiaohe_uranus_bigtts: 'xiaohe', zh_female_vv_uranus_bigtts: 'vivi',
  zh_male_m191_uranus_bigtts: 'yunzhou', zh_male_taocheng_uranus_bigtts: 'xiaotian',
}
function voiceName(voice: VoiceSpeaker, t: Locale['t']): string { const key = VOICE_KEYS[voice.speaker]; return key ? t(key) : voice.name }

/** Localized settings section props. */
export type VoiceSettingsPageProps = Locale & InjectFace<VoiceSettingsInjected>
/** Render voice preferences directly in the settings section; leaving stops previews. */
export function VoiceSettingsPage(props: VoiceSettingsPageProps) {
  const { t, close, edit } = props
  const descriptionId = useId()
  const state = props.useVoiceSettings(value => value), draft = state.draft, catalog = state.catalog
  useEffect(() => { if (!state.open) props.open(t('exampleDefault')) }, [state.open, props.open, t])
  useEffect(() => close, [close])
  const voice = catalog?.voices.find(option => option.speaker === draft?.speaker)
  const key = voice && VOICE_KEYS[voice.speaker]
  const disabled = state.busy || !state.writable
  const actions = <div className={css.footer}>
      <Button disabled={disabled || !draft} onClick={props.defaults}>{t('defaults')}</Button>
      <div className={css.footerActions}>
        <Button disabled={state.busy} onClick={close}>{t('cancel')}</Button>
        <Button variant="primary" disabled={disabled || !draft} onClick={() => { void props.apply() }}>{t(state.busy ? 'applying' : 'apply')}</Button>
      </div>
    </div>
  return <section className={css.page} data-voice-settings-page>
    <header className={css.header}><h2 className={css.title}>{t('title')}</h2><p className={css.hint}>{t('description')}</p></header>
    {!draft || !catalog ? <p className={css.hint} role={state.failure ? 'alert' : 'status'}>{t(state.failure ?? 'loading')}</p> : <div className={css.fields} data-voice-settings>
      {(['asrProvider', 'ttsProvider'] as const).map(field => <label key={field} className={css.field}><span>{t(field)}</span>
        <select aria-label={t(field)} value={draft[field] ?? 'deepseek'} disabled={disabled || state.preview} onChange={event => { if (event.target.value === 'deepseek' || event.target.value === 'doubao') edit(field, event.target.value) }}>
          <option value="deepseek">DeepSeek</option><option value="doubao">{t('doubao')}</option>
        </select></label>)}
      <p className={css.hint}>{t('providerHint')}</p>
      {(draft.asrProvider === 'doubao' || draft.ttsProvider === 'doubao') && <section className={css.detection} aria-label={t('doubaoCredentials')}>
        <div className={css.groupTitle}>{t('doubaoCredentials')}</div>
        <p className={css.hint}>{t('credentialHint')}</p>
        {state.credentials ? (['apiKey', 'appId', 'accessToken'] as const).map(field => <label className={css.field} key={field}>
          <span>{t(field)} · {t(state.credentials![field].configured ? 'configured' : 'notConfigured')}</span>
          <input type="password" aria-label={t(field)} autoComplete="new-password" spellCheck={false}
            placeholder={t(state.credentials![field].configured ? 'keepCredential' : 'enterCredential')}
            value={state.credentialDraft?.[field] ?? ''} disabled={disabled || !state.credentials![field].writable}
            onChange={event => props.credential?.(field, event.target.value)} />
        </label>) : <p className={css.hint}>{t('credentialsUnavailable')}</p>}
      </section>}
      {draft.ttsProvider !== 'doubao' && <label className={css.field}><span>{t('speaker')}</span><select aria-label={t('speaker')} value={draft.deepseekSpeaker ?? 'stella'} disabled={disabled} onChange={event => { if (event.target.value === 'stella' || event.target.value === 'tide') edit('deepseekSpeaker', event.target.value) }}><option value="stella">Stella</option><option value="tide">Tide</option></select></label>}
      {draft.ttsProvider === 'doubao' && <><label className={css.field}><span>{t('speaker')}</span>
        <select aria-label={t('speaker')} aria-describedby={descriptionId}
          value={draft.speaker} disabled={disabled} onChange={(event) => { edit('speaker', event.target.value) }}>
          {catalog.voices.map(option => <option key={option.speaker} value={option.speaker}>{voiceName(option, t)}</option>)}
        </select>
        <span id={descriptionId} className={css.hint}>{key ? t(`${key}Description`) : t('customDescription')}</span>
      </label>
      <label className={css.field}><span className={css.fieldTitle}>{t('speechRate')}<output>{draft.speechRate > 0 ? '+' : ''}{draft.speechRate}%</output></span>
        <input aria-label={t('speechRate')} type="range" min={-50} max={100} step={5} value={draft.speechRate} disabled={disabled}
          onChange={(event) => { edit('speechRate', Number(event.target.value)) }} />
      </label>
      </>}
      <label className={css.field}><span className={css.fieldTitle}>{t('volume')}<output>{Math.round(draft.volume * 100)}%</output></span>
        <input aria-label={t('volume')} type="range" min={0} max={100} step={5} value={Math.round(draft.volume * 100)} disabled={state.busy}
          onChange={(event) => { edit('volume', Number(event.target.value) / 100) }} /><span className={css.hint}>{t('volumeHint')}</span>
      </label>
      <div className={css.preview}>
        <label className={css.field}><span>{t('example')}</span><textarea aria-label={t('example')} rows={2} maxLength={catalog.maxTextLength}
          value={state.example} disabled={state.busy} onChange={(event) => { props.example(event.target.value) }} /></label>
        <div><Button variant="outline" disabled={state.busy || !state.example.trim() || draft.ttsProvider !== catalog.ttsProvider} onClick={() => { if (state.preview) void props.stop(); else props.play() }}>
          {t(state.preview ? 'stop' : 'preview')}
        </Button></div><p className={css.hint}>{t('previewHint')}</p>
      </div>
      <section className={css.detection} aria-label={t('detection')}>
        <div className={css.groupTitle}>{t('detection')}</div>
        <label className={css.field}><span className={css.fieldTitle}>{t('threshold')}<output>{t('rms')} {draft.threshold.toFixed(3)}</output></span>
          <input aria-label={t('threshold')} type="range" min={0} max={100} step={1} value={Math.round(-Math.log10(draft.threshold) * 100 / 3)} disabled={disabled}
            onChange={(event) => { edit('threshold', 10 ** (-Number(event.target.value) * 3 / 100)) }} />
          <span className={css.ends}><span>{t('lower')}</span><span>{t('higher')}</span></span><span className={css.hint}>{t('thresholdHint')}</span>
        </label>
        <label className={css.field}><span className={css.fieldTitle}>{t('minSpeech')}<output>{draft.minSpeechMs} {t('milliseconds')}</output></span>
          <input aria-label={t('minSpeech')} type="range" min={0} max={Math.min(1000, catalog.maxUtteranceMs)} step={50} value={draft.minSpeechMs} disabled={disabled}
            onChange={(event) => { edit('minSpeechMs', Number(event.target.value)) }} /><span className={css.hint}>{t('minSpeechHint')}</span>
        </label>
      </section>
      {draft.ttsProvider === 'doubao' && <details className={css.more}><summary>{t('more')}</summary><div className={css.moreFields}>
        <label className={css.field}><span className={css.fieldTitle}>{t('pitch')}<output>{draft.pitch > 0 ? '+' : ''}{draft.pitch}</output></span>
          <input aria-label={t('pitch')} type="range" min={-12} max={12} step={1} value={draft.pitch} disabled={disabled}
            onChange={(event) => { edit('pitch', Number(event.target.value)) }} /></label>
        <label className={css.field}><span>{t('style')}</span><select value={draft.style} disabled={disabled}
          onChange={(event) => { const style = voice?.styles.find(option => option === event.target.value); if (style) edit('style', style) }}>
          {(voice?.styles ?? ['natural']).map(style => <option key={style} value={style}>{t(style)}</option>)}
        </select></label>
      </div></details>}
      <p className={css.hint}>{t(state.writable ? 'changed' : 'readonly')}</p>
      {state.failure && <p role="alert" className={css.error}>{t(state.failure)}</p>}
    </div>}
    {actions}
  </section>
}
