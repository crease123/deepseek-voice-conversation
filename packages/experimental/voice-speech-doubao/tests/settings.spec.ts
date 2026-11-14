/** Real profile persistence and Settings validation preserve live speech service instances. */
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { boot, initProfile, loadOptionalPatches, readProfilePatches, type ProfileContext } from '@deepseek-ai/dsh-app-boot'
import ConfigEditor from '@deepseek-ai/dsh-config-editor'
import Settings from '@deepseek-ai/dsh-settings'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import VoiceSpeechDoubao from '../src/index.ts'

const cleanups: Array<() => Promise<void>> = []
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup() })

async function profileFixture(placement: 'bundle' | 'overlay' | 'profile' = 'bundle') {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'dsh-voice-settings-')))
  cleanups.push(async () => { await rm(home, { recursive: true, force: true }) })
  const dir = join(home, 'profiles', 'test'), bundle = join(dir, 'node_modules', 'voice-test-bundle')
  initProfile(dir, ['voice-test-bundle'])
  await mkdir(bundle, { recursive: true })
  await writeFile(join(home, 'package.json'), '{"name":"voice-settings-test"}\n')
  await writeFile(join(bundle, 'package.json'), JSON.stringify({ name: 'voice-test-bundle', version: '1.0.0', dsh: { bundle: { patch: 'cordis.patch.yml' } } }))
  await writeFile(join(bundle, 'cordis.patch.yml'), JSON.stringify([{ insert: [
    { id: 'config-editor', name: 'cordis:editor' },
    { id: 'settings', name: 'cordis:settings' },
    { id: 'typert', name: 'cordis:typert' },
    ...(placement === 'bundle' ? [{ id: 'voice-speech-doubao', name: 'cordis:speech', config: {
      asrProvider: 'doubao', ttsProvider: 'doubao', asrUrl: 'ws://127.0.0.1:1/asr', ttsUrl: 'http://127.0.0.1:1/tts', silenceMs: 150,
    } }] : []),
  ] }]))
  await writeFile(join(dir, 'cordis.yml'), '[]\n')
  // The source-plane Loader builtin uses the actual Host class without a second native TS module instance.
  const sourcePatch = JSON.stringify([{ insert: [{
    id: 'voice-speech-doubao', name: 'cordis:speech',
  }] }])
  const overlayPath = join(home, 'source.patch.yml')
  if (placement === 'overlay') await writeFile(overlayPath, sourcePatch)
  if (placement === 'profile') await writeFile(join(dir, 'cordis.patch.yml'), sourcePatch)
  const profile: ProfileContext = {
    name: 'test', startedBundles: ['voice-test-bundle'], dir, patchPath: join(dir, 'cordis.patch.yml'),
    installAnchor: join(home, 'package.json'), cwd: home, home,
    overlays: placement === 'overlay' ? loadOptionalPatches('test', overlayPath) ?? [] : [], telemetryDisabledEnv: undefined,
  }
  const start = async () => {
    const ctx = await boot('test', join(dir, 'cordis.yml'), readProfilePatches('test', profile), (owner) => {
      owner.provide('profileContext', profile)
      owner.provide('appReady', { onReady: (listener: () => void) => { listener(); return () => {} } })
      owner.provide('credentials', { resolve: async () => undefined } as never)
      Object.assign(owner.loader.builtins, { editor: ConfigEditor, settings: Settings, typert: TypertRegistry, speech: VoiceSpeechDoubao })
    })
    cleanups.push(async () => { await ctx.fiber.dispose() })
    return ctx
  }
  return { ctx: await start(), profile, start }
}

it.each(['bundle', 'profile'] as const)('saves all voice settings for a %s-owned entry without remounting the speech service', async (placement) => {
  const { ctx, profile, start } = await profileFixture(placement)
  const api = ctx.get('voiceSpeech')
  if (!api) throw new Error('Speech service did not start')
  const namespace = api.catalog(new AbortController().signal).settingsNamespace
  if (!namespace) throw new Error('Speech settings are not addressable')
  const entry = ctx.configEditor.entries().find(item => item.options.id === namespace)
  if (!entry) throw new Error('Missing speech configuration entry')
  const fiber = entry.fiber
  const descriptor = ctx.settings.describe().find(item => item.ns === namespace)
  if (!descriptor) throw new Error('Missing speech configuration form')
  expect(descriptor.autoGenerate).toBe(false)
  const fields = { asrProvider: 'deepseek', ttsProvider: 'deepseek', deepseekSpeaker: 'tide', speaker: 'zh_female_vv_uranus_bigtts', speechRate: 100, pitch: 12, style: 'gentle', threshold: 10 ** -1.5, minSpeechMs: 200 }
  await ctx.settings.mutate(namespace, Object.entries(fields).map(([field, value]) => ({ op: 'set', path: [field], value })), descriptor.revision)
  expect(entry.fiber === fiber).toBe(true)
  expect(api.catalog(new AbortController().signal)).toMatchObject({
    voice: { speaker: fields.speaker, speechRate: 100, pitch: 12, style: 'gentle' }, threshold: fields.threshold, minSpeechMs: 200,
  })
  const persisted = await readFile(profile.patchPath, 'utf8')
  expect(persisted).toContain('zh_female_vv_uranus_bigtts')
  expect(ctx.settings.describe().find(item => item.ns === namespace)?.value).toMatchObject(fields)
  const before = persisted
  await expect(ctx.settings.mutate(namespace, [{ op: 'set', path: ['pitch'], value: 13 }])).rejects.toThrow()
  expect(await readFile(profile.patchPath, 'utf8')).toBe(before)
  await ctx.fiber.dispose()
  const restored = await start()
  expect(restored.voiceSpeech.catalog(new AbortController().signal)).toMatchObject({
    voice: { speaker: fields.speaker, speechRate: 100, pitch: 12, style: 'gentle' }, threshold: fields.threshold, minSpeechMs: 200,
  })
  await restored.settings.mutate(namespace, Object.keys(fields).map(field => ({ op: 'unset', path: [field] })))
  expect(restored.voiceSpeech.catalog(new AbortController().signal)).toMatchObject({
    voice: { speaker: 'zh_female_xiaohe_uranus_bigtts', speechRate: 0, pitch: 0, style: 'natural' },
    threshold: 0.012, minSpeechMs: 200, silenceMs: placement === 'bundle' ? 150 : 650,
  })
  expect(restored.settings.describe().find(item => item.ns === namespace)?.user).toEqual({})
})

it('rejects saving a source entry inserted only by the process overlay', async () => {
  const { ctx, profile } = await profileFixture('overlay')
  const api = ctx.get('voiceSpeech')
  if (!api) throw new Error('Speech service did not start')
  const before = api.catalog(new AbortController().signal)
  if (!before.settingsNamespace) throw new Error('Speech settings are not addressable')
  const fields = { asrProvider: 'deepseek', ttsProvider: 'deepseek', deepseekSpeaker: 'tide', speaker: 'zh_female_vv_uranus_bigtts', speechRate: 100, pitch: 12, style: 'gentle', threshold: 10 ** -1.5, minSpeechMs: 200 }
  const persisted = await readFile(profile.patchPath, 'utf8')
  await expect(ctx.settings.mutate(before.settingsNamespace, Object.entries(fields).map(([field, value]) => ({ op: 'set', path: [field], value })))).rejects.toThrow('overridden by a home patch or command-line overlay')
  expect(api.catalog(new AbortController().signal)).toEqual(before)
  expect(await readFile(profile.patchPath, 'utf8')).toBe(persisted)
})
