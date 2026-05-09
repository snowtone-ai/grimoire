# Project AGENTS.md — pm-zero v9.1

## Language
- 完了報告、エラー報告、手動確認依頼は日本語。
- コード識別子は英語可。
- 不明点は勝手に確定しない。HIGH仮定が3つ溜まったら確認。

## Source of Truth
- 仕様: docs/vision.md
- 現在状態: docs/state.md
- 判断: docs/decisions.md
- 失敗: docs/issues.md
- 品質: OS-KERNEL.md
- 報告: HANDOFF-JA.md

## Execution Rules
- 同時に書き込み権限を持つAIは1つだけ。
- 実装前に docs/state.md と docs/decisions.md を読む。
- UI/API/DB/重要workflowは実在例3件を docs/decisions.md に記録してから実装。
- 1ファイル300行、1関数50行を目安に分割。
- 新機能にはテストを追加。
- エラー3回連続で docs/issues.md の Escalation に記録し停止。
- 完了前に quick / standard / final の検証モードを明示する。
- 最終報告は HANDOFF-JA.md に従う。

## Commands
- install: pnpm install
- lint: pnpm lint
- typecheck: npx tsc --noEmit
- build: pnpm build
- dev: pnpm dev

## Security
- secretを読まない・出力しない。
- force push / reset --hard / clean -fd / rm -rf / sudoは禁止。
- API key発行、OAuth承認、課金、本番deploy最終承認は人間タスク。
- pnpm install / lint / test / build / Playwright / git commit はAIが実行する。

## Model Routing
- 設計が曖昧: Claude / ChatGPT Thinking
- 実装が明確: Codex CLI / Claude Code
- 軽量修正: 軽量モデル
- 重要変更: 実装者と別ベンダーでレビュー
- 認証・課金・DB・権限・deploy・security・300行超diffはCross-vendor review必須。
