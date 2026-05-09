# decisions.md

## D-001: CLAUDE.md構造 — @AGENTS.md import方式
- 日付: 2026-05-09
- 対象: architecture
- 決定: CLAUDE.mdは@AGENTS.mdを冒頭でインポートし、プロジェクト固有ルールのみ記載
- 採用理由: v9.1の二重記載禁止ルール
- 不採用案: AGENTS.mdに全ルールを統合 → プロジェクト固有の地雷回避ルールが汎用指示と混在
- 将来見直し条件: Claude Codeが@importを正式サポートした場合

## D-002: vision.md の配置 — docs/ ディレクトリへ移動
- 日付: 2026-05-09
- 対象: architecture
- 決定: vision.md をルートから docs/vision.md に移動
- 採用理由: v9.1 Memory Layer仕様。state/decisions/issuesと同一ディレクトリに統一
- 不採用案: ルートに残す → 一貫性が崩れる
- 将来見直し条件: なし

## D-003: Service Worker — cache.addAll 禁止
- 日付: 2026-05-09（既存判断の記録）
- 対象: architecture
- 決定: install イベントで cache.addAll を使わず、fetch イベントで cache.put
- 採用理由: addAll は1URLでも失敗すると全体が失敗し、古いSWが永続化する
- 参照例: CLAUDE.md 自己改善セクション
- 将来見直し条件: なし

## D-004: データストア — IndexedDB (Dexie.js) + 遅延初期化
- 日付: 2026-05-09（既存判断の記録）
- 対象: architecture
- 決定: Dexieインスタンスを getDb() + Proxy で遅延初期化
- 採用理由: SSR環境でのモジュールトップレベル評価を防止
- 将来見直し条件: Next.js の SSR 仕様が変わった場合

## D-005: Observability — MVP段階では後回し
- 日付: 2026-05-09
- 対象: architecture
- 決定: MVP段階では構造化ログ・APMは導入しない。console.error/warn/info の使い分けのみ
- 採用理由: 個人利用PWAのため。本番運用で問題が出たら導入
- 将来見直し条件: ユーザー数が増えた場合、本番障害が追跡困難になった場合

## D-006: ディレクトリ構造 — domain/api/hooks に責務分離
- 日付: 2026-05-09
- 対象: architecture
- 決定: pure domain logic を `src/lib/domain/`、外部API補助を `src/lib/api/`、React副作用を `src/hooks/` に分ける
- 採用理由: 300行超ファイルを分割し、UI / domain / data の責務混在を減らすため
- 不採用案: PRODUCT-OPTIMIZATION.md の全構成を一括導入 → diffが大きくなり既存機能の回帰リスクが高い
- 将来見直し条件: テスト基盤導入後に `taskDb.ts` を query/mutation 単位へ追加分割する場合

## D-007: Service Worker管理 — 今回は既存ファイルを維持
- 日付: 2026-05-09
- 対象: architecture
- 決定: `src/components/pwa-register.tsx` は64行でゲート内のため、今回は抽出しない
- 採用理由: Service Workerは既存の地雷回避ルールが多く、不要な移動は回帰リスクになるため
- 不採用案: `lib/services/sw-manager.ts` へ即時抽出 → 動作差分の検証コストが高い
- 将来見直し条件: SW更新UIや複数登録パスが増えた場合

## D-008: テスト基盤 — Node built-in test を先行採用
- 日付: 2026-05-09
- 対象: process
- 決定: pure domain helper は Node.js built-in test runner で検証し、Playwright/Vitest導入は別タスクで実施
- 採用理由: 追加依存なしで最低限の再現テストを導入し、品質改善リファクタと依存追加を分離するため
- 不採用案: 依存を即時追加してE2E/Unitを実装 → ロックファイル変更とテスト設定変更が大きくなる
- 将来見直し条件: 次の機能追加またはバグ修正に着手する前

## Future Changes
- Codex CLI を本格導入した場合、state.md の Write Lock 運用を厳格化
- ユーザー数増加時に Observability Gate の本格対応
