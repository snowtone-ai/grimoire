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
- This file, docs/state.md, docs/issues.md, docs/decisions.md, docs/repo-map.md Summary.
  Nothing else.

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

## Parallelism
- Disjoint write scopes or worktree isolation. Same file -> serialize.
- Default cap: <=2 concurrent worker subagents; raise only if budget clearly allows.

## Self-Review (no human reviewer)
- Tier 0: verify script + tests + lint, then CI (.github/workflows/ci.yml) on the PR.
  Nothing merges past a red check; a self-reported local pass is not sufficient on its
  own.
- Tier 1: fresh-context reviewer subagent (Opus 5, read-only) when the change is large,
  changes behaviour, is hard to undo, or touches shared UI components or design tokens
  (v12.1 §16.5). Ask for every issue with severity/confidence -- do not restrict it to
  serious issues only, or recall drops.
- Tier 2 is retired: it fired on auth/billing/DB-schema/deploy/production-data classes
  that essentially do not occur in this project. If one of those classes ever appears,
  re-derive the tier rather than re-enabling it from memory.

## Frontend/UI Operating Layer (pm-zero v12.1 §16)
- Browser self-verification before "done" is already covered by the global judgment
  instruction (start the dev server, check the changed screen with Playwright MCP at
  the breakpoints touched, confirm no console/runtime error) -- code-reading is not a
  substitute.
- For a change big enough to need sign-off before or mid-implementation (a new screen,
  a visual-direction change), generate the design at claude.ai/design via `/design-sync`
  and show it to the owner instead of deciding unilaterally -- they can react to a
  rendered design even though they cannot review a diff.
- `DESIGN.md` exists at repo root (authored 2026-08-22, D-012): the target design
  language for a UI-layer rebuild that has not happened yet -- current `src/app/`,
  `src/features/*`, `src/ui/` predate it. `ASSET_REGISTRY.md` is still not adopted
  (no concrete need yet, per Section 3's rule for every optional file). Once the
  rebuild (T019) lands, `scripts/verify.mjs`'s lint step must additionally reject
  unregistered raw values in changed UI-layer files per `DESIGN.md` §7's scope and
  exemption mechanism (v12.1 §16.2) -- not wired yet, since there is no rebuilt UI
  to lint against.
- Per-project UI tool auto-provisioning (impeccable skill; shadcn skill if `shadcn/ui`
  is ever added as a dependency) runs from `scripts/setup.mjs` on framework detection
  (v12.1 §16.7). No chrome-devtools MCP: this repo already has Playwright MCP registered
  and in active use for browser verification, and impeccable itself prefers the harness's
  existing browser tool over a dedicated MCP -- adding a second one would be redundant
  tool-schema cost with no functional gain.

## Self-Evolution
- On the first surprising failure, ask one question: can a machine detect this?
  Yes -> add the check to scripts/verify.mjs (+ a reproduction test if it is a bug);
  the lesson is now a build failure, not a paragraph. No -> write it to
  .claude/rules/<zone>.md with a paths: frontmatter glob and a `由来:` line naming the
  failure and date (last resort only). Delete any rules file not needed in six months.
- docs/issues.md holds only what is currently blocked right now; resolved items leave
  it. Operator-level lessons go to auto-memory; project facts never do.

## Engineering Role
- Principal-level full-stack engineer. Readable, testable, minimal, correct code.
- No placeholder code or TODOs. Every committed function works.

## Coding Priorities (in order)
- Correctness, Security, Reliability, Data Integrity, Observability,
  Maintainability, Performance, Scalability, Testability, Dependency Security.

## Commands
- install: pnpm install | lint: pnpm lint | typecheck: pnpm typecheck
- test: pnpm test | build: pnpm build | verify: pnpm verify | setup: node scripts/setup.mjs
- Use only commands that exist in this repository.

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
- Docs-only exception: a change touching only Markdown/doc files (no source, config, or CI
  files) may commit straight to the active base branch (main, or grimore-v2 per the next
  rule), skipping branch/PR/CI. git diff --check still required.
- grimore-v2 integration branch: main auto-deploys to the production origin the family uses
  daily; grimore-v2 is a long, high-churn, speculative design+dev effort with no ship date.
  All grimore-v2 work -- design-consult docs (grimore-v2/*.md) and future implementation --
  branches from and targets the long-lived `grimore-v2` branch instead of main; it is v2's
  de facto main until the owner explicitly decides to ship, at which point grimore-v2 merges
  into main as one deliberate release. tasks.md/docs/decisions.md/docs/state.md are edited
  independently on each branch for the duration (accepted tradeoff: expect a ledger merge
  conflict at ship time, resolved by keeping both branches' new rows).

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
