/** One General settings entry opens the plugin-owned voice preferences dialog. */
import type { HostObservable, InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { useId } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { VoiceSpeaker } from '@deepseek-ai/dsh-voice-speech-doubao/types'
import type { VoiceSettingsController, VoiceSettingsState } from './settings-controller.ts'
import { SETTINGS_NS } from './settings-locales.ts'
import css from './VoiceSettings.module.css'

/** Plain commands and observable panel state shared by both registered entries. */
export interface VoiceSettingsInjected {
  hooks: { voiceSettings: HostObservable<VoiceSettingsState> }
  open: (example: string) => void
  close: () => void
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

/** Props of the optional General settings row. */
export type VoiceSettingsRowProps = Locale & InjectFace<VoiceSettingsInjected>
/**
 * Render the sole fixed entry to voice settings.
 * @param props - panel commands and localized row copy.
 * @returns one General preference row.
 */
export function VoiceSettingsRow({ open, t }: VoiceSettingsRowProps) {
  return <div className={css.row}>
    <div className={css.rowText}><div className={css.rowTitle}>{t('title')}</div><div className={css.hint}>{t('description')}</div></div>
    <Button variant="outline" size="sm" onClick={() => { open(t('exampleDefault')) }}>{t('open')}</Button>
  </div>
}

/** Props of the root-owned settings overlay. */
export type VoiceSettingsDialogProps = Locale & InjectFace<VoiceSettingsInjected>
/**
 * Render one draft editor; preview never submits text to the conversation.
 * @param props - accepted settings state, draft commands and locale.
 * @returns the accessible settings dialog.
 */
export function VoiceSettingsDialog(props: VoiceSettingsDialogProps) {
  const { t, close, edit } = props
  const descriptionId = useId()
  const state = props.useVoiceSettings(value => value), draft = state.draft, catalog = state.catalog
  const voice = catalog?.voices.find(option => option.speaker === draft?.speaker)
  const key = voice && VOICE_KEYS[voice.speaker]
  const disabled = state.busy || !state.writable
  return <Modal open={state.open} onClose={close} title={t('title')} closeLabel={t('close')}
    className={css.dialog ?? ''} contentClassName={css.content ?? ''}
    footer={<div className={css.footer}>
      <Button disabled={disabled || !draft} onClick={props.defaults}>{t('defaults')}</Button>
      <div className={css.footerActions}>
        <Button disabled={state.busy} onClick={close}>{t('cancel')}</Button>
        <Button variant="primary" disabled={disabled || !draft} onClick={() => { void props.apply() }}>{t(state.busy ? 'applying' : 'apply')}</Button>
      </div>
    </div>}>
    {!draft || !catalog ? <p className={css.hint} role={state.failure ? 'alert' : 'status'}>{t(state.failure ?? 'loading')}</p> : <div className={css.fields} data-voice-settings>
      <label className={css.field}><span>{t('speaker')}</span>
        <select data-modal-autofocus aria-label={t('speaker')} aria-describedby={descriptionId}
          value={draft.speaker} disabled={disabled} onChange={(event) => { edit('speaker', event.target.value) }}>
          {catalog.voices.map(option => <option key={option.speaker} value={option.speaker}>{voiceName(option, t)}</option>)}
        </select>
        <span id={descriptionId} className={css.hint}>{key ? t(`${key}Description`) : t('customDescription')}</span>
      </label>
      <label className={css.field}><span className={css.fieldTitle}>{t('speechRate')}<output>{draft.speechRate > 0 ? '+' : ''}{draft.speechRate}%</output></span>
        <input aria-label={t('speechRate')} type="range" min={-50} max={100} step={5} value={draft.speechRate} disabled={disabled}
          onChange={(event) => { edit('speechRate', Number(event.target.value)) }} />
      </label>
      <label className={css.field}><span className={css.fieldTitle}>{t('volume')}<output>{Math.round(draft.volume * 100)}%</output></span>
        <input aria-label={t('volume')} type="range" min={0} max={100} step={5} value={Math.round(draft.volume * 100)} disabled={state.busy}
          onChange={(event) => { edit('volume', Number(event.target.value) / 100) }} /><span className={css.hint}>{t('volumeHint')}</span>
      </label>
      <div className={css.preview}>
        <label className={css.field}><span>{t('example')}</span><textarea aria-label={t('example')} rows={2} maxLength={catalog.maxTextLength}
          value={state.example} disabled={state.busy} onChange={(event) => { props.example(event.target.value) }} /></label>
        <div><Button variant="outline" disabled={state.busy || !state.example.trim()} onClick={() => { if (state.preview) void props.stop(); else props.play() }}>
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
      <details className={css.more}><summary>{t('more')}</summary><div className={css.moreFields}>
        <label className={css.field}><span className={css.fieldTitle}>{t('pitch')}<output>{draft.pitch > 0 ? '+' : ''}{draft.pitch}</output></span>
          <input aria-label={t('pitch')} type="range" min={-12} max={12} step={1} value={draft.pitch} disabled={disabled}
            onChange={(event) => { edit('pitch', Number(event.target.value)) }} /></label>
        <label className={css.field}><span>{t('style')}</span><select value={draft.style} disabled={disabled}
          onChange={(event) => { const style = voice?.styles.find(option => option === event.target.value); if (style) edit('style', style) }}>
          {(voice?.styles ?? ['natural']).map(style => <option key={style} value={style}>{t(style)}</option>)}
        </select></label>
      </div></details>
      <p className={css.hint}>{t(state.writable ? 'changed' : 'readonly')}</p>
      {state.failure && <p role="alert" className={css.error}>{t(state.failure)}</p>}
    </div>}
  </Modal>
}
