import assert from 'node:assert/strict'

export const CAROL_RESILIENCE_TOKEN = 'carol-3d-resilience-v1'

async function waitForCarol(page, timeout = 15_000, requireIdle = true) {
  await page.waitForFunction((idle) => {
    const stage = document.querySelector('.carol3d-stage')
    return stage?.dataset.ready === 'true' && stage.dataset.performance === 'valid'
      && (!idle || stage.dataset.feeding === 'false')
  }, requireIdle, { timeout })
}

export function createCarolResilienceScenario(baseURL) {
  return {
    name: 'carol-3d-resilience',
    baseURL,
    safetyToken: CAROL_RESILIENCE_TOKEN,
    startPath: '/plant/carol-3d',
    navigationPaths: ['/plant', '/plant/carol-3d'],
    networkPath: '/api/resilience-probe',
    targets: {
      rapidTap: ({ page }) => page.getByRole('button', { name: 'マカロンをあげる（チェック用）', exact: true }),
      duplicateSubmit: ({ page }) => page.getByRole('button', { name: 'マカロンをあげる（チェック用）', exact: true }),
    },
    probes: {
      network: ({ page }) => page.evaluate(() => fetch('/api/resilience-probe').then(response => response.ok).catch(() => false)),
      storagePressure: ({ page }) => page.evaluate(async () => {
        const failures = []
        try { localStorage.setItem('carol-resilience-pressure', 'synthetic') } catch (error) { failures.push(error.name) }
        try {
          const request = indexedDB.open('grimoire-carol-resilience', 1)
          const database = await new Promise((resolve, reject) => {
            request.onupgradeneeded = () => request.result.createObjectStore('records')
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })
          const transaction = database.transaction('records', 'readwrite')
          transaction.objectStore('records').put({ status: 'synthetic' }, 'pressure')
          await new Promise((resolve, reject) => {
            transaction.oncomplete = resolve
            transaction.onerror = () => reject(transaction.error)
            transaction.onabort = () => reject(transaction.error)
          })
          database.close()
        } catch (error) { failures.push(error.name) }
        document.documentElement.dataset.carolResilienceStorage = failures.sort().join(',') || 'ok'
      }),
    },
    storageCorruption: [
      { kind: 'localStorage', key: 'carol-resilience-preference', value: '{invalid-json' },
      { kind: 'indexedDB', database: 'grimoire-carol-resilience', store: 'records', operation: 'delete', key: 'stable' },
    ],
    async initialize({ pages }) {
      // Carol intentionally stops its animation loop in a background document.
      // Bring each persistent-context page forward once before observing its
      // renderer state, otherwise a concurrent hidden tab can never produce
      // the first frame this scenario asserts on.
      for (const page of pages) {
        await page.bringToFront()
        // The model is deliberately high-detail, so only startup receives a
        // longer bounded budget; steady-state assertions remain at 15 seconds.
        await waitForCarol(page, 30_000)
        await page.evaluate(async () => {
          localStorage.setItem('carol-resilience-preference', '{"mode":"synthetic"}')
          const request = indexedDB.open('grimoire-carol-resilience', 1)
          const database = await new Promise((resolve, reject) => {
            request.onupgradeneeded = () => request.result.createObjectStore('records')
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })
          const transaction = database.transaction('records', 'readwrite')
          transaction.objectStore('records').put({ status: 'stable' }, 'stable')
          await new Promise((resolve, reject) => {
            transaction.oncomplete = resolve
            transaction.onerror = () => reject(transaction.error)
            transaction.onabort = () => reject(transaction.error)
          })
          database.close()
        })
      }
    },
    async snapshot({ page }) {
      // A snapshot is an observable foreground-user state. Restoring focus
      // also drives Carol's visibility handler after reload or offline churn.
      await page.bringToFront()
      // A snapshot observes health during an action as well as at rest. In
      // headless Chromium an unfocused WebGL animation may advance slowly;
      // waiting for the cosmetic feed timeline would turn that scheduling
      // detail into a false failure of the resilience invariants.
      await waitForCarol(page, 15_000, false)
      return page.locator('.carol3d-stage').evaluate((stage) => ({
        ready: stage.dataset.ready,
        performance: stage.dataset.performance,
        feeding: stage.dataset.feeding,
        feedCount: Number(stage.dataset.feedCount || '0'),
        storage: document.documentElement.dataset.carolResilienceStorage || '',
      }))
    },
    async assertInvariants({ operation, before, after }) {
      assert.equal(after.ready, 'true', 'Carol did not recover to a ready state')
      assert.equal(after.performance, 'valid', 'Carol emitted an invalid transform or morph state')
      assert.ok(Number.isSafeInteger(after.feedCount) && after.feedCount >= 0, 'feed count became invalid')
      if (operation === 'rapid-taps' || operation === 'duplicate-submit') {
        assert.ok(after.feedCount <= before.feedCount + 1, 'one Carol instance accepted more than one overlapping feed')
      }
      if (operation === 'storage-quota') assert.match(after.storage, /QuotaExceededError/, 'synthetic storage quota was not surfaced')
    },
  }
}
