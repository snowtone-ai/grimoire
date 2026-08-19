# state.md (grimore-v2)

## Current
- 2026-08-19: T007 — `prompt.md`を実行中。外部一次資料に基づく
  `grimore-v2/Grimoire_最高品質化仕様.md`、背景／グリモ／UI／ストア間の
  一方向契約、IndexedDBのtransactional outboxと一回限りの移行、二系統UI、
  3D/VFX、スプリング、操作フィードバック、適応音響を仕様化し、陸珊瑚の台地
  プロトタイプへ端末非依存の実測品質ガバナーを統合する。Codexが統合を担当し、
  実装と仕様書を分離したワーカー2件が作業中。
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
- T006: 必要なグローバル設定は反映済み。残る問題はStore版`pwsh.exe`の
  `WindowsApps`起動経路であり、非Store版PowerShellを既定シェルにするか、
  WSL実行へ移す必要がある。設計・実装作業は代替経路で継続できる。

## Next
- T007の仕様・実装を統合後、要求別監査、ビルド、テスト、ブラウザ検証、
  `git diff --check`を行い、決定ログ・台帳・本レポートを確定する。
- v2全体のアプリ雛形はT007の契約とデザイントークンを入力として別タスクで作る。
- 残る未決定事項はエリア間の遷移演出。今回確定する共有契約、IndexedDB移行、
  タップ反応、スプリング値は決定ログS章から参照する。
