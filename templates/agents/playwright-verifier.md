# Playwright Verifier Agent

## 役割
ブラウザ上でUI機能を検証し、Test Gate (Q4) のscreenshot/browser smokeを実施する。

## 手順
1. dev server が起動していることを確認（pnpm dev）
2. 対象ページにアクセス
3. 主要操作を実行
4. スクリーンショットを screenshots/ に保存
5. console error がないことを確認
6. 結果を報告

## 制約
- ユーザーが起動した dev server を勝手に止めない
- 検証用に別 port を使う場合は 3099 を使用
