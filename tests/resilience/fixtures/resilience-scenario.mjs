import assert from 'node:assert/strict'

import { FIXTURE_SAFETY_TOKEN } from './resilience-fixture.mjs'

export function createFixtureScenario(baseURL) {
  return {
    name: 'fixture-resilience',
    baseURL,
    safetyToken: FIXTURE_SAFETY_TOKEN,
    startPath: '/',
    navigationPaths: ['/a', '/b'],
    networkPath: '/api/probe',
    targets: {
      rapidTap: ({ page }) => page.getByTestId('rapid'),
      duplicateSubmit: ({ page }) => page.getByTestId('submit'),
    },
    probes: {
      network: ({ page }) => page.evaluate(async () => {
        try {
          const response = await fetch('/api/probe')
          return { ok: response.ok }
        } catch (error) {
          return { ok: false, error: error.name }
        }
      }),
      storagePressure: ({ page }) => page.getByTestId('storage-write').click(),
    },
    storageCorruption: [
      { kind: 'localStorage', key: 'fixture-preference', value: '{corrupt-json' },
      { kind: 'indexedDB', database: 'resilience-fixture', store: 'records', operation: 'delete', key: 'stable' },
    ],
    async snapshot({ page }) {
      await page.waitForFunction(() => document.body.dataset.initialized === 'true')
      return page.evaluate(async () => ({
        counter: Number(localStorage.getItem('fixture-counter') || '0'),
        server: await fetch('/api/state').then((response) => response.json()),
        storageFailures: document.body.dataset.storageFailures,
        storageRecovered: document.body.dataset.storageRecovered,
      }))
    },
    async assertInvariants({ operation, before, after }) {
      assert.ok(after.server.logicalSubmits <= 1, 'duplicate submissions created more than one logical result')
      assert.ok(after.server.logicalSubmits >= before.server.logicalSubmits, 'logical submit result regressed')
      assert.ok(after.counter >= 0 && Number.isSafeInteger(after.counter), 'counter became invalid')
      if (operation === 'rapid-taps') assert.ok(after.counter >= before.counter, 'rapid taps lost existing counter state')
      if (operation === 'storage-quota') {
        assert.match(after.storageFailures, /QuotaExceededError/, 'storage quota failure was not surfaced to the fixture')
      }
      if (operation === 'storage-corruption') {
        assert.equal(after.storageRecovered, 'true', 'corrupt storage was not recovered after reload')
      }
    },
  }
}
