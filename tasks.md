# tasks.md -- pm-zero v12 Execution Ledger (grimore-v2)

## Goal Binding
- Vision source: docs/vision.md
- Active goal: (未設定 -- v2の目標が固まり次第記載)
- Main agent: Claude Code (Sonnet-first) — sole owner of this ledger.
- Implementation: Claude Code main agent; Sonnet worker subagents on disjoint scopes.
- Review: fresh-context reviewer subagent (Opus 5, Tier 1) for large/behaviour-changing/hard-to-undo diffs; Tier 2 retired in v12.
- Numbering restarted from T001 on the `grimore-v2` branch (D-046): v2 is a near-from-scratch rebuild, so this ledger tracks only v2 work. Pre-reset history (old Task Plant/Grimoire app, T001-T045) lives in `main`'s tasks.md and in this branch's git history prior to the reset commit.

## Status Vocabulary
- proposed: idea exists, not ready
- ready: owner, dependencies, write scope, acceptance, verification, and expected evidence are clear
- doing: one owner is actively working
- blocked: needs decision, dependency, credential, environment, or human action
- review: implementation complete, review pending
- done: accepted by reviewer
- verified: evidence recorded

## Parallelization Rules
- The main agent owns tasks.md.
- Worker subagents own only their assigned Write Scope.
- Parallel implementation requires disjoint Write Scopes or worktree isolation.
- If two tasks need the same file, serialize them.
- Default cap: <=2 concurrent worker subagents on a Pro plan.
- Subagents return reports; the main agent updates tasks.md.

## Tasks
| ID | Status | Owner | Depends On | Write Scope | Acceptance | Verification | Evidence |
|---|---|---|---|---|---|---|---|
| T001 | done | Claude Code | none | src/, public/, tests/, docs/analysis.md, docs/architecture.txt, docs/implementation-plan.md, docs/plant-reward-image-*.md, .claude/rules/, README.md, CONTEXT.md, package.json, pnpm-lock.yaml, next.config.ts, eslint.config.mjs, postcss.config.mjs, tsconfig.json, components.json (removed); tasks.md, docs/decisions.md, docs/state.md, docs/issues.md, docs/vision.md, docs/repo-map.md, HANDOFF-JA.md (reset to empty template) | grimore-v2ブランチのリポジトリリセット(D-001)。ほぼ0からの作り直しである v2に合わせ、旧Task Plant/Grimoireアプリの実装・アセット・テスト・アプリ固有ドキュメント・ツール設定を削除し、pm-zero公式12ファイル構成のうち台帳/ナビゲーション/レポート系ファイルを空テンプレートで1から再開。grimore-v2/設計ログ、CLAUDE.md、.claude/settings.json、.env.example、.gitignore、scripts/setup.mjs、scripts/verify.mjs、.github/workflows/ci.yml、templates/、LICENSEは維持 | git diff --check(ドキュメントのみ、Tier 0、grimore-v2ブランチへ直接コミット) | 2026-08-19: git diff --check クリーン。 |
| T002 | done | Claude Code | none | AGENTS.md, .codex/config.toml (新規、プロジェクト); ~/.codex/hooks/guard.mjs, ~/.codex/hooks.json (新規/更新、グローバル、リポジトリ外) | Codex CLIをClaude Codeと同等のルール・自律性・安全機構で運用できるようにする(D-002)。プロジェクトルートにAGENTS.md(CLAUDE.mdを正典として参照し、Codex固有の差分のみ記載)、.codex/config.tomlを新設。グローバル側は既存のrtk連携(hooks.json, config.toml)を壊さず、~/.claude/hooks/guard.mjsと同一ルールセットの破壊的コマンド/秘密ファイル防御フック(~/.codex/hooks/guard.mjs)をPreToolUseに追加。approval_policy="never"・プロジェクト信頼設定は既にグローバルに存在し変更不要と確認 | git diff --check(ドキュメントのみ相当だが.codex/config.tomlは設定fileのため厳密にはCI対象。ただしgrimore-v2は現状CI未接続(.github/workflows/ci.ymlはmain限定トリガー)のため、grimore-v2へ直接コミット。理由をHANDOFF-JA.md/報告で開示) | 2026-08-19: git diff --check クリーン。 |
| T003 | done | Claude Code | T002 | AGENTS.md (プロジェクト); ~/.codex/AGENTS.md, ~/.codex/RTK.md (グローバル、リポジトリ外) | オーナーの明示指示によりグローバルrtkプロキシ運用を全廃止(D-003、D-002を一部訂正)。~/.codex/AGENTS.mdから「RTK Usage」節と`@RTK.md`取り込みを削除、~/.codex/RTK.mdは廃止注記のみ追記して残置、プロジェクトAGENTS.mdのRTK usage節を廃止後の記述へ更新 | git diff --check(ドキュメントのみ、grimore-v2へ直接コミット) | 2026-08-19: git diff --check クリーン。 |

## Execution Pointer
Current active task, executor, write lock, and latest verification live in docs/state.md.

## Blockers
| ID | Task | Blocker | Needed decision | Owner |
|---|---|---|---|---|

## Review Notes
| Task | Reviewer | Result | Follow-up |
|---|---|---|---|
