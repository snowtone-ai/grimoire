---
name: resilience-tester
description: Build or run bounded, seeded browser resilience campaigns for local test systems. Use for duplicate actions, lifecycle churn, network faults, or browser-storage failure testing; do not use against production or real user data.
---

# Resilience Tester

Exercise a web workflow under realistic overlapping actions and browser faults, then check product invariants rather than treating the absence of a crash as success.

## Safety boundary

- Target only an explicit loopback URL on an unprivileged port. Never weaken the runner's origin check or test-only handshake.
- Use synthetic accounts and isolated data. Do not connect external services, reuse a signed-in browser profile, or point at a shared environment.
- Run only a finite seeded campaign. Keep the runner's hard time, action, restart, and concurrency caps; never add recursive agents, open-ended retries, or “run until failure” loops.
- Restart only the Playwright browser profile created by the runner. Never discover, kill, or replace a user-owned server process.
- Treat storage corruption and user-like destructive actions as authorized only after the CLI acknowledgement. This acknowledgement does not authorize product or production changes.

## Workflow

1. Identify the smallest user-visible invariant at risk: at-most-once result, no lost acknowledged write, recovery after interruption, or an explicit degraded state.
2. Create or adapt a scenario module under `tests/resilience/`. When doing so, read [the campaign contract](references/campaign-contract.md).
3. Make the local fixture return the exact `/.well-known/resilience-test` marker with `Cache-Control: no-store`. Do not add a marker to a production deployment.
4. Declare exact selectors, navigation paths, one same-origin network probe, and explicit synthetic storage keys/records. Avoid broad element discovery or random deletion.
5. Run `pnpm test:resilience:unit`, then one bounded browser campaign with a recorded seed. Use another seed only when it tests a stated hypothesis; do not loop seeds autonomously.
6. On failure, preserve `summary.json`, `history.jsonl`, trace segments, and the failure screenshot. Report the seed, first violated invariant, operation, and artifact path.

The checked-in harness blocks cross-origin requests, requires a test marker, bounds every campaign, and schedules rapid taps, duplicate submit, navigation churn, reload, page close, browser restart, offline, request abort/delay, quota errors, and declared storage corruption at least once.

## Evidence

The design follows Playwright's isolation, timeout, routing/offline, and trace guidance; W3C IndexedDB transaction/error semantics and WebDriver BiDi network-failure model; web.dev guidance on quota/eviction and offline reliability; and Jepsen's invocation/completion histories and nemesis-style fault injection. Exact sources and the dependency decision are recorded in `docs/decisions.md`.
