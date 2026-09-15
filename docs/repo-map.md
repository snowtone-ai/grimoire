# リポジトリ案内

現在地は `../tasks.md`。資料の一覧は `pnpm context`、対象指定は `pnpm context carol` 等。
コードの場所は CodeGraph MCP でシンボルを検索する。ここへ関数一覧を複製しない。

| 場所 | 所有する情報 |
|---|---|
| `../AGENTS.md` | プロジェクトの規約・データ保護 |
| `../tasks.md` | 現在地・検証・次の操作（唯一の再開台帳） |
| `state.md` / `decisions.md` | 現状の要点 / 判断索引 |
| `context-workflow.md` | 読込経路・実測・運用 |
| `grimo-*.md` | Grimo制作の仕様・調査・レビュー。対象指定時だけ読む |
| `archive/2026-09-09/` | 過去の台帳・旧入口。通常の検索対象外 |
| `../src/app/` | ページとAPI、共通CSS |
| `../src/components/` / `../src/hooks/` | 表示 / 操作の接続 |
| `../src/lib/` | 保存・外部API・純粋なドメイン処理 |
| `../tests/` / `../scripts/` | 検証 / 開発用コマンド |
| `../assets/grimo/source/` | 改変しない原画 |
| `../data/grimo/` / `../public/grimo/` | 制作manifest / 配信用生成物 |
| `../output/` | ローカル検証・制作証跡。通常読込しない |

既存の研究文書や assets の移動は参照を壊すため行わない。大きいHTML提案書はブラウザ閲覧用であり、全文検索・入力に含めない。
