// @vitest-environment jsdom
/** Call toolbar behavior uses the renderer's ordinary observable selector binding. */
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { VoiceConversation, type VoiceConversationProps } from '../src/client/VoiceConversation.tsx'
import { en } from '../src/client/locales.ts'
import type { CallState } from '../src/client/call.ts'

afterEach(cleanup)
const id = 'call-session' as SessionId
function fixture(state?: CallState) {
  const store = createSnapshotStore<ReadonlyMap<SessionId, CallState>>(new Map(state ? [[id, state]] : []))
  const props: VoiceConversationProps = { sessionId: id, locked: false, onActiveChange: vi.fn(), start: vi.fn(), hangup: vi.fn(),
    useVoiceCalls: bindSnapshotSelector(store), t: makeTranslate(en) }
  return { store, props }
}

it('starts from a user gesture and keeps the hangup action available during a response', () => {
  const b = fixture(), view = render(createElement(VoiceConversation, b.props))
  fireEvent.click(screen.getByRole('button', { name: 'Start voice call' }))
  expect(b.props.start).toHaveBeenCalledWith(id)
  act(() => { b.store.set(new Map([[id, { phase: 'listening' }]])) })
  expect(screen.getByRole('status').textContent).toBe('Listening')
  expect(b.props.onActiveChange).toHaveBeenLastCalledWith(true)
  act(() => { b.store.set(new Map([[id, { phase: 'speaking' }]])) })
  fireEvent.click(screen.getByRole('button', { name: 'Hang up voice call' }))
  expect(b.props.hangup).toHaveBeenCalledWith(id)
  view.unmount(); expect(b.props.onActiveChange).toHaveBeenLastCalledWith(false)
})

it('shows recovery advice with retry and disables starting in a locked composer', () => {
  const b = fixture({ phase: 'error', failure: 'cancellation' })
  const view = render(createElement(VoiceConversation, b.props))
  expect(screen.getByRole('alert').textContent).toContain('Use Stop in the conversation')
  fireEvent.click(screen.getByRole('button', { name: 'Retry voice call' })); expect(b.props.start).toHaveBeenCalledWith(id)
  view.rerender(createElement(VoiceConversation, { ...b.props, locked: true }))
  expect(screen.getByRole('button', { name: 'Retry voice call' }).hasAttribute('disabled')).toBe(true)
})

it('hangs up the old Session when switching and releases toolbar expansion on unmount', () => {
  const b = fixture({ phase: 'recognizing' }), view = render(createElement(VoiceConversation, b.props))
  view.rerender(createElement(VoiceConversation, { ...b.props, sessionId: 'another-session' as SessionId }))
  expect(b.props.hangup).toHaveBeenCalledWith(id)
  expect(screen.getByRole('button', { name: 'Start voice call' })).toBeTruthy()
  view.unmount(); expect(b.props.hangup).toHaveBeenCalledWith('another-session')
})
