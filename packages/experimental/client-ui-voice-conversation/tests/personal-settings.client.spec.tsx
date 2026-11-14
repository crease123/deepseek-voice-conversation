// @vitest-environment jsdom
/** Personal prompt editing keeps saved previews and call-only rules distinct. */
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { afterEach, expect, it, vi } from 'vitest'
import { PersonalAgentSettings, type PersonalAgentSettingsProps } from '../src/client/PersonalAgentSettings.tsx'
import type { PersonalSettingsState } from '../src/client/personal-settings-controller.ts'
import { personalEn } from '../src/client/personal-locales.ts'

afterEach(cleanup)
function fixture() {
  const saved = { basePrompt: 'Saved base instructions.', callPrompt: 'Saved call instructions.' }
  const state = createSnapshotStore<PersonalSettingsState>({ open: true, saved, draft: { ...saved }, busy: false, writable: true, dirty: false })
  const props: PersonalAgentSettingsProps = { usePersonalSettings: bindSnapshotSelector(state), t: makeTranslate(personalEn),
    open: vi.fn(), close: vi.fn(), edit: vi.fn(), cancel: vi.fn(), apply: vi.fn(async () => {}) }
  return { state, props }
}

it('opens the editor, labels call guidance and joins its page lifecycle', () => {
  const b = fixture(), view = render(createElement(PersonalAgentSettings, b.props))
  expect(b.props.open).toHaveBeenCalledOnce()
  expect(screen.queryByRole('textbox', { name: 'Base instructions' })).toBeNull()
  fireEvent.change(screen.getByRole('textbox', { name: 'Call instructions' }), { target: { value: 'Draft call.' } })
  expect(b.props.edit).toHaveBeenCalledWith('callPrompt', 'Draft call.')
  expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true)
  act(() => { b.state.update((state) => { state.dirty = true }) })
  fireEvent.click(screen.getByRole('button', { name: 'Save' })); expect(b.props.apply).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(b.props.cancel).toHaveBeenCalledOnce()
  view.unmount(); expect(b.props.close).toHaveBeenCalledOnce()
})

it('previews saved instructions for text and voice without including unsaved edits', () => {
  const b = fixture()
  b.state.update((state) => { state.draft = { basePrompt: 'Unsaved base.', callPrompt: 'Unsaved call.' }; state.dirty = true })
  render(createElement(PersonalAgentSettings, b.props))
  fireEvent.click(screen.getByText('View active rules'))
  expect(screen.getByLabelText('Saved rules').textContent).toBe('Saved call instructions.')
  expect(screen.getByLabelText('Saved rules').textContent).not.toContain('Unsaved')
})

it('keeps call guidance visible during save conflicts and read-only profiles', () => {
  const b = fixture()
  b.state.update((state) => { state.failure = 'conflict'; state.dirty = true })
  const view = render(createElement(PersonalAgentSettings, b.props))
  expect(screen.getByRole('alert').textContent).toContain('Saved instructions changed elsewhere')
  expect(screen.getByRole('textbox', { name: 'Call instructions' })).toHaveProperty('value', 'Saved call instructions.')
  act(() => { b.state.update((state) => { state.writable = false }) })
  expect(screen.getByRole('textbox', { name: 'Call instructions' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true)
  view.unmount()
})
