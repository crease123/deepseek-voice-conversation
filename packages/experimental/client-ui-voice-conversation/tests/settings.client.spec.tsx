// @vitest-environment jsdom
/** Settings components keep one fixed entry and edit controlled drafts. */
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { afterEach, expect, it, vi } from 'vitest'
import { VoiceSettingsDialog, VoiceSettingsRow, type VoiceSettingsDialogProps } from '../src/client/VoiceSettings.tsx'
import type { VoiceSettingsState } from '../src/client/settings-controller.ts'
import { settingsEn } from '../src/client/settings-locales.ts'

afterEach(cleanup)
function fixture() {
  const state = createSnapshotStore<VoiceSettingsState>({ open: true, example: 'Example', busy: false, preview: false, writable: true,
    catalog: { voice: { speaker: 'voice', speechRate: 0, pitch: 0, style: 'natural' },
      voices: [{ speaker: 'voice', name: 'Voice', styles: ['natural', 'gentle', 'lively'] }],
      sampleRate: 24000, silenceMs: 650, maxUtteranceMs: 15000, threshold: 0.012, minSpeechMs: 200, maxTextLength: 600 },
    draft: { speaker: 'voice', speechRate: 0, pitch: 0, style: 'natural', threshold: 0.012, minSpeechMs: 200, volume: 1 } })
  const props: VoiceSettingsDialogProps = { useVoiceSettings: bindSnapshotSelector(state), t: makeTranslate(settingsEn), open: vi.fn(),
    close: vi.fn(), edit: vi.fn(), example: vi.fn(), play: vi.fn(), stop: vi.fn(async () => {}), defaults: vi.fn(),
    apply: vi.fn(async () => {}) }
  return { state, props }
}

it('opens the one dialog from its General settings row and keeps all draft controls labelled', () => {
  const b = fixture()
  const row = render(createElement(VoiceSettingsRow, b.props))
  fireEvent.click(screen.getByRole('button', { name: 'Voice settings' }))
  expect(b.props.open).toHaveBeenCalledWith(settingsEn.exampleDefault)
  row.unmount()
  render(createElement(VoiceSettingsDialog, b.props))
  expect(screen.getAllByRole('dialog', { name: 'Voice conversation' })).toHaveLength(1)
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
})
