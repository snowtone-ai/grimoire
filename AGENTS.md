# Grimoire の作業規約

このリポジトリは個人向けタスク管理 PWA「Grimoire」を管理する。利用者はタスクを登録・完了し、必要に応じて Gmail、Google Calendar、Gemini 音声入力を使う。タスク、報酬、植物、設定は端末内の IndexedDB に保存される。

## pm-zero v13

- 共通規約は `C:/Users/chidj/project/プロダクト/pm-zero/AGENTS.md`、詳細手順は `C:/Users/chidj/project/プロダクト/pm-zero/pm-zero-knowledge-v13.md` を参照する。新規機能、UI、能力追加、公開、品質確認では該当節だけ読む。
- 継続作業は最初にこのファイル、`tasks.md` の先頭、必要なら `docs/state.md` と `docs/decisions.md` を読む。判断、検証、次の操作を台帳へ短く残す。
- main では編集しない。変更前に専用ブランチを作り、既存の未コミット差分は所有者の作業として保護する。意図したファイルだけ stage する。
- 追加費用、課金、秘密の送信、公開範囲の変更、既存利用者データの破壊につながる操作は、根拠と対象を確認してから扱う。`.env*`、認証情報、利用者データをコミット・ログ出力しない。

## プロダクト固有の境界

- IndexedDB の schema、task persistence、バックアップ形式を変える場合は、既存端末のデータを保持する後方互換性と rollback を確認する。既存データの自動削除・重複の自動解消はしない。
- Gemini と Google API は server-side key、既存の OAuth scope、入力検証、有限 timeout、利用者が回復できるエラー表示を維持する。外部 API の再試行では二重登録を防ぐ。
- UI は `src/app/globals.css` と既存部品を再利用する。v13 の UI 基準（角丸 0、カード群を増やさない、reduced-motion、キーボードと画面幅確認）に従い、画面変更時は Chrome DevTools で実画面を確認する。
- 依存追加、MCP、skill、plugin は既存機能で不足すると確認できた場合だけ、保守元の資料、権限・データ露出、ライセンス、Windows 互換性を記録して最小導入する。Context7 はグローバル設定のみを使い、このリポジトリで再定義しない。

## 実行と検証

- 開発: `pnpm dev`
- 通常確認: `pnpm verify`（lint、typecheck、test、production build）
- 本番反映後: `pnpm check:production`。UI変更は該当経路、主要操作、対応幅、console/network/runtime を確認する。
- CI は `.github/workflows/ci.yml` が `main` と PR で実行する。GitHub 反映を依頼された場合は、CI と必要なデプロイ状態まで確認して完了とする。

## 記録先

- 現在地・受入条件・未解決点・次の操作: `tasks.md`
- 現在のプロダクト状態とリリース結果: `docs/state.md`
- 長期的な設計、能力選定、失敗と再発防止: `docs/decisions.md`
