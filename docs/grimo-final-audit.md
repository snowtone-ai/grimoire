# Grimo 製品実装前監査

監査日: 2026-09-08 JST  
対象ブランチ: `docs/grimo-concept-research`

## 結論

G01の仕様固定までは進められる。製品コード、IndexedDB、Service Worker、既存音声、既存QAは変更していない。作業開始時点の未コミット差分は `.codex/config.toml`、`AGENTS.md`、`tasks.md`、`docs/state.md`、`docs/decisions.md` と Grimo企画資料・原画で、すべて利用者の既存作業として保持する。

## 保護する既存境界

| 対象 | 現状 | Grimo実装で守ること |
|---|---|---|
| 画面 | `/plant` は `PlantScreen`、下部ナビは「研究所」 | 入口URLと下部ナビの位置を維持し、Golden Referenceはこの経路で統合する |
| IndexedDB | `TaskManagerDB` schema v4。tasks / streaks / plantState / dropsを保持 | G01〜G04ではschemaを変えない。保存仕様は別storeかlocalStorageを比較してからG12で追加する |
| backup | schema v4の既存データを書き出し・取込み | Golden Reference中に形式を変えない。将来追加時は旧backupの取込みとrollbackを検証する |
| PWA | `public/sw.js` のnavigation network-firstと静的資産cache | 初回完全offlineを約束しない。オンライン訪問後のoffline再訪を壊さない |
| 音 | Web Audioと既存CC0音、音設定は既存経路 | 初期OFFと任意性を維持。G04までは新規音源を追加せず無音でも成立させる |
| motion | `prefers-reduced-motion`、visibility停止の既存例あり | character runtimeも同じ設定をライブ参照し、非表示時にrAF/timerを停止する |
| input | Pointer Events、pointer capture、pinch対応の既存実装あり | G03は独立した純粋判定器を作り、既存explorerのpinch/scrollを変更しない |
| UI | Next.js App Router、React 19、Tailwind v4、shadcn Radix Nova | `src/app/globals.css` と既存Buttonを再利用し、角丸0・1画面1主要操作を守る |

全ルート共通の `OpenFlourish` は最大3秒の入力面を持つため、Golden Referenceの「すぐ触れる」と衝突する。製品統合時に `/plant` では抑制する。既存の音声入力とGemini経路はタスク登録専用のままにし、Carolへ接続しない。

## 資産

- 4体の原画は `assets/grimo/source/carol-pino-jill-shushu-canonical.jpg`（1536×1024、JPEG、alphaなし）。4体を2×2に配置した統合原画で、キャロルは左上にいる。
- ムゥの原画は `assets/grimo/source/muu-canonical.png`（1792×2400、PNG、alphaあり）。背景を含む完成絵で、既存4体とは別の線質と構図を持つ。
- 原本はbyte-for-byteで移動し、編集していない。公開用派生物は原本と別に置く。
- 4体原画は黒背景へ統合済みで、隠れ部位と完全なalphaは存在しない。ムゥのPNGもalphaは全画素255で背景込み。黒い輪郭を壊さず任意背景へ分離できるとは現時点で証明できない。G02ではキャロルだけ実測し、不足を捏造しない。
- 既存 `public/vfx`、`public/audio`、`public/area-heroes` はGrimo専用資産ではない。出典・用途を確認せず転用しない。

## 既存能力と依存

`sharp`、Playwright、Chrome DevTools、既存WebGL runtime、Pointer Events、Web Audioで監査と最小spikeを実行できる。DOM/CSSとCanvas2Dは追加依存なしで比較できる。PixiJSとThree.jsは未導入なので、G02の資産可否を通過した後、同じ入力・同じ絵で比較する時だけ一時spikeまたは最小依存として扱う。製品renderer決定前に両方を本番依存へ追加しない。

## 監査ゲート

- 既存差分消失: 0
- 製品コード変更: 0
- DB / backup / PWA / API /公開範囲変更: 0
- 重複plugin / MCP / skill / runtime依存追加: 0
- 次の操作: [G01製品契約](grimo-g01-product-contract.md)を受入基準として固定し、その後 [G02資産実測](grimo-asset-reality.md) へ進む
