# Grimoire v2 — quality difference ledger

This is the working record for the loop defined in docs/architecture.md §10.
A slice is not complete because code exists; it is complete when repeated evidence brings its
critical/high differences inside target.

## Method

For every pass:

1. Capture the same reproducible evidence before and after a correction.
2. Describe the user-visible difference, not only the implementation symptom.
3. Research the narrow difference. Prefer specifications and primary documentation; use reviews and
   incident reports to discover failure scenarios.
4. Record external fact, our inference, and our chosen intervention separately.
5. Change one bounded cause, rerun the evidence, and keep regressions in the automated suite.

Focused checks are owned by the implementer. A whole durable-data contract, complete screen flow,
world integration, migration, or release gate is evaluated by a fresh-context reviewer that sees the
acceptance contract and evidence but does not inherit the implementation conversation.

Severity:

- critical: data loss/corruption, inaccessible core action, security/privacy breach.
- high: incorrect durable result, blocked core flow, silent failure, unusable target device.
- medium: measurable target miss with a viable workaround.
- low: polish difference that does not obscure result or action.

## Active pass

| Pass | Slice | Target evidence | Status |
|---|---|---|---|
| P001 | foundation/startup | install, lint, typecheck, test, build; 320px/desktop splash and Home capture | verified; physical devices pending |
| P002 | durable commands | duplicate/crash/hash/reward/recurrence/import fault tests | reviewed; browser fault injection/10k pending |
| P003 | task experience | keyboard/zoom/reduced-motion and responsive browser evidence | reviewed; 200% zoom pending |
| P004 | world contract | schema adaptation, fallback, invalid environment tests | reviewed; final assets/context-loss E2E pending |
| P005 | PWA/offline | production install/cache/reload with no failed request | Chromium verified; Windows WebKit harness skipped |

## Differences

| ID | Pass | Severity | Target | Actual/reproduction | Research finding | Intervention | Re-evaluation |
|---|---|---|---|---|---|---|---|
| Q001 | P001 | medium | emblem reads at 32px with no visible text | first generated concept has too many fine rings and incidental marks | small icon marks need few strong masses; visual critique | reject generated draft; redraw one SVG from broken seal/book/core for all operational sizes | pending |
| Q002 | P001 | high | timed splash never hides a stalled app | a fixed delay alone cannot distinguish ready/stalled bootstrap | platform loading guidance favors prompt feedback and determinate state when possible | hard ceiling, then phase/retry loading state | pending |
| Q003 | P002 | critical | local-first data has a recoverable durability story | default browser storage may be evicted | Storage API distinguishes best-effort/persistent and exposes estimate/persist | explicit persistence state, quota handling, verified export/import | pending |
| Q004 | P003 | high | splash runs once for the intended launch and announces readiness once | an unstable callback restarted the splash effect after its own ready update | React effects must synchronize external work and keep stable dependencies | make the startup transition reducer/clock-driven and regression-test ready/slow/off modes | pending |
| Q005 | P002 | critical | one creation item and one first-completion item coexist per task | reward ledger used a unique taskId, so the second valid acquisition could not be stored | the product decision defines two independently idempotent acquisition triggers | key reward entries by deterministic trigger event; growth remains completion-only | pending |
| Q006 | P002 | high | daily recurrence stays anchored when queried after any date | interval was added to the query date, drifting when that date was not an occurrence | recurrence is derived from the series anchor, never from completion/query time | derive the next interval index from start and add an off-cadence regression test | pending |
| Q007 | P004 | medium | world depth follows the no-gradient visual constraint | first poster/egg pass used CSS and SVG gradients | layered solid translucent materials preserve depth without generic generated-light effects | replace gradients with solid strata, outlines, blur and measured opacity | pending |
| Q008 | P002 | high | refresh query count does not grow with reward history | Catalog initially joined every inventory row against a full reward-ledger read, producing quadratic local work | IndexedDB has no server join, so durable projections should be materialized at commit and read in bulk | store first/last discovery on inventory atomically; v1→v2 bulk backfill; Catalog O(inventory) | unit migration/projection tests and 59-test full suite pass |
| Q009 | P005 | high | warmed PWA reloads offline without hidden network failure | cached HTML referenced uncached Next chunks; visible shell survived but console/network failed | offline navigation requires the complete shell dependency graph, and Next prefetch can create background RSC failures | cache HTML-referenced static chunks; disable nonessential Link prefetch; run E2E against production build | Chromium offline E2E pass with zero console/request failures |
| Q010 | P002 | high | routine writes do not reproject every active recurrence | independent review found each refresh loaded all active tasks and expanded up to 100 occurrences per task | read models should cache immutable base projections and apply committed deltas; full rebuild belongs to bootstrap/range/import boundaries | cache active tasks and calendar/today bases; append one created task; completion/settings/persistence reuse the projection | diagnostic regression proves one task query/one rebuild across initialize+create+complete+settings+persist; full suite 60 pass |

## Closed differences

Move a row here only after the original evidence has been rerun and linked in the task ledger.
