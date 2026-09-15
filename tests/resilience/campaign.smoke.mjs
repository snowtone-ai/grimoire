import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runResilienceCampaign } from '../../scripts/resilience/campaign.mjs'
import { startResilienceFixture } from './fixtures/resilience-fixture.mjs'
import { createFixtureScenario } from './fixtures/resilience-scenario.mjs'

test('bounded browser campaign exercises every required disruption and emits replay diagnostics', { timeout: 90_000 }, async () => {
  const fixture = await startResilienceFixture()
  const artifactsDir = await mkdtemp(join(tmpdir(), 'resilience-smoke-artifacts-'))
  try {
    const summary = await runResilienceCampaign({
      scenario: createFixtureScenario(fixture.baseURL),
      acknowledged: true,
      seed: 424242,
      limits: {
        durationMs: 60_000,
        maxActions: 11,
        concurrency: 2,
        actionTimeoutMs: 10_000,
        navigationTimeoutMs: 10_000,
        rapidTapCount: 3,
        networkDelayMs: 25,
        maxRestarts: 1,
      },
      artifactsDir,
    })

    assert.equal(summary.passed, true)
    assert.equal(new Set(summary.operationPlan).size, 11)
    assert.equal(summary.seed, 424242)
    assert.ok(summary.diagnostics.requestFailures.length >= 1, 'injected network faults should be diagnosed')
    assert.ok(summary.diagnostics.consoleErrors.length >= 1, 'browser should report the injected network failures')
    assert.ok(
      summary.diagnostics.consoleErrors.every((entry) => entry.expected === true),
      'only console errors correlated to declared injected network failures should be accepted',
    )

    const history = await readFile(summary.historyFile, 'utf8')
    assert.match(history, /"type":"invoke"/)
    assert.match(history, /"type":"ok"/)
    assert.doesNotMatch(history, /"type":"fail"/)
  } finally {
    await fixture.close()
    await rm(artifactsDir, { recursive: true, force: true })
  }
})
