# Grimoire 作業規約

このrepositoryは個人向けタスク管理PWA「Grimoire」を管理する。

利用者はタスクを登録・完了し、必要に応じてGmail、Google Calendar、Gemini音声入力を使う。

タスク、報酬、植物、設定は端末内のIndexedDBに保存される。

## 作業原則

* ユーザーは非エンジニアとして扱い、技術判断を必要以上に求めない。依頼された成果まで自律的に進める。
* 通常の調査、編集、検証について形式的な再承認を求めない。
* 新たな費用、秘密情報の外部送信、不可逆なデータ破壊、公開範囲、認証・権限の重大な不明点だけ確認する。
* 既存コード、標準機能、既存依存を優先し、必要な機能だけ実装する。
* 明示的な指示以外は、将来の可能性だけを理由に抽象化、基盤、依存、設定を増やさない。
* 実装のおける追加の金銭的コストは0。

## 作業開始

最初に読む。

1. `AGENTS.md`
2. `xp.md`

追加情報は必要になった時だけ取得する。

優先する情報源は、

1. 実コードと設定
2. Git状態と実行結果
3. `tasks.md`
4. `xp.md`
5. 必要なREADME / docs
6. 会話やMemory

とする。

完了済みの調査や本文を理由なく読み直さない。

必要な資料は `pnpm context <topic>` で絞れる場合は利用する。

## Gitと作業環境

* 作業前にGit状態と未コミット変更を確認する。
* Codex管理Worktreeならそのまま利用する。
* Localでmain等の保護対象branchにいる場合、コード変更前に安全な作業branchを自動作成する。
* 既に適切な作業branchなら新しいbranchを重ねない。
* GitやWorktreeの方式をユーザーへ選ばせない。
* ユーザーの未コミット変更をreset、discard、stash、overwrite、deleteしない。
* 意図した変更だけcommit対象にする。
* 安全に分離できない競合がある場合だけ確認する。

## データ境界

* IndexedDBのschema、task persistence、backup形式を変える場合、既存端末データを保持する後方互換性と復旧経路を確認する。
* 既存利用者データを自動削除しない。
* 判断不能な重複データを勝手に解消しない。
* migrationは途中失敗と再実行を考慮する。
* 保存や再試行で二重登録を発生させない。

## Google / Gemini

* GeminiとGoogle APIはserver-side keyを維持する。
* OAuth scopeを理由なく広げない。
* 入力を検証する。
* 外部通信には有限timeoutを持たせる。
* failure時は利用者が回復できる表示を行う。
* retryによる二重処理を防ぐ。
* `.env*`、credential、token、利用者データをcommit、ログ、公開資料へ出さない。

## Engineering

* 既存コード → 標準機能 → 既存依存 → 必要な新規実装の順で検討する。
* 変更理由のない大規模refactorを混ぜない。
* responsibilityが実際に分かれる場合だけ分割する。
* 新規依存は明確な利益が既存機能を上回る場合だけ追加する。
* authentication、authorization、input、secret、data loss、external failureなど変更固有のriskを扱う。
* performanceは主要操作を実測して問題を確認した場合だけ改善する。

## UI

* `src/app/globals.css` と既存componentを優先して再利用する。
* 別指定がなければ `border-radius: 0` を維持する。
* 角丸card、pill、capsule、装飾panel群を情報階層の代わりに増やさない。
* 1ページは1主要目的、1主要actionを中心にする。
* 余白、配置、文字サイズ、太さ、整列、区切りで情報階層を作る。
* loading、empty、success、error状態を扱う。
* keyboard操作、semantic structure、contrast、必要なresponsive幅、`prefers-reduced-motion`を確認する。
* 品質の良い既存component、library、assetを優先し、不要なAI生成装飾を追加しない。
* UI変更をコードだけ読んで完了にしない。
* UIコンポーネントは自作せず、基本的にWeb上の既存の高品質のUIコンポーネントをリサーチし、導入する。

## Browser検証

通常の操作確認には利用可能なCodex Browserを使ってよい。

console、network、runtime、performance等の診断には既存Chrome DevTools MCPを利用する。

同じ確認を複数browser toolで理由なく重複しない。

UI変更では必要に応じて、

* 対象route
* 主要操作
* loading / success / error
* 必要な画面幅
* console
* network
* runtime

を実画面で確認する。

## コード探索

大きなコード探索では利用可能なら既存CodeGraphを使う。

名前、参照関係、機能境界など現在必要な情報だけ取得する。

同じ本文を理由なく再取得しない。

CodeGraphが未索引、古い、曖昧、または解決不能なら `rg` と限定的なfile読込へ切り替える。

tool固有の引数や現在のAPI仕様をこのファイルへ固定しない。

## 外部能力

Plugin、MCP、Skill、依存は既存能力で不足すると確認できた場合だけ追加する。

グローバルに存在する能力をrepository側で重複定義しない。

導入時は必要に応じて、

* 保守元
* 更新状況
* permission
* authentication
* data exposure
* license
* Windows compatibility
* 既存能力との重複

を確認する。

## 実行と検証

開発:

`pnpm dev`

通常確認:

`pnpm verify`

本番反映後:

`pnpm check:production`

`pnpm verify` は既存のlint、typecheck、test、production buildの統合確認として扱う。

すべての変更に全検証を機械的に要求せず、変更とriskに応じて必要な確認を選ぶ。

失敗した場合は原因を修正し、関連する確認を再実行する。

成功後、新しい懸念がなければ同じ検証を繰り返さない。

CIは `.github/workflows/ci.yml` がmainとPRで実行する。

GitHub反映まで依頼された場合は、必要なCIとdeployment状態まで確認する。

## `tasks.md`

現在の作業状態を保持する再開台帳。

最低限、

* 更新日
* 現在地
* 次の操作
* 受入条件の状態
* 未解決の質問・仮定
* 作業環境 / branch
* 検証済み
* 停止理由

を一手で再開できる量だけ残す。

作業ログを蓄積しない。

重要な区切り、中断、検証完了、失敗原因判明時に更新する。

## `xp.md`

このrepositoryで実作業から得た、再利用可能で検証済みの経験則を保持する。

作業開始時に読む。

新しい項目は、

* 実際に発生した
* 原因または有効な対処を確認した
* 再発する可能性がある
* 次回使える具体的ルールへ変換できる

場合だけ追加する。

一度限りの出来事、作業履歴、推測、内部思考、すぐ陳腐化するtool引数は追加しない。

既存のxpと同じ内容を重複追加しない。

十分に確立して常時守るべき規約になった経験則だけ、必要に応じて `AGENTS.md` へ昇格する。

## `docs/state.md`

現在productionで実際に動いている状態とrelease結果を記録する。

作業履歴にはしない。

公開状態が変化した場合だけ更新する。

## `docs/decisions.md`

長期間残す価値のある重要判断だけ記録する。

対象例:

* architecture
* IndexedDB schema
* authentication
* Google / Gemini integration
* hosting
* security boundary
* 重要なPlugin / MCP / Skill
* 復旧が難しいmigration
* 重大な失敗と再発防止

小さな実装変更や日常的な作業履歴は記録しない。

## Context管理

`pnpm context:check` はcontext入口と参照先の整合性確認に利用する。

`tasks.md`、`xp.md`、docsが肥大化した場合は、現在有効な情報を先頭側に残して過去詳細をarchiveへ移す。

context削減自体を目的にせず、必要な事実を失わない。

## オーケストレーション

Mainエージェントは、タスク分解・進行管理・サブエージェントへの振り分け・最終統合を担当する。

サブエージェントは以下のルールで使い分ける。

* **Blender mcpを用いた3Dを含むグリモの制作:** **Astra / low**

  * キャラクターデザイン
  * Blender作業
  * リギング
  * アニメーション
  * ビジュアル調整
  * その他、グリモ固有の制作作業

* **シンプルなCoding:** **Luna / xhigh**

  * 小規模な実装
  * 単純なバグ修正
  * リファクタリング
  * ユーティリティスクリプト
  * 定型的なリポジトリ変更

* **困難な問題のアドバイザー:** **Astra / low**

  * Mainエージェントや他のサブエージェントが詰まった場合
  * 複雑なデバッグ
  * 設計・実装方針の助言
  * 難しい問題に対するレビュー

### ルール

1. Lunaで処理できる通常のCodingにAstraを使わない。
2. 専門作業はMainエージェント自身で抱えず、適切なサブエージェントへ委譲する。
3. Astraには必要最小限のコンテキストだけを渡す。
4. Mainエージェントは、サブエージェントの成果物を確認してから統合する。
5. Astraをアドバイザーとして使うのは、実際に困難・停滞・高難度な問題に直面した場合に限定する。

