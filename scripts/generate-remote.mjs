import { copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageName = '@deepseek-ai/dsh-voice-speech-doubao'
const sourcePackage = join(repositoryRoot, 'packages/experimental/voice-speech-doubao')
const harnessRootValue = process.env.DSH_HARNESS_ROOT
const arguments_ = process.argv.slice(2).filter(argument => argument !== '--')

if (arguments_.some(argument => argument !== '--dry-run')) {
  throw new Error('Usage: pnpm run generate:remote [--dry-run]')
}

if (harnessRootValue === undefined || harnessRootValue.trim() === '') {
  throw new Error('Set DSH_HARNESS_ROOT to a matching DeepSeek Harness checkout before generating Remote metadata.')
}

const harnessRoot = resolve(harnessRootValue)
const hostConfig = join(harnessRoot, 'tsconfig.host.json')
const generatorEntry = join(harnessRoot, 'packages/typert/generator/lib/index.js')
const protocolSource = join(harnessRoot, 'packages/typert/protocol')
const stagedProjectReference = './packages/experimental/voice-speech-doubao'
const stagedPackage = join(harnessRoot, stagedProjectReference.slice(2))
const generatedFiles = ['typert.host.js', 'typert.host.d.ts', 'typert.remote-client.js', 'typert.remote-client.d.ts']

for (const path of [hostConfig, generatorEntry, join(protocolSource, 'src/index.ts')]) {
  try {
    await readFile(path)
  } catch (cause) {
    throw new Error(`The matching Harness checkout is incomplete: ${path}. Build it with pnpm run build:artifacts, then retry.`, { cause })
  }
}

try {
  await readFile(join(harnessRoot, 'package.json'))
} catch (cause) {
  throw new Error(`DSH_HARNESS_ROOT is not a DeepSeek Harness checkout: ${harnessRoot}`, { cause })
}

const originalHostConfig = await readFile(hostConfig)
const patchedHostConfig = addHostReference(originalHostConfig.toString('utf8'), hostConfig, stagedProjectReference)
if (arguments_.includes('--dry-run')) {
  console.log(`Validated the temporary Typert project reference in ${hostConfig}.`)
  process.exit(0)
}
const backupDirectory = await mkdtemp(join(tmpdir(), 'dsh-voice-host-config-'))
const backupPath = join(backupDirectory, 'tsconfig.host.json')
await writeFile(backupPath, originalHostConfig)
let configChanged = false
let stagingCreated = false
let generationError

try {
  try {
    await mkdir(stagedPackage)
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`Refusing to replace an existing Harness package directory: ${stagedPackage}`, { cause: error })
    }
    throw error
  }
  stagingCreated = true
  await cp(sourcePackage, stagedPackage, {
    recursive: true,
    filter: path => {
      const relativePath = relative(sourcePackage, path)
      return relativePath === '' || !relativePath.split(sep).some(part => part === 'node_modules' || part === 'lib')
    },
  })
  const configBeforePatch = await readFile(hostConfig)
  if (!configBeforePatch.equals(originalHostConfig)) {
    throw new Error(`Harness config changed during validation. No temporary config was written; retry after the other edit is complete: ${hostConfig}`)
  }
  configChanged = true
  await writeFile(hostConfig, patchedHostConfig)

  const { WorkspaceTypertGenerator, writeWorkspaceArtifacts } = await import(pathToFileURL(generatorEntry).href)
  const artifacts = new WorkspaceTypertGenerator(harnessRoot, {
    checkDiagnostics: false,
    rejectBuildOutputs: true,
  }).generate([packageName], ['host'])

  if (artifacts.length !== 1 || artifacts[0]?.remote === undefined) {
    throw new Error(`Typert did not produce the Host Remote metadata for ${packageName}.`)
  }
  writeWorkspaceArtifacts(harnessRoot, artifacts)

  const outputDirectory = join(repositoryRoot, 'packages/experimental/voice-speech-doubao/lib')
  await mkdir(outputDirectory, { recursive: true })
  for (const file of generatedFiles) {
    await copyFile(join(stagedPackage, 'lib', file), join(outputDirectory, file))
  }
  // The published package includes the declarations but not a map to the temporary staging path.
  await rm(join(outputDirectory, 'typert.remote-client.d.ts.map'), { force: true })
  console.log(`Generated Host and Remote Client metadata for ${packageName}.`)
} catch (error) {
  generationError = error
} finally {
  const cleanupErrors = []
  let preserveBackup = false
  if (configChanged) {
    try {
      const currentConfig = await readFile(hostConfig)
      if (currentConfig.equals(Buffer.from(patchedHostConfig))) {
        await writeFile(hostConfig, originalHostConfig)
      } else if (!currentConfig.equals(originalHostConfig)) {
        preserveBackup = true
        cleanupErrors.push(new Error(`Harness config changed during generation and was left untouched. Restore or merge the original from ${backupPath}; the staged package was removed.`))
      }
    } catch (error) {
      preserveBackup = true
      cleanupErrors.push(error)
    }
  }
  if (stagingCreated) {
    try {
      await rm(stagedPackage, { recursive: true, force: true })
    } catch (error) {
      cleanupErrors.push(error)
    }
  }
  if (!preserveBackup) {
    try {
      await rm(backupDirectory, { recursive: true, force: true })
    } catch (error) {
      cleanupErrors.push(error)
    }
  }
  if (cleanupErrors.length > 0) {
    generationError = generationError === undefined
      ? new AggregateError(cleanupErrors, 'Failed to clean up the temporary Harness Typert integration.')
      : new AggregateError([generationError, ...cleanupErrors], 'Generation failed and temporary Harness cleanup needs attention.')
  }
}
if (generationError !== undefined) throw generationError

function addHostReference(source, file, stagedProjectReference) {
  const ts = requireTypescript(file)
  const json = ts.parseJsonText(file, source)
  if (json.parseDiagnostics.length > 0) {
    throw new Error(`Could not parse ${file}: ${json.parseDiagnostics.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('; ')}`)
  }
  const expression = json.statements[0]?.expression
  if (expression === undefined || !ts.isObjectLiteralExpression(expression)) {
    throw new Error(`Expected a JSON object in ${file}.`)
  }
  const property = expression.properties.find(item => hasPropertyName(ts, item, 'references'))
  if (property === undefined || !ts.isPropertyAssignment(property) || !ts.isArrayLiteralExpression(property.initializer)) {
    throw new Error(`Expected a references array in ${file}.`)
  }
  const references = property.initializer
  if (references.elements.some(element => ts.isObjectLiteralExpression(element)
    && element.properties.some(member => hasPropertyName(ts, member, 'path')
      && ts.isStringLiteral(member.initializer)
      && member.initializer.text === stagedProjectReference))) {
    throw new Error(`The Harness already references ${stagedProjectReference} in ${file}; remove that stale reference and retry.`)
  }
  if (references.elements.length === 0) {
    const position = references.getStart(json) + 1
    return `${source.slice(0, position)}\n    { "path": "./packages/experimental/voice-speech-doubao" }\n  ${source.slice(position)}`
  }
  const last = references.elements.at(-1)
  if (last === undefined) throw new Error(`Could not locate the final project reference in ${file}.`)
  const rest = source.slice(last.end, references.end - 1)
  const separator = rest.trimStart().startsWith(',') ? '\n    ' : ',\n    '
  return `${source.slice(0, last.end)}${separator}{ "path": "./packages/experimental/voice-speech-doubao" }${source.slice(last.end)}`
}

function requireTypescript(file) {
  const require = createRequire(import.meta.url)
  const path = resolve(dirname(file), 'node_modules/typescript')
  try {
    return require(path)
  } catch (cause) {
    throw new Error('Install dependencies in the matching Harness checkout before generating Remote metadata.', { cause })
  }
}

function hasPropertyName(ts, member, name) {
  return ts.isPropertyAssignment(member)
    && ((ts.isIdentifier(member.name) && member.name.text === name)
      || (ts.isStringLiteral(member.name) && member.name.text === name))
}
