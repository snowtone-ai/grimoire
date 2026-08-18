# state.md (grimore-v2)

## Current
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
- v2の技術スタック・アプリ雛形の作成方針を決めてから実装に着手する。
- `grimore-v2/Grimoire_決定事項ログ.md` O章の残る未決定事項（図鑑・コレクション
  画面の詳細設計、カレンダー画面の詳細設計、タップ反応アニメーションのライブラリ
  構成、スプリングボーンのパラメータ、エリア間の遷移演出、モジュール間の共有
  状態インターフェース仕様、既存ユーザーのIndexedDBデータの引き継ぎ方針）を
  相談セッションで詰めていく。
