# Grimoire v2 — product and system architecture

Status: implementation baseline
Date: 2026-08-19
Inputs: prompt.md, docs/vision.md, Grimoire_決定事項ログ.md, Grimoire_最高品質化仕様.md

## 1. Architecture drivers

Priority order:

1. A task that appeared saved must not disappear or be applied twice.
2. Today must remain fast and understandable when offline, after years of data, and on a weak GPU.
3. Errors, pending work, storage risk, and recovery paths must be visible without becoming noisy.
4. Creature/world presentation must never own or mutate task truth.
5. Schema, renderer, Calendar provider, and a future sync provider must be replaceable behind ports.
6. Accessibility and reduced-motion/audio-off modes are first-class behavior, not visual patches.

The browser database is the authoritative local replica, but browser storage is not described as a
permanent backup. Durability therefore combines transactional IndexedDB, persistent-storage
request/status, verified export/import, migration snapshots, and an explicit health surface.

## 2. Research signals and adopted countermeasures

This is a pattern analysis, not a claim that every referenced report has the same root cause.

| Observed failure pattern | Signal | Grimoire countermeasure |
|---|---|---|
| Parent/recurring tasks fail or vanish around sync | Todoist known issues and user reports | immutable command IDs, tombstones, occurrence IDs, transactional outbox, no silent success |
| Reinstall or multi-device completion loses/duplicates data | TickTick/Todoist/Things reports | receipts, idempotent consumers, per-occurrence completion, export reminder, future sync port |
| Recurrence jumps after completion or month boundary | TickTick and Microsoft To Do reports | pure recurrence engine, local wall-clock + IANA zone, DST/month-end property tests |
| Desktop reminders silently stop or drift | Any.do reports | integration health and last-success time; retry state is visible and independently repairable |
| Local browser data is assumed permanent | Web storage documentation | request persistence after meaningful use, monitor quota, PWA install guidance, verified backup |
| Loading/splash hides a stalled bootstrap | platform loading guidance | timed emblem has a hard ceiling, then transitions to honest loading/recovery UI |

Research sources:

- Todoist known issues: https://www.todoist.com/help/known-issues
- Web storage durability and eviction: https://web.dev/articles/storage-for-the-web
- Persistent storage: https://web.dev/articles/persistent-storage
- MDN storage quotas: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- iCalendar recurrence/time-zone model: https://www.rfc-editor.org/rfc/rfc5545
- Dexie transactions: https://dexie.org/docs/Transaction/Transaction
- Apple loading guidance: https://developer.apple.com/design/human-interface-guidelines/loading

Community review threads are retained as scenario inputs, not authoritative implementation facts:

- https://www.reddit.com/r/ticktick/comments/1qkjug0/ticktick_android_sync_completely_broken_for_tasks/
- https://www.reddit.com/r/ticktick/comments/1js00j0/please_pay_attention_for_potential_data_loss/
- https://www.reddit.com/r/todoist/comments/1oifex2/beware_known_bug_recurring_tasks_deleted/
- https://www.reddit.com/r/todoist/comments/1envb3m/
- https://www.capterra.com/p/173614/Any-do/reviews/

## 3. System shape

The deployable is a Next.js App Router PWA with a client-side application core. Server rendering may
produce the shell, but domain writes occur through one local command boundary.

    App shell / routes
          |
    feature presenters  <---- committed projections ---- query store
          |                                               |
       commands                                      IndexedDB
          |                                               |
    application core ---- domain events ---- transactional outbox
          |                         |              |
       ports                     presentation   integration workers
          |                         |              |
    clock/id/crypto          UI, creature, audio   Google Calendar

Hard dependencies point inward:

- domain: types, invariants, recurrence, reward rules; no React, Dexie, Three.js, or network imports.
- application: command handlers and use cases; depends on domain and abstract ports.
- infrastructure: Dexie repositories, storage health, Calendar adapter, import/export, worker leases.
- features: Home, Calendar, Grimo, Catalog, Settings; read projections and dispatch commands.
- world: background and creature renderers; consume immutable environment and presentation events.
- bootstrap: composes concrete adapters and is the only cross-module wiring point.

No feature imports another feature implementation. Shared visual primitives live in UI; shared
business rules live in domain. The prototype remains a source package until it is adapted; generated
dist files are never copied into feature code.

## 4. Durable data model

The initial product database uses additive versioned migrations. Core tables:

| Table | Purpose and invariant |
|---|---|
| tasks | current task definitions; no hard delete in normal UI |
| taskOccurrences | one completion state per series occurrence; unique seriesId + occurrenceKey |
| commandReceipts | commandId + payloadHash + committed result; same ID with different payload is rejected |
| domainEvents | append-only audit sequence with eventId and schemaVersion |
| outbox | events awaiting a named consumer; claimed by expiring lease |
| inboxAcks | consumer + eventId uniqueness prevents durable double effects |
| rewardLedger | unique acquisition key per task + trigger; one item on creation and one on first-ever completion |
| growthLedger | first-completion source event to creature growth delta; creation rewards never grow the creature |
| inventory | item quantity projection derived transactionally from ledgers |
| settings | validated, versioned preference values |
| integrations | provider state, cursor, last attempt/success/error; secrets are not exported |
| migrationRuns | resumable source hash, stage, counts, verification and activation state |
| migrationStaging | isolated rows not visible to product queries before activation |
| localSnapshots | verified checkpoints used for repair, never advertised as an off-device backup |

Identifiers are UUIDv7/cryptographically random where ordering is not required. Event IDs and reward
choices are deterministic from stable command inputs. Every durable record has schemaVersion,
createdAt, updatedAt, and origin. Deleted tasks become tombstones and remain recoverable for a
retention window; permanent purge is an explicit maintenance command after export/checkpoint.

### Recurrence

A series definition is separate from its occurrences. occurrenceKey uses the intended local date/time
and the series IANA time zone, not an elapsed UTC duration. Completion advances no mutable pointer:
the next occurrence is derived by a pure RFC 5545-compatible function. Repeating a command for the
same occurrence returns its receipt; completing two different occurrences is valid. Moving across
time zones preserves the authoring wall-clock intent and shows the active zone in Settings.
For a monthly/yearly anchor absent from the target period, the series stores an explicit
monthDayPolicy. The initial default is clamp-to-period-end; skip is a supported policy. The engine
never infers or changes this policy from a late completion.

### Atomic command protocol

1. Validate input and permissions outside the write transaction.
2. Hash canonical payload and look up command receipt.
3. In one Dexie transaction, write task/occurrence, reward/growth/inventory, domain event, outbox,
   and receipt.
4. Publish a BroadcastChannel hint only after commit.
5. Present success/reward only from the committed event.
6. A retry with the same commandId and payload returns the stored result; a hash mismatch fails closed.

Dexie transactions contain only IndexedDB work. Network, timers, and unrelated promises are outside.

## 5. Reliability, persistence, and recovery

### Storage lifecycle

- On first meaningful save, measure navigator.storage.estimate and expose the storage state.
- Request navigator.storage.persist only from a user gesture, with a plain explanation.
- Installed-PWA guidance is offered but never blocks use.
- QuotaExceededError stops the command before success UI, preserves prior data, and opens recovery:
  export, archive media cache, retry.
- Cache Storage contains replaceable app/world assets only. IndexedDB contains user truth. A service
  worker never independently edits domain tables.
- Settings shows last successful local write, pending integration count, database version, storage
  persistence state, usage estimate, last verified export, and a self-check action.

### Backup and repair

Export is a versioned JSON envelope with manifest, counts, hashes, time zone, and app/schema versions.
Import first parses and validates into staging, generates a dry-run report, then activates atomically.
Malformed or newer-unknown records remain quarantined. Old DB, snapshots, and failed staging are never
deleted automatically.

The self-check verifies indexes, referential links, event-to-projection counts, unique ledgers, outbox
leases, and snapshot hashes. Repair is deterministic projection rebuild from events/checkpoints.
It never guesses missing user text. Diagnostics are local by default; sending a report is opt-in and
redacts task title/body.

### Future sync extension

Local-first is not hard-coded to one cloud. A SyncReplicaPort exchanges immutable operations, remote
cursor, acknowledgements, and conflict records. Google Calendar is an integration adapter, not the
task database. Future cloud sync must pass the same command receipts and occurrence semantics and may
not use last-write-wins for task body deletion or completion conflicts. Conflicts surface in a small
repair queue with both values and an undoable choice.

## 6. Comfortable long-term use

- Today query is indexed by local date/status/order and does not scan history.
- Calendar loads one visible range plus an adjacent prefetch range.
- Catalog virtualizes long lists and loads detail media on demand.
- Completed task history is paged; no automatic deletion.
- Domain event compaction is allowed only after a verified checkpoint and retains audit summaries.
- Slow work is interruptible and reports progress. Bootstrap never waits behind Calendar or 3D.
- HTML task operations stay usable if WebGL, audio, network, service worker, or optional assets fail.
- Cross-tab hints trigger a query refresh; they are not the durability mechanism.

Performance budgets:

| Path | Target |
|---|---|
| Shell to usable Home on warm load | p75 under 1.0 s on reference mid-range device |
| Local task command commit | p95 under 100 ms at 10k tasks |
| Today projection refresh | p95 under 50 ms |
| Input response | INP under 200 ms |
| World rendering | adaptive budgets in Grimoire_最高品質化仕様.md |
| Long task/import | never block input over 50 ms chunks without yielding |

## 7. Splash, motion, and startup state machine

The new wordless emblem is a broad broken seal containing an open grimoire and water/egg core.
It has two assets: a simple vector-safe mark for 32–64 px use and an atmospheric raster treatment
for the splash. It must not resemble or derive from the v1 logo.

Preference values:

- off: no emblem delay.
- timed: default; show once per cold app launch for 900 ms, maximum 1.2 s.
- always: show on every route entry that represents a fresh app launch, not every client navigation.

Bootstrap runs in parallel. When the display budget ends:

- ready -> Home.
- still loading -> honest loading state with phase and recovery action.
- migration available -> Home first, then one-time migration prompt as a non-destructive sheet.
- reduced motion -> static emblem with a 150 ms opacity transition.

Splash has no startup sound or vibration. Audio starts only after a later user gesture.

## 8. Visual system: two-pass design

### Pass 1 — intention

- Focus: today’s actions are crisp iron controls floating above a living negative-space world.
- Type: Noto Sans JP for operation; Shippori Mincho for names, lore, and catalog headings.
- Palette: black iron and stone neutrals; cyan mist light from Area 1; accent is scarce.
- Composition: asymmetrical, spacious, edge-aware. The environmental subject can cross the page
  field; UI appears only where an action or reading surface is needed.
- Signature: broken grimoire seal, hairline orbital stages, mineral edge highlights.
- Motion: brief physical press and committed-event glow; calm environmental motion only.

### Pass 2 — critique and correction

- Reject a dashboard made from equal rounded cards: it would flatten the world and resemble a template.
- Reject the first highly ornate seal: detail collapses below 64 px and incidental marks weaken the
  no-text requirement. Do not ship it; redraw one mark with three readable masses for every size.
- Reject cyan glow on every control: reserve it for focus, committed success, and environment reflection.
- Reject a full-screen 3D dependency for Home: use CSS/poster ambience so task entry survives renderer loss.
- Verify at 320 CSS px, 200% zoom, keyboard, screen reader labels, high contrast, and reduced motion.

All interaction and visual tuning values live in typed tokens/parameter objects. Feature components do
not embed magic durations, colors, or spring constants.

## 9. Use-case and failure simulation

| ID | Scenario | Expected behavior | Automated evidence |
|---|---|---|---|
| U01 | First save, persistence not granted | save succeeds; status is best-effort; Settings offers a user-gesture request/export | browser storage mock |
| U02 | double tap then tab crash | one receipt, one task/reward event, no early success | transaction crash test |
| U03 | same completion in two tabs | one occurrence completion and first reward; both tabs converge | multi-context test |
| U04 | annual/monthly recurrence at leap day, month end, DST | deterministic occurrence keys and no skipped/double dates | property/time-zone suite |
| U05 | Calendar offline or 401 | local tasks work; integration shows retry/reconnect without deleting local data | adapter fault test |
| U06 | quota exceeded during write | prior state intact; no reward animation; export recovery shown | quota fault injection |
| U07 | migration closes at every stage | resume by source hash; no staged rows visible; old DB retained | stage-by-stage kill test |
| U08 | five years, 10k tasks, 100k events | Home and Calendar stay within query budgets | seeded benchmark |
| U09 | browser storage eviction/device loss | app never promised backup; empty-state recovery and verified import work | wipe/import E2E |
| U10 | WebGL context loss or p20 below floor | poster fallback; all HTML actions remain available | browser context-loss test |
| U11 | OS reduced motion + audio off | no spatial drift, no hidden audio initialization, same information | accessibility E2E |
| U12 | splash off/timed/always and slow bootstrap | exact state transitions; no blank screen or false readiness | clock-controlled E2E |
| U13 | import corrupt/newer schema | quarantine and dry-run errors; active data unchanged | fuzz/schema tests |
| U14 | future remote delivers reordered duplicates | inbox/receipts converge; conflict is explicit | replica contract suite |

## 10. Improvement loop and completion gate

Every vertical slice repeats:

1. Implement the smallest end-to-end contract.
2. Evaluate with unit/property/integration tests, browser evidence, performance trace, and visual captures.
3. Record each measurable difference from this document as target / actual / severity / reproduction.
4. Research the specific gap using official specifications, production techniques, and relevant failure
   reports. Separate external fact from our adoption decision.
5. Re-implement one bounded correction and rerun the same evidence.
6. Stop only when critical/high gaps are zero and lower gaps have an explicit disposition.

The loop applies independently to data durability, recurrence, bootstrap, each screen, 3D, accessibility,
and sound. A large change gets a fresh-context Tier 1 review after tests pass. Visual work additionally
uses desktop/mobile screenshots and a critique pass against the composition rules above.

Evaluation ownership is intentionally asymmetric:

- Small/local evaluation: the implementation owner reruns focused tests and measurements immediately.
  This keeps the correction loop short.
- Milestone evaluation: a fresh-context reviewer receives the goal, acceptance contract, diff, and raw
  evidence, but not the implementer’s narrative. Data semantics, complete screen flows, renderer
  integration, migrations, and release readiness always use this path.
- The main agent triages findings and assigns corrections; the reviewer does not silently repair the
  implementation it judged. A changed contract is reviewed again from fresh context.

## 11. Delivery slices

1. Foundation: workspace, Next shell, tokens, emblem assets, PWA/bootstrap and CI-compatible commands.
2. Durable core: domain, Dexie schema, commands, recurrence, export/import, health and fault tests.
3. Task experience: splash, Home, Calendar, Settings and responsive navigation.
4. Living world: Area 1 adapter, creature stage, committed-event presentation and renderer fallback.
5. Discovery: Catalog, inventory, reward reveal and natural-history presentation.
6. Hardening: migration, Calendar adapter, long-data benchmarks, accessibility, audio, browser matrix.

Each slice is usable without the next one and follows the improvement gate above.
