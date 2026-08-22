# tasks.md -- pm-zero v12 Execution Ledger (grimore-v2)

## Goal Binding
- Vision source: docs/vision.md
- Active goal: `prompt.md` に基づく Grimoire v2 全設計要素の外部調査・最高品質化・実装補強
- Main agent: Codex — sole owner of this ledger.
- Implementation: Codex main agent; worker subagents on disjoint write scopes.
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
| T006 | blocked | Codex | T004 | .codex/config.toml, tasks.md, docs/state.md, docs/issues.md | 現在のCodexセッションで再発したWindowsサンドボックス起動拒否を特定し、通常の端末実行を復旧する | 非Store版PowerShellまたはWSLへ既定実行経路を切り替え、新規セッションで通常コマンドを実行 | 2026-08-19: オーナーがグローバル設定へ`windows.sandbox="unelevated"`と`sandbox_private_desktop=false`を反映し完全再起動したことを確認。それでもラッパーがStore版`WindowsApps/.../pwsh.exe`を制限トークンから起動する段階で`0xC0070005`が継続。T007は別のローカル実行経路で継続。 |
| T007 | verified | Codex | T005 | prompt.md, tasks.md, docs/state.md, docs/issues.md, docs/repo-map.md, HANDOFF-JA.md, grimore-v2/Grimoire_決定事項ログ.md, grimore-v2/Grimoire_最高品質化仕様.md, grimore-v2/prototypes/area1-coral/ | `prompt.md` の5領域を外部一次資料で調査し、各モジュールを「現状分析・根拠・改善仕様/正確な値・コード/JSON」の順で仕様化する。背景/グリモ/UI/ストアの一方向契約、Pixel 7a/Xiaomi 14T Pro向け自動縮退、IndexedDBの堅牢な移行とexactly-onceイベント、二系統UIとWCAG 2.2 AA、3D/VFX・ACES・共有光、部位別スプリング、押下/グロー、適応BGM/効果音を網羅し、既存背景試作の該当パラメータと品質制御を補強する | 一次資料URL監査、仕様内数値/出典/実装例の要求別照合、試作`npm run build`、ブラウザ実機相当の描画・コンソール・アクセシビリティ・FPS/draw call確認、`git diff --check` | 2026-08-19: 独立再監査CRITICAL 0/HIGH 0。Node 15/15、build、Markdown fence/JSON、headless D3D11、diff check合格。 |
| T008 | verified | Claude Code | T007 | grimore-v2/prototypes/area1-coral/ (src/*.js, params.js, build.mjs, serve.mjs, index.html, README.md), tasks.md, docs/state.md | `Grimoire_決定事項ログ.md` B章の背景世界1枚目「陸珊瑚の台地」を、あらゆるアプローチから最高品質で完成させる。参照画像(Image1, ©CAPCOM)の構図・トーンに寄せた実装を、315+個の調整可能パラメータ(21グループ)として外出しし、実測に基づいて詳細調整する。B章の構成要素(穴あき岩塔2〜3体・骨色の枝珊瑚・板珊瑚・扇珊瑚・発光珊瑚・前景フレーミング)、C章の固定カメラ、G章のstylized方針とfull/reduced二段品質、H章の環境プリセット契約をすべて満たすこと | `node build.mjs` 成功、ブラウザ実機で 60fps / シーンdraw call <=50 / 三角形 <=150k(±2%)、参照画像との輝度ヒストグラム照合(mean/p50/p95/blown/dark/saturation)、1440x900・375x812縦持ちの両方で構図維持かつ横スクロールなし、コンソール0エラー0警告、reducedティアで10秒間の最小FPS計測、`git diff --check` | 2026-08-19: 下記「T008 Evidence」およびT007最終監査で再確認。 |
| T009 | blocked | Codex | none | ~/.codex/config.toml (グローバル、リポジトリ外), AGENTS.md, docs/decisions.md, docs/issues.md, docs/state.md | Codexのshell・MCP・app/connectorを新規セッションでもユーザー承認なしで実行するグローバル既定を、現行公式設定で統一する。破壊的操作は既存guardで拒否し、承認ダイアログへは変換しない | `approval_policy="never"`、`default_permissions=":danger-full-access"`、apps/MCPの`default_tools_approval_mode="approve"`を設定後、新規セッションでshellと代表MCPを実行 | 2026-08-19: OpenAI公式現行リファレンスで構文確認。ChatGPT pluginのグローバル権限はfeature gate上可能な最大の`review_important_actions`へ更新。`~/.codex/config.toml`はmanaged filesystemがworkspace外書込を拒否するためB002。 |
| T010 | blocked | Codex | none | ~/.codex/config.toml (グローバル、リポジトリ外), .codex/config.toml, AGENTS.md, docs/decisions.md, docs/issues.md, docs/state.md | Codexだけが最大4つのworker subagentsを同時使用できるようにし、Claudeの上限・設定は変更しない | OpenAI公式の`[agents] max_concurrent_threads_per_session = 4`を反映し、新規Codexセッションでprimaryを除く4 workerを同時spawnできること、`CLAUDE.md`が未変更であることを確認 | 2026-08-19: 公式Subagents文書で現行キーと「primaryを除外」を確認。`AGENTS.md`へCodex-only overrideを反映。global/projectの両configはmanaged filesystemに拒否されB003。 |
| T011 | review | Codex | T007,T008 | prompt.md, docs/vision.md, docs/architecture.md, docs/decisions.md, docs/state.md, docs/repo-map.md, HANDOFF-JA.md, tasks.md, grimore-v2/Grimoire_決定事項ログ.md, root app/tooling files | promptと面談回答を製品・耐久性・拡張性の契約へ変換し、類似製品の障害/negative reviewをユースケース化。実装→評価→差分→再調査→再実装loop、wordless魔導書紋章、Next/PWA workspaceを確立 | source監査、`git diff --check`、install後lint/typecheck/test/build、desktop/mobile browser smoke | 2026-08-19: Next 16/PWA、wordless紋章、architecture/quality ledgerを実装。`pnpm verify`全合格、audit 0。fresh-context review中。 |
| T012 | review | worker-data | T011 | src/domain/, src/application/, src/infrastructure/, tests/unit/, tests/integration/ | Dexie schema、transaction receipt/outbox、recurrence occurrence、reward/growth exactly-once、storage health、export/import stagingを実装。silent loss/double applyを許さない | unit/property tests、multi-tab/kill/quota/migration fault injection、10k task benchmark | 60 tests中、atomic command/recurrence/import/migrationを実DB相当で検証。reward台帳再走査をinventory投影へ置換しv1→v2 migrationを追加。active-task query/recurrence投影も起動時1回＋差分更新に変更。実ブラウザmulti-tab crash/quotaと10k実時間benchmarkは未完。 |
| T013 | review | worker-ui | T011 | src/app/, src/features/home/, src/features/calendar/, src/features/settings/, src/ui/, public/brand/ | splash off/timed/always、Home、Calendar、Settings、responsive navを新規デザインで実装。32pxで読めるwordless紋章、reduced motion、HTML fallbackを含む | component/a11y tests、320px/desktop、200% zoom、keyboard、browser screenshots | Home/Calendar/Settings、3 splash modes、responsive nav、durable adapterを統合。mobile/desktop smokeとE2E合格。200% zoom/physical deviceは未完。 |
| T014 | review | worker-world | T011 | src/features/grimo/, src/features/catalog/, src/world/, public/world/, tests/world/ | Area1 prototypeをadapter経由で統合し、生物stage、Catalog、committed event演出、poster fallbackを実装。prototype sourceを複製しない | environment contract tests、context-loss/low-p20、visual/performance capture | Area1 V2→V3 adapter、immutable contract、fallback、Catalog discovered-only UIを統合。実Catalog定義は12/720、最終生物asset/context-loss実E2Eは未完。 |
| T015 | doing | Codex | T012,T013,T014 | src/bootstrap/, src/integrations/, src/audio/, public/audio/, tests/e2e/, root app/tooling files | 各moduleをbootstrapだけで配線し、Calendar/migration/audio/PWAを統合。永続状態・同期health・復旧をUIから操作可能にする | offline/401/quota/import E2E、audio gesture、PWA install/update、full verify | durable UI、旧DB移行、export/import、storage health、PWA shellを統合。本番E2E 5 pass/1 WebKit offline skip。Google Calendar/audio/multi-tab pumpは未実装。 |
| T016 | review | reviewer | T015 | read-only review; findings returned to Codex | 全受入matrixとarchitecture fitnessをfresh-contextで監査し、critical/high差分を0にするまで改善loopを回す | Tier 1 review、physical-equivalent browser matrix、performance/a11y/visual evidence | fresh-context監査完了。N+1後続指摘の各refresh O(N×R)はcache/差分投影＋回帰で修正。他の未達はCatalog 12/720、edit、outbox pump、audio等として記録し、release判定はFAILのまま。 |
| T017 | verified | Codex | T016 | docs/implementation-status-2026-08-20.html, tasks.md, docs/state.md, docs/repo-map.md, HANDOFF-JA.md, .gitignore | 現在の実装・検証・N+1対策・release差分を、非エンジニアが誤解しない単独HTMLへ可視化し、次セッションが即再開できるcheckpointを残す | PC 1280px/390px browser visual、画像/console/overflow、`pnpm verify`、`pnpm test:e2e`、`pnpm audit --prod`、`git diff --check` | 2026-08-20: 12章、3表、2 SVG graph、3実画面。PC/mobileともconsole 0・broken image 0・document overflow 0。verify 60/60、E2E 5 pass/1 skip、audit 0。 |
| T018 | verified | Claude Code | none | scripts/setup.mjs, scripts/verify.mjs, CLAUDE.md, AGENTS.md, .github/workflows/ci.yml, eslint.config.mjs, .mcp.json(gitignore対象、ローカルのみ), .claude/skills/impeccable(新規、ローカルのみ), docs/decisions.md, tasks.md | pm-zero-knowledge-v12.1.md(Section 16 Frontend/UI Operating Layer含む)へ本リポジトリを追随させる(D-011)。実行不能な判断規約は取り込まず、config値・script exit code・toolフックへ還元できる部分のみ導入 | `pnpm verify`全合格、`node scripts/setup.mjs`のUI検出→冪等provisioning成功、`.mcp.json`にchrome-devtools登録、`git diff --check` | 2026-08-21: `pnpm verify`(lint/typecheck/test/build)全合格。setup.mjs再実行で冪等(skip表示)確認。CI trigger差分をgrimore-v2へ拡張。同日追記: 重複した`chrome-devtools` MCPとdead permission entryを削除(D-011追記)。 |
| T019 | done | Claude Code (Opus) | T012 | DESIGN.md(完了); 今後: src/app/, src/features/*, src/ui/, 対応する*.module.css, src/styles/(新設計)。src/domain/, src/application/, src/infrastructure/, tests/unit/, tests/integration/は対象外(オーナー指示: バックエンドは維持) | オーナー指示によりUI層を`DESIGN.md`(2026-08-22版、D-012)準拠で全面作り直しする。データ層(T012の永続化・recurrence・outbox等)は無傷のまま、画面構成・コンポーネント・CSSのみ置き換える。完了時に`scripts/verify.mjs`のlintへDESIGN.md §7のraw-value lint(scope: UI chrome、world scene値は`/* world: scene value, exempt from DESIGN.md */`で除外、blocking)を配線する | 実装後: `pnpm verify`全合格、DESIGN.md §6のcomponent rules準拠をfresh-context reviewerで確認(Tier 1、v12.1 §16.5のUIトリガー)、320px/200%zoom/keyboard/screen reader/high contrast/reduced motionのbrowser QA、`git diff --check` | 2026-08-22: DESIGN.mdをdocs/vision.md・docs/architecture.md §8(Pass1/Pass2)を出典に0から構築し完了(D-012)。実装部はT023、raw-value lintの配線は`scripts/design-token-lint.mjs`として完了し`pnpm lint`にblockingで組み込み済み。DESIGN.md §7に実装との差分(full scope / tokens.cssは対象外 / `@media`行は対象外 / .tsxはinline styleのみ)を明記。 |
| T020 | done | worker-integrations (Sonnet) | T012 | src/integrations/**(新規), src/app/api/gemini/generate/route.ts(新規), .env.example, tests/unit/integrations/**(新規), package.json(依存追加時のみ) | オーナー指示(D-013)により、Google OAuth(GIS)、Google Calendar取込、Gmail取込、Gemini API、ローカル通知/リマインダーを`main`(v1)からそのまま引き継ぐ。機能要件が変わらないものを再設計しない。v1の`src/lib/api/*`・`src/lib/notifications.ts`・`src/lib/domain/reminders.ts`をv2のモジュール境界へ配置し直し、v1のDB型依存(`./taskDb`)だけをv2データ層が満たすport interfaceへ置換する。取込結果はF-4/H-3どおり出所を画面に出さない共通形式へ正規化する | `pnpm lint`/`pnpm typecheck`/`pnpm test`合格、v1の`tests/lib/domain/reminders.test.mjs`をvitestへ移植して同等のケースが通ること、`NEXT_PUBLIC_GOOGLE_CLIENT_ID`未設定時に例外ではなく無効状態として扱われること | 完了(cadae88)。Google auth/Calendar/Gmail・Gemini・通知/リマインダーを移植、64 tests。`GoogleIntegrationPort`/`NotificationIntegrationPort`と名前・シグネチャ一致。合成ルート配線は申し送りどおりT025(2ed55a8)で実施 |
| T021 | done | worker-catalog (Sonnet) | T012 | src/features/catalog/definitions/**(新規12+2ファイル), src/features/catalog/definitions.ts, tests/unit/catalog-definitions.test.ts(新規) | アイテム図鑑720種(12分類×60種、M-8/M-9準拠)の名前・分類・説明文を全件作成する。画像は後日(D-013)のため`art`は現行プレースホルダを維持。現行12件のidと名前は永続IDとして不変。文体はM-9の4系統(博物学的記録/由来の物語/奇妙な逸話/静かなユーモア)を混在させる | `CATALOG_DEFINITIONS.length===720`、分類ごと60件、id/name/description全件一意、sortOrder連番、現行12件のid→name不変を検証するvitest。`pnpm lint`/`pnpm test`合格 | 完了(d646e64)。720件・12分類×60件・id/name/description全件一意・永続12件のid→name不変を独立に再検証。文末パターンの最頻値2.2%、文字数23-60でテンプレ化なしを確認。`definitions.ts`は`requireComplete: true`で欠落を起動時に検出 |
| T022 | done | worker-data (Sonnet) | T012,T020 | src/domain/, src/application/, src/infrastructure/, src/app/durable-ui-port.ts, src/app/memory-ui-port.ts, src/app/catalog-projection.ts, tests/unit/, tests/integration/ | UI層が必要とする永続機能を追加する。(1) updateTask/deleteTask(tombstone)のatomic command、(2) タスクの説明・時刻・分類(v1 category)・繰り返しをcreate/updateで扱う、(3) 選択中エリアの永続化、(4) グリモ観察記録(M-11/M-12)の保存と初見判定、(5) 通知の有効/無効と配信済み台帳の永続化(T020のport実装)、(6) outbox pumpとmulti-tab反映。報酬の一度きり確定(H-2)を壊さないこと | 新規commandのunit/property test、multi-tab/crash/quotaのfault injection、既存60testsの非回帰、`pnpm verify`合格 | 完了(306c69d)。typecheck/lint/testを独立に再検証 |
| T023 | done | Claude Code (Opus) | T012 | src/app/(*.tsx, */page.tsx, *.module.css, ui-port.ts, splash-state.ts), src/features/*/(UIコンポーネントと*.module.css), src/ui/**, src/styles/**, public/brand/**, tests/ui/** | UI層をDESIGN.md準拠で全面再構築する(T019の実装部)。5画面(Home F-8 / Calendar F-7,F-9 / Grimo F-6,F-14 / 図鑑 M-10,M-11 / 設定 F-3)、透明ボトムナビ(F-11,F-12)、報酬の段階表示(M-4)、起動紋章とsplash状態機械(architecture §7)。背景世界とスプラッシュは調達動画(D-013)のためのslotとして実装し、素材不在時はposter/fallbackで正常動作させる。グリモ本体とアイテム画像は後日 | `pnpm verify`全合格、320px/200%zoom/keyboard/screen reader/high contrast/reduced motionのbrowser QA、Playwright MCPで変更画面のconsole 0エラー、fresh-context reviewer(Tier 1、v12.1 §16.5) | 完了。browser QA実施(320px/390px/200%拡大/デスクトップ、reduced motion、forced-colors、キーボード、skip link): 横スクロール0・AAコントラスト違反0・consoleエラー0・focus ring欠落0。実機で5件の欠陥を検出し修正(2ed55a8, 2dd6ace): sheetがnavに覆われ主要ボタンが押せない/移行通知が主要導線を覆う/設定が通知非対応と誤表示/全画面で「ホームを開きました」と読み上げ/h1が2つ。Tier 1 reviewerは未実施 |
| T024 | done | Claude Code (Opus) | T023 | src/audio/**(新規), public/audio/**(新規), src/features/*/(発火点のみ), docs/decisions.md(アセット出典の記録) | UI操作音・効果音を実装する。オーナー指示(D-013)により**自作(合成)は禁止**で、Web/GitHub等のライセンス明示された既存アセットを本リポジトリへ導入して使う。音響レイヤーはユーザー操作後に初期化し、BGM/効果音を独立ON/OFF(F-3)、画面ごとの音景(F-13)、連続操作での過剰再生を抑制する。BGMはオーナー調達のため空スロット | 出典とライセンスを`docs/decisions.md`へ記録、効果音OFFでも操作結果が完全に理解できること(F-13)、`pnpm verify`合格、実ブラウザで多重再生・初回gesture・OFF時無音を確認 | 完了。実ブラウザでconsoleエラー0、SFX OFFで無音、初回gesture後に発音を確認。効果音OFFでも操作結果が画面だけで判別できることを各画面で確認(F-13) |
| T025 | done | Claude Code (Opus) | T020,T021,T022,T023,T024 | scripts/verify.mjs, tests/e2e/, docs/state.md, HANDOFF-JA.md | 全slice統合と最終検証。`scripts/verify.mjs`のlintへDESIGN.md §7のraw-value lint(UI chrome限定、`/* world: scene value, exempt from DESIGN.md */`で除外、blocking)を配線する。E2Eを新UIへ更新し、offline/quota/import/通知/動画不在fallbackを通す | `pnpm verify`全合格、`pnpm test:e2e`合格、`pnpm audit --prod`0、CI green、`git diff --check` | 完了。`node scripts/verify.mjs`→all checks passed、`pnpm test:e2e`→11 passed(chromium-desktop+webkit-mobile)、`pnpm audit --prod`→0。design-token lintは先行して配線済み。未使用の`motion`を削除(`three`/`@types/three`はD-013/D-014によりグリモ用に残置)。CIはPR上で確認。**訂正**: 当初「`git diff --check`クリーン」と記載したが、引数なしの`git diff --check`は未コミット変更しか見ないため、ブランチ済コミットについては何も検証していなかった。T026で`scripts/verify.mjs`に`merge-base..HEAD`を対象とする`checkWhitespace()`を追加し、以後は機械が判定する。**未達**: 受入基準に挙げた通知はE2Eに無い(通知許可はブラウザ権限を要し、Playwrightの権限付与では実配信まで再現できないため)。通知はunit(`tests/unit/integrations/notifications/**`)と実ブラウザ手動確認のみ |
| T026 | done | Claude Code (Opus) | T025 | src/app/(durable-ui-port.ts, create-app-port.ts, app-context.tsx, ui-port.ts, memory-ui-port.ts, runtime.tsx, runtime.module.css, service-worker-registration.tsx), src/features/(calendar, settings), src/integrations/(google/auth.ts, notifications/delivery.ts), src/ui/, src/styles/tokens.css, src/audio/area-ambience.tsx, public/sw.js, scripts/(verify.mjs, sync-world-media.mjs), tests/, .gitattributes, .gitignore | fresh-context reviewer(Opus 5, Tier 1)の指摘に対応する。T023の受入基準に挙げながら未実施だったreviewerを実施し、blocking 1件と有効な指摘12件を修正する。合わせてT020から申し送られた合成ルート(`createAppPort`)未配線を解消する | 指摘ごとに再現テストまたは実ブラウザ確認を伴うこと、`node scripts/verify.mjs`合格、`pnpm test:e2e`合格、対応しない指摘は理由付きで残すこと | 完了。blocking: カレンダーの`CalendarEntryView.id`(`taskId:date`)を`setTaskCompleted`へタスクIDとして渡していたため、カレンダーからの完了・編集が無言で失敗していた(再現テスト`tests/ui/calendar-experience.test.tsx`)。実ブラウザ確認中に**2件目の欠陥**を自力検出: 完了はoccurrence状態なのに`calendarProjection`へ焼き込まれており、タスク編集以外では再投影されないため、完了/未完了の切替がストアには書かれるのに画面に出なかった(再現テストを`tests/integration/durable-ui-port.test.ts`へ追加→修正→`projectionRebuilds`が1のままであることも同時に検証)。他: sheetがnavに覆われるstacking context、`navigator.serviceWorker.ready`が解決せず通知キューが停止、sw.jsの`skipWaiting`/`notificationclick`欠落、dev環境のSW登録、GISスクリプトの遅延注入、modal閉時のfocus復帰、`sync-world-media.mjs`の型ベース削除を台帳ベースへ。`node scripts/verify.mjs`→all checks passed、`pnpm test:e2e`→12 passed、実ブラウザで完了・未完了の双方向をストアと画面の一致まで確認。**未対応(意図的)**: 下記Review Notes参照 |
| T027 | done | Claude Code | T024 | public/audio/ui/(新規88ファイル、manifest.json新規), public/sw.js(コメントのみ), docs/decisions.md, docs/state.md, tasks.md | オーナー指示によりKenney "Interface Sounds"(CC0、D-015で導入済み)をパック全量100件へ拡張する(D-016)。「UIコンポーネントアセットのようにAIが選定を完全に任される」運用に沿い、各ファイルのcategory/用途hint/再生時間/配線状況を記録した`manifest.json`を新設。既存12件のファイル・`src/audio/sound-catalog.ts`の12キューは無変更。フォーマットは既存と同じPCM s16le/44.1kHz/monoのwavに統一(公式配布はogg、Safari/iOSの`decodeAudioData`互換のため変換)。同じ範囲を`main`ブランチへも独立作業として配置する(T042、main側tasks.md) | `node scripts/verify.mjs`合格、manifest.jsonのfile数が実ファイル数(100)と一致、既存12キューの再生に回帰がないこと、`git diff --check` | 2026-08-22: Kenney公式(kenney.nl/assets/interface-sounds)からCC0パック(100ファイル)を取得しffmpegでffprobe確認済みの同一フォーマット(pcm_s16le/44100Hz/mono)へ変換、未導入の88件のみ追加(既存12件はバイト単位で無変更)。manifest.json(100件、うち12件に`wiredAs`でカタログのキュー名を記録)を新設。sw.jsのruntime cacheコメントを実態に合わせて更新。 |

## Execution Pointer
Current active task, executor, write lock, and latest verification live in docs/state.md.

## Blockers
| ID | Task | Blocker | Needed decision | Owner |
|---|---|---|---|---|
| B001 | T006 | `sandbox="unelevated"`と`sandbox_private_desktop=false`はグローバル設定へ反映済みだが、制限トークンからStore版`pwsh.exe` (`WindowsApps`) を起動する段階で`0xC0070005`が継続する | 非Store版PowerShellを導入してCodexの既定シェルを切り替えるか、WSL実行へ移行する。T007は別のローカル実行経路で継続可能 | owner |
| B002 | T009 | 現セッションのmanaged filesystemは`~/.codex/config.toml`をread-onlyとし、`apply_patch`もworkspace外書込として拒否する。ChatGPT plugin権限の`full_access`グローバル指定もfeature gateで非公開 | オーナーが下記D-007の最小差分を`~/.codex/config.toml`へ反映してCodexを再起動する。plugin側は`full_access`がUIに公開された時点で切り替える | owner |
| B003 | T010 | 現セッションのmanaged filesystemは`~/.codex/config.toml`とプロジェクト`.codex/config.toml`の双方を保護し、`apply_patch`を拒否する | オーナーが`~/.codex/config.toml`へ`[agents]`と`max_concurrent_threads_per_session = 4`を追加し、Codexを再起動する。Claude側は変更しない | owner |

## Review Notes
| Task | Reviewer | Result | Follow-up |
|---|---|---|---|
| T007 | requirement_audit subagent | CRITICAL 0 / HIGH 0。前回HIGH 8件の解消、仕様構造、source/dist整合を独立確認 | 物理2端末・最終asset試験は製品統合時 |
| T008 | requirement_audit subagent | 品質budget、visible triangle、fallbackを含むprototype合格 | 実video asset経路は提供時に実再生確認 |
| T023/T026 | reviewer subagent (Opus 5, fresh context) | blocking 1件、有効な指摘12件を修正(T026証跡)。実ブラウザ確認中にreviewerが挙げていない完了投影の欠陥を1件自力検出し、同じくT026で修正 | 意図的に未対応(下記) |

### T026 未対応の指摘と理由
指摘を黙って落とさないための記録。いずれも「今なおすと、直す理由より壊す理由の方が大きい」と判断したもの。

- `sendTestNotification`が未使用 — 宣言・文書化・テスト済みの公開APIであり、
  未完成の置き去りコードではない。設定画面へ導線を足すかは製品判断なのでオーナー待ち。
- `--action-band`がホーム以外でもミニ通知を持ち上げる — ずれるのは数pxで、
  画面ごとに条件分岐させる方がトークンの意味を壊す。
- `Math.min(SPLASH_TIMED_MS, SPLASH_HARD_MAX_MS)`が常に900 — 上限は将来
  `SPLASH_TIMED_MS`を伸ばしたときの安全弁として意図的に残す。
- `use-media-query`が読み取りごとに`MediaQueryList`を確保 — 実測で問題になっておらず、
  計測なしの最適化はしない。
- `/api/gemini/generate`が未認証 — D-013の「v1をそのまま引き継ぐ」に従った結果で、
  変更は方針変更に当たる。認証を足すならオーナー判断のうえ独立タスクとして起票する。
- StrictModeの二重初期化で最初のport購読が孤児になる — dev限定。E2Eがdevサーバ相手に
  起動レイヤー`checking`のまま全滅したときは一度これを疑ったが、ストレージを消した
  devの実ブラウザでは正常に「ホームを開きました」まで到達したので別件(cold compileが
  5秒のexpect budgetを超えていた)。孤児購読そのものは残っており、次に起動まわりを
  触るときに再評価する。
- import前バックアップのスナップショットが到達不能な分岐を持つ / SWキャッシュが
  無制限に増える — どちらも現行の使い方(1世帯、月数十件)では顕在化しない。

## T008 Evidence (2026-08-19)

計測はすべて Playwright 経由の実機 Chrome。参照画像は `grimore-v2/デザイン参考画像/EWh0FswVAAA47qb.jpg` (Image1, ©CAPCOM)。

### 性能
| 項目 | 予算 (Three.js-design.md) | 実測 (full) | 実測 (reduced) |
|---|---|---|---|
| FPS | 60 | 59-60 | 60 (10秒間の最小値も60) |
| シーンdraw call | <=50 | 29 | 25 |
| GL draw call 合計 | - | 67 (シーン29 + 光芒遮蔽の再描画29 + ポスト9) | 57 |
| 三角形 | <=150,000 | 152,490 (+1.7%) | 44,918 |
| ジオメトリ生成 | - | 1,717 ms | 1,235 ms |

三角形は予算を1.7%超過。珊瑚の密度を落とせば収まるが、参照画像の「画面を埋める群落」が
成立しなくなるため、超過を許容して記録する。距離別2段LOD導入前は同じ見た目で183,092。

### 参照画像とのトーン照合 (320x200, 輝度)
| 指標 | 参照 | 実装 |
|---|---|---|
| mean | 0.471 | 0.491 |
| p25 | 0.264 | 0.282 |
| p50 | 0.430 | 0.444 |
| p75 | 0.654 | 0.719 |
| p95 | 0.923 | 0.934 |
| 白飛び率 (>0.95) | 0.035 | 0.015 |
| 黒潰れ率 (<0.12) | 0.036 | 0.044 |
| 彩度 | 0.376 | 0.383 |

### その他
- 1440x900 / 375x812(縦持ち)ともに構図維持。縦持ちは `camera.portraitFovBoost` により垂直画角 41 -> 53.5 度。横スクロールなし。
- コンソール 0 エラー / 0 警告。
- `prefers-reduced-motion: reduce` は太陽ゆらぎ・天蓋スクロール・霧の流れ・木漏れ日・発光脈動・
  珊瑚の揺れ・遠景稜線ドリフト・塵の運動・カメラの呼吸と微揺れのすべてを停止。OS設定の
  変更中トグルにも `matchMedia` の change で追従。
- H章の環境プリセット契約 (`version/areaId/quality/light/ambient/tone/fog/stage`) を凍結オブジェクトで発行。

### 修正した実装バグ (すべて実測で発見)
| 症状 | 原因 | 対処 |
|---|---|---|
| 枝珊瑚・発光珊瑚・前景茂みが一切描画されない (190インスタンス、draw call発行済み、三角形53,960計上、画素ゼロ) | `addSegment` が `dir` を共有スクラッチ `_vTmpA` に保持したまま `basisFrom` が同じ `_vTmpA` に `up` を書き込み、`cross(dir, dir)` = 零ベクトル。基底が両方ゼロになり全リングが中心線に潰れ、全三角形の面積がゼロ | `basisFrom` に専用スクラッチ `_vUp` を用意。併せて `degenerateFraction()` を追加し、生成した全ジオメトリの退化三角形率を毎ビルド監査 (`quality.auditGeometry`) |
| 岩塔が巨大な平面板になる | `new MarchingCubes(res, mat, false, false, res*res*2)` のポリゴン予算5,408に対し実際は11,022三角形必要。溢れが無警告で重複頂点を残し、溶接で1頂点に潰れる | 予算を `max(24000, res*res*8)` へ。溢れ時は `console.warn` |
| 岩塔が空中で分断される | 穴半径を基準半径基準で計算しており、先細り部で局所半径を超えて塔を切断 | 穴半径を局所半径の割合(上限0.78)に変更。加えて溶接後に最大連結成分のみ残す `keepLargestComponent()` を追加し、パラメータに関わらず浮遊塊が出ないことを保証 |
| ジオメトリ予算の9割が画面外 | 固定カメラなのに原点中心の円盤散布。枝珊瑚152本中フラスタム内は15本 | `scatterOnTerrain` にカメラ前方の扇形ドメインを追加 (`scatter` グループ)。同じ本数で画面内102本へ |
| 起動直後に必ず `reduced` へ落ちる | ジオメトリ生成とシェーダ初回コンパイルの停止をFPS判定に算入。実測で生成直後に約2.5秒間28-41fps | `quality.warmupWindow` を追加し生成中と生成直後を判定から除外 |
| 一度 `reduced` に落ちると永久に戻らない | 復帰経路が存在しなかった。追加後も閾値が `目標55 + 余裕6 = 61fps` で、vsync上限60では到達不能 | 復帰条件を `>=` かつ既定余裕0に変更。ヒステリシスは判定窓の非対称(縮退2.5秒 / 復帰8秒)で確保。復帰は1セッション1回まで |
| 前景フレーミングが1つも画面に入らない (41個中0個) | ワールドX座標で左右に散らしていたが、4m先のフレーム幅は±2.6mしかない | カメラの視錐台から求めた扇形の縁を基準に配置 (`scatter.frameSpread`) |
