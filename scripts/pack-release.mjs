/** Assemble an allowlisted prebuilt release without credentials or source-machine paths. */
import { cp, mkdir, mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const version = manifest.version
const output = resolve(root, 'dist')
await mkdir(output, { recursive: true })
const names = ['voice-speech-doubao', 'personal-agent', 'client-ui-voice-conversation']
const internalNames = names.map(name => `@deepseek-ai/dsh-${name}`)
async function pack(name, source, raw, files, embedded = []) {
  const stage = await mkdtemp(join(tmpdir(), 'dsh-voice-pack-'))
  try {
    const directory = join(stage, 'package')
    await mkdir(directory)
    const data = { ...raw, version }
    delete data.devDependencies; delete data.scripts; delete data.workspaces; delete data.packageManager; delete data.private
    for (const group of ['dependencies', 'peerDependencies']) {
      if (!data[group]) continue
      data[group] = Object.fromEntries(Object.entries(data[group]).map(([key, value]) => [key, internalNames.includes(key) ? version : value]))
    }
    await writeFile(join(directory, 'package.json'), JSON.stringify(data, null, 2) + '\n')
    for (const [from, to] of files) await cp(join(source, from), join(directory, to), { recursive: true })
    for (const [packageName, archive] of embedded) {
      const destination = join(directory, 'node_modules', packageName)
      await mkdir(destination, { recursive: true })
      const unpack = spawnSync('tar', ['-xzf', archive, '--strip-components=1', '-C', destination], { stdio: 'inherit' })
      if (unpack.status !== 0) throw new Error(`Could not embed ${packageName}`)
    }
    for (const doc of ['README.md', 'README.zh.md', 'LICENSE']) await cp(join(root, doc), join(directory, doc))
    if (name === manifest.name) await cp(join(root, 'docs/images'), join(directory, 'docs/images'), { recursive: true })
    async function cleanBuiltPaths(folder) {
      for (const entry of await readdir(folder, { withFileTypes: true })) {
        const file = join(folder, entry.name)
        if (entry.isDirectory()) await cleanBuiltPaths(file)
        else if (entry.name.endsWith('.map')) await rm(file)
        else if (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) {
          const source = await readFile(file, 'utf8')
          const clean = source.split('\n').filter(line => !(line.trimStart().startsWith('//') && (line.includes(root) || line.includes('sourceMappingURL=')))).join('\n')
          if (clean.includes(root)) throw new Error(`Local build path remains in ${entry.name}`)
          await writeFile(file, clean)
        }
      }
    }
    await cleanBuiltPaths(join(directory, 'lib'))
    const target = join(output, `${name}-${version}.tgz`)
    const result = spawnSync('tar', ['-czf', target, '--exclude=*.map', '-C', stage, 'package'], { stdio: 'inherit', env: { ...process.env, COPYFILE_DISABLE: '1' } })
    if (result.status !== 0) throw new Error(`Could not pack ${name}`)
    console.log(target)
  } finally { await rm(stage, { recursive: true, force: true }) }
}
for (const name of names) {
  const source = join(root, 'packages/experimental', name)
  const data = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'))
  await pack(`dsh-${name}`, source, data, [['lib', 'lib'], ['locale', 'locale']])
}
const bundle = join(root, 'packages/experimental/voice-conversation-bundle')
const data = { ...manifest, main: 'lib/index.js', types: 'lib/types/index.d.ts', exports: { '.': { types: './lib/types/index.d.ts', default: './lib/index.js' }, './package.json': './package.json', './cordis.patch.yml': './cordis.patch.yml', './locale/*.json': './locale/*.json' }, dsh: { bundle: { patch: './cordis.patch.yml' } } }
// Embed our own prebuilt components. URL subdependencies are rejected by the
// default pnpm policy used by DSH. Hoist their registry requirements so npm and
// pnpm both install everything needed by the embedded components.
data.bundledDependencies = internalNames
data.dependencies = { ...manifest.dependencies }
for (const name of names) {
  const child = JSON.parse(await readFile(join(root, 'packages/experimental', name, 'package.json'), 'utf8'))
  for (const group of ['dependencies', 'peerDependencies']) {
    for (const [key, value] of Object.entries(child[group] ?? {})) {
      if (internalNames.includes(key)) continue
      if (data.dependencies[key] && data.dependencies[key] !== value) throw new Error(`Conflicting runtime requirement: ${key}`)
      data.dependencies[key] = value
    }
  }
}
const embedded = names.map(name => [`@deepseek-ai/dsh-${name}`, join(output, `dsh-${name}-${version}.tgz`)])
await pack(manifest.name, bundle, data, [['lib', 'lib'], ['locale', 'locale'], ['cordis.patch.yml', 'cordis.patch.yml']], embedded)
