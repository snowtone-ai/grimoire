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
| T018 | verified | Claude Code | none | scripts/setup.mjs, scripts/verify.mjs, CLAUDE.md, AGENTS.md, .github/workflows/ci.yml, eslint.config.mjs, .mcp.json(gitignore対象、ローカルのみ), .claude/skills/impeccable(新規、ローカルのみ), docs/decisions.md, tasks.md | pm-zero-knowledge-v12.1.md(Section 16 Frontend/UI Operating Layer含む)へ本リポジトリを追随させる(D-011)。実行不能な判断規約は取り込まず、config値・script exit code・toolフックへ還元できる部分のみ導入 | `pnpm verify`全合格、`node scripts/setup.mjs`のUI検出→冪等provisioning成功、`.mcp.json`にchrome-devtools登録、`git diff --check` | 2026-08-21: `pnpm verify`(lint/typecheck/test/build)全合格。setup.mjs再実行で冪等(skip表示)確認。CI trigger差分をgrimore-v2へ拡張。 |

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
