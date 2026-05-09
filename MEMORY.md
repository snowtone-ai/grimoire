# MEMORY.md — pm-zero v9.1

## External Memory
LLMの記憶に依存せず、状態をファイルに保存する。

## Files
- docs/vision.md: 仕様、成功条件、失敗ケース
- docs/state.md: 現在状態、Write Lock、検証状態
- docs/decisions.md: 永続判断、Reference URL、将来見直し条件
- docs/issues.md: 失敗ログ、Escalation、review timeout

## Rules
- stateにない完了作業を完了扱いしない。
- decisionsにない判断を前提化しない。
- issuesの同種エラーを繰り返さない。
- 3回連続失敗はEscalationに記録する。
