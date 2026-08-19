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
| T004 | done | Claude Code | none | ~/.codex/config.toml (グローバル、リポジトリ外、`[windows] sandbox`変更 + `mcp_servers.playwright/context7/blender`追加); ~/.codex/skills/frontend-design/ (グローバル、リポジトリ外、新規インストール) | Codex CLIの端末実行全拒否(`CreateProcessAsUserW failed: 5`)と`$CODEX_HOME/skills`書き込み拒否を解消(D-005)。原因は`[windows] sandbox = "elevated"`が要求する特権をユーザートークンが持たないことと判明、`unelevated`へ変更し復旧確認。オーナー依頼のPlaywright/Context7/Blender MCPを`codex mcp add`で登録、Anthropic公式`frontend-design` Skillを Codex公式`skill-installer`のスクリプト経由でインストール。Three.js-design.mdのSkill URL(https://github.com/MengTo/sylva)をオーナーへ回答 | `codex sandbox -- powershell -NoProfile -Command "Write-Output ok"`が成功、`codex doctor --summary`で0 fail、`codex mcp list`で6サーバ登録確認 | 2026-08-19: 全確認コマンド成功(0 fail)。 |
| T005 | done | Claude Code | T004 | docs/decisions.md, grimore-v2/Grimoire_決定事項ログ.md (フロントエンド設計決定2件の移設); ~/.claude.json, ~/.codex/config.toml (グローバル、リポジトリ外、Exa/Firecrawl MCP追加); ~/.claude/plugins相当(グローバル、Codexプラグイン導入); CLAUDE.md, AGENTS.md (Research Tools運用ルール追記); docs/issues.md, docs/state.md | (D-006) docs/decisions.mdに紛れ込んでいたフロントエンド設計決定2件をgrimore-v2/Grimoire_決定事項ログ.mdのR章へ移設。OpenAI公式`codex-plugin-cc`プラグインをClaude Codeへ導入(`/codex:rescue`等でCodexをサブエージェント呼び出し可能に)。オーナー依頼のExa+Firecrawl運用のため、CodexにローカルMCP`exa`/`firecrawl`を登録(APIキー未設定、オーナー確認済みで現状維持)。ClaudeはExa/Firecrawlとも既存claude.aiコネクタで代替(Firecrawlは`claude mcp login`実行、承認待ち)。運用ルールをCLAUDE.md/AGENTS.mdへ追記 | `claude plugin list`で`codex@openai-codex`enabled確認、`codex mcp list`/`claude mcp list`でexa/firecrawl登録確認、git diff --check(ドキュメントのみ、grimore-v2へ直接コミット) | 2026-08-19: 全確認コマンド成功。 |

## Execution Pointer
Current active task, executor, write lock, and latest verification live in docs/state.md.

## Blockers
| ID | Task | Blocker | Needed decision | Owner |
|---|---|---|---|---|

## Review Notes
| Task | Reviewer | Result | Follow-up |
|---|---|---|---|
