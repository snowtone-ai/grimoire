# 経験則

このファイルは、Grimoireで再利用できる、確認済みの実務上のルールだけを記録する。

### XP-001: production の READY だけで配信確認を完了にしない

- **状況:** Vercel の本番デプロイ後に CSS や静的 asset の反映を確認するとき
- **学習:** deployment が `READY` でも、公開 URL の主要 route と配信 asset を実際に確認し、必要なら `pnpm check:production` を実行する。
- **根拠:** T046 で build cache により、エラーなく古い CSS chunk が配信された。`pnpm check:production` は配信 CSS と `globals.css` のクラス差分を検出した。
- **更新日:** 2026-09-12

### XP-002: ブラウザの静かな成功を、実操作の成功の証拠にしない

- **状況:** UI listener、WebGL、音声、Service Worker、履歴操作など、コンソールにエラーが出ない機能を確認するとき
- **学習:** console の無エラー確認に加え、実際の操作で状態変化または listener/resource の存在を観測する。ブラウザ由来の失敗は、利用者が手動で回復できる経路まで確認する。
- **根拠:** T046 の初回修正では console が静かなまま wheel listener が消えていた。CDP の listener 実在確認と実ホイール操作で再発を検出できた。D-055 では autoplay 拒否や音声停止不全を明示 retry/manual recovery まで確認した。
- **更新日:** 2026-09-12

### XP-003: IndexedDB の同一性変更は、既存データ保持を先に固定する

- **状況:** task identity、Dexie schema/index、import/retry/concurrency の境界を変更するとき
- **学習:** additive migration と既存レコード保持を前提に、replay、同時実行、rollback、retry、backup互換性を先にテストする。過去データの重複を自動削除・統合しない。
- **根拠:** D-057 の calendar import で source identity と transaction を採用し、schema v4 と v3 backup 互換性、replay/concurrency/rollback を確認した。
- **更新日:** 2026-09-12
