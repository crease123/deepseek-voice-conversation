/**
 * Rebuild watchers for plugins linked into the local application.
 * TypeScript checks each package before emitting modules consumed by tsdown.
 */
import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

const repoRoot = resolve(import.meta.dirname, '..')
if (process.env.DSH_HARNESS_ROOT === undefined) {
  console.error('Set DSH_HARNESS_ROOT to the DeepSeek Harness checkout the app runs before starting the watcher.')
  process.exit(1)
}

const hostDir = join(repoRoot, 'packages/experimental/voice-speech-doubao')
const personalDir = join(repoRoot, 'packages/experimental/personal-agent')
const clientDir = join(repoRoot, 'packages/experimental/client-ui-voice-conversation')
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const useProcessGroups = process.platform !== 'win32'
const children = new Set()
let stopping = false
let shutdown

/** Start a tracked command, with a separate process group on POSIX hosts. */
function start(args) {
  const child = spawn(pnpm, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
    detached: useProcessGroups,
  })
  children.add(child)
  child.once('close', () => children.delete(child))
  return child
}

/** Signal a command and its descendants without depending on pnpm forwarding. */
function signal(child, name) {
  if (child.pid === undefined) return
  try {
    if (useProcessGroups) process.kill(-child.pid, name)
    else child.kill(name)
  } catch (error) {
    if (error.code !== 'ESRCH') console.error(`[dev-watch] Could not send ${name} to ${child.pid}: ${error.message}`)
  }
}

/** Whether a tracked command still has a running process or process group. */
function running(child) {
  if (child.pid === undefined) return false
  if (!useProcessGroups) return child.exitCode === null && child.signalCode === null
  try {
    process.kill(-child.pid, 0)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') return false
    console.error(`[dev-watch] Could not inspect process group ${child.pid}: ${error.message}`)
    return true
  }
}

/** Stop child process groups, wait for exit, and force any remaining group. */
function stop(code) {
  if (stopping) return shutdown
  stopping = true
  const pending = [...children]
  shutdown = (async () => {
    for (const child of pending) signal(child, 'SIGTERM')
    const deadline = Date.now() + 2_000
    while (pending.some(running) && Date.now() < deadline) await delay(50)
    for (const child of pending.filter(running)) signal(child, 'SIGKILL')
    const forceDeadline = Date.now() + 1_000
    while (pending.some(running) && Date.now() < forceDeadline) await delay(50)
    process.exit(code)
  })()
  return shutdown
}

// Seed compilation is tracked too, so stopping during startup releases its children.
process.on('SIGINT', () => { void stop(0) })
process.on('SIGTERM', () => { void stop(0) })

/** Run one tracked command to completion and resolve to its exit code. */
function run(args) {
  return new Promise((resolveCode) => {
    const child = start(args)
    child.once('close', (code) => resolveCode(code ?? 1))
    child.once('error', (error) => {
      console.error(`[dev-watch] ${error.message}`)
      resolveCode(1)
    })
  })
}

/** TypeScript arguments shared by initial compilation and watch mode. */
const tscArgs = (dir) => [
  '--noEmit',
  'false',
  '--noEmitOnError',
  '--rewriteRelativeImportExtensions',
  '-p',
  join(dir, 'tsconfig.json'),
]

// tsdown consumes checked emitted modules; keep the last bundle if checking fails.
for (const dir of [hostDir, personalDir, clientDir]) {
  const code = await run(['exec', 'tsc', ...tscArgs(dir)])
  if (stopping) await shutdown
  if (code !== 0) await stop(code)
}

const tasks = [
  { name: 'tsc host', args: ['exec', 'tsc', '--watch', '--preserveWatchOutput', ...tscArgs(hostDir)] },
  { name: 'tsdown host', args: ['--filter', '@deepseek-ai/dsh-voice-speech-doubao', 'exec', 'tsdown', '--watch'] },
  { name: 'tsc personal', args: ['exec', 'tsc', '--watch', '--preserveWatchOutput', ...tscArgs(personalDir)] },
  { name: 'tsdown personal', args: ['--filter', '@deepseek-ai/dsh-personal-agent', 'exec', 'tsdown', '--watch'] },
  { name: 'tsc client', args: ['exec', 'tsc', '--watch', '--preserveWatchOutput', ...tscArgs(clientDir)] },
  { name: 'tsdown client', args: ['--filter', '@deepseek-ai/dsh-client-ui-voice-conversation', 'exec', 'tsdown', '--watch', '--env.DSH_BUILD_FACE=client'] },
]

for (const task of tasks) {
  if (stopping) await shutdown
  const child = start(task.args)
  child.once('close', (code) => {
    if (stopping) return
    console.error(`[dev-watch] ${task.name} exited with ${code}; stopping the other watchers.`)
    void stop(code ?? 1)
  })
  child.once('error', (error) => {
    console.error(`[dev-watch] ${task.name} failed: ${error.message}`)
    void stop(1)
  })
}

console.log('[dev-watch] watching the voice-conversation packages; checked edits rebuild into the running app.')
