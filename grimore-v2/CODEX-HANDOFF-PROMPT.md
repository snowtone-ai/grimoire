# Codex CLI 引き継ぎプロンプト

`codex` をこのリポジトリのルート(`C:\Users\chidj\project\プロダクト\task-plant`、
`grimore-v2` ブランチ)で起動し、最初のメッセージとして以下をそのまま貼り付けてください。

---

まず AGENTS.md → CLAUDE.md → docs/state.md → docs/issues.md → docs/decisions.md
→ grimore-v2/Grimoire_決定事項ログ.md の順に読んで。

このセッションは Claude Code からの引き継ぎ。直前の作業(T002/D-002)で、
このプロジェクトを Codex CLI でも Claude Code と同じ pm-zero v12 ルールで
動かせるようにした — AGENTS.md 新設、.codex/config.toml 新設、グローバル
~/.codex/hooks/guard.mjs で破壊的コマンド・秘密ファイル防御を追加。詳細は
AGENTS.md の「Where Codex differs from Claude Code」と docs/decisions.md の
D-002 を見て。

今のブランチ状態: grimore-v2 は T001/D-001 でほぼ0から作り直し中で、
package.json すら無い(意図的)。旧アプリの実装はこのブランチには残っていない。

これから続けるのは grimore-v2 の設計相談セッション。エンジニアリング上の
決定は docs/decisions.md、生物・世界観など設計上の決定は
grimore-v2/Grimoire_決定事項ログ.md に書き分ける(このルールは維持)。

次にやることは、grimore-v2/Grimoire_決定事項ログ.md の O章に残っている
未決定事項を一つずつ詰めていくこと(図鑑・コレクション画面の詳細設計、
カレンダー画面の詳細設計、タップ反応アニメーションのライブラリ構成、
スプリングボーンのパラメータ、エリア間の遷移演出、モジュール間の共有
状態インターフェース仕様、既存ユーザーの IndexedDB データの引き継ぎ方針)。
どれから始めるか提案して。

---
