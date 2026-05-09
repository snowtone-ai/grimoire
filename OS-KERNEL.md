# OS-KERNEL.md — pm-zero v9.1

## Quality Gates

### Q1. Spec / Reference Gate
- docs/vision.md に目的・ユーザー・成功条件がある。
- UI/API/DB/重要workflowは実在例3件が docs/decisions.md にある。
- HIGH仮定が3つ以上ある場合、実装前に確認済み。

### Q2. Code Gate
- 1ファイル300行目安。
- 1関数50行目安。
- 意味の薄い命名を避ける。
- 空catch禁止。
- 既存styleに合わせる。

### Q3. Architecture Gate
- UI / domain / data の責務を混ぜない。
- 依存方向を一方向にする。
- 300行超diffは分割、または docs/decisions.md に理由を書く。
- 過剰抽象化を避ける。

### Q4. Test Gate
- 新機能にはテストを追加。
- バグ修正は再現テストまたは再現手順を残す。
- negative pathを最低1つ含める。
- UI変更はscreenshotまたはbrowser smokeを実施。

### Q5. Error Gate
- 失敗ケースを仕様化。
- ユーザー向けエラー文を用意。
- 同じエラー3回でEscalation。

### Q6. Security Gate
- secretを読まない・出力しない。
- .env* は読み取り禁止。
- 認証・課金・DB・権限・deploy・外部APIはCross-vendor review。

### Q7. Observability Gate
- console.log だけに依存しない。
- error / warn / info を区別する。
- secret redactionを行う。
- API / DB / auth / 外部APIの失敗が追跡できる。
- MVPで後回しにする場合は docs/decisions.md に明記する。

### Q8. Handoff Gate
- 日本語で報告。
- 実行した検証を明記。
- 未検証を隠さない。
- AIができる作業をユーザーに丸投げしない。

## Verification Modes

### quick
用途: 文書修正、小さな文言修正、低リスク設定変更。
最低実行: 対象ファイル確認、影響範囲の明記。

### standard
用途: 通常実装、コンポーネント追加、API変更。
最低実行: lint → typecheck → build → 関連test。

### final
用途: main反映前、push前、deploy前、大規模変更後。
最低実行: pnpm verify → e2e → browser smoke → console error確認 → screenshot → git status。

## Cross-vendor Review Triggers
- 認証
- 課金
- DB schema
- RLS / 権限
- deploy
- security
- 300行超diff
- 新規外部API
- 3回連続エラー
- 本番データ・個人情報・公開URL影響

## Permission Design

### AIが自律実行する
- pnpm install / lint / typecheck / test / build
- Playwright / screenshot / console確認
- git status / diff / add / commit
- ファイル作成・編集

### 人間承認が必要
- git push
- 本番deploy最終承認
- API key発行 / OAuth承認 / 課金
- 個人情報・本番データの取り扱い判断

### 禁止
- force push / reset --hard / clean -fd / rm -rf / sudo
- .env* 読み取り / secret出力
