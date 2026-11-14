// @vitest-environment jsdom
/** Settings components keep one fixed entry and edit controlled drafts. */
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { afterEach, expect, it, vi } from 'vitest'
import { VoiceSettingsPage, type VoiceSettingsPageProps } from '../src/client/VoiceSettings.tsx'
import type { VoiceSettingsState } from '../src/client/settings-controller.ts'
import { settingsEn } from '../src/client/settings-locales.ts'

afterEach(cleanup)
function fixture() {
  const state = createSnapshotStore<VoiceSettingsState>({ open: true, example: 'Example', busy: false, preview: false, writable: true,
    catalog: { asrProvider: 'doubao', ttsProvider: 'doubao', voice: { speaker: 'voice', speechRate: 0, pitch: 0, style: 'natural' },
      voices: [{ speaker: 'voice', name: 'Voice', styles: ['natural', 'gentle', 'lively'] }],
      sampleRate: 24000, silenceMs: 650, maxUtteranceMs: 15000, threshold: 0.012, minSpeechMs: 200, maxTextLength: 600 },
    draft: { asrProvider: 'doubao', ttsProvider: 'doubao', speaker: 'voice', speechRate: 0, pitch: 0, style: 'natural', threshold: 0.012, minSpeechMs: 200, volume: 1 } })
  const props: VoiceSettingsPageProps = { useVoiceSettings: bindSnapshotSelector(state), t: makeTranslate(settingsEn), open: vi.fn(),
    close: vi.fn(), edit: vi.fn(), example: vi.fn(), play: vi.fn(), stop: vi.fn(async () => {}), defaults: vi.fn(),
    apply: vi.fn(async () => {}) }
  return { state, props }
}

it('renders the dedicated page directly and keeps draft controls labelled', () => {
  const b = fixture()
  const view = render(createElement(VoiceSettingsPage, b.props))
  expect(screen.getByRole('heading', { name: 'Voice call' })).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.change(screen.getByRole('slider', { name: 'Speech rate' }), { target: { value: '25' } })
  expect(b.props.edit).toHaveBeenCalledWith('speechRate', 25)
  fireEvent.change(screen.getByRole('slider', { name: 'Interruption sensitivity' }), { target: { value: '47' } })
  expect(b.props.edit).toHaveBeenCalledWith('threshold', 10 ** (-47 * 3 / 100))
  fireEvent.change(screen.getByRole('textbox', { name: 'Preview text' }), { target: { value: 'New example' } })
  expect(b.props.example).toHaveBeenCalledWith('New example')
  fireEvent.click(screen.getByRole('button', { name: 'Preview voice' })); expect(b.props.play).toHaveBeenCalledOnce()
  act(() => { b.state.update((state) => { state.preview = true }) })
  fireEvent.click(screen.getByRole('button', { name: 'Stop preview' })); expect(b.props.stop).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(b.props.close).toHaveBeenCalledOnce()
  view.unmount()
})

it('offers independent providers and only DeepSeek voices when DeepSeek is selected', () => {
  const b = fixture()
  act(() => { b.state.update(state => {
    if (state.draft) { state.draft.asrProvider = 'deepseek'; state.draft.ttsProvider = 'deepseek'; state.draft.deepseekSpeaker = 'stella' }
    if (state.catalog) state.catalog.ttsProvider = 'deepseek'
  }) })
  render(createElement(VoiceSettingsPage, b.props))
  expect(screen.queryByRole('slider', { name: 'Speech rate' })).toBeNull()
  expect(screen.getByRole('option', { name: 'Stella' })).toBeTruthy()
  expect(screen.getByRole('option', { name: 'Tide' })).toBeTruthy()
  fireEvent.change(screen.getByRole('combobox', { name: 'Speech recognition' }), { target: { value: 'doubao' } })
  expect(b.props.edit).toHaveBeenCalledWith('asrProvider', 'doubao')
})

it('offers password-only empty credential inputs and configuration status for Doubao', () => {
  const b = fixture(), credential = vi.fn()
  b.state.update(state => { state.credentials = {
    apiKey: { ref: 'SPEECH_API_KEY', configured: true, writable: true },
    appId: { ref: 'SPEECH_APP_ID', configured: false, writable: true },
    accessToken: { ref: 'SPEECH_ACCESS_TOKEN', configured: false, writable: true },
  } })
  const view = render(createElement(VoiceSettingsPage, { ...b.props, credential }))
  const inputs = view.container.querySelectorAll<HTMLInputElement>('input[type="password"]')
  expect(inputs).toHaveLength(3)
  expect([...inputs].every(input => input.value === '')).toBe(true)
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'test-only-key' } })
  expect(credential).toHaveBeenCalledWith('apiKey', 'test-only-key')
})
