/** Source-mode plugin tests use the matching Harness checkout and its test transforms. */
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { defineConfig } from 'vitest/config'

const harnessRoot = resolve(process.env['DSH_HARNESS_ROOT'] ?? fileURLToPath(new URL('../../deepseek-harness', import.meta.url)))
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const { standardDecoratorPlugin, vitestExecArgv } = await import(pathToFileURL(resolve(harnessRoot, 'vitest.shared.ts')).href)
const config = ts.getParsedCommandLineOfConfigFile(resolve(harnessRoot, 'tsconfig.base.json'), {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic(diagnostic) { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')) },
})
if (!config?.options.paths) throw new Error('The Harness tsconfig.base.json must declare source paths')
const alias = Object.entries(config.options.paths).map(([name, targets]) => {
  const target = targets[0]
  if (!target) throw new Error(`Missing source path for ${name}`)
  return name.includes('*')
    ? { find: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\*', '(.*)')}$`), replacement: resolve(harnessRoot, target).replace('*', '$1') }
    : { find: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), replacement: resolve(harnessRoot, target) }
})

export default defineConfig({
  plugins: [standardDecoratorPlugin()],
  resolve: { alias: [
    { find: /^@deepseek-ai\/dsh-personal-agent$/, replacement: resolve(repositoryRoot, 'packages/experimental/personal-agent/src/index.ts') },
    { find: /^@deepseek-ai\/dsh-personal-agent\/types$/, replacement: resolve(repositoryRoot, 'packages/experimental/personal-agent/src/types.ts') },
    { find: /^@deepseek-ai\/dsh-personal-agent\/remote$/, replacement: resolve(repositoryRoot, 'packages/experimental/personal-agent/lib/typert.remote-client.js') },
    { find: /^@deepseek-ai\/dsh-voice-speech-doubao\/types$/, replacement: resolve(repositoryRoot, 'packages/experimental/voice-speech-doubao/src/types.ts') },
    ...alias,
  ], dedupe: ['react', 'react-dom', 'vitest', '@testing-library/react'] },
  test: {
    pool: 'forks',
    execArgv: vitestExecArgv,
    include: [
      'packages/experimental/client-ui-voice-conversation/tests/**/*.client.spec.{ts,tsx}',
      'packages/experimental/personal-agent/tests/**/*.spec.ts',
      'packages/experimental/voice-speech-doubao/tests/**/*.spec.ts',
    ],
  },
})
