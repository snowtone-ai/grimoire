# AGENTS.md -- Grimoire / pm-zero v12.1 (Codex CLI adaptation)

This is the Codex CLI counterpart of this repo's `CLAUDE.md`. Same project, same
pm-zero v12.1 ledger, same git workflow -- **read `CLAUDE.md` first**, it is the
canonical ruleset and governs regardless of which CLI executes the work. This
file exists only to document where Codex's mechanics differ from Claude Code's.
Do not duplicate `CLAUDE.md` here; if a rule changes, change it there.

## Source of Truth (unchanged, read on demand)
- Intent: docs/vision.md | Tasks: tasks.md | State: docs/state.md
- Decisions: docs/decisions.md | Failures: docs/issues.md | Map: docs/repo-map.md
- Design-consult decisions (creature/world design, not engineering decisions):
  `grimore-v2/Grimoire_決定事項ログ.md` -- keep recording there, not in
  docs/decisions.md, regardless of which CLI is running the session.
- Report: HANDOFF-JA.md

## Startup Read
- This file, then `CLAUDE.md`, docs/state.md, docs/issues.md, docs/decisions.md,
  docs/repo-map.md Summary, and `grimore-v2/Grimoire_決定事項ログ.md` if the
  session is continuing a design consultation. Nothing else by default.

## Where Codex differs from Claude Code

**Autonomy.** Claude Code uses `bypassPermissions` (project `.claude/settings.json`)
plus a global `permissions.deny` layer. Current Codex versions load trusted
project-scoped `.codex/config.toml` overrides, but machine-wide defaults belong in
`~/.codex/config.toml`. Fully non-interactive local/MCP/app operation requires the
three independent defaults documented by Codex: `approval_policy = "never"`,
`default_permissions = ":danger-full-access"`, and `default_tools_approval_mode =
"approve"` under `[apps._default]` and each `[mcp_servers.<id>]`. The global file
currently has `approval_policy = "never"`, while the remaining defaults are tracked
as B002 because this managed session cannot write outside the workspace. The
project trust entry remains `[projects.'c:\users\chidj\project\プロダクト\task-plant']`.

**Guard hook.** Claude Code's destructive-command guard lives at
`~/.claude/hooks/guard.mjs`. Its Codex port lives at `~/.codex/hooks/guard.mjs`,
wired in `~/.codex/hooks.json` with a broad PreToolUse matcher. Same rule set:
blocks `rm -rf /` or `~`, `git push --force`/`-f`, `git reset --hard`,
`git clean -f*`, `git checkout|restore .`, `git stash clear|drop`, `sudo su`,
`runas`, and `.env*` read/write (with the `.env.example` exception) -- via shell
commands or via `apply_patch` file targets. If it blocks something, do not
retry or work around it; surface it instead, same as the Claude Code guard.
Note: editing a Codex hook file changes its trust hash, so the human may see a
one-time "trust this hook?" prompt the first time it fires after this setup.

**RTK usage.** Retired 2026-08-19 (T003/D-003). The global `~/.codex/AGENTS.md`
no longer defines `rtk` proxy conventions -- read files, run `git`, `pytest`,
`ruff`, etc. directly instead of through `rtk`. `~/.codex/RTK.md` is kept
only as a dead record of the old convention; it is no longer imported.

**Model.** Codex runs on this machine's configured OpenAI model (currently
`gpt-5.5`, set globally), not Sonnet 5. `CLAUDE.md`'s "never switch model
mid-session" cache-economics rule is Claude-specific (Anthropic prompt caching);
it does not apply to Codex sessions and can be ignored here.

**Subagents.** Codex may use up to four concurrent worker subagents when useful.
This overrides `CLAUDE.md`'s default cap of two for Codex only; Claude's cap and
behavior remain unchanged. The Codex runtime counterpart is the user-level
`[agents] max_concurrent_threads_per_session = 4` setting (the limit excludes
the primary agent).

**Frontend/UI tooling (pm-zero v12.1 §16).** `/design-sync` and the
`frontend-design` plugin are Claude Code-only mechanics (claude.ai/design
integration) -- Codex has no equivalent and does not attempt one. The
executable pieces apply identically to both CLIs: browser self-verification
before reporting a UI change done, the `scripts/verify.mjs` raw-value lint
once `DESIGN.md` is adopted (not yet, in this repo), and per-project tool
auto-provisioning from `scripts/setup.mjs` on framework detection.

Everything else -- Task Ledger, Parallelism, Self-Review tiers, Self-Evolution,
Engineering Role, Coding Priorities, git branch/PR/docs-only-exception rules,
Execution Boundaries -- is identical to `CLAUDE.md`. Read it there.
