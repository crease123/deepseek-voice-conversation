import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const harnessRoot = process.env.DSH_HARNESS_ROOT
if (!harnessRoot) throw new Error('Set DSH_HARNESS_ROOT to a matching DeepSeek Harness checkout before building the Client bundle.')
const { clientBundle } = await import(pathToFileURL(join(harnessRoot, 'packages/client/tsdown.client.ts')).href)

export default clientBundle(import.meta.dirname, ['lib/types/index.js'])
