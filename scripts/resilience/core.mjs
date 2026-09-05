import { isIP } from 'node:net'
import { resolve, sep } from 'node:path'

export const REQUIRED_OPERATIONS = Object.freeze([
  'rapid-taps',
  'duplicate-submit',
  'navigation-churn',
  'reload',
  'page-close',
  'browser-restart',
  'offline',
  'request-abort',
  'request-delay',
  'storage-quota',
  'storage-corruption',
])

export const DEFAULT_LIMITS = Object.freeze({
  durationMs: 30_000,
  maxActions: 16,
  concurrency: 2,
  actionTimeoutMs: 5_000,
  navigationTimeoutMs: 8_000,
  rapidTapCount: 5,
  networkDelayMs: 200,
  maxRestarts: 2,
})

export const HARD_LIMITS = Object.freeze({
  durationMs: 120_000,
  maxActions: 128,
  concurrency: 4,
  actionTimeoutMs: 15_000,
  navigationTimeoutMs: 30_000,
  rapidTapCount: 12,
  networkDelayMs: 2_000,
  maxRestarts: 4,
})

const INTEGER_LIMITS = Object.keys(DEFAULT_LIMITS)

function isLoopbackIpv4(hostname) {
  if (isIP(hostname) !== 4) return false
  return Number(hostname.split('.')[0]) === 127
}

export function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized === '::1'
    || normalized === '0:0:0:0:0:0:0:1'
    || isLoopbackIpv4(normalized)
}

export function assertSafeBaseUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`Invalid resilience base URL: ${String(value)}`)
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Resilience targets must use http or https')
  }
  if (!isLoopbackHostname(url.hostname)) {
    throw new Error(`Refusing non-loopback resilience target: ${url.hostname}`)
  }
  if (url.username || url.password) {
    throw new Error('Credentials are forbidden in resilience target URLs')
  }
  if (!url.port || Number(url.port) < 1024) {
    throw new Error('Resilience targets must use an explicit, unprivileged port (1024-65535)')
  }
  if (url.search || url.hash) {
    throw new Error('Base URL must not contain query parameters or a fragment')
  }

  url.pathname = url.pathname.replace(/\/+$/, '') || '/'
  return url
}

export function assertSameTargetUrl(value, baseUrl, label = 'URL') {
  const target = new URL(value, baseUrl)
  if (target.origin !== baseUrl.origin) {
    throw new Error(`${label} must stay on the exact resilience target origin`)
  }
  return target
}

export function isAllowedBrowserUrl(value, baseUrl) {
  let url
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (['about:', 'blob:', 'data:'].includes(url.protocol)) return true
  return ['http:', 'https:'].includes(url.protocol) && url.origin === baseUrl.origin
}

function boundedInteger(name, value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`)
  }
  if (value > HARD_LIMITS[name]) {
    throw new Error(`${name} exceeds the hard limit of ${HARD_LIMITS[name]}`)
  }
  return value
}

export function normalizeLimits(overrides = {}) {
  const unknown = Object.keys(overrides).filter((key) => !INTEGER_LIMITS.includes(key))
  if (unknown.length > 0) {
    throw new Error(`Unknown resilience limit: ${unknown.join(', ')}`)
  }

  const limits = {}
  for (const name of INTEGER_LIMITS) {
    limits[name] = boundedInteger(name, overrides[name] ?? DEFAULT_LIMITS[name])
  }
  if (limits.maxActions < REQUIRED_OPERATIONS.length) {
    throw new Error(`maxActions must be at least ${REQUIRED_OPERATIONS.length} to cover every required fault`)
  }
  return Object.freeze(limits)
}

export function normalizeSeed(value = 0x5eed1234) {
  const seed = typeof value === 'string' ? Number(value) : value
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new Error('seed must be an unsigned 32-bit integer')
  }
  return seed >>> 0
}

export function createSeededRandom(seedValue) {
  let state = normalizeSeed(seedValue)
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function shuffle(values, random) {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

export function buildOperationPlan({ seed, maxActions, maxRestarts }) {
  const random = createSeededRandom(seed)
  const plan = shuffle(REQUIRED_OPERATIONS, random)
  let restartCount = 1

  while (plan.length < maxActions) {
    const candidates = restartCount >= maxRestarts
      ? REQUIRED_OPERATIONS.filter((name) => name !== 'browser-restart')
      : REQUIRED_OPERATIONS
    const operation = candidates[Math.floor(random() * candidates.length)]
    plan.push(operation)
    if (operation === 'browser-restart') restartCount += 1
  }

  return Object.freeze(plan)
}

export function redactText(value, maxLength = 500) {
  const text = String(value)
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:api[_-]?key|token|access[_-]?token|key)=)[^&#\s]+/gi, '$1[REDACTED]')
    .replace(/\b(?:AIza|sk-)[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

export function sanitizeUrl(value) {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return redactText(value, 200)
  }
}

export function assertWritableOutputPath(pathValue, cwd, temporaryRoot) {
  const candidate = resolve(pathValue)
  const allowedRoots = [resolve(cwd), resolve(temporaryRoot)]
  const insideAllowedRoot = allowedRoots.some((root) => candidate === root || candidate.startsWith(`${root}${sep}`))
  if (!insideAllowedRoot) {
    throw new Error('Resilience output must stay inside the repository or operating-system temporary directory')
  }
  return candidate
}

export async function runBounded(label, timeoutMs, operation) {
  const controller = new AbortController()
  let timer
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort(new Error(`${label} exceeded ${timeoutMs}ms`))
          reject(controller.signal.reason)
        }, timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
