// @vitest-environment jsdom
/** The General entry and unique dialog follow the optional speech Remote lifetime. */
import assert from 'node:assert/strict'
import { Context, Service } from '@deepseek-ai/cordis'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { expect, it, vi } from 'vitest'
import { mountVoiceConversation, inject } from '../src/client/mount.ts'
import type { VoiceSettingsInjected } from '../src/client/VoiceSettings.tsx'
import type { SpeechRemote } from '../src/client/call.ts'

const mountedCalls = vi.hoisted(() => [] as Array<{
  setBackgrounded: (hidden: boolean) => Promise<void>
  start: () => Promise<void>
  dispose: () => Promise<void>
}>)
vi.mock('../src/client/call.ts', () => ({
  VoiceCall: class {
    readonly setBackgrounded = vi.fn(async (_hidden: boolean) => {})
    readonly start = vi.fn(async () => {})
    readonly dispose = vi.fn(async () => { this.release() })
    constructor(_binding: object, _remote: object, _personal: object, _audio: object, _publish: (state: never) => void,
      private readonly release: () => void) { mountedCalls.push(this) }
  },
}))

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
  ctx.provide('remote.personalAgent', {} as never)
  ctx.provide('remote.credentials', {} as never)
  ctx.provide('sessions', {} as never); ctx.provide('configForms', {} as never); ctx.provide('settingsSchema', {} as never)
  ctx.provide('locale', new LocaleRuntime(ctx))
  await ctx.plugin(SlotRegistry)
  ctx.slots.register({ name: 'root', children: {
    'conversation.input.activity': { kind: 'single', scope: 'session' },
    'settings.section': { kind: 'list', scope: 'root' },
    'settings.general.item': { kind: 'list', scope: 'root' },
    'shell.overlay': { kind: 'list', scope: 'root' },
  } } as never, () => null)
  try {
    const fiber = ctx.plugin({ inject, apply: child => mountVoiceConversation(child, contribution) })
    await fiber
    const sections = ctx.slots.entries('settings.section')
    expect(sections).toHaveLength(1)
    expect(sections[0]!.options.id).toBe('voice-conversation')
    expect(ctx.slots.entries('settings.general.item')).toHaveLength(0)
    expect(ctx.slots.entries('shell.overlay')).toHaveLength(0)
    const row = sections[0]!.inject!()
    settingsFace(row)
    row.open('Example')
    await vi.waitFor(() => { expect(read).toHaveBeenCalledOnce() })
    await fiber.dispose()
    expect(ctx.slots.entries('settings.general.item')).toHaveLength(0)
    expect(ctx.slots.entries('shell.overlay')).toHaveLength(0)
    expect(ctx.slots.entries('settings.section')).toHaveLength(0)
    expect(unmount).toHaveBeenCalledOnce()
    catalog.reject(new Error('late catalogue failure'))
    await Promise.resolve()
  } finally { await ctx.fiber.dispose() }
})

it('pauses the same mounted call on page hiding and only releases it on hangup', async () => {
  mountedCalls.length = 0
  const previousHidden = Object.getOwnPropertyDescriptor(document, 'hidden')
  let hidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  const ctx = new Context(), unmount = vi.fn(async () => {}), release = vi.fn()
  class Remote extends Service {
    constructor() { super(ctx, 'remote') }
    async $mount() { return unmount }
  }
  new Remote()
  ctx.provide('remote.voiceSpeech', {} as never)
  ctx.provide('remote.personalAgent', {} as never)
  ctx.provide('remote.credentials', {} as never)
  ctx.provide('sessions', { retain: () => ({ binding: {}, ready: Promise.resolve(), release }) } as never)
  ctx.provide('configForms', {} as never); ctx.provide('settingsSchema', {} as never)
  ctx.provide('locale', new LocaleRuntime(ctx))
  await ctx.plugin(SlotRegistry)
  ctx.slots.register({ name: 'root', children: {
    'conversation.input.activity': { kind: 'single', scope: 'session' },
    'settings.section': { kind: 'list', scope: 'root' },
    'settings.general.item': { kind: 'list', scope: 'root' },
    'shell.overlay': { kind: 'list', scope: 'root' },
  } } as never, () => null)
  try {
    const fiber = ctx.plugin({ inject, apply: child => mountVoiceConversation(child, contribution) })
    await fiber
    const activity = ctx.slots.entries('conversation.input.activity')[0]!.inject!()
    const sessionId = 'voice-session' as SessionId
    activity.start(sessionId)
    const call = mountedCalls[0]!
    hidden = true; document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => { expect(call.setBackgrounded).toHaveBeenLastCalledWith(true) })
    expect(call.start).toHaveBeenCalledOnce(); expect(call.dispose).not.toHaveBeenCalled(); expect(release).not.toHaveBeenCalled()
    hidden = false; document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => { expect(call.setBackgrounded).toHaveBeenLastCalledWith(false) })
    expect(call.dispose).not.toHaveBeenCalled(); expect(release).not.toHaveBeenCalled()
    activity.hangup(sessionId)
    await vi.waitFor(() => { expect(call.dispose).toHaveBeenCalledOnce(); expect(release).toHaveBeenCalledOnce() })
    await fiber.dispose()
    expect(unmount).toHaveBeenCalledOnce()
  } finally {
    if (previousHidden) Object.defineProperty(document, 'hidden', previousHidden)
    else Reflect.deleteProperty(document, 'hidden')
    await ctx.fiber.dispose()
  }
})
