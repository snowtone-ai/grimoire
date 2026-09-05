# Campaign contract

Read this reference when creating or changing a resilience scenario. The runner is `scripts/resilience/run.mjs`; its reusable API is `runResilienceCampaign` in `scripts/resilience/campaign.mjs`.

## Required target handshake

Before launching a browser, the runner requests this exact same-origin endpoint:

```text
GET /.well-known/resilience-test
Cache-Control: no-store
Content-Type: application/json

{"resilienceTest":true,"environment":"test","token":"the-scenario-safety-token"}
```

The base URL must be HTTP(S), use `localhost`, a `.localhost` name, `127.0.0.0/8`, or `::1`, include an explicit port of at least 1024, and contain no credentials, query, or fragment. There is no force option.

## Scenario module

Default-export an object with this shape:

```js
export default {
  name: 'checkout-resilience',
  baseURL: process.env.RESILIENCE_BASE_URL,
  safetyToken: 'checkout-fixture-v1',
  startPath: '/',
  navigationPaths: ['/cart', '/checkout'],
  networkPath: '/api/test-probe',

  targets: {
    rapidTap: ({ page }) => page.getByRole('button', { name: 'Add' }),
    duplicateSubmit: ({ page }) => page.getByRole('button', { name: 'Place test order' }),
  },
  probes: {
    network: ({ page }) => page.evaluate(() => fetch('/api/test-probe').catch(() => null)),
    storagePressure: ({ page }) => page.getByTestId('write-test-state').click(),
  },

  storageCorruption: [
    { kind: 'localStorage', key: 'synthetic-preferences', value: '{invalid-json' },
    { kind: 'indexedDB', database: 'synthetic-app', store: 'drafts', operation: 'delete', key: 'draft-1' },
  ],

  async snapshot({ page, signal }) {
    // Return only synthetic state needed to check invariants.
  },
  async assertInvariants({ operation, before, after, history, signal }) {
    // Throw with one actionable invariant violation.
  },
}
```

Selector functions must synchronously return Playwright locators. Probe, snapshot, and invariant functions must honor the supplied `AbortSignal` when they start their own asynchronous work. Do not put secrets, user content, or full request URLs in snapshots or error messages.

Storage corruption is allowlisted: name each synthetic Web Storage key or IndexedDB database/store/key. The runner supports Web Storage string replacement plus IndexedDB `delete` and `put`; it never discovers and mutates unknown records.

## Invariants

Prefer observable claims over UI-shape assertions:

- rapid taps or duplicate submits create at most one logical command result;
- every acknowledged command appears after reload, tab close, and browser restart;
- navigation churn does not duplicate, roll back, or strand pending state;
- offline, aborted, and delayed requests recover or show an explicit retryable state;
- quota errors do not produce false success or erase the last known-good state;
- malformed or missing storage recovers to an explicit safe state;
- uncaught errors, console errors, HTTP 5xx responses, and cross-origin requests are absent unless the scenario documents and checks the expected condition.

The runner records Jepsen-style `invoke`, `ok`, and `fail` entries. Use their concurrency and real-time ordering to explain a failure; do not claim distributed-system linearizability from a browser-only campaign.

## Invocation

Run the contract tests first:

```text
pnpm test:resilience:unit
```

Then start the instrumented fixture separately and run one campaign:

```text
pnpm resilience -- --scenario tests/resilience/my-scenario.mjs --acknowledge-local-destructive-testing --seed 424242
```

Defaults are intentionally finite. CLI overrides cannot exceed 120 seconds, 128 actions, four concurrent pages, four browser restarts, 12 rapid taps per actor, or the per-action hard caps in `scripts/resilience/core.mjs`.
