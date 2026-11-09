// @vitest-environment jsdom
/** The General entry and unique dialog follow the optional speech Remote lifetime. */
import assert from 'node:assert/strict'
import { Context, Service } from '@deepseek-ai/cordis'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { expect, it, vi } from 'vitest'
import { mountVoiceConversation, inject } from '../src/client/mount.ts'
import type { VoiceSettingsInjected } from '../src/client/VoiceSettings.tsx'
import type { SpeechRemote } from '../src/client/call.ts'

const contribution: TypertRemoteContribution = { package: '@deepseek-ai/dsh-voice-speech-doubao', descriptors: [] }
function settingsFace(value: Record<string, unknown>): asserts value is Record<string, unknown> & VoiceSettingsInjected {
  assert.equal(typeof value.open, 'function'); assert.equal(typeof value.close, 'function')
  assert(typeof value.hooks === 'object' && value.hooks !== null)
}

it('shares one settings owner and withdraws its slots before unmounting the speech Remote', async () => {
  const ctx = new Context(), catalog = Promise.withResolvers<Awaited<ReturnType<SpeechRemote['catalog']>>>()
  const unmount = vi.fn(async () => {})
  class Remote extends Service {
    constructor() { super(ctx, 'remote') }
    async $mount() { return unmount }
  }
  new Remote()
  const read = vi.fn(() => catalog.promise)
  ctx.provide('remote.voiceSpeech', { catalog: read } as never)
  ctx.provide('sessions', {} as never); ctx.provide('configForms', {} as never); ctx.provide('settingsSchema', {} as never)
  ctx.provide('locale', new LocaleRuntime(ctx))
  await ctx.plugin(SlotRegistry)
  ctx.slots.register({ name: 'root', children: {
    'conversation.input.activity': { kind: 'single', scope: 'session' },
    'settings.general.item': { kind: 'list', scope: 'root' },
    'shell.overlay': { kind: 'list', scope: 'root' },
  } } as never, () => null)
  try {
    const fiber = ctx.plugin({ inject, apply: child => mountVoiceConversation(child, contribution) })
    await fiber
    const rows = ctx.slots.entries('settings.general.item'), overlays = ctx.slots.entries('shell.overlay')
    expect(rows).toHaveLength(1); expect(overlays).toHaveLength(1)
    const row = rows[0]!.inject!(), overlay = overlays[0]!.inject!()
    settingsFace(row); settingsFace(overlay)
    expect(row.hooks.voiceSettings).toBe(overlay.hooks.voiceSettings)
    row.open('Example')
    await vi.waitFor(() => { expect(read).toHaveBeenCalledOnce() })
    await fiber.dispose()
    expect(ctx.slots.entries('settings.general.item')).toHaveLength(0)
    expect(ctx.slots.entries('shell.overlay')).toHaveLength(0)
    expect(unmount).toHaveBeenCalledOnce()
    catalog.reject(new Error('late catalogue failure'))
    await Promise.resolve()
  } finally { await ctx.fiber.dispose() }
})
