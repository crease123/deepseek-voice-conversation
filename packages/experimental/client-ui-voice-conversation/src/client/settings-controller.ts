/** Draft voice preferences, local volume, and one independently cancellable preview. */
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { VoicePreferences, VoiceSpeechCatalog } from '@deepseek-ai/dsh-voice-speech-doubao/types'
import type { CallAudio } from './audio.ts'
import type { SpeechRemote } from './call.ts'

/** Host-owned fields editable by the voice settings form. */
export interface VoiceSettingsValues extends VoicePreferences { threshold: number; minSpeechMs: number }
/** A panel draft includes device-local gain without adding it to Host settings. */
export interface VoiceSettingsDraft extends VoiceSettingsValues { volume: number }
/** Immutable panel state; opening starts a new draft from accepted values. */
export interface VoiceSettingsState {
  open: boolean
  catalog?: VoiceSpeechCatalog
  draft?: VoiceSettingsDraft
  example: string
  busy: boolean
  preview: boolean
  writable: boolean
  failure?: 'loadError' | 'previewError' | 'saveError' | undefined
}
/** Settings services and audio resources owned by this plugin instance. */
export interface VoiceSettingsDependencies {
  remote: SpeechRemote
  form: (namespace: string) => ConfigForm<VoiceSettingsValues>
  ensure: () => Promise<void>
  inherited: (namespace: string, base: unknown) => VoiceSettingsValues
  audio: (volume: () => number) => CallAudio
  pauseCalls: () => Promise<() => Promise<void>>
  volume: SnapshotStore<{ volume: number }>
}

function gain(value: number): number { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1 }

/**
 * Create this client's persisted playback gain; Host and Session data are excluded.
 * @returns one store for the plugin's entire mounted lifetime.
 */
export function createVoiceVolume(): SnapshotStore<{ volume: number }> {
  const store = createSnapshotStore({ volume: 1 }, { persist: { name: 'dsh.voice-conversation.volume.v1' } })
  store.set({ volume: gain(store.getSnapshot().volume) })
  return store
}

/** One settings owner, shared by the General row and the root overlay. */
export class VoiceSettingsController {
  /** Shared observable draft and operation state for the row and dialog. */
  readonly state = createSnapshotStore<VoiceSettingsState>({ open: false, example: '', busy: false, preview: false, writable: false })
  private readonly lifetime = new AbortController()
  private panel = new AbortController()
  private form: ConfigForm<VoiceSettingsValues> | undefined
  private revision: number | undefined
  private resetFields = false
  private readonly tasks = new Set<Promise<void>>()
  private preview: { abort: AbortController; audio: CallAudio; done: Promise<void> } | undefined
  private disposal: Promise<void> | undefined

  constructor(private readonly dependencies: VoiceSettingsDependencies) {}

  /**
   * Open a fresh draft without changing saved preferences.
   * @param example - locale-owned default preview text.
   */
  open(example: string): void {
    if (this.lifetime.signal.aborted || this.state.getSnapshot().open) return
    this.panel = new AbortController()
    this.resetFields = false
    this.state.set({ open: true, example, busy: false, preview: this.preview !== undefined, writable: false })
    const signal = AbortSignal.any([this.panel.signal, this.lifetime.signal])
    void this.track((async () => {
      try {
        const result = await this.untilAborted(this.dependencies.remote.catalog(signal), signal)
        if (!result.ok) throw result.error
        await this.untilAborted(this.dependencies.ensure(), signal)
        if (signal.aborted) return
        const catalog = result.value
        this.form = catalog.settingsNamespace === undefined ? undefined : this.dependencies.form(catalog.settingsNamespace)
        const saved = this.form?.getSnapshot()
        this.revision = saved?.revision
        const values = saved?.status === 'ready' && saved.value !== undefined ? saved.value : { ...catalog.voice, threshold: catalog.threshold, minSpeechMs: catalog.minSpeechMs }
        this.state.update((state) => {
          state.catalog = catalog
          state.draft = { ...values, volume: gain(this.dependencies.volume.getSnapshot().volume) }
          state.writable = saved?.status === 'ready' && saved.writable
        })
      } catch (_error) { if (!signal.aborted) this.state.update((state) => { state.failure = 'loadError' }) }
    })())
  }

  /**
   * Stage one field; only Apply sends Host writes.
   * @param key - editable draft field.
   * @param value - next typed value.
   */
  edit<K extends keyof VoiceSettingsDraft>(key: K, value: VoiceSettingsDraft[K]): void {
    if (this.state.getSnapshot().busy) return
    this.resetFields = false
    this.state.update((state) => {
      if (!state.draft) return
      state.draft[key] = value
      if (key === 'speaker') {
        const speaker = state.catalog?.voices.find(voice => voice.speaker === value)
        if (speaker && !speaker.styles.includes(state.draft.style)) state.draft.style = 'natural'
      }
      state.failure = undefined
    })
  }

  /**
   * Change only the text sent to the next preview request.
   * @param text - user-editable sample text, never a Session message.
   */
  example(text: string): void { this.state.update((state) => { state.example = text }) }

  /** Stage inherited profile values and unity device gain. */
  defaults(): void {
    const current = this.state.getSnapshot(), namespace = current.catalog?.settingsNamespace
    if (!this.form || namespace === undefined || current.busy) return
    try {
      const base = this.dependencies.inherited(namespace, this.form.getSnapshot().base)
      this.resetFields = true
      this.state.update((state) => { state.draft = { ...base, volume: 1 }; state.failure = undefined })
    } catch (_error) { this.state.update((state) => { state.failure = 'loadError' }) }
  }

  /**
   * Read accepted detection settings for each incoming microphone frame.
   * @param initial - catalog settings retained by the current call.
   * @returns saved detection values; drafts never change capture.
   */
  detection(initial: Pick<VoiceSpeechCatalog, 'threshold' | 'minSpeechMs'>): Pick<VoiceSpeechCatalog, 'threshold' | 'minSpeechMs'> {
    const saved = this.form?.getSnapshot().value
    return saved === undefined ? initial : { threshold: saved.threshold, minSpeechMs: saved.minSpeechMs }
  }

  /** Preview draft synthesis without acquiring a microphone or creating Session input. */
  play(): void {
    const state = this.state.getSnapshot()
    if (!state.open || !state.draft || !state.catalog || this.preview || state.busy || !state.example.trim()) return
    const abort = new AbortController(), signal = AbortSignal.any([abort.signal, this.panel.signal, this.lifetime.signal])
    const audio = this.dependencies.audio(() => gain(this.state.getSnapshot().draft?.volume ?? 1))
    const sampleRate = state.catalog.sampleRate
    const activation = audio.activate()
    const pausing = this.dependencies.pauseCalls()
    const starting = Promise.all([activation, pausing])
    const voice: VoicePreferences = {
      speaker: state.draft.speaker, speechRate: state.draft.speechRate, pitch: state.draft.pitch, style: state.draft.style,
    }
    this.state.update((next) => { next.preview = true; next.failure = undefined })
    const done = this.track((async () => {
      let resume: (() => Promise<void>) | undefined
      let stream: ReturnType<SpeechRemote['synthesize']> | undefined
      try {
        const started = await this.untilAborted(starting, signal)
        resume = started[1]
        signal.throwIfAborted()
        stream = this.dependencies.remote.synthesize({ text: state.example.trim(), voice }, signal)
        for await (const chunk of stream) { signal.throwIfAborted(); audio.append(chunk.audio, sampleRate) }
        await audio.drain()
      } catch (_error) { if (!signal.aborted) this.state.update((next) => { next.failure = 'previewError' }) }
      finally {
        stream?.dispose()
        try {
          if (!resume) { try { resume = await pausing } catch (_pauseFailure) { /* A failed pause restores its other calls. */ } }
          try { await audio.dispose() } finally { await resume?.() }
        } catch (_cleanupFailure) { if (!signal.aborted) this.state.update((next) => { next.failure = 'previewError' }) }
        this.preview = undefined
        if (!this.lifetime.signal.aborted) this.state.update((next) => { next.preview = false })
      }
    })())
    this.preview = { abort, audio, done }
  }

  /**
   * Stop and join preview transport, playback and paused-call restoration.
   * @returns after preview resources are released.
   */
  async stop(): Promise<void> {
    const preview = this.preview
    if (!preview) return
    preview.abort.abort()
    await Promise.allSettled([preview.audio.dispose(), preview.done])
  }

  /**
   * Apply the staged Host fields atomically, then persist this client's volume.
   * @returns after acceptance or a visible failure.
   */
  apply(): Promise<void> { return this.track(this.save()) }

  private async save(): Promise<void> {
    const current = this.state.getSnapshot(), draft = current.draft, form = this.form
    if (!draft || !form || current.busy || !current.writable) return
    this.state.update((state) => { state.busy = true; state.failure = undefined })
    try {
      await this.stop()
      this.lifetime.signal.throwIfAborted()
      const fields = ['speaker', 'speechRate', 'pitch', 'style', 'threshold', 'minSpeechMs'] as const
      const accepted = await form.mutate(fields.map(field => this.resetFields
        ? { op: 'unset' as const, path: [field] }
        : { op: 'set' as const, path: [field], value: draft[field] }), this.revision)
      if (this.lifetime.signal.aborted) return
      if (!accepted) throw new Error('Voice preferences were refused')
      this.dependencies.volume.set({ volume: gain(draft.volume) })
      this.panel.abort()
      this.state.update((state) => { state.open = false })
    } catch (_error) { if (!this.lifetime.signal.aborted) this.state.update((state) => { state.failure = 'saveError' }) }
    finally { if (!this.lifetime.signal.aborted) this.state.update((state) => { state.busy = false }) }
  }

  /** Close and discard the draft, stopping preview without cancelling Agent work. */
  close(): void {
    if (this.state.getSnapshot().busy) return
    this.panel.abort()
    this.state.update((state) => { state.open = false })
    void this.track(this.stop())
  }

  private track(task: Promise<void>): Promise<void> {
    this.tasks.add(task)
    void task.finally(() => { this.tasks.delete(task) }).catch(() => {})
    return task
  }

  private untilAborted<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
      const abort = (): void => { reject(new DOMException('Voice settings closed', 'AbortError')) }
      signal.addEventListener('abort', abort, { once: true })
      void task.then((value) => {
        signal.removeEventListener('abort', abort)
        if (!signal.aborted) resolve(value)
      }, (error: unknown) => {
        signal.removeEventListener('abort', abort)
        reject(error instanceof Error ? error : new Error('Voice settings failed', { cause: error }))
      })
      if (signal.aborted) abort()
    })
  }

  /**
   * Abort and join the panel's own work before its Remote dependency is released.
   * @returns after all owner tasks and preview resources settle.
   */
  dispose(): Promise<void> {
    this.disposal ??= (async () => {
      this.lifetime.abort(); this.panel.abort()
      await this.stop(); await Promise.allSettled([...this.tasks])
    })()
    return this.disposal
  }
}
