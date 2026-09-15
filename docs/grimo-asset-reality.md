# G02 — キャロル Canonical Asset Reality

確定日: 2026-09-08 JST

## Canonical Reference

原本は [4体統合原画](../assets/grimo/source/carol-pino-jill-shushu-canonical.jpg)。SHA-256は `4bef79470608bc81482afef48f124279fdaa57b41f0cc043453ec98ee79ade1b`、1536×1024、JPEG、alphaなし。キャロルのcanonical cropは左上 `(0, 0, 768, 493)`、可視foreground boundsは閾値18で `(96, 5)–(733, 489)`。原本は変更しない。利用者が、Grimo原画は自身がAI画像生成で一から作成したオリジナルであり、プロジェクトと公開への完全な権利を持つと確認した。

`scripts/grimo/build-carol-canonical.mjs` がsource hashを先に検証し、cropを `background / ambient / identity` の排他的な3層へ分ける。派生物は `assets/grimo/derived/carol/` に保存する。同じスクリプトを再実行しても原本へ書き込まない。

## 静止再合成

`canonical-crop.png` と `static-recomposite.png` のdecoded RGB pixel SHA-256は共に `320fd723734f082cc2ab410892edcc4e83f3343f12412d4ce44421faddb96e58`。全画素のbyte比較も一致した。静止時の顔、比率、線、色、装飾は原画から変わらない。

この一致は黒いmatteを含むcanonical cropについての判定であり、任意背景へ完全に抜ける証明ではない。JPEGの黒背景と黒い輪郭を数学的に分離する情報は原本にない。黒縁を消すための閾値拡大は輪郭を欠損させるため採用しない。

## Layer / Part Contract

座標は768×493 crop内。部位boxは可視範囲を人が確認するための領域で、隠れた形状を推定した輪郭ではない。完全値とhashは [manifest](../data/grimo/character-manifest.json) を正とする。

| 部位 | bounds / anchor | z-order | source状態 | 動かしてよい範囲 |
|---|---|---:|---|---|
| background | crop全体 | 0 | 原画matte | 0 |
| detached ambient | `96,50,623,440 / 407,250` | 10 | 9 connected componentsを分離 | ±4px、±2°。顔と接点を覆わない |
| feet | `277,429,322,63 / 438,462` | 17 | 胴に隠れた輪郭なし | 0 |
| left/right ear | `280,286,132,84 / 393,303`; `612,207,99,88 / 619,253` | 18 | 毛に隠れた根元・裏面なし | 0 |
| fleece and body | `96,5,638,485 / 414,300` | 20 | 1枚のflattened visible surface | rigidな上下±3px。局所変形は顔lock外で最大2pxをrenderer比較 |
| moon / attached stars | `185,82,377,318 / 334,237` | 21 | 毛と結合 | 0 |
| face | `382,210,260,188 / 517,307` | 24 | Identity Layer | 変形・回転・拡縮0 |
| eyes | 左 `430,273,58,80`; 右 `552,235,61,82` | 25 | 開眼だけ。pupil/eyelid未分離 | 変形・位置移動0 |

## 不足と採用判断

- 自然な閉じ目、分離pupil、耳・足・毛の隠れ輪郭、背面はsourceにない。黒楕円、補筆、生成AIで捏造しない。
- `identity.png` はforeground componentを実分離したが、黒matte由来のedge情報不足がある。任意色背景の最終assetとして昇格させず、renderer spikeではcanonical cropを同じ暗色舞台で比較する。
- 呼吸はcanonical surface全体のrigid displacement、視線は舞台に対する身体の微細な向き、secondary motionはsourceから分離できたambientと世界側で検証する。顔・目を加工して「動いたように見せる」方法は不採用。
- 権利記録は利用者確認により更新済み。第三者素材・外部APIは使わず、manifestにsource/provenanceを固定する。

## 透過asset（G02補足）

利用者追加の `assets/grimo/source/carol-transparent.png` は624×400のRGBA PNGで、完全透明93,747pxと半透明アンチエイリアス9,275pxを持つ。`scripts/grimo/build-carol-canonical.mjs` はhashを固定し、`assets/grimo/derived/carol/transparent.png` と `public/grimo/carol-transparent.png` へdecoded RGBA全画素一致で出力する。既に輪郭品質のあるalphaをMLで再推定せず保持するため、黒matteのcanonical JPEGとは別に、世界との合成・renderer depth比較で使える。

## G02 Gate

- 原本hash固定: pass
- 原本非変更: pass
- 実分離とz-order: pass（安全に分離できた3層のみ）
- 静止再合成: pass（decoded全画素一致）
- semantic部位の独立可動: unavailableを明記
- 顔・比率・線質の変更: 0
- 次の操作: 同じcanonical crop、暗色背景、同じ接触入力でDOM/CSS、Canvas2D、PixiJS、Three.jsを比較する
