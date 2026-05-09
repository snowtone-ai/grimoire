# analysis.md

## 現状分析（2026-05-09）

### 行数ゲート
- 改修前: `src/components/all/all-screen.tsx` 507行、`src/components/home/home-screen.tsx` 369行。
- 改修後: 全 `src/**/*.ts(x)` が300行未満。
- 最大ファイル: `src/components/home/task-edit-modal.tsx` 294行。

### 責務分離
- `src/components/all/all-screen.tsx`: データ取得・状態管理のみを担当し、表示は `calendar-view.tsx` / `list-view.tsx` / `selected-date-sheet.tsx` に分離。
- `src/components/home/home-screen.tsx`: 表示を担当し、状態・副作用・完了演出は `src/hooks/use-home-screen.ts` に分離。
- `src/lib/domain/task-date.ts`: 日付判定、繰り返しタスク表示状態、ソート、カテゴリドット生成を集約。
- `src/lib/api/gemini-prompts.ts`: Gemini prompt定義をAPI呼び出しから分離。
- `src/lib/errors.ts`: `RateLimitError` とsecret redactionを集約。

### テスト
- `tests/lib/domain/task-date.test.mjs` を追加し、繰り返しタスクの日付判定、表示日ごとの完了状態、日付/時刻ソートを検証。
- 追加依存なしで Node.js built-in test runner を使用。

### 残リスク
- Playwright依存が未導入のため、E2Eは実装せず、今後のブラウザ検証タスクとして残す。
