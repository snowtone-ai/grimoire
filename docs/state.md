# state.md (grimore-v2)

## Current
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
- none

## Next
- 設計相談はCodex CLIへ引き継ぎ、AGENTS.md → CLAUDE.md → 本ファイル →
  docs/issues.md → docs/decisions.md → grimore-v2/Grimoire_決定事項ログ.md
  の順で読んでから継続する。
- v2の技術スタック・アプリ雛形の作成方針を決めてから実装に着手する。
- `grimore-v2/Grimoire_決定事項ログ.md` O章の残る未決定事項（図鑑・コレクション
  画面の詳細設計、カレンダー画面の詳細設計、タップ反応アニメーションのライブラリ
  構成、スプリングボーンのパラメータ、エリア間の遷移演出、モジュール間の共有
  状態インターフェース仕様、既存ユーザーのIndexedDBデータの引き継ぎ方針）を
  相談セッションで詰めていく。設計段階の決定事項は引き続き
  grimore-v2/Grimoire_決定事項ログ.mdに記載する(docs/decisions.mdは
  エンジニアリング/インフラ決定専用のまま)。
