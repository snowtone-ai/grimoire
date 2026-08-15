# CLAUDE.md -- Grimoire (formerly Task Plant) / pm-zero v11.1.1 (Claude Code only, Windows PowerShell, Pro plan)

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
- This file, docs/state.md, docs/decisions.md, docs/repo-map.md Summary. Nothing else.

## Budget (Pro plan, hard wall)
- One task per session. Plan -> /handoff -> execute for big features.
- Haiku subagents for wide reading; Sonnet 5 for everything else; Opus 5 only for
  top-risk review/architecture when available (200K context window on Pro). Never
  block on Opus.
- Long builds/tests in background. Batch questions. Compact at checkpoints.

## Continuity (auto-compact at 50%)
- Auto-compact trigger is an absolute token target (CLAUDE_CODE_AUTO_COMPACT_WINDOW=
  188000 in .claude/settings.json), not a percentage.
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
- Tier 0: verify script + tests + lint (always).
- Tier 1: fresh-context Sonnet 5 subagent (review classes: 300+ line diff, new external
  API, critical-workflow changes, and all Tier 2 classes).
- Tier 2: fresh Opus 5 subagent when available and budget allows (auth, billing, DB
  schema, RLS/permissions, deploy, security, production data, personal information).
  Otherwise Tier 1 at high effort; record the substitution in tasks.md Review Notes.

## Self-Evolution
- Log failures in docs/issues.md. On 3 repeats, web-search a fix and record the source URL.
- Promote always-applicable lessons into this file; lessons scoped to a subset of this
  repo's files into .claude/rules/*.md (paths: frontmatter glob); other reference
  lessons into docs/lessons.md; operator-level lessons into auto-memory.

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
- Merge: final verify green + fresh-context self-review passed.
  Low/medium risk: squash-merge + delete branch.
  High-risk classes: stop before irreversible real-world side effects; Japanese summary.

## Execution Boundaries
- Handle every error explicitly. Safe values only in output.
- .env.example is the template; runtime reads actual env values.
- Irreversible real-world acts are human-gated. Everything else is AI-executed without asking.

## Version Policy
- Keep the user's currently configured Claude Code version. Verify in Phase 0 when relevant.
- If the recorded version above differs from the running one, re-check version-sensitive
  facts (model names, autocompact behavior, hook semantics) before relying on them.
