# Grimoire の作業規約

このリポジトリは、個人向けタスク管理 PWA「Grimoire」を管理する。利用者はタスクを登録・完了し、必要に応じて Gmail、Google Calendar、Gemini 音声入力を使う。タスク、報酬、植物、設定は端末内の IndexedDB に保存される。

## 作業開始

- このファイル、`tasks.md` の先頭、`xp.md` を読む。必要な場合だけ `docs/state.md`、`docs/decisions.md`、対象コードを読む。
- `tasks.md` で現在の作業、受入条件、write scope、未解決点、検証結果を確認してから編集する。
- 既存の未コミット差分はユーザーの作業として保護する。`reset`、discard、stash、checkout、上書き、削除を行わない。
- `main` では編集しない。安全な専用ブランチで作業し、意図したファイルだけを stage する。

## 自律実行と確認境界

目的と範囲が明確な調査・編集・検証は自律的に進める。次の場合だけ停止して確認する。

- 新たな費用・課金、秘密情報の外部送信、既存データの不可逆な破壊
- 公開範囲、認証、権限に重大な不明点がある場合

既存の月額契約や接続を勝手に別サービスへ切り替えない。`.env*`、認証情報、利用者データをコミット・ログ出力しない。

## プロダクト固有の危険領域

- IndexedDB の schema、task persistence、backup 形式を変更する場合は、既存端末のデータ保持、重複、migration、rollback/recovery を確認する。既存データを自動削除・自動統合しない。
- Gemini と Google API は server-side key、既存 OAuth scope、入力検証、有限 timeout、回復可能なエラー表示を維持する。retry で二重登録を起こさない。
- 外部入力、権限、秘密、意図しない情報露出、依存関係のリスクを変更内容に応じて確認する。

## Engineering

- 既存コードと標準機能を優先し、理由のない refactor、抽象化、新規依存を追加しない。
- コードは短く理解可能にし、入力検証、部分失敗、network failure、timeout、save failure、error boundary、recoverable state を必要な範囲で扱う。
- 推測で最適化しない。利用者が感じる主要操作で問題を測定してから性能を変更する。

## UI

- 既存の `src/app/globals.css` と既存部品を再利用する。基本は `border-radius: 0`、角丸カード群・pill/capsule・装飾 panel の乱用なしとする。
- 1ページ1主要目的・1主要 action を保ち、余白、配置、文字サイズ、太さ、整列、区切りで階層を作る。
- keyboard、semantic structure、contrast、loading、empty、success、error、reduced motion、responsive width を確認する。
- UIを変更したら、利用可能な Browser/Chrome DevTools 能力で実画面を確認する。コードを読むだけで完了にしない。console、network、runtime の問題が必要なら適切な開発 tool で確認する。

## 実行と検証

- 開発: `pnpm dev`
- 通常検証: `pnpm verify`（lint、typecheck、test、production build）
- 本番反映後: `pnpm check:production`
- 基本順序は syntax/format → typecheck → lint → 必要な test → build → 受入条件の主要操作 → failure recovery → 変更固有の risk。検証量は変更とリスクに比例させる。
- UI変更では対象経路、主要操作、対応幅、console/network/runtime を実画面で確認する。
- CI は `.github/workflows/ci.yml` の lint/typecheck/test/build を merge gate とする。公開を依頼された場合は CI、deployment、production を確認する。

## 主要 tool と依存

- ファイル検索は `rg` / `rg --files`、シェルは Windows PowerShell、パッケージ操作は pnpm を使う。
- Browser 検証は既存の Playwright/Chrome DevTools 能力を使う。追加 Plugin、MCP、Skill、依存は既存能力で不足すると確認した場合だけ、保守元、権限、data exposure、license、Windows compatibility、保守コストを記録して最小導入する。
- 同じ目的の能力を二重登録しない。新しい外部能力を導入する場合も、認証情報や利用者データを不要に送信しない。

## 記録と完了条件

- `tasks.md`: 現在地、次の操作、受入条件、未解決点、branch、verification。会話ログにはしない。
- `xp.md`: 実作業で確認でき、再利用できる具体的な経験則。単なる履歴・推測・一時的な状態は記録しない。
- `docs/state.md`: production の現在の事実。履歴を増やす場合は現在 pointer と混同しない。
- `docs/decisions.md`: architecture、database、auth、security boundary、重要な外部サービス、難しい migration など長期判断の理由。
- 依頼範囲について、受入条件、ユーザーの既存作業、必要な検証、変更固有の重大 risk を確認し、`tasks.md`を最新にする。重要な新しい経験則だけ`xp.md`へ追加する。

最終報告は、変更、検証、残る問題を短く伝える。
