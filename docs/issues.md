# issues.md

## Error Log

### I-001: PWA永続ローディングバグ
- 日時: 2026-05（修正済み）
- 分類: runtime
- 発生箇所: public/sw.js, src/components/pwa-register.tsx
- 内容: Service Workerのinstallでcache.addAllが失敗し、古いSWが永続化。モバイルPWAが永久にローディング状態
- 試行:
  1. SW cache bust + reload → 部分改善
  2. controllerchange リスナー修正 → 部分改善
  3. 7層防御修正（cache.addAll廃止、updateViaCache:none、1.5秒タイムアウト）→ 解決
- 結果: 解決
- 再発防止: CLAUDE.md に cache.addAll 禁止ルール追加

## Escalation
（なし）
