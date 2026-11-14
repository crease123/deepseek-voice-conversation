/** Build each plugin with local tools and the matching Harness checkout. */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
function run(file, args = [], cwd = root) {
  const result = spawnSync(process.execPath, [resolve(root, file), ...args], { cwd, stdio: 'inherit', env: process.env })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
function build(name) {
  const path = `packages/experimental/${name}`
  run('node_modules/typescript/bin/tsc', ['--noEmit', 'false', '--rewriteRelativeImportExtensions', '-p', `${path}/tsconfig.json`])
  run('node_modules/tsdown/dist/run.mjs', [], resolve(root, path))
}
build('voice-speech-doubao')
build('personal-agent')
run('scripts/generate-remote.mjs')
build('client-ui-voice-conversation')
build('voice-conversation-bundle')
