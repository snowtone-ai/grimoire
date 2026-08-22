# state.md (grimore-v2)

## Current
- 2026-08-23: T046完了(D-011追記)。`main`ブランチのpm-zero v12.1追随作業(main側
  T043/D-046)を実施中に、`scripts/setup.mjs`の`hasShadcn()`冪等性判定が
  実際のインストール先(`.claude/skills/shadcn`)ではなく誤った名前
  (`.claude/skills/shadcn-ui`)を見ているバグを発見。mainで先に修正・確認した上で、
  本ブランチにも同じ修正を適用した。本ブランチの`package.json`はshadcnに
  未依存のため実運用では未発火(dormant)だったバグ。pm-zero本体のナレッジ
  (`pm-zero-knowledge-v12.1.md`)側には具体的パスの記述がなく、修正不要と確認済み。
  検証: `node scripts/setup.mjs`が例外なく完走。
- 2026-08-22: T027完了(D-016)。オーナー指示で、D-015で12件だけ導入した
  Kenney "Interface Sounds"(CC0)をパック全量100件へ拡張し、
  `public/audio/ui/manifest.json`を新設した。「UIコンポーネントアセット
  のようにAIが選定を完全に任される」運用のため、category/用途hint/
  再生時間/配線状況を機械可読で記録。既存12件のファイルと
  `sound-catalog.ts`の12キューは無変更(新規キュー配線は今回のスコープ外)。
  同じ資産を`main`ブランチへも独立に配置する作業(main側T042)を並行実施。
  検証: `node scripts/verify.mjs` all checks passed。
- 2026-08-22: T026完了。T023で受入基準に挙げながら未実施だったTier 1
  fresh-context reviewer(Opus 5)を実施し、blocking 1件+有効な指摘12件を修正した。
  blocking: カレンダーの`CalendarEntryView.id`は`taskId:date`のoccurrence idなのに
  `setTaskCompleted`/`updateTask`へタスクIDとして渡しており、カレンダーからの完了と
  編集が無言で失敗していた。`taskId`をviewへ明示的に持たせて解消。
  この修正を実ブラウザで確認する過程で**2件目の欠陥を自力検出**した: 完了は
  occurrence状態なのに`calendarProjection`へ焼き込まれ、タスク編集など別の理由で
  投影がdirtyにならない限り再計算されない。ストアには書けているのに画面が変わらず、
  ホーム画面(`tasksToday`)だけが正しく動いていた。両projectionをoccurrence keyと
  view rowの組に統一し、完了集合はrefreshのたびに適用する形へ変更(再現テストは
  `tests/integration/durable-ui-port.test.ts`、`projectionRebuilds`が1のままである
  ことも同時に検証)。
  他: `src/app/create-app-port.ts`を合成ルートとして新設(T020申し送り)、
  `navigator.serviceWorker.ready`が解決せず通知キューが恒久停止する経路、
  sw.jsの`skipWaiting`/`notificationclick`欠落、dev環境でのSW登録、
  GISスクリプトの遅延注入、モーダル閉時のfocus復帰、`sync-world-media.mjs`の
  削除判定を拡張子ベースから台帳ベースへ(手置きファイルを消さない)。
  検証: `node scripts/verify.mjs` all checks passed / `pnpm test:e2e` 11 passed。
  **運用上の発見**: `playwright.config.ts`の`reuseExistingServer`が起動中の
  `pnpm dev`を再利用し、cold compileで11件全滅した(コードとは無関係)。逆に
  devサーバ相手にgreenになる危険の方が重いため`false`へ固定した。
  `scripts/verify.mjs`には`merge-base..HEAD`を対象とする`checkWhitespace()`を追加
  (引数なしの`git diff --check`は未コミット分しか見ないため、T025の証跡が
  実際には何も検証していなかった)。
- 2026-08-22: T019-T025完了。今回のスコープ(スプラッシュ映像・背景世界映像・
  グリモ本体・アイテムアートを除く実装可能な全範囲)を実装し終えた。UI層5画面と
  共有コンポーネント(T023)、効果音12キュー(T024/D-015)、データ層の再構築(T022)、
  v1統合機能の移植(T020: Google auth/Calendar/Gmail・Gemini・通知/リマインダー)、
  図鑑テキスト720件(T021)、DESIGN.md §7 raw-value lintの配線(T019)。
  `src/app/create-app-port.ts`を合成ルートとして新設し、抽象port
  (`GoogleIntegrationPort`/`NotificationIntegrationPort`)へ実装を注入した。
  検証: `node scripts/verify.mjs` all checks passed / `pnpm test` 207 tests /
  `pnpm test:e2e` 11 passed (chromium-desktop + webkit-mobile) /
  `pnpm audit --prod` 0。(当初ここに「`git diff --check` クリーン」と記載したが、
  引数なしの同コマンドは未コミット変更しか見ないため検証になっていなかった。
  T026で`scripts/verify.mjs`のブランチ全体チェックへ置き換え済み。)
  browser QA(320px/390px/200%拡大/デスクトップ、reduced motion、forced-colors、
  キーボード、skip link)で横スクロール0・AAコントラスト違反0・consoleエラー0・
  focus ring欠落0を確認。実機QAで検出し修正した欠陥は7件:
  (1) `.appSurface`のz-indexがstacking contextを作り、シートがナビゲーションに
  覆われてタスク編集の確定ボタンが押せない、(2) 移行通知/報酬通知がホームの
  主要導線を覆う、(3) 合成ルート未配線で設定が「通知に対応していません」と誤表示、
  (4) 全画面で「ホームを開きました」と読み上げる、(5) 起動オーバーレイのh1が
  画面のh1と重複、(6) SWが`serviceWorker.ready`待ちでリマインダー配信を恒久停止、
  (7) SWがv1の`task-manager-v6`キャッシュを永久に残す。いずれも回帰テスト付き。
  Tier 1 fresh-context reviewerはT026で実施(上記)。CIのgreen確認はPR上。
  未使用の`motion`を削除。`three`/`@types/three`はD-013/D-014によりグリモ用に残置。
- 2026-08-22: T023/T024実装完了。UI層をDESIGN.md準拠で全面再構築した。共有
  コンポーネント(Sheet/Button/IconButton/Field/Switch/Chip/BottomNavigation/
  WorldSurface)と3つのフック(useMediaQuery/useReducedMotion/useModalBehaviour)を
  新設し、5画面(Home F-8 / Calendar F-7,F-9 / Grimo F-6,F-14 / 図鑑 M-10,M-11 /
  設定 F-3)を書き直した。`src/app/ui-port.ts`をUIとデータ層の唯一の契約として
  再定義(タスクのcategory/recurrence/description/時刻、観察記録、通知、Google連携、
  エリア選択)。スプラッシュは調達動画スロット+紋章fallback、背景世界は
  footage→poster→ambienceの3段階。音はKenney Interface Sounds(CC0)12件を導入し
  12キューを配線、BGMは`anime/`へ`bgm-<エリアid>.<拡張子>`を置くと有効になる
  空スロットとして実装(D-015)。DESIGN.md §7のraw-value lintを
  `scripts/design-token-lint.mjs`として実装し`pnpm lint`へ配線(blocking)。
  `pnpm lint`green、`pnpm test` 86 tests green。`pnpm typecheck`はデータ層が
  旧契約のままのため赤(T022で解消)。E2Eは新UI向けに書き直したが未実行。
- 2026-08-22: オーナーの大幅な方針転換を受領し、D-013/D-014として確定。
  スプラッシュ・背景世界は自作Three.jsから調達動画素材(`anime/`)へ、グリモは
  画像生成→3D→Rigify→GLB→R3Fの制作ワークフローへ変更。Google OAuth/Calendar/
  Gmail取込/Gemini API/通知はv1(`main`ブランチ)の実装をそのまま引き継ぐ方針に
  確定。アイテム図鑑720件のテキスト(名前・分類・説明文)は今回のセッションで
  作成する。UI操作音・効果音はClaudeによる自作(合成)を禁止し、既存アセットを
  ライセンス確認のうえ導入して実装する。今回の実装スコープはスプラッシュ・
  背景世界・グリモ・アイテムアートを除く実装可能な全範囲(UI層、データ層、
  統合、図鑑テキスト、音の仕組み)。
- 2026-08-22: T019起票 (D-012) — オーナー指示でUI層(`src/app/`,`src/features/*`,`src/ui/`)を
  `DESIGN.md`準拠で全面リセットする方針を決定。データ層(T012)は維持。今回は`DESIGN.md`を
  `docs/vision.md`/`docs/architecture.md` §8を出典に0から作成するところまでで、UI層の
  実装置き換え自体はT019として次セッション以降へ。同日: `chrome-devtools` MCPと
  `.claude/settings.local.json`の孤立permission entryを削除(D-011追記、blender MCPは
  資産調達方針として維持)。
- 2026-08-21: T018 (D-011) — pm-zero v12.1(Section 16 Frontend/UI Operating Layer)へ追随。
  `scripts/setup.mjs`をv9.4放置状態から書き直し、UI依存検出時のみ`.claude/skills/impeccable`と
  `.mcp.json`の`chrome-devtools` MCPを冪等provisioning。CLAUDE.md/AGENTS.mdをv12.1表記へ更新し
  Section 16項目(DESIGN.md任意採用、Tier 1 UIトリガー、`/design-sync`)を明記。`scripts/verify.mjs`の
  必須ファイル一覧へAGENTS.md・.codex/config.tomlを追加。`.github/workflows/ci.yml`のtrigger
  branchesへ`grimore-v2`を追加しCI gapを解消。`eslint.config.mjs`へ`.claude/skills/**`を
  globalIgnores追加(vendored impeccableコードの警告でlintが割れないように)。`pnpm verify`全合格。
- 2026-08-21: CodexのExa/Firecrawl MCP登録と関連運用ルールを削除。`codex mcp list`で残存登録なしを確認。
- 2026-08-20: T017 — 非エンジニア向け現状報告を
  `docs/implementation-status-2026-08-20.html`として作成。release判定を「保留」とし、
  5画面、60 tests、E2E 5/6、Catalog 12/720、領域別4段階成熟度、実画面、atomic保存、
  N+1修正前後、未完了と次の順序を表・SVG graphで可視化した。1280px/390pxでconsole 0、
  broken image 0、document横overflow 0を実ブラウザ確認。終了前に`pnpm verify`（60 tests、
  7 static routes）、`pnpm test:e2e`（5 pass/1 Windows WebKit offline skip）、
  `pnpm audit --prod`（0）を再実行し合格。次の実装入口はT015/T016残差の
  Catalog 708件、task edit/delete、audio、outbox pump。session checkpointはHANDOFF-JA.md。
- 2026-08-19: T011–T016統合sliceを実装。Next 16/PWA、wordless魔導書紋章、
  splash OFF/一定時間/毎回、Home/Calendar/Settings、Dexie durable command、exactly-once
  reward/growth、versioned export/import、旧DB移行、Area1、discovered-only Catalogを接続した。
  表示refreshは固定本数のindex/bulk queryへ整理し、reward ledger全走査との二重loopを廃止。
  discovery日時をinventoryへatomic materializeし、DB v1→v2で一括backfillするため、履歴増加で
  query回数が増えるN+1経路はない。独立レビューで見つかった各refreshの全active task O(N×R)も、
  起動時cache＋task作成の差分投影へ変更し、完了/設定/永続化確認で再query・再展開しない回帰を追加。
  `pnpm verify`はlint/typecheck/60 tests/build全合格、
  本番Playwrightは5 pass/1 WebKit-offline skip、production audit 0。
- 2026-08-19: T011 — prompt.mdと追加要望をarchitectureへ確定。negative review/
  known issueを失敗scenarioへ変換し、durable local-first、occurrence-based recurrence、
  verified export/import、storage health、future sync portをD-010/docs/architecture.mdへ
  記録した。オーナー提案の「実装→評価→差分→再調査→再実装」を全sliceのcompletion
  gateとして採用。wordless魔導書紋章とsplash設定/遷移を決定ログT章へ確定した。
- 2026-08-19: T010 — OpenAI公式Subagents文書で、Codexのworker上限は
  `[agents] max_concurrent_threads_per_session`（primaryを除外）と確認した。
  `AGENTS.md`にはCodex-onlyで最大4 workerのoverrideを追加し、`CLAUDE.md`は未変更。
  実行時設定はglobal/projectの両configがmanaged filesystemに拒否されB003。
- 2026-08-19: T009 — OpenAI公式の現行Config Reference/MCP/Security文書を再調査し、
  shell・MCP・appの無確認実行には`approval_policy="never"`だけでなく、
  `default_permissions=":danger-full-access"`とapps/MCPごとの
  `default_tools_approval_mode="approve"`が必要と確定(D-007)。ChatGPT pluginの
  グローバル権限は利用可能な最大値`review_important_actions`へ更新済み。
  `~/.codex/config.toml`本体はmanaged filesystemのworkspace外書込拒否でB002。
- 2026-08-19: T007/T008 — `prompt.md`の5領域を一次資料55件、採用判断、正確な
  初期値、コード/JSON、受入matrixまで仕様化し、決定ログS章へ確定した。陸珊瑚の
  台地へp20/scene calls/visible triangles/post passesの品質ガバナーと3秒low-p20
  poster fallbackを統合。Node 15/15、build、headless Chrome D3D11、Markdown/JSON、
  diff checkに合格し、独立監査はproduct CRITICAL 0/HIGH 0。T007/T008 verified。
- 2026-08-19: T006 — オーナーがグローバル設定へ
  `windows.sandbox="unelevated"`と`sandbox_private_desktop=false`を反映し、Codexを
  完全再起動したことを確認した。それでも現在の実行ラッパーはMicrosoft Store版
  PowerShell 7 (`WindowsApps/.../pwsh.exe`)を制限トークンから起動する段階で
  `CreateProcessAsUserW`の`0xC0070005` (Win32 ERROR_ACCESS_DENIED)が継続する。
  T007は別のローカル実行経路で停止せず継続している。
- 2026-08-19: T005 (D-006) — 3件対応。(1) docs/decisions.mdに紛れ込んでいた
  フロントエンド設計決定2件を`grimore-v2/Grimoire_決定事項ログ.md`のR章へ
  移設。(2) OpenAI公式`codex-plugin-cc`をClaude Codeへ導入、`/codex:rescue`
  等でCodexをサブエージェント呼び出し可能に。(3) オーナー依頼のExa(検索)+
  Firecrawl(ページ解析)運用のため、CodexにローカルMCP`exa`/`firecrawl`を
  登録(APIキー未設定で現在未稼働、docs/issues.md参照)。Claude側はExa/
  Firecrawlとも既存のclaude.aiコネクタで代替(Firecrawlは
  `claude mcp login`実行済み、オーナーのブラウザ承認待ち)。運用ルールを
  CLAUDE.md/AGENTS.mdに追記。詳細はD-006参照。
- 2026-08-19: T004 (D-005) — Codex CLIの端末実行が全拒否(`CreateProcessAsUserW
  failed: 5`)される状態を調査・解消。原因はグローバル`~/.codex/config.toml`の
  `[windows] sandbox = "elevated"`が要求する特権(SeAssignPrimaryTokenPrivilege等)
  をユーザートークンが持たないこと。`unelevated`へ変更し実行復旧を確認。
  併せてオーナー依頼のMCP(Playwright/Context7/Blender)を`codex mcp add`で
  グローバル登録、Anthropic公式`frontend-design` SkillをCodex公式
  skill-installer経由で`~/.codex/skills/frontend-design`へインストール。
  Three.js-design.mdが参照するGitHub Skillの URL(https://github.com/MengTo/sylva)
  をオーナーへ回答。詳細はD-005参照。
- 2026-08-19: T003 (D-003) — グローバルrtkプロキシ運用を全廃止(D-002の一部を
  訂正)。オーナーが「Codexがまだrtk経由でファイルを読んでいる、消し忘れでは
  ないか」と指摘したのが発端。調査の結果、D-002は意図的にrtkを維持する決定
  だったと判明したため一度報告した上で、オーナーが改めて「グローバルのrtk
  運用自体をやめる」ことを選択。~/.codex/AGENTS.mdから「RTK Usage」節と
  `@RTK.md`取り込みを削除し、~/.codex/RTK.mdは廃止注記のみ追記して残置。
  プロジェクトAGENTS.mdのRTK usage節も廃止後の記述へ更新。D-002のガード
  フック・approval_policy関連の決定はそのまま有効。詳細はD-003参照。
- 2026-08-19: T002 (D-002) — Codex CLIをClaude Codeと同等のルールで運用できる
  ようにした。オーナーがこのセッション以降の設計相談をCodex CLIへ引き継ぐため。
  プロジェクト側: AGENTS.md新設(CLAUDE.mdを正典として参照し差分のみ記載)、
  .codex/config.toml新設。グローバル側(~/.codex/、リポジトリ外): 既存のrtk
  連携・approval_policy="never"・このプロジェクトの信頼設定は維持したまま、
  ~/.claude/hooks/guard.mjsと同一ルールセットの破壊的コマンド/秘密ファイル
  防御フック(~/.codex/hooks/guard.mjs)をPreToolUseに追加配線。詳細はD-002参照。
- 2026-08-19: T001 (D-001) — grimore-v2ブランチのリポジトリリセット。ほぼ0からの
  作り直しであるv2に合わせ、旧Task Plant/Grimoireアプリの実装・アセット・テスト・
  アプリ固有ドキュメント・ツール設定を削除し、pm-zero公式12ファイル構成の台帳/
  ナビゲーション/レポート系ファイルを空テンプレートで1から再開(T001-T045、
  D-001-D-045の旧番号は`main`のtasks.md/docs/decisions.mdとこのブランチの
  git履歴に残る)。grimore-v2/設計ログ(創作生物デザイン、v2スコープ等)、
  CLAUDE.md、.claude/settings.json、.env.example、.gitignore、scripts/setup.mjs、
  scripts/verify.mjs、.github/workflows/ci.yml、templates/、LICENSEは維持。
  現時点でpackage.json等のツール設定が無いため、動くアプリとしては空の状態
  （新アプリの雛形作りは今後の別タスク）。

## Current Blocker
- T010: Codex実行時上限の`[agents] max_concurrent_threads_per_session = 4`は
  `~/.codex/config.toml`への反映とCodex再起動が必要。Claude側の変更は不要。
- T009: グローバル`~/.codex/config.toml`が現在のmanaged filesystemではread-only。
  D-007の差分は確定済みだが、反映とCodex再起動はオーナー操作が必要。
- T006: 必要なグローバル設定は反映済み。残る問題はStore版`pwsh.exe`の
  `WindowsApps`起動経路であり、非Store版PowerShellを既定シェルにするか、
  WSL実行へ移す必要がある。設計・実装作業は代替経路で継続できる。

## Next
- T016 fresh-context監査の残findings（Catalog 12/720、edit、outbox pump、audio）を実装する。
  T015 hardeningとして10k taskの実時間benchmark、
  multi-tab/QuotaExceeded/physical-device、Google Calendar adapter、audio gestureを順に行う。
- Catalogは契約上12分類×60枠だが、現時点の実定義は各分類1件（12/720）。量産assetを
  ダミーで埋めず、個別品質を保ったcontent production taskとして継続する。
- 残るcreative未決定はエリア間の遷移演出。共有契約、IndexedDB移行、タップ反応、
  spring値は決定ログS章、起動紋章はT章を参照する。
