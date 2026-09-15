#!/usr/bin/env node
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

import { runResilienceCampaign } from './campaign.mjs'

const VALUE_OPTIONS = new Map([
  ['--scenario', 'scenario'],
  ['--seed', 'seed'],
  ['--max-actions', 'maxActions'],
  ['--duration-ms', 'durationMs'],
  ['--concurrency', 'concurrency'],
  ['--action-timeout-ms', 'actionTimeoutMs'],
  ['--navigation-timeout-ms', 'navigationTimeoutMs'],
  ['--rapid-tap-count', 'rapidTapCount'],
  ['--network-delay-ms', 'networkDelayMs'],
  ['--max-restarts', 'maxRestarts'],
  ['--artifacts', 'artifactsDir'],
])

function usage() {
  return `Usage:
  pnpm resilience -- --scenario <local-module.mjs> --acknowledge-local-destructive-testing [options]

Required:
  --scenario <path>                         Scenario module inside this repository
  --acknowledge-local-destructive-testing   Confirm use of isolated synthetic test data

Bounds and replay:
  --seed <uint32> --max-actions <n> --duration-ms <n> --concurrency <n>
  --action-timeout-ms <n> --navigation-timeout-ms <n>
  --rapid-tap-count <n> --network-delay-ms <n> --max-restarts <n>
  --artifacts <path> --headed
`
}

function parseArguments(argv) {
  const parsed = { limits: {} }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') return { help: true }
    if (argument === '--acknowledge-local-destructive-testing') {
      parsed.acknowledged = true
      continue
    }
    if (argument === '--headed') {
      parsed.headed = true
      continue
    }
    const property = VALUE_OPTIONS.get(argument)
    if (!property) throw new Error(`Unknown argument: ${argument}`)
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) throw new Error(`${argument} requires a value`)
    index += 1
    if (property === 'scenario' || property === 'artifactsDir') parsed[property] = value
    else if (property === 'seed') parsed.seed = value
    else parsed.limits[property] = Number(value)
  }
  return parsed
}

function assertScenarioPath(pathValue, cwd) {
  if (!pathValue) throw new Error('--scenario is required')
  const scenarioPath = resolve(cwd, pathValue)
  if (scenarioPath !== cwd && !scenarioPath.startsWith(`${cwd}${sep}`)) {
    throw new Error('Scenario module must be inside the repository')
  }
  return scenarioPath
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(usage())
    return
  }
  const cwd = resolve(process.cwd())
  const scenarioPath = assertScenarioPath(options.scenario, cwd)
  const imported = await import(pathToFileURL(scenarioPath).href)
  const scenario = imported.default
  if (!scenario) throw new Error('Scenario module must have a default export')

  const summary = await runResilienceCampaign({
    scenario,
    acknowledged: options.acknowledged,
    seed: options.seed,
    limits: options.limits,
    artifactsDir: options.artifactsDir,
    headed: options.headed,
    cwd,
  })
  process.stdout.write(`resilience PASS scenario=${summary.scenario} seed=${summary.seed} actions=${summary.operationPlan.length} durationMs=${summary.durationMs}\n`)
  process.stdout.write(`diagnostics ${summary.historyFile}\n`)
}

main().catch((error) => {
  process.stderr.write(`resilience FAIL ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
