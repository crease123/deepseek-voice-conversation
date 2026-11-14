/** Personal prompt drafts retain revision fences, saved previews and write ownership. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { PersonalAgentCatalog, PersonalAgentPreferences } from '@deepseek-ai/dsh-personal-agent/types'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings/types'
import { expect, it, vi } from 'vitest'
import { PersonalSettingsController } from '../src/client/personal-settings-controller.ts'

const initial: PersonalAgentPreferences = { basePrompt: 'Help with everyday tasks.', callPrompt: 'Speak briefly.' }
function fixture() {
  const snapshot = createSnapshotStore<ConfigFormSnapshot<PersonalAgentPreferences>>({
    status: 'ready', value: initial, base: initial, user: {}, revision: 1, writable: true,
  })
  const mutate = vi.fn<ConfigForm<PersonalAgentPreferences>['mutate']>(async (ops, revision) => {
    if (revision !== snapshot.getSnapshot().revision) return false
    const next = { ...snapshot.getSnapshot().value! }
    for (const op of ops) if (op.op === 'set') Object.assign(next, { [op.path[0]!]: op.value })
    snapshot.set({ ...snapshot.getSnapshot(), value: next, revision: 2 })
    return true
  })
  const form: ConfigForm<PersonalAgentPreferences> = { ...snapshot, mutate, set: vi.fn(async () => true), unset: vi.fn(async () => true) }
  const catalog: PersonalAgentCatalog = { ...initial, settingsNamespace: 'personal-agent' as SettingsNamespace }
  const read = vi.fn(async (_signal: AbortSignal) => ({ ok: true as const, value: catalog }))
  const ensure = vi.fn(async () => {})
  const controller = new PersonalSettingsController({ catalog: read, ensure, form: () => form })
  return { controller, snapshot, mutate, form, catalog, read, ensure }
}
async function opened(b: ReturnType<typeof fixture>): Promise<void> {
  b.controller.open()
  await vi.waitFor(() => { expect(b.controller.state.getSnapshot().draft).toBeDefined() })
}

it('keeps drafts out of saved previews and atomically saves both rules with the original revision', async () => {
  const b = fixture(); await opened(b)
  b.controller.edit('basePrompt', 'Use a natural tone.\nStart with the answer.')
  b.controller.edit('callPrompt', 'One short answer.')
  expect(b.controller.state.getSnapshot().saved).toEqual(initial)
  expect(b.mutate).not.toHaveBeenCalled()
  await b.controller.apply()
  expect(b.mutate).toHaveBeenCalledWith([
    { op: 'set', path: ['basePrompt'], value: 'Use a natural tone.\nStart with the answer.' },
    { op: 'set', path: ['callPrompt'], value: 'One short answer.' },
  ], 1)
  expect(b.controller.state.getSnapshot()).toMatchObject({ dirty: false, busy: false, saved: { callPrompt: 'One short answer.' } })
  await b.controller.dispose()
})

it('preserves a conflicting draft and Cancel loads current saved values before a later save', async () => {
  const b = fixture(); await opened(b)
  b.controller.edit('callPrompt', 'My unsaved call rules.')
  b.snapshot.set({ ...b.snapshot.getSnapshot(), value: { ...initial, basePrompt: 'Changed elsewhere.' }, revision: 7 })
  expect(b.controller.state.getSnapshot()).toMatchObject({ draft: { callPrompt: 'My unsaved call rules.' }, saved: { basePrompt: 'Changed elsewhere.' }, failure: 'conflict' })
  await b.controller.apply()
  expect(b.mutate.mock.calls[0]![1]).toBe(1)
  expect(b.controller.state.getSnapshot().failure).toBe('conflict')
  expect(b.controller.state.getSnapshot().draft?.callPrompt).toBe('My unsaved call rules.')
  b.controller.cancel()
  expect(b.controller.state.getSnapshot()).toMatchObject({ dirty: false, draft: { basePrompt: 'Changed elsewhere.', callPrompt: initial.callPrompt } })
  b.controller.edit('callPrompt', 'Edited after reload.'); await b.controller.apply()
  expect(b.mutate.mock.calls[1]![1]).toBe(7)
  expect(b.controller.state.getSnapshot().failure).toBeUndefined()
  await b.controller.dispose()
})

it('follows accepted changes while clean without overwriting a later draft', async () => {
  const b = fixture(); await opened(b)
  b.snapshot.set({ ...b.snapshot.getSnapshot(), value: { ...initial, callPrompt: 'Changed.' }, revision: 3 })
  expect(b.controller.state.getSnapshot()).toMatchObject({ draft: { callPrompt: 'Changed.' }, saved: { callPrompt: 'Changed.' }, dirty: false })
  b.controller.edit('basePrompt', 'Draft.')
  b.snapshot.set({ ...b.snapshot.getSnapshot(), value: { ...initial, callPrompt: 'Newer.' }, revision: 4 })
  expect(b.controller.state.getSnapshot().draft?.basePrompt).toBe('Draft.')
  expect(b.controller.state.getSnapshot().saved?.callPrompt).toBe('Newer.')
  await b.controller.dispose()
})

it('keeps failed drafts visible and allows retry without pretending they were accepted', async () => {
  const b = fixture(); await opened(b)
  b.controller.edit('basePrompt', 'Preserve this draft.')
  b.mutate.mockRejectedValueOnce(new Error('connection lost'))
  await b.controller.apply()
  expect(b.controller.state.getSnapshot()).toMatchObject({ failure: 'saveError', dirty: true, busy: false,
    draft: { basePrompt: 'Preserve this draft.' }, saved: initial })
  await b.controller.apply()
  expect(b.controller.state.getSnapshot()).toMatchObject({ dirty: false, failure: undefined, saved: { basePrompt: 'Preserve this draft.' } })
  await b.controller.dispose()
})

it('joins admitted writes during disposal and prevents late writes into a reopened page', async () => {
  const b = fixture(); await opened(b)
  b.controller.edit('callPrompt', 'Saved during navigation.')
  const committed = Promise.withResolvers<boolean>()
  b.mutate.mockReturnValueOnce(committed.promise)
  const saving = b.controller.apply()
  b.controller.close(); b.controller.open()
  expect(b.read).toHaveBeenCalledOnce()
  b.snapshot.set({ ...b.snapshot.getSnapshot(), value: { ...initial, callPrompt: 'Saved during navigation.' }, revision: 2 })
  committed.resolve(true); await saving
  await vi.waitFor(() => { expect(b.controller.state.getSnapshot().draft?.callPrompt).toBe('Saved during navigation.') })
  b.controller.edit('callPrompt', 'Another pending write.')
  const second = Promise.withResolvers<boolean>(); b.mutate.mockReturnValueOnce(second.promise)
  const applying = b.controller.apply()
  let disposed = false
  const closing = b.controller.dispose().then(() => { disposed = true })
  await Promise.resolve(); expect(disposed).toBe(false)
  const before = b.controller.state.getSnapshot()
  second.resolve(true); await applying; await closing
  expect(b.controller.state.getSnapshot()).toBe(before)
})

it('releases a pending catalog read on page close and ignores its late completion', async () => {
  const b = fixture(), read = Promise.withResolvers<{ ok: true; value: PersonalAgentCatalog }>()
  b.read.mockReturnValueOnce(read.promise)
  b.controller.open(); await vi.waitFor(() => { expect(b.read).toHaveBeenCalledOnce() })
  b.controller.close(); await b.controller.dispose()
  expect(b.read.mock.calls[0]![0].aborted).toBe(true)
  const before = b.controller.state.getSnapshot()
  read.resolve({ ok: true, value: b.catalog }); await Promise.resolve()
  expect(b.controller.state.getSnapshot()).toBe(before)
})

it('keeps a namespace without write access read-only and ignores edits', async () => {
  const b = fixture()
  b.snapshot.set({ ...b.snapshot.getSnapshot(), writable: false })
  await opened(b)
  b.controller.edit('basePrompt', 'Forbidden draft.'); await b.controller.apply()
  expect(b.controller.state.getSnapshot().draft).toEqual(initial)
  expect(b.mutate).not.toHaveBeenCalled()
  await b.controller.dispose()
})

it('does not reopen an already visible page or preserve drafts across page closure', async () => {
  const b = fixture(); await opened(b)
  b.controller.edit('basePrompt', 'Discard on navigation.')
  b.controller.open(); expect(b.read).toHaveBeenCalledOnce()
  b.controller.close(); await opened(b)
  expect(b.controller.state.getSnapshot().draft).toEqual(initial)
  await b.controller.dispose()
})

it('reports an initial load failure without exposing an editable empty form', async () => {
  const b = fixture(); b.ensure.mockRejectedValueOnce(new Error('settings unavailable'))
  b.controller.open()
  await vi.waitFor(() => { expect(b.controller.state.getSnapshot().failure).toBe('loadError') })
  expect(b.controller.state.getSnapshot().draft).toBeUndefined()
  await b.controller.dispose()
})
