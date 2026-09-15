# 判断索引

## D-071: 現在地と検索対象の分離（2026-09-09）

- 原因: tasks/state に中断記録を累積し、古い再開指示と最新指示が競合。旧 CLAUDE / HANDOFF の規約も現行と不一致。
- 対策: 現在地は tasks 一箇所。履歴は `archive/2026-09-09/` に保管し、通常検索から除く。入口の予算と資料リンクを `pnpm context:check` で検査する。
- CodeGraph はシンボルと依存の検索、文書は限定ルートと見出し検索を使う。MCP は製品要件や実行時の正しさを保証しない。
- 測定、使い方、限界: `context-workflow.md`。依存追加・課金・グローバル設定変更なし。

## 過去の判断を必要なときだけ探す

`pnpm context history D-070` のように ID / 語を指定し、返された行の周辺だけ読む。
原文: `archive/2026-09-09/decisions.md`。D-001〜D-070等の既存記録を保持。
Carol の直近判断は `grimo-carol-rebuild-review.md`、製品境界は `../AGENTS.md`。
