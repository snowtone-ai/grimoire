# Area 1 — 陸珊瑚の台地（背景世界プロトタイプ）

`Grimoire_決定事項ログ.md` B章の背景世界1枚目を、Three.js r169 で手続き的に生成する試作。
モデルもテクスチャも読み込まない。地形・岩塔・珊瑚・霧・光芒・グレードのすべてが
`src/params.js` の 1 ファイルから駆動される。

参照画像は Monster Hunter World: Iceborne のスクリーンショット（©CAPCOM CO., LTD.）。
**構図・配色・素材の傾向のみを参照しており、原画像のピクセルは一切含まない。**

## 使い方

```
npm install
npm run build      # dist/area1-coral.js, dist/standalone.html, dist/artifact.html
npm run serve      # http://localhost:5178/
```

`dist/standalone.html` は単体で完結する 1 ファイル（`file://` で直接開ける）。

画面右上の「調整パネル」から全パラメータを操作できる。`H` キーでパネルを開閉。
パネル下部の「JSONをコピー」は既定値からの差分だけを出力するので、
そのまま `PRESETS` に貼れる。

## 構成

| ファイル | 役割 |
|---|---|
| `src/params.js` | **仕様の本体。** 21グループ・315+パラメータのスキーマ、reduced ティア差分、プリセット4種 |
| `src/noise.js` | mulberry32 / Perlin / fBm（JS側）と simplex・fBm・木漏れ日（GLSL側） |
| `src/geometry.js` | 地形ハイトフィールド、マーチングキューブによる岩塔、L-system 風の枝珊瑚、板/扇珊瑚、岩塊、散布 |
| `src/materials.js` | 共有ユニフォーム、ラップ拡散＋リム＋擬似SSS、3バンド空気遠近、空、遮蔽用マテリアル |
| `src/passes.js` | 光芒（放射ブラー）、ブルーム（ミップチェーン）、合成＋トーンマップ＋グレード |
| `src/scene.js` | 組み立て、品質ティア判定、H章の環境プリセット契約の発行 |
| `src/gui.js` | スキーマから自動生成される調整パネルと HUD |
| `src/main.js` | 起動、WebGL2 フォールバック、リサイズ、可視性制御 |

## 設計ログとの対応

| 決定事項 | 実装 |
|---|---|
| B章「有機的な穴の空いた岩の塔（2〜3体）」 | SDF をマーチングキューブで面出し（`towers`）。溶接後に最大連結成分のみ残すので、どのパラメータでも浮遊塊が出ない |
| B章「一方向からの強い逆光〜半逆光、暖色〜中間色」 | `sun.azimuth` 既定 186 度（ほぼ正対逆光）。`sun.color` は暖色、大気側は寒色で対比 |
| B章「覗き込む構図の枠を作る」 | `framing` がカメラの視錐台から求めた扇形の縁に暗い前景を置く |
| C章「固定カメラ、ユーザー操作なし」 | `camera` は呼吸ドリーと微揺れのみ。散布ドメインもこの固定画角を前提に最適化（`scatter`） |
| G章「フォトリアルPBRではなくスタイライズ」 | ラップ拡散＋フレネルリム＋Frostbite 系の擬似SSS の3本立て（`surface` / `translucency`） |
| G章「性能判定で full / reduced を決定」 | `quality` グループ。FPS で自動縮退し、条件を満たせば1回だけ復帰する |
| H章「背景世界が環境プリセットの唯一の書き手」 | `getEnvironment()` が凍結オブジェクトを返す。グリモ側はこれを購読する |
| R章「既存の高品質プロダクトと公式ガイダンスを調査してから提案する」 | 光芒は GPU Gems 3 (Mitchell) のポストプロセス方式、ブルームは Jimenez SIGGRAPH 2014 のミップチェーン、擬似SSS は Barré-Brisebois & Bouchard (GDC 2011)、空気遠近は CryEngine2 の地平線整合フォグ＋Firewatch のレイヤ配色 |

## パラメータ・グループ

`camera` `sun` `sky` `fog` `surface` `translucency` `dapple` `terrain` `scatter` `towers`
`branchCoral` `glowCoral` `plateCoral` `fanCoral` `rubble` `framing` `ridges` `motes`
`godrays` `bloom` `grade` `stage` `quality`

プリセット: `① 参照忠実（寒色シアン）` `② 暖色逆光` `③ 深青` `④ 生物発光`

## 性能

| 項目 | 予算 | full | reduced |
|---|---|---|---|
| FPS | 60 | 59–60 | 60 |
| シーン draw call | ≤50 | 29 | 25 |
| 三角形 | ≤150,000 | 152,490 | 44,918 |

`renderer.info.render.calls` が示す 67 は、シーン 29 に光芒の遮蔽バッファ用の再描画 29 と
ポストプロセス 9 を足したもの。シーン自体の draw call は予算内。

三角形は予算を 1.7% 超過している。珊瑚を間引けば収まるが、参照画像の「画面を埋める群落」が
成立しなくなるため、超過を明示したうえで維持している。

## 実装上の注意

- **`degenerateFraction()` は消さないこと。** 面積ゼロのメッシュは属性・インデックス・
  バウンディングボックス・draw call・三角形カウンタのすべてが正常に見えるのに何も描かない。
  面積を測る以外に検出手段がなく、実際にこれで枝珊瑚の全滅を発見した。
- マーチングキューブのポリゴン予算を削らないこと。溢れは無警告で頂点配列を壊す。
- 品質ティアの復帰しきい値は vsync 上限を超えられない。
  `recoverMargin` は（リフレッシュレート − 目標FPS）未満に保つ。
