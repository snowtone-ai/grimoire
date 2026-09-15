# グリモ実装で使う既存能力

確認日: 2026-09-07。リポジトリの設定・ファイル、グローバル設定の名前、セッションの公開ツール一覧を照合。認証値・環境変数の値は記録しない。接続試験、インストール、設定変更は今回行っていない。

## Skillの全体像

| 所在 | 全名称 | 今回の実装計画での扱い |
|---|---|---|
| `.agents/skills` | shadcn、migrate-radix-to-base、resilience-tester | shadcnは既存Radix部品の再利用、resilience-testerは必要な保存障害だけ。Base UI移行は不要 |
| グローバルの公開skill | frontend-design、chrome-devtools、chrome-devtools-cli、playwright、playwright-interactive、screenshot、handoff、hatch-pet | frontend-designで世界と情報階層、Chrome MCPで製品変更後の画面確認。Playwrightは既存の再現可能な障害確認用。CLI/interactive/screenshotは通常経路で不足した場合のみ。handoffはtasks.mdで不足するときだけ。hatch-petのCodex用8×9 atlasは今回のPWAの部位演技に合わず不採用 |
| `.system` の公開skill | imagegen、openai-docs、plugin-creator、skill-creator、skill-installer | OpenAI Docsで必要時の公式仕様確認。画像の新規AI生成、plugin/skillの自作・導入は不要 |
| プラグイン公開skill | deep-research-work:deep-research、plugin-management:plugin-management | Deep researchは明示依頼なしのため不使用。新たな外部接続の不足なし、plugin管理の変更不要 |
| ディスクのみ確認 | `.system/review-agent` | このセッションの利用可能skill一覧にない。利用可能とみなさず、通常の限定サブエージェントレビューを使う |

実際に使う工程で該当SKILL.mdを読み、全skillを毎回読み込まない。shadcnは `components.json` の `radix-nova`、既存lucide、`src/app/globals.css` を維持。レジストリ追加やpreset再初期化はしない。

## MCP・アプリ・標準ツール

| 種別 | 棚卸し結果 | 計画での使い方 |
|---|---|---|
| Chrome DevTools MCP | 公開29ツール。グローバル定義あり | G04/G10/G11の必要箇所に限定。実際の公開schema（この環境ではpageId）を優先し、古いskill記載を盲信しない |
| Context7 MCP | resolve/queryの2ツール。グローバル定義あり | Dexie、React、Next、shadcnで仕様が不確かな節だけ取得。プロジェクトで重複定義しない |
| clasp MCP | 公開5ツール、設定あり | Apps Script用途。今回不使用・既存接続維持 |
| Google Workspace MCP | 公開121ツール、設定あり | Gmail/Calendar/Drive等。今回不使用・既存接続維持。調査へ私有データを送らない |
| codex_apps | 公開36ツール。Sites、plugin管理、支援窓口等 | 今回の既存PWAには不使用。Sitesによる別サイト作成や公開不要 |
| 設定に存在するplugin | vercel、github、supabase、gmail、google-calendar | 設定の存在と利用可能な呼出しは別。全サービスの認証成功を意味しない。今回接続試験なし。既存接続を維持 |
| 標準能力 | Web検索/取得、画像閲覧、shell、apply_patch、サブエージェント、imagegen | 調査・文書・実装・限定委譲に使う。imagegenは今回不要。新規APIキー、課金APIは使わない |

`.codex/config.toml` は短文設定とContext7重複防止コメントのみ。グローバル既定は現在Astra/mediumであり、次回Luna/xhighを起動済みとは扱わない。全プロジェクトの既定モデルを書き換えず、次セッションの実行役指定はtasks.mdで引き継ぐ。[公式Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)と[公式MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)を本文取得して役割と拡張手段を確認した。

## 既存コード・制作道具

`package.json` の現行記載: Next 16.3.1、React 19.2.4、Dexie ^4.4.2、shadcn 4.1.2、radix-ui ^1.4.3、lucide-react ^1.7.0、sharp ^0.35.3、@playwright/test 1.62.1、fake-indexeddb ^6.2.5。Windows/PowerShellとpnpmの既存構成を使う。新規版へ更新しない。

- `scripts/process-item-assets.mjs`、`process-area-assets.mjs`、`build-item-contact-sheets.mjs`、`validate-item-assets.mjs`: 原本/派生物分離、hash、サイズ、透明境界、比較シートの既存方式を再利用。既存報酬の出力先を流用して上書きしない。必要ならグリモ専用の小さな処理を追加。
- `scripts/resilience/` と `tests/resilience/`: localhost・合成データ・有限seedの既存枠。今回新しい試験基盤は作らない。
- `src/lib/db.ts`、`backup.ts`、`sound.ts`、既存UI: 保存・復旧・音の好みを再利用。音は既存適法素材が相応しい場合だけ。
- `.claude/rules/pwa-dev-testing.md`: 古いSWが新しいコードを隠す既知事例。次回は分離した試験profileを使い、実利用者のcacheやDBを消さない。

## 導入判断

追加導入は0件。調査、部位画像の派生処理、ブラウザ標準の入力/演技、永続化、画面確認まで既存能力で接続できる。Live2D/Riveは公開制作資料の知見のみ参照し、SDKやエディタへの依存は作らない。YouTube閲覧用MCPも不要。

未解決なのはツール数ではなく、原画から自然な閉じ目・隠れ部位を含む素材を作れるかという制作上の問題。G02でキャロルだけ確かめ、既存素材の切出し・マスクで成立しなければ不足部位を明記する。無断の外部画像送信、原画に似ない代用品、課金による穴埋めをしない。新規導入が必要と判明した時だけ保守元・ライセンス・0円継続条件・Windows・データ送信範囲を確認して最小導入する。
