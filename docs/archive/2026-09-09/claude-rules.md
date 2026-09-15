# CLAUDE.md -- Grimoire (formerly Task Plant) / pm-zero v12.1 (Claude Code only, Windows PowerShell, Pro plan)

## Language
- Reports, error reports, manual confirmation requests: Japanese.
- Code identifiers and command names: English.
- When 3+ HIGH assumptions accumulate, ask immediately (batched).

## Source of Truth (read on demand)
- Intent: docs/vision.md | Tasks: tasks.md | State: docs/state.md
- Decisions: docs/decisions.md | Failures: docs/issues.md | Map: docs/repo-map.md
- Domain vocabulary: CONTEXT.md | Report: HANDOFF-JA.md
- Scoped rules: .claude/rules/*.md (path-scoped facts; loads only when a matching file
  is read, not on every session)

## Startup Read
- This file, docs/state.md, docs/issues.md, and docs/repo-map.md Summary. Nothing else
  in full. Resolve the active task from state, then query only its row and relevant
  decisions by ID or keyword; historical ledgers are read on demand.

## Budget (Pro plan, hard wall)
- Do not split work across sessions -- long sessions are cheaper (cached input bills at
  ~10%, one-hour TTL on a subscription). /compact at task boundaries and commit
  immediately before it.
- Sonnet 5 for everything by default, at platform-default effort. Explore subagent for
  wide reading (only the summary returns); planner/reviewer Opus 5 subagents for
  architecture and final review -- never for single-file fixes or first-attempt
  debugging. Never block on Opus.
- Long builds/tests in background. Batch questions.

## Continuity (auto-compact at an absolute window)
- Auto-compact fires at CLAUDE_CODE_AUTO_COMPACT_WINDOW=400000, set globally in
  ~/.claude/settings.json. The absolute window takes precedence over any percentage
  override, so none is set here or in this project's .claude/settings.json.
- The global PreCompact hook auto-checkpoints tasks.md/docs/state.md/docs/issues.md
  before compaction fires; still restate active task ID, modified files list, and
  verify command in your own summary.
- Checkpoint to tasks.md + docs/state.md and commit after each logical unit.
- Keep this file lean; @path or rg for detail; subagents for wide reading.

## Autonomy
- bypassPermissions is active; never ask permission for tool calls.
- The global guard hook blocks the dangerous set (destructive shell commands, and
  .env*/.secret reads AND writes via Read/Edit/Write/MultiEdit); if blocked, do not
  work around it.
- For long or multi-session tasks, use /goal <condition> to record the completion
  condition so it survives compaction/handoff. The evaluator only reads the transcript
  and cannot run commands -- it gets you continuation, not evidence; still verify with
  a real command (pnpm verify/test) before declaring the task done.
- Human gate only for irreversible real-world acts (real money, prod credentials,
  publishing personal data).

## Task Ledger
- tasks.md is the only execution ledger; the main agent is the only writer.
- Every ready task: owner, dependencies, write scope, acceptance, verification, evidence.
- Product code changes require an explicit task in tasks.md.
- Record each fact once: tasks owns execution/result, state owns only the current pointer,
  decisions owns rationale, and specialist ledgers own their domain detail. Link by ID instead
  of copying test logs or review findings between files.

## Parallelism
- Disjoint write scopes or worktree isolation. Same file -> serialize.
- In one worktree, never run `next dev` and `next build` concurrently because both write `.next`;
  use a separate worktree/output directory when they must overlap.
- Default cap: <=2 concurrent worker subagents; raise only if budget clearly allows.

## Self-Review (no human reviewer)
- Tier 0: during implementation run the narrowest affected command. On a stable product-code
  candidate run `pnpm verify` once; if it fails, iterate on only the failing command, then run
  one final `pnpm verify`. Markdown-only follow-up does not invalidate a green product-code run;
  use `git diff --check`. CI (.github/workflows/ci.yml) remains the merge gate.
- Tier 1: fresh-context reviewer subagent (Opus 5, read-only) when the change is large,
  crosses routes/subsystems, changes persistence or integration contracts, is hard to undo,
  or touches shared UI primitives/design tokens with multiple consumers (v12.1 §16.5).
  The reviewer uses current Tier 0 evidence and reruns deterministic suites only when evidence
  is missing/stale or a finding needs reproduction. Ask for every issue with
  severity/confidence -- do not restrict it to serious issues only, or recall drops.
- Tier 2 is retired: it fired on auth/billing/DB-schema/deploy/production-data classes
  that essentially do not occur in this project. If one of those classes ever appears,
  re-derive the tier rather than re-enabling it from memory.

## Frontend/UI Operating Layer (pm-zero v12.1 §16)
- Browser self-verification before "done" is already covered by the global judgment
  instruction (start the dev server, check the changed screen with Playwright MCP at
  the breakpoints touched, confirm no console/runtime error) -- code-reading is not a
  substitute.
- Before diagnosing a UI mismatch, prove the browser is serving the worktree. If a stack frame,
  selector, or computed style contradicts current source, stop editing: compare the raw dev-server
  response, then use a fresh browser context or unregister Service Workers and clear Cache Storage.
  Clear `.next` only when the dev-server/build response itself is stale. This is the first step,
  not a fallback after repeated CSS edits or server restarts.
- For a change big enough to need sign-off before or mid-implementation (a new screen,
  a visual-direction change), generate the design at claude.ai/design via `/design-sync`
  and show it to the owner instead of deciding unilaterally -- they can react to a
  rendered design even though they cannot review a diff.
- `DESIGN.md` is not adopted here (no concrete need yet, per Section 3's rule for every
  optional file): this app's screens (Home/Calendar/Book/Plant/Settings) predate the
  token-registry pattern and there is no current plan to retrofit one. §7's raw-value
  lint therefore stays unwired in `scripts/verify.mjs` -- it only activates once a
  project adopts `DESIGN.md`.
- Project-local UI tools are added only for a concrete task: impeccable after explicit adoption
  of its detector/final visual audit, and the shadcn skill when adding, updating, or migrating
  registry primitives or presets (v12.1 §16.7). No chrome-devtools MCP: Playwright MCP is already
  registered globally (user scope) and in active use for browser verification across this operator's
  projects -- adding a second, overlapping browser-automation MCP would be redundant
  tool-schema cost with no functional gain.

## Self-Evolution
- On a surprising failure, first identify the failing layer and create the smallest deterministic
  reproduction. Add a permanent check only when recurrence or impact justifies its runtime and
  false-positive cost; prefer a focused automated test when cheap/stable, or a repeatable browser
  scenario for browser-only faults. If prevention cannot be executable but is durable and
  path-specific, write .claude/rules/<zone>.md with a `paths:` glob and a `由来:` line (last
  resort). Delete any rules file not needed in six months.
- docs/issues.md holds only what is currently blocked right now; resolved items leave
  it. Operator-level lessons go to auto-memory; project facts never do.

## Engineering Role
- Principal-level full-stack engineer. Readable, testable, minimal, correct code.
- No placeholder code or TODOs. Every committed function works.

## Coding Priorities (in order)
- Correctness, Security, Reliability, Data Integrity, Observability,
  Maintainability, Performance, Scalability, Testability, Dependency Security.

## Shell
- PowerShell for all operations. Windows backslash paths. node scripts/name.mjs.

## Git (full auto)
- Never commit to main. Branch per task: <type>/<short-description>.
- Commit after each logical unit; push after every commit; auto-PR to main.
- Stage only Write-Scope files. Never stage .env* or secrets. gitleaks pre-push if available.
- Merge gate: CI green (.github/workflows/ci.yml runs the same lint/typecheck/test/build
  as pnpm verify; branch protection requires it). A local pass alone does not merge.
  Low/medium risk: squash-merge + delete branch.
  High-risk classes: stop before irreversible real-world side effects; Japanese summary.
- After a merge to main, once the Vercel Production deploy reports READY, run
  `pnpm check:production`. A READY deploy is not proof the build is correct: Vercel
  restores a build cache, and a Turbopack cache miss once shipped a CSS chunk with none
  of the branch's hand-written classes while logging no error (T046, docs/issues.md).
  If it exits 1, use Vercel's cache-free redeploy and run it again; do not create an empty or
  unrelated commit solely to invalidate provider cache.
- Docs-only exception: a change touching only Markdown/doc files (no source, config, or CI
  files) may commit straight to the active base branch (main, or grimore-v2 per
  grimore-v2/CLAUDE.md), skipping branch/PR/CI. git diff --check still required.
- grimore-v2 integration branch conventions: see grimore-v2/CLAUDE.md.

## Execution Boundaries
- Handle every error explicitly. Safe values only in output.
- .env.example is the template; runtime reads actual env values.
- Irreversible real-world acts are human-gated. Everything else is AI-executed without asking.

## Version Policy
- Keep the user's currently configured Claude Code version. Verify in Phase 0 when relevant.
- If the recorded version above differs from the running one, re-check version-sensitive
  facts (model names, autocompact behavior, hook semantics) before relying on them.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
