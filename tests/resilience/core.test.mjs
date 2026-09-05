import assert from 'node:assert/strict'
import { join, resolve } from 'node:path'
import test from 'node:test'

import {
  REQUIRED_OPERATIONS,
  assertSafeBaseUrl,
  assertWritableOutputPath,
  buildOperationPlan,
  createSeededRandom,
  normalizeLimits,
  redactText,
  runBounded,
  sanitizeUrl,
} from '../../scripts/resilience/core.mjs'

test('only explicit unprivileged loopback targets are accepted', () => {
  assert.equal(assertSafeBaseUrl('http://127.0.0.1:3099').origin, 'http://127.0.0.1:3099')
  assert.equal(assertSafeBaseUrl('http://localhost:4173').origin, 'http://localhost:4173')
  assert.equal(assertSafeBaseUrl('http://[::1]:8080').hostname, '[::1]')

  for (const value of [
    'https://example.com:4443',
    'http://0.0.0.0:3000',
    'http://localhost',
    'http://localhost:80',
    'http://user:secret@localhost:3000',
    'file:///tmp/fixture.html',
  ]) {
    assert.throws(() => assertSafeBaseUrl(value), /Refusing|explicit|Credentials|http or https/)
  }
})

test('seeded plans are reproducible, exhaustive, and restart bounded', () => {
  const input = { seed: 123456, maxActions: 64, maxRestarts: 2 }
  const first = buildOperationPlan(input)
  const second = buildOperationPlan(input)
  assert.deepEqual(first, second)
  assert.notDeepEqual(first, buildOperationPlan({ ...input, seed: 123457 }))
  assert.deepEqual(new Set(first), new Set(REQUIRED_OPERATIONS))
  assert.ok(first.filter((operation) => operation === 'browser-restart').length <= 2)

  const randomA = createSeededRandom(42)
  const randomB = createSeededRandom(42)
  assert.deepEqual(Array.from({ length: 10 }, randomA), Array.from({ length: 10 }, randomB))
})

test('campaign limits reject missing coverage, unknown options, and unsafe fan-out', () => {
  assert.equal(normalizeLimits({ maxActions: REQUIRED_OPERATIONS.length }).maxActions, REQUIRED_OPERATIONS.length)
  assert.throws(() => normalizeLimits({ maxActions: REQUIRED_OPERATIONS.length - 1 }), /at least/)
  assert.throws(() => normalizeLimits({ concurrency: 5 }), /hard limit/)
  assert.throws(() => normalizeLimits({ extra: 1 }), /Unknown/)
  assert.throws(() => normalizeLimits({ durationMs: 0 }), /positive integer/)
})

test('diagnostics redact common credentials and discard URL query data', () => {
  assert.equal(redactText('Authorization: Bearer top.secret-token'), 'Authorization: Bearer [REDACTED]')
  assert.equal(sanitizeUrl('http://localhost:3000/path?token=secret#fragment'), 'http://localhost:3000/path')
})

test('output paths stay in the repository or temporary directory', () => {
  const root = resolve(process.cwd())
  const cwd = join(root, 'sandbox-project')
  const temporaryRoot = join(root, 'synthetic-temp')
  assert.equal(assertWritableOutputPath(join(cwd, 'logs', 'run'), cwd, temporaryRoot), resolve(cwd, 'logs', 'run'))
  assert.equal(assertWritableOutputPath(join(temporaryRoot, 'resilience-run'), cwd, temporaryRoot), resolve(temporaryRoot, 'resilience-run'))
  assert.throws(() => assertWritableOutputPath(join(root, 'outside-run'), cwd, temporaryRoot), /repository or operating-system/)
})

test('bounded operations abort instead of waiting indefinitely', async () => {
  await assert.rejects(
    runBounded('hung probe', 20, (signal) => new Promise((resolvePromise, rejectPromise) => {
      signal.addEventListener('abort', () => rejectPromise(signal.reason), { once: true })
    })),
    /hung probe exceeded 20ms/,
  )
})
