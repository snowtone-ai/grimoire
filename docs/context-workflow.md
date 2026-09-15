# 小さく正確なコンテキスト経路

## 普段の操作

1. 注入済みの規約は再取得せず、`tasks.md` で現在地を確認する。
2. 文書: `pnpm context carol` 等で必要資料だけ選ぶ。`pnpm context carol 最新` は最大12行・各240文字。全文を出すコマンドではない。
3. コード: CodeGraph MCPで対象を絞り、必要な関数だけ取得。変更後は型・テスト等で実際の挙動を検証する。
4. 終了時は tasks の現在地を置換する。state は状態の要点、decisions は理由だけ。検証ログを三重にコピーしない。

`pnpm context` でトピック一覧。`pnpm context history D-070` で旧判断の行位置を探せる。
検索は固定の文書allowlistのみ。秘密、node_modules、生成物、巨大HTML、全リポジトリを走査しない。
新しい分野の入口が必要になった時だけ `scripts/context.mjs` の routes に足す。

## CodeGraph の実測と使い分け

- 2026-09-09、既存索引は172 files / 2095 nodes / 3828 edges。
- `codegraph_context(task: "verify context documentation repository map scripts", includeCode: false, maxNodes: 6)` は無関係なresilience/報酬シンボルを返した。曖昧な自然文を万能検索として使わない。
- `codegraph_context(task: "Carol3DScreen", includeCode: false, maxNodes: 4)` は `src/components/grimo/carol-3d-screen.tsx:8` と `src/app/plant/carol-3d/page.tsx:3` を特定。無関係な `useHomeScreen` も含まれ、全結果を読む必要はない。
- 名前→search、機能→context、呼出経路→trace、変更影響→impact、必要な本文一つ→node。既に返った本文をファイル全文で重ねて読まない。
- 索引の遅延表示があるファイル、未対応言語、曖昧な名前解決は限定 `rg` / 行読込で補う。文書の要件と実行結果はグラフ外で確認する。

## 実装した予算

- 初期経路 `AGENTS.md` + `tasks.md`: 合計10,000 UTF-8 bytes以下。
- 個別上限: AGENTS 5,500 / tasks 4,500 / CLAUDE 1,600 / HANDOFF 600 / state 1,400 / decisions 2,500 / map 2,600 bytes。
- `pnpm context:check` は超過・経路欠落・入口のMarkdownリンク切れで失敗。`pnpm verify` とCIに接続済み。
- これは読み込み対象のサイズ制限であり、モデルの課金トークン・会話全体・ツール定義の消費量ではない。文字/4で日本語トークンを推測しない。

## 整理と保存

旧 tasks/state/decisions/CLAUDE/HANDOFF/map は `archive/2026-09-09/` へ退避。現行入口から履歴の本文・重複指示を削除した。履歴を破棄していない。
旧 CLAUDE の根拠不明なキャッシュ料金・固定モデル・自動push・main編集許可は現行規約から除去した。
既存のGrimo研究資料・原画・生成物は他のコード/文書から参照されるため物理移動しない。入口のルーティングで用途別に選ぶ。
archive 内の旧相対パスは移動前の位置を基準にした史料。現行リンクとして解釈せず、ファイル名で必要箇所を探す。
`.ignore` で archive と画像埋込HTMLを通常の `rg` からも除外する。Gitの追跡・保管は妨げない。過去検索は `pnpm context history <語>`、必要なら `rg --no-ignore <語> docs/archive/2026-09-09/decisions.md`。

OpenAI Docsで[AGENTS.mdの読み込み仕様](https://learn.chatgpt.com/docs/agent-configuration/agents-md)を確認した。規約と必要資料を分ける設計に使用。handoff skillに従い終了時の短い引継ぎはOS一時フォルダへ保存し、本文をrepo台帳に重複させない。

## 検証

実行結果と削減量は整理完了時にここへ追記する。製品UI・原画・データを変える作業ではない。
