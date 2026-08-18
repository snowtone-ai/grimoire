# AGENTS.md -- Grimoire / pm-zero v12 (Codex CLI adaptation)

This is the Codex CLI counterpart of this repo's `CLAUDE.md`. Same project, same
pm-zero v12 ledger, same git workflow -- **read `CLAUDE.md` first**, it is the
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
plus a global `permissions.deny` layer. Codex has no project-scoped equivalent --
`approval_policy` and `sandbox_mode` are security-sensitive keys the Codex CLI
silently ignores in a project-local `.codex/config.toml`; they must live in
`~/.codex/config.toml`. This machine's global config already sets
`approval_policy = "never"` and trusts this project's path under
`[projects.'c:\users\chidj\project\プロダクト\task-plant']`, so autonomy already
matches Claude Code's `bypassPermissions` -- no project-level action needed here.

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

**RTK usage.** This machine's global `~/.codex/AGENTS.md` defines `rtk` proxy
conventions (`rtk read`, `rtk git`, `rtk pytest`, `rtk ruff`,
`rtk proxy powershell -NoProfile -Command "..."`) for token-efficient output.
Follow those globally-defined conventions in this repo too; they are not
repeated here to avoid drift between the two copies.

**Model.** Codex runs on this machine's configured OpenAI model (currently
`gpt-5.5`, set globally), not Sonnet 5. `CLAUDE.md`'s "never switch model
mid-session" cache-economics rule is Claude-specific (Anthropic prompt caching);
it does not apply to Codex sessions and can be ignored here.

**Verify script reality check.** `scripts/verify.mjs` (kept from `CLAUDE.md`'s
Commands section) still shells out to `pnpm lint/typecheck/test/build`. Per
T001/D-001, `package.json` and the rest of the old app were removed from this
branch as part of the near-from-scratch v2 rebuild -- `pnpm verify` will fail
until a new scaffold exists. That is a known, already-recorded gap, not a
regression to silently "fix" by restoring old files or inventing a stopgap.

**CI trigger gap.** `.github/workflows/ci.yml` currently only triggers on
`push`/`pull_request` to `main`, not on `grimore-v2` -- so on this branch,
"merge gate: CI green" from `CLAUDE.md`'s Git section is not actually
enforced yet. Known gap from the branch split (T041/D-044 on `main`); treat
config/tooling changes on `grimore-v2` with the same care as if CI were
enforced, since it currently isn't.

Everything else -- Task Ledger, Parallelism, Self-Review tiers, Self-Evolution,
Engineering Role, Coding Priorities, git branch/PR/docs-only-exception rules,
Execution Boundaries -- is identical to `CLAUDE.md`. Read it there.
