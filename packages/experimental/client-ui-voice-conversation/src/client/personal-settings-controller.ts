/** Revision-fenced drafts for the personal Agent's ordinary and call instructions. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { PersonalAgentCatalog, PersonalAgentPreferences } from '@deepseek-ai/dsh-personal-agent/types'

/** Accepted rules remain separate from the editable draft and preview. */
export interface PersonalSettingsState {
  open: boolean
  saved?: PersonalAgentPreferences
  draft?: PersonalAgentPreferences
  busy: boolean
  writable: boolean
  dirty: boolean
  failure?: 'loadError' | 'saveError' | 'conflict' | undefined
}
/** Shared Host settings services used by this plugin-owned editor. */
export interface PersonalSettingsDependencies {
  catalog: (signal: AbortSignal) => Promise<RemoteResult<PersonalAgentCatalog>>
  ensure: () => Promise<void>
  form: (namespace: string) => ConfigForm<PersonalAgentPreferences>
}

function preferences(values: PersonalAgentPreferences): PersonalAgentPreferences {
  return { basePrompt: values.basePrompt, callPrompt: values.callPrompt }
}
function equal(left: PersonalAgentPreferences, right: PersonalAgentPreferences): boolean {
  return left.basePrompt === right.basePrompt && left.callPrompt === right.callPrompt
}

/** One page editor retains conflicting drafts until Cancel explicitly reloads saved rules. */
export class PersonalSettingsController {
  /** Read-only previews use saved rules, never unsaved draft text. */
  readonly state = createSnapshotStore<PersonalSettingsState>({ open: false, busy: false, writable: false, dirty: false })
  private readonly lifetime = new AbortController()
  private panel = new AbortController()
  private form: ConfigForm<PersonalAgentPreferences> | undefined
  private unsubscribe = (): void => {}
  private revision: number | undefined
  private saving: Promise<void> | undefined
  private readonly tasks = new Set<Promise<void>>()

  constructor(private readonly dependencies: PersonalSettingsDependencies) {}

  /** Open a fresh draft after any previous admitted save settles. */
  open(): void {
    if (this.lifetime.signal.aborted || this.state.getSnapshot().open) return
    this.panel = new AbortController()
    const signal = AbortSignal.any([this.panel.signal, this.lifetime.signal])
    this.state.set({ open: true, busy: false, writable: false, dirty: false })
    void this.track((async () => {
      try {
        await this.untilAborted(this.saving ?? Promise.resolve(), signal)
        const result = await this.untilAborted(this.dependencies.catalog(signal), signal)
        if (!result.ok) throw result.error
        await this.untilAborted(this.dependencies.ensure(), signal)
        if (signal.aborted) return
        const catalog = result.value
        this.form = catalog.settingsNamespace === undefined ? undefined : this.dependencies.form(catalog.settingsNamespace)
        const snapshot = this.form?.getSnapshot()
        const saved = preferences(snapshot?.value ?? catalog)
        this.revision = snapshot?.revision
        this.state.set({ open: true, saved, draft: { ...saved }, busy: false,
          writable: snapshot?.status === 'ready' && snapshot.writable, dirty: false })
        if (this.form) this.unsubscribe = this.form.subscribe(() => { this.acceptSaved() })
      } catch (_error) {
        if (!signal.aborted) this.state.update((state) => { state.failure = 'loadError' })
      }
    })())
  }

  private acceptSaved(): void {
    const snapshot = this.form?.getSnapshot(), current = this.state.getSnapshot()
    if (!current.open || this.lifetime.signal.aborted || !snapshot) return
    this.state.update((state) => {
      state.writable = snapshot.status === 'ready' && snapshot.writable
      if (snapshot.value === undefined) return
      state.saved = preferences(snapshot.value)
      if (!state.dirty) { state.draft = { ...state.saved }; this.revision = snapshot.revision }
      else if (snapshot.revision !== this.revision && !state.busy) state.failure = 'conflict'
    })
  }

  /**
   * Stage one editable prompt without submitting a Host write.
   * @param field - ordinary or call-only prompt.
   * @param value - complete draft text, including line breaks.
   */
  edit(field: keyof PersonalAgentPreferences, value: string): void {
    const current = this.state.getSnapshot()
    if (current.busy || !current.writable || !current.draft) return
    this.state.update((state) => {
      state.draft = { ...state.draft!, [field]: value }
      state.dirty = state.saved === undefined || !equal(state.draft, state.saved)
      if (state.failure !== 'conflict') state.failure = undefined
    })
  }

  /** Discard local edits and reload the latest accepted rules without saving. */
  cancel(): void {
    if (this.state.getSnapshot().busy) return
    const snapshot = this.form?.getSnapshot(), saved = snapshot?.value ?? this.state.getSnapshot().saved
    if (!saved) return
    this.revision = snapshot?.revision
    this.state.update((state) => { state.saved = preferences(saved); state.draft = preferences(saved); state.dirty = false; state.failure = undefined })
  }

  /**
   * Atomically save both prompt fields against the draft's original revision.
   * @returns after Host acceptance or a visible failure that retains the draft.
   */
  apply(): Promise<void> {
    if (this.saving) return this.saving
    const current = this.state.getSnapshot(), form = this.form, draft = current.draft
    if (!current.open || !form || !draft || !current.writable || !current.dirty || this.lifetime.signal.aborted) return Promise.resolve()
    const signal = this.panel.signal
    this.state.update((state) => { state.busy = true; state.failure = undefined })
    const saving = this.track((async () => {
      try {
        const accepted = await form.mutate([
          { op: 'set', path: ['basePrompt'], value: draft.basePrompt },
          { op: 'set', path: ['callPrompt'], value: draft.callPrompt },
        ], this.revision)
        if (signal.aborted || this.lifetime.signal.aborted) return
        if (!accepted) {
          this.state.update((state) => { state.failure = form.getSnapshot().revision !== this.revision ? 'conflict' : 'saveError' })
          return
        }
        const snapshot = form.getSnapshot()
        this.revision = snapshot.revision
        const saved = preferences(snapshot.value ?? draft)
        this.state.update((state) => { state.saved = saved; state.draft = { ...saved }; state.dirty = false })
      } catch (_error) {
        if (!signal.aborted && !this.lifetime.signal.aborted) this.state.update((state) => { state.failure = 'saveError' })
      } finally {
        this.saving = undefined
        if (!signal.aborted && !this.lifetime.signal.aborted) this.state.update((state) => { state.busy = false })
      }
    })())
    this.saving = saving
    return saving
  }

  /** Withdraw this page; admitted Host writes settle before the plugin is disposed. */
  close(): void {
    this.panel.abort(); this.unsubscribe(); this.unsubscribe = () => {}; this.form = undefined
    if (!this.lifetime.signal.aborted) this.state.set({ open: false, busy: false, writable: false, dirty: false })
  }

  /**
   * Abort pending reads and join admitted writes.
   * @returns after all page-owned operations settle.
   */
  async dispose(): Promise<void> {
    this.close(); this.lifetime.abort()
    await Promise.allSettled([...this.tasks])
  }

  private async untilAborted<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
    signal.throwIfAborted()
    const abort = Promise.withResolvers<never>()
    const cancel = (): void => { abort.reject(signal.reason) }
    signal.addEventListener('abort', cancel, { once: true })
    try { return await Promise.race([task, abort.promise]) }
    finally { signal.removeEventListener('abort', cancel) }
  }

  private track(task: Promise<void>): Promise<void> {
    this.tasks.add(task)
    void task.finally(() => { this.tasks.delete(task) }).catch(() => {})
    return task
  }
}
