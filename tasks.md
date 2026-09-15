# 作業台帳

更新日: 2026-09-10 JST
現在地: 研究所の入口を、合格済みの3D Carol 触れ合い画面へ統合済み。最終FB（尻尾のびっくり反応）まで実装・実画面確認済み。利用者受入: 完全合格。チェック用の給餌は無限で、端末データを変更しない。公開はしていない。
変更ブランチ: `chore/context-routing`（既存の未コミット作業を継承）。commit / push / 公開なし。
次の操作: なし。利用者の受入確認によりセッション終了。

## Grimo 触れ合い — 完了した受入条件

- `/plant` が旧2Dの調整画面を表示していたため、触れ合いが別画面に分裂し反応が伝わらなかった。入口を3D Carolへ戻し、「なでる／つつく／そっと押す」、マカロン給餌、雲を3回なぞるケアを同一画面に統合。3D読み込み完了前は誤操作を止め、給餌は既存IndexedDBの原子的消費を使う。320px・1280pxで操作の到達性、Console error/warnなし、`pnpm typecheck`、対象eslint、diff checkを確認。
- チェック画面の給餌は無限供給に変更。押下ごとに3Dの喜び反応とマカロン飛行を再生するが、IndexedDBを読まず、在庫の消費・付与も行わない。連続2回の給餌と操作可能状態、Console error/warnなし、`pnpm typecheck`、対象eslintを確認。
- 2D SVGマカロンを、キャロル画面で在庫数つきの「マカロンをあげる」として実装。原子的に1個だけ消費し、空なら操作を止める。給餌時はマカロンが舞い、キャロルと星空が喜ぶ反応をする。
- マカロンはアプリを開く／前景へ戻る際に1日1回、手動タスク登録に1日1回、タスク完了に1日最大3回、IndexedDBのイベント台帳によりリトライ・複数タブでも重複せず付与する。task / reward の既存記録は変更せず、backupはfood配列を追加的に保存・旧backupのimportは既存foodを消さない。
- 既存の「なでる」と別に、ポケリフレの戦闘後ケアという着想をCarol固有の「雲をとかす」へ翻案。開始後、雲の上を3回なぞると整い、独自の完了反応とスクリーンリーダー向け状態文を返す。
- 今回の確認: v4既存IndexedDBからv5 food schemaへのupgrade、型検査、対象eslint、macaron domain/persistence 12 tests、アプリ表示で初回マカロン1個・給餌後0個・live文言・「雲をとかす」開始状態を確認。DevTools console error/warnなし（検証用の別プロファイル）。

## Carol FB対応 — 完了した受入条件

- 指定されたポケパルレ動画の停止フレーム（ニンフィアの給餌 2:11〜2:22）を基準に、旧CSSの小さな画面内アイコン飛行を廃止。3Dのマカロンが顔幅のおよそ75%で現れ、`Mouth` の実アンカーへ到達してから食べ進め、別の「給餌」演技（注視・口元への顔寄せ・咀嚼・満足の跳ね）へ移る。完食後は頭頂に5個の、白い縁・ハイライト・濃ピンクの陰影を持つハートを表示する。給餌中は重複実行を停止し、終われば再び無限チェックできる。320px 実画面とconsole error/warnなし、型検査・対象eslint・diff checkを確認。

- `scripts/grimo/build-carol-reference.py` を再生成し、奥行きを浅い2.5Dレリーフへ変更。背面の造形を評価対象にしない狭い視点移動（左右最大約7度・上下約2度）に限定した。
- 足を `BodyWool` の原画投影へ統合。独立した足mesh／歩行リグ／画面の「歩いてみて」を撤去した。
- 本体のふくらんだ輪郭を保ち、直下の淡いラベンダー輪郭レリーフを追加。後ろ足脇の雲に混ざっていた足色は、独立hoofを撤去して原画投影へ戻したことで解消した。
- 雲・星（`CarolAtmosphere`）は独立ノードのまま、Carolのなで反応の揺れと同期する。将来の個別演技を妨げない。
- 実画面 `http://localhost:3000/plant/carol-3d` を開いた。なでる／つつく／長押し／連続ストローク／小視点移動／keyboard／reduced-motion／320px・1280pxを確認。歩行の不在も確認した。`pnpm typecheck`、対象eslint、全190 tests成功。描画は54 calls / 517,434 triangles。
- 後方（画面左側、利用者が指定した顔の反対側の羊毛縁）に、原画左下の大気雲と同じ輪郭・水彩質感を淡いピンクへ転調した尻尾を追加。なでる時はゆっくり揺れ、つつく時は短く跳ね、押す時は身体へ寄る。`Tail` は既存の演技境界で制御する。
- フッターに「輪郭線」のネイティブ色選択を追加。`#RRGGBB` のみを受け取り、3Dの `ReferenceContour` を即時変更する。実画面で `#634E84` への切替と、初期色 `#F2FBFF` への復帰を確認した。
- 今回の確認: `pnpm typecheck` と対象eslint成功。実画面でなでる／つつく／そっと押す・色変更、雲型尻尾・`#F2FBFF` の初期色、console error/warnなしを確認。対象 `git diff --check` 成功（全体は今回と無関係な既存 `AGENTS.md` の末尾空行を報告する）。
- 最終FB: 尻尾への直接タッチで既存 `Blink` を専用の `tailBlink` として短く閉じ、頭部投影アンカーに共有 `GrimoEmotionMark` の柔らかな「！」を表示。別反応・給餌・比較・停止・非表示・disposeで残留を消し、reduced-motionでも閉眼の意味を保つ。狭幅では給餌ボタンを副題と重ならない位置へ調整した。
- 最終確認: `pnpm test` 205件、`pnpm typecheck`、変更対象eslint、対象diff check、Carol QA（尻尾反応／マーク出現・消去／給餌／reduced-motion／320px・1280px／横overflow）成功。実画面のconsole error/warnなし、描画54 calls / 523,258 triangles。`pnpm verify` は既存のcontext入口サイズ超過と生成物を含む全量lintで失敗したが、build・typecheck・testは成功。公開・commitなし。

## Carol給餌の安定化 — 完了した受入条件

- 給餌を通常の接触反応から分離し、反応重み・変形・morphを有限かつ許容範囲に制限。給餌開始で接触状態を初期化し、給餌中は直接タッチ、触れ合い操作、比較表示、停止を受け付けない。
- 自作Three.jsハートを削除し、白縁とピンク塗りのLucide Heartオーバーレイへ置換。連続給餌で再始動し、reduced-motionでは静的に表示する。雲ケアは今回の仕様から撤去した。
- 尻尾根元を原画の位置へ補正し、尻尾への直接タッチは身体の反動と驚きの専用反応にする。
- `RESILIENCE_TEST=1` の隔離ローカルNextサーバーだけに安全マーカーと同一生成元probeを追加。seed固定のCarolシナリオが、連打、二重送信、遷移、page close、再起動、offline、遅延／中断、quota、合成storage破損を対象に、trace・画面・履歴を保存する。
- 確認済み: Carol motion tests 204、`pnpm test:resilience:unit`、`pnpm typecheck`、対象eslint、実画面の320px／デスクトップでの給餌・尻尾反応・console error/warnなし。隔離ローカルの `pnpm resilience:carol -- --acknowledge-local-destructive-testing` は seed `20260910` で11種の障害操作を210秒で完走。成功画面、2本の軽量trace、履歴、summaryは `output/resilience/carol-3d/` に保存され、再実行前にこの実行専用の古い成果物を消去する。

## 前回のコンテキスト整理の受入条件

- 現在地と履歴を分離し、旧版の指示・完了報告を通常の読込経路から除去する。
- `pnpm context:check` で入口のサイズと参照先を検査。`pnpm context` は必要な資料の場所だけ返す。
- CodeGraph MCP で実際に対象シンボルを特定し、広い検索を繰り返さない経路を記録する。
- 原画、製品コード、IndexedDB、既存の未コミット差分を保護する。詳細と測定: `docs/context-workflow.md`。
- 検証済み: context予算・6経路・検索出力上限・不正引数拒否、対象eslint、diff check、退避6文書の本文一致。CIは接続のみで未実行。製品変更なしのため今回build/ブラウザ再検証なし。

## 次のセッション

まずこのファイルを読む。整理の続きではなく、新しい依頼に着手してよい。
Carol の続きなら `pnpm context carol` → `docs/grimo-carol-rebuild-review.md` の最新節 → 対象シンボルを CodeGraph で取得。
チェックURL: `http://localhost:3000/plant/carol-3d`。サーバーが停止していたら `pnpm dev`。

## 次回のCarol作業（新規FBがある場合のみ）

- 新builder: `scripts/grimo/build-carol-reference.py`。旧 `build-carol-3d.py` を誤実行しない。
- 原画: `assets/grimo/source/carol-transparent.png`。最新GLB約11.6MB。編集可能なblendと比較画像: `output/playwright/carol-rebuild/`。
- 今回の方針上、横背面・歩行・足の接地は対象外。正面の比較と小さい視点移動を次のレビュー基準とする。
- 残り4体・本番置換には進まない。Carol 作業はサブエージェント禁止。

過去の台帳は `docs/archive/2026-09-09/tasks.md`。通常は読まない。
