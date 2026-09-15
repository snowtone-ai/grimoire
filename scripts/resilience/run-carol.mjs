#!/usr/bin/env node
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

import { runResilienceCampaign } from './campaign.mjs'
import { createCarolResilienceScenario } from '../../tests/resilience/carol-3d-scenario.mjs'

function optionValue(name, fallback) {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}

async function reserveLoopbackPort() {
  const server = createServer()
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve()))
  const address = server.address()
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  if (!address || typeof address === 'string') throw new Error('Could not reserve a loopback port')
  return address.port
}

async function waitForMarker(baseURL) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseURL}/.well-known/resilience-test`)
      if (response.ok) return
    } catch {}
    await delay(250)
  }
  throw new Error('Carol resilience server did not expose its test-only safety marker')
}

async function stop(child) {
  // On Windows the command-shell wrapper can exit before its `next` child.
  // Kill its whole tree so an interrupted campaign cannot retain the isolated
  // `.next-resilience` development lock for a later run.
  if (process.platform === 'win32' && child.pid) {
    await new Promise(resolve => {
      const taskkill = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
      taskkill.once('exit', resolve)
      taskkill.once('error', resolve)
    })
    return
  }
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    delay(5_000).then(() => child.kill('SIGKILL')),
  ])
}

if (!process.argv.includes('--acknowledge-local-destructive-testing')) {
  throw new Error('Pass --acknowledge-local-destructive-testing to use synthetic Carol resilience faults')
}

const port = await reserveLoopbackPort()
const baseURL = `http://127.0.0.1:${port}`
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : pnpm
const args = process.platform === 'win32'
  ? ['/d', '/s', '/c', `${pnpm} exec next dev --port ${port}`]
  : ['exec', 'next', 'dev', '--port', String(port)]
const child = spawn(command, args, {
  cwd: process.cwd(),
  env: { ...process.env, RESILIENCE_TEST: '1' },
  stdio: 'inherit',
})

try {
  await waitForMarker(baseURL)
  const summary = await runResilienceCampaign({
    scenario: createCarolResilienceScenario(baseURL),
    acknowledged: true,
    seed: Number(optionValue('--seed', '20260910')),
    // Carol's GLB is intentionally detailed.  One isolated browser context
    // keeps the campaign representative without background WebGL throttling;
    // duplicate clicks and rapid taps still exercise action races.
    limits: { durationMs: 300_000, maxActions: 11, concurrency: 1, actionTimeoutMs: 60_000, navigationTimeoutMs: 30_000, rapidTapCount: 4, networkDelayMs: 100, maxRestarts: 1 },
    artifactsDir: optionValue('--artifacts', 'output/resilience/carol-3d'),
    cwd: process.cwd(),
  })
  process.stdout.write(`Carol resilience PASS seed=${summary.seed} actions=${summary.operationPlan.length}\n`)
} finally {
  await stop(child)
}
