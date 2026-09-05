import { chromium } from '@playwright/test'
import { appendFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'

import {
  assertSafeBaseUrl,
  assertSameTargetUrl,
  assertWritableOutputPath,
  buildOperationPlan,
  createSeededRandom,
  isAllowedBrowserUrl,
  normalizeLimits,
  normalizeSeed,
  redactText,
  runBounded,
  sanitizeUrl,
} from './core.mjs'

const DIAGNOSTIC_LIMIT = 200

function boundedPush(collection, value) {
  if (collection.length < DIAGNOSTIC_LIMIT) collection.push(value)
}

function errorMessage(error) {
  return redactText(error instanceof Error ? error.message : String(error))
}

function safeArtifactName(value) {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
}

function validateScenario(scenario) {
  if (!scenario || typeof scenario !== 'object') throw new Error('Scenario must export an object')
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(scenario.name ?? '')) {
    throw new Error('Scenario name must be 2-63 lowercase letters, digits, or hyphens')
  }
  if (!/^[a-z0-9][a-z0-9-]{7,63}$/.test(scenario.safetyToken ?? '')) {
    throw new Error('Scenario safetyToken must be a non-secret 8-64 character slug')
  }

  const requiredFunctions = [
    ['targets.rapidTap', scenario.targets?.rapidTap],
    ['targets.duplicateSubmit', scenario.targets?.duplicateSubmit],
    ['probes.network', scenario.probes?.network],
    ['probes.storagePressure', scenario.probes?.storagePressure],
    ['snapshot', scenario.snapshot],
    ['assertInvariants', scenario.assertInvariants],
  ]
  for (const [name, value] of requiredFunctions) {
    if (typeof value !== 'function') throw new Error(`Scenario requires ${name}()`)
  }
  if (!Array.isArray(scenario.navigationPaths) || scenario.navigationPaths.length < 2) {
    throw new Error('Scenario requires at least two navigationPaths')
  }
  if (typeof scenario.networkPath !== 'string') throw new Error('Scenario requires networkPath')
  if (!Array.isArray(scenario.storageCorruption) || scenario.storageCorruption.length < 1) {
    throw new Error('Scenario requires explicit storageCorruption targets')
  }
}

async function verifySafetyHandshake(baseUrl, scenario) {
  const handshakeUrl = new URL('/.well-known/resilience-test', baseUrl)
  let response
  try {
    response = await fetch(handshakeUrl, {
      headers: { accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(3_000),
    })
  } catch (error) {
    throw new Error(`Resilience safety handshake failed: ${errorMessage(error)}`)
  }
  if (!response.ok) throw new Error(`Resilience safety handshake returned HTTP ${response.status}`)
  if (!response.headers.get('cache-control')?.toLowerCase().includes('no-store')) {
    throw new Error('Resilience safety handshake must return Cache-Control: no-store')
  }

  let marker
  try {
    marker = await response.json()
  } catch {
    throw new Error('Resilience safety handshake must return JSON')
  }
  if (marker?.resilienceTest !== true || marker?.environment !== 'test' || marker?.token !== scenario.safetyToken) {
    throw new Error('Target did not provide the exact test-only resilience safety marker')
  }
}

function createDiagnostics() {
  return {
    consoleErrors: [],
    externalRequests: [],
    pageErrors: [],
    requestFailures: [],
    serverErrors: [],
  }
}

function attachPageDiagnostics(page, diagnostics, activeOperation) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      boundedPush(diagnostics.consoleErrors, {
        operation: activeOperation.value,
        text: redactText(message.text()),
      })
    }
  })
  page.on('pageerror', (error) => {
    boundedPush(diagnostics.pageErrors, {
      operation: activeOperation.value,
      message: errorMessage(error),
    })
  })
  page.on('requestfailed', (request) => {
    boundedPush(diagnostics.requestFailures, {
      operation: activeOperation.value,
      url: sanitizeUrl(request.url()),
      error: redactText(request.failure()?.errorText ?? 'unknown'),
    })
  })
  page.on('response', (response) => {
    if (response.status() >= 500) {
      boundedPush(diagnostics.serverErrors, {
        operation: activeOperation.value,
        status: response.status(),
        url: sanitizeUrl(response.url()),
      })
    }
  })
}

function createNetworkController(baseUrl, diagnostics, activeOperation) {
  return {
    fault: null,
    async handle(route) {
      const requestUrl = route.request().url()
      if (!isAllowedBrowserUrl(requestUrl, baseUrl)) {
        boundedPush(diagnostics.externalRequests, {
          operation: activeOperation.value,
          method: route.request().method(),
          url: sanitizeUrl(requestUrl),
        })
        await route.abort('blockedbyclient')
        return
      }

      const url = new URL(requestUrl)
      const fault = this.fault
      if (fault && url.origin === baseUrl.origin && url.pathname === fault.pathname && fault.remaining > 0) {
        fault.remaining -= 1
        fault.hits += 1
        if (fault.kind === 'abort') {
          await route.abort('connectionreset')
          return
        }
        await new Promise((resolveDelay) => setTimeout(resolveDelay, fault.delayMs))
      }
      await route.continue()
    },
  }
}

async function settleProbes(pages, probe, signal) {
  const results = await Promise.allSettled(pages.map((page, actor) => probe({ page, actor, signal })))
  return results.map((result) => result.status === 'fulfilled'
    ? { status: 'fulfilled' }
    : { status: 'rejected', reason: errorMessage(result.reason) })
}

async function patchStorageQuota(page) {
  await page.evaluate(() => {
    const marker = '__resilienceQuotaPatch'
    if (window[marker]) throw new Error('Storage quota patch is already active')
    const quotaError = () => new DOMException('Injected test quota pressure', 'QuotaExceededError')
    const originals = {
      storageSetItem: Storage.prototype.setItem,
      idbAdd: IDBObjectStore.prototype.add,
      idbPut: IDBObjectStore.prototype.put,
      cacheAdd: globalThis.Cache?.prototype.add,
      cacheAddAll: globalThis.Cache?.prototype.addAll,
      cachePut: globalThis.Cache?.prototype.put,
    }
    Storage.prototype.setItem = function setItem() { throw quotaError() }
    IDBObjectStore.prototype.add = function add() { throw quotaError() }
    IDBObjectStore.prototype.put = function put() { throw quotaError() }
    if (globalThis.Cache) {
      Cache.prototype.add = async function add() { throw quotaError() }
      Cache.prototype.addAll = async function addAll() { throw quotaError() }
      Cache.prototype.put = async function put() { throw quotaError() }
    }
    window[marker] = originals
  })
}

async function restoreStorageQuota(page) {
  await page.evaluate(() => {
    const marker = '__resilienceQuotaPatch'
    const originals = window[marker]
    if (!originals) return
    Storage.prototype.setItem = originals.storageSetItem
    IDBObjectStore.prototype.add = originals.idbAdd
    IDBObjectStore.prototype.put = originals.idbPut
    if (globalThis.Cache) {
      Cache.prototype.add = originals.cacheAdd
      Cache.prototype.addAll = originals.cacheAddAll
      Cache.prototype.put = originals.cachePut
    }
    delete window[marker]
  })
}

async function corruptDeclaredStorage(page, targets) {
  await page.evaluate(async (declaredTargets) => {
    function requestResult(request) {
      return new Promise((resolveRequest, rejectRequest) => {
        request.onsuccess = () => resolveRequest(request.result)
        request.onerror = () => rejectRequest(request.error)
      })
    }
    function transactionDone(transaction) {
      return new Promise((resolveTransaction, rejectTransaction) => {
        transaction.oncomplete = () => resolveTransaction()
        transaction.onabort = () => rejectTransaction(transaction.error)
        transaction.onerror = () => rejectTransaction(transaction.error)
      })
    }

    for (const target of declaredTargets) {
      if (target.kind === 'localStorage' || target.kind === 'sessionStorage') {
        const storage = target.kind === 'localStorage' ? localStorage : sessionStorage
        storage.setItem(target.key, target.value)
        continue
      }
      if (target.kind !== 'indexedDB') throw new Error(`Unsupported storage target: ${target.kind}`)
      const openRequest = indexedDB.open(target.database)
      const database = await requestResult(openRequest)
      try {
        const transaction = database.transaction(target.store, 'readwrite')
        const store = transaction.objectStore(target.store)
        if (target.operation === 'delete') store.delete(target.key)
        else if (target.operation === 'put') store.put(target.value, target.key)
        else throw new Error(`Unsupported IndexedDB corruption operation: ${target.operation}`)
        await transactionDone(transaction)
      } finally {
        database.close()
      }
    }
  }, targets)
}

function validateStorageCorruptionTargets(targets) {
  for (const target of targets) {
    if (!target || typeof target !== 'object') throw new Error('Storage corruption target must be an object')
    if (target.kind === 'localStorage' || target.kind === 'sessionStorage') {
      if (typeof target.key !== 'string' || typeof target.value !== 'string') {
        throw new Error(`${target.kind} corruption requires string key and value`)
      }
      continue
    }
    if (target.kind === 'indexedDB') {
      if (typeof target.database !== 'string' || typeof target.store !== 'string') {
        throw new Error('IndexedDB corruption requires database and store names')
      }
      if (!['delete', 'put'].includes(target.operation)) {
        throw new Error('IndexedDB corruption operation must be delete or put')
      }
      continue
    }
    throw new Error(`Unsupported storage corruption kind: ${String(target.kind)}`)
  }
}

function classifyInjectedNetworkConsoleErrors(diagnostics, networkUrl) {
  const declaredNetworkUrl = sanitizeUrl(networkUrl.href)
  const expectedErrors = new Map([
    ['offline', 'net::ERR_INTERNET_DISCONNECTED'],
    ['request-abort', 'net::ERR_CONNECTION_RESET'],
  ])

  for (const entry of diagnostics.consoleErrors) {
    const expectedError = expectedErrors.get(entry.operation)
    if (!expectedError || entry.text !== `Failed to load resource: ${expectedError}`) continue

    entry.expected = diagnostics.requestFailures.some((failure) => (
      failure.operation === entry.operation
      && failure.url === declaredNetworkUrl
      && failure.error === expectedError
    ))
  }
}

async function assertNoUnexpectedDiagnostics(diagnostics, networkUrl) {
  classifyInjectedNetworkConsoleErrors(diagnostics, networkUrl)
  const failures = []
  if (diagnostics.externalRequests.length) failures.push('external network attempts')
  if (diagnostics.pageErrors.length) failures.push('uncaught page errors')
  if (diagnostics.consoleErrors.some((entry) => entry.expected !== true)) failures.push('console errors')
  if (diagnostics.serverErrors.length) failures.push('HTTP 5xx responses')
  if (failures.length) throw new Error(`Unexpected diagnostics: ${failures.join(', ')}`)
}

export async function runResilienceCampaign({
  scenario,
  acknowledged = false,
  seed: seedValue,
  limits: limitOverrides,
  artifactsDir,
  headed = false,
  cwd = process.cwd(),
} = {}) {
  if (!acknowledged) {
    throw new Error('Pass the explicit local destructive-testing acknowledgement')
  }
  validateScenario(scenario)
  validateStorageCorruptionTargets(scenario.storageCorruption)

  const baseUrl = assertSafeBaseUrl(scenario.baseURL)
  const startUrl = assertSameTargetUrl(scenario.startPath ?? '/', baseUrl, 'startPath')
  const navigationUrls = scenario.navigationPaths.map((path) => assertSameTargetUrl(path, baseUrl, 'navigationPath'))
  const networkUrl = assertSameTargetUrl(scenario.networkPath, baseUrl, 'networkPath')
  const limits = normalizeLimits(limitOverrides)
  const seed = normalizeSeed(seedValue)
  const random = createSeededRandom(seed)
  const operationPlan = buildOperationPlan({ seed, maxActions: limits.maxActions, maxRestarts: limits.maxRestarts })
  const temporaryRoot = resolve(tmpdir())
  const outputPath = assertWritableOutputPath(
    artifactsDir ?? join(cwd, 'logs', 'resilience', `${safeArtifactName(scenario.name)}-${seed}`),
    cwd,
    temporaryRoot,
  )
  await mkdir(join(outputPath, 'traces'), { recursive: true })
  const historyPath = join(outputPath, 'history.jsonl')
  await writeFile(historyPath, '', 'utf8')
  await verifySafetyHandshake(baseUrl, scenario)

  const profilePath = await mkdtemp(join(temporaryRoot, 'task-plant-resilience-'))
  const diagnostics = createDiagnostics()
  const history = []
  const activeOperation = { value: 'startup' }
  const networkController = createNetworkController(baseUrl, diagnostics, activeOperation)
  const startedAt = Date.now()
  const deadline = startedAt + limits.durationMs
  let context
  let pages = []
  let traceSegment = 0
  let primaryError = null
  let initialized = false

  async function record(event) {
    const entry = {
      index: history.length,
      elapsedMs: Date.now() - startedAt,
      ...event,
    }
    history.push(entry)
    await appendFile(historyPath, `${JSON.stringify(entry)}\n`, 'utf8')
  }

  async function openContext(reason) {
    context = await chromium.launchPersistentContext(profilePath, {
      headless: !headed,
      serviceWorkers: 'allow',
      viewport: { width: 1100, height: 800 },
    })
    context.setDefaultTimeout(limits.actionTimeoutMs)
    context.setDefaultNavigationTimeout(limits.navigationTimeoutMs)
    await context.route('**/*', (route) => networkController.handle(route))
    await context.tracing.start({ screenshots: true, snapshots: true })

    const existingPages = context.pages()
    pages = existingPages.length > 0 ? [existingPages[0]] : [await context.newPage()]
    while (pages.length < limits.concurrency) pages.push(await context.newPage())
    for (const page of pages) {
      attachPageDiagnostics(page, diagnostics, activeOperation)
      await page.goto(startUrl.href, { waitUntil: 'domcontentloaded' })
      if (new URL(page.url()).origin !== baseUrl.origin) throw new Error('Target redirected outside the safe origin')
    }
    if (!initialized && typeof scenario.initialize === 'function') {
      await scenario.initialize({ pages, seed })
      initialized = true
    }
    await record({ type: 'lifecycle', event: 'context-open', reason, traceSegment })
  }

  async function closeContext(reason) {
    if (!context) return
    const closingContext = context
    context = undefined
    pages = []
    const tracePath = join(outputPath, 'traces', `segment-${traceSegment}.zip`)
    traceSegment += 1
    try {
      await closingContext.tracing.stop({ path: tracePath })
    } catch (error) {
      await record({ type: 'diagnostic', event: 'trace-stop-failed', message: errorMessage(error) })
    }
    await closingContext.close()
    await record({ type: 'lifecycle', event: 'context-close', reason, trace: tracePath })
  }

  async function reloadAll() {
    await Promise.all(pages.map((page) => page.reload({ waitUntil: 'domcontentloaded' })))
  }

  async function executeOperation(operation, signal) {
    switch (operation) {
      case 'rapid-taps': {
        await Promise.all(pages.map(async (page, actor) => {
          const locator = scenario.targets.rapidTap({ page, actor })
          const box = await locator.boundingBox()
          if (!box) throw new Error('rapidTap target is not actionable')
          await page.bringToFront()
          for (let tap = 0; tap < limits.rapidTapCount; tap += 1) {
            if (signal.aborted) throw signal.reason
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
          }
        }))
        return
      }
      case 'duplicate-submit':
        await Promise.all(pages.map((page, actor) => scenario.targets
          .duplicateSubmit({ page, actor })
          .evaluate((element) => { element.click(); element.click() })))
        return
      case 'navigation-churn':
        await Promise.all(pages.map(async (page) => {
          const first = navigationUrls[Math.floor(random() * navigationUrls.length)]
          const second = navigationUrls.find((url) => url.href !== first.href) ?? navigationUrls[0]
          await page.goto(first.href, { waitUntil: 'domcontentloaded' })
          await page.goto(second.href, { waitUntil: 'domcontentloaded' })
          await page.goBack({ waitUntil: 'domcontentloaded' })
          await page.goForward({ waitUntil: 'domcontentloaded' })
        }))
        return
      case 'reload':
        await reloadAll()
        return
      case 'page-close': {
        const actor = Math.floor(random() * pages.length)
        await pages[actor].close()
        const replacement = await context.newPage()
        attachPageDiagnostics(replacement, diagnostics, activeOperation)
        await replacement.goto(startUrl.href, { waitUntil: 'domcontentloaded' })
        pages[actor] = replacement
        return
      }
      case 'browser-restart':
        await closeContext('seeded-browser-restart')
        await openContext('seeded-browser-restart')
        return
      case 'offline':
        await context.setOffline(true)
        try {
          await settleProbes(pages, scenario.probes.network, signal)
        } finally {
          await context.setOffline(false)
        }
        await reloadAll()
        return
      case 'request-abort':
      case 'request-delay': {
        networkController.fault = {
          kind: operation === 'request-abort' ? 'abort' : 'delay',
          pathname: networkUrl.pathname,
          delayMs: limits.networkDelayMs,
          remaining: pages.length,
          hits: 0,
        }
        try {
          await settleProbes(pages, scenario.probes.network, signal)
          if (networkController.fault.hits < 1) throw new Error(`${operation} did not intercept its declared networkPath`)
        } finally {
          networkController.fault = null
        }
        return
      }
      case 'storage-quota':
        await Promise.all(pages.map(patchStorageQuota))
        try {
          await settleProbes(pages, scenario.probes.storagePressure, signal)
        } finally {
          await Promise.all(pages.map(restoreStorageQuota))
        }
        return
      case 'storage-corruption':
        await corruptDeclaredStorage(pages[0], scenario.storageCorruption)
        await reloadAll()
        return
      default:
        throw new Error(`Unknown resilience operation: ${operation}`)
    }
  }

  try {
    await openContext('campaign-start')
    for (let index = 0; index < operationPlan.length; index += 1) {
      if (Date.now() >= deadline) throw new Error(`Campaign exceeded its ${limits.durationMs}ms duration budget`)
      const operation = operationPlan[index]
      activeOperation.value = operation
      const before = await runBounded('snapshot-before', limits.actionTimeoutMs, (signal) => scenario.snapshot({ page: pages[0], signal }))
      await record({ type: 'invoke', process: 'campaign', operation, operationIndex: index })
      try {
        await runBounded(operation, limits.actionTimeoutMs, (signal) => executeOperation(operation, signal))
        const after = await runBounded('snapshot-after', limits.actionTimeoutMs, (signal) => scenario.snapshot({ page: pages[0], signal }))
        await runBounded('assert-invariants', limits.actionTimeoutMs, (signal) => scenario.assertInvariants({
          operation,
          before,
          after,
          history: [...history],
          signal,
        }))
        await record({ type: 'ok', process: 'campaign', operation, operationIndex: index })
      } catch (error) {
        await record({ type: 'fail', process: 'campaign', operation, operationIndex: index, error: errorMessage(error) })
        throw error
      }
    }
    await assertNoUnexpectedDiagnostics(diagnostics, networkUrl)
  } catch (error) {
    primaryError = error
    try {
      const page = pages.find((candidate) => !candidate.isClosed())
      await page?.screenshot({ path: join(outputPath, 'failure.png'), fullPage: true })
    } catch (screenshotError) {
      await record({ type: 'diagnostic', event: 'screenshot-failed', message: errorMessage(screenshotError) })
    }
  } finally {
    activeOperation.value = 'shutdown'
    try {
      await closeContext('campaign-end')
    } catch (closeError) {
      primaryError ??= closeError
    }
    if (profilePath.startsWith(`${temporaryRoot}${sep}`) && profilePath.includes('task-plant-resilience-')) {
      try {
        await rm(profilePath, { recursive: true, force: true, maxRetries: 3 })
      } catch (cleanupError) {
        boundedPush(diagnostics.pageErrors, { operation: 'cleanup', message: errorMessage(cleanupError) })
        primaryError ??= cleanupError
      }
    }
  }

  const summary = {
    schemaVersion: 1,
    scenario: scenario.name,
    baseUrl: `${baseUrl.origin}${baseUrl.pathname}`,
    seed,
    limits,
    operationPlan,
    passed: primaryError === null,
    error: primaryError ? errorMessage(primaryError) : null,
    durationMs: Date.now() - startedAt,
    diagnostics,
    historyFile: historyPath,
  }
  await writeFile(join(outputPath, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  if (primaryError) {
    primaryError.message = `${primaryError.message} (seed ${seed}; diagnostics ${outputPath})`
    throw primaryError
  }
  return summary
}
