/** Remote generation preserves the Harness checkout and never replaces existing packages. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const generatorScript = join(repositoryRoot, 'scripts/generate-remote.mjs')

/** A private checkout stub fails only after the script has applied its temporary config. */
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'voice-remote-generator-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const file of ['package.json', 'tsconfig.host.json', 'packages/typert/protocol/src/index.ts', 'packages/typert/generator/lib/index.js']) {
    await mkdir(dirname(join(root, file)), { recursive: true })
  }
  const original = '{\n  "references": []\n}\n'
  await writeFile(join(root, 'package.json'), '{"type":"module"}\n')
  await writeFile(join(root, 'tsconfig.host.json'), original)
  await writeFile(join(root, 'packages/typert/protocol/src/index.ts'), 'export {}\n')
  await writeFile(join(root, 'packages/typert/generator/lib/index.js'),
    'export class WorkspaceTypertGenerator { generate() { throw new Error("fixture generator failure") } }\nexport function writeWorkspaceArtifacts() {}\n')
  await mkdir(join(root, 'node_modules'))
  await symlink(join(repositoryRoot, 'node_modules/typescript'), join(root, 'node_modules/typescript'), 'dir')
  await mkdir(join(root, 'packages/experimental'))
  return { root, original }
}

/** Run only the fixture's CLI and retain bounded diagnostic output for assertions. */
function run(root, args = []) {
  return spawnSync(process.execPath, [generatorScript, ...args], {
    cwd: repositoryRoot,
    env: { ...process.env, DSH_HARNESS_ROOT: root },
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 128 * 1024,
  })
}

test('dry run validates both references without modifying the checkout', async t => {
  const { root, original } = await fixture(t)
  const result = run(root, ['--dry-run'])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Validated 2 temporary Typert project references/u)
  assert.equal(await readFile(join(root, 'tsconfig.host.json'), 'utf8'), original)
  assert.equal(existsSync(join(root, 'packages/experimental/voice-speech-doubao')), false)
  assert.equal(existsSync(join(root, 'packages/experimental/personal-agent')), false)
})

test('an existing package is preserved and newly created staging is removed', async t => {
  const { root, original } = await fixture(t)
  const existing = join(root, 'packages/experimental/personal-agent')
  await mkdir(existing)
  await writeFile(join(existing, 'keep.txt'), 'existing checkout data')
  const result = run(root)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Refusing to replace an existing Harness package directory/u)
  assert.equal(await readFile(join(existing, 'keep.txt'), 'utf8'), 'existing checkout data')
  assert.equal(existsSync(join(root, 'packages/experimental/voice-speech-doubao')), false)
  assert.equal(await readFile(join(root, 'tsconfig.host.json'), 'utf8'), original)
})

test('generation failure restores config and removes both staged packages', async t => {
  const { root, original } = await fixture(t)
  const result = run(root)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /fixture generator failure/u)
  assert.equal(await readFile(join(root, 'tsconfig.host.json'), 'utf8'), original)
  assert.equal(existsSync(join(root, 'packages/experimental/voice-speech-doubao')), false)
  assert.equal(existsSync(join(root, 'packages/experimental/personal-agent')), false)
})
