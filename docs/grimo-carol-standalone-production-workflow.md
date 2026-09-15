# Grimoire「キャロル3D」制作工程 — 他AI引き継ぎ用完全仕様

この文書は、この会話の履歴・AIの記憶・暗黙の前提を持たない別のAIへ、そのまま貼り付けて読ませることを目的とする。対象は、個人向けタスク管理PWA「Grimoire」に追加した、羊キャラクター「キャロル」の3D試遊ページである。

## 0. まず理解すべき結論

今回の成果物は、既存のタスク管理画面を3Dへ置き換えた完成版ではない。原画からキャロル一体を立体化し、触って造形・表情・触感を人間が判断するための独立した比較用試遊版である。

試遊URLは `http://localhost:3000/plant/carol-3d`。既存の `/plant`、IndexedDB、task、plant、reward、backup、認証、Google/Gemini機能は変更していない。追加費用、外部生成API、外部3D素材、新規依存、公開は行っていない。

「SV級を達成した」「原画を完全に3D再現した」とは宣言しない。現段階の受入条件は、キャロル一体を実際に触って、造形・表情・触感の改善点を人間が判断できること。

## 1. キャラクターと原画

キャロルは、淡い青紫とクリーム色の羊毛をまとった小さな羊キャラクターである。原画にある特徴を3Dの判断基準にした。

- 大きな茶系の瞳。瞳の中に星形の光。
- クリーム色の顔、茶色の耳と脚、淡い青紫・白系の羊毛。
- 金色の月と星の装飾。
- 丸く、やさしく、ぬいぐるみのようなシルエット。
- 主目的は戦闘・探索ではなく、スマートフォンで触れて癒されること。

不変の原画は `assets/grimo/source/carol-transparent.png`。このファイルは本人が生成したオリジナル素材として受け入れ済みで、制作時に上書きしない。3Dの横・背面形状は原画に存在しないため、制作上の補完であり、canonicalな正解として固定してはいけない。

## 2. 技術的な制作方針

採用した経路は次の通り。

`原画を観察 → Blender標準Pythonで3Dモデル生成 → GLB書き出し → Three.jsで読み込み → Web上で触れ合い演技を付与 → 実ブラウザで調整・検証`

採用理由は、既存プロジェクトがNext.js + React + Three.jsを使っており、Webでの入力・カメラ・アニメーションを追加依存なしで実装できるため。Blender MCP、Unity、Godot、Live2D、Spine、外部AI動画生成は使っていない。

使用環境:

- Blender 5.2.1 LTS（2026年9月時点の最新LTS）
- Three.js 0.185.1（既存依存）
- Next.js 16.3.1 / React 19
- TypeScript
- shadcn/uiの既存Button（既存依存）
- PowerShell、pnpm
- 追加費用: 0円

## 3. Blender側の制作工程

### 3.1 シーンを空にする

`build-carol-3d.py` はBlenderを `--background --factory-startup` で起動する。既存のBlenderユーザー設定やシーンを利用せず、再現可能な空シーンから開始する。

実行対象:

`scripts/grimo/build-carol-3d.py`

実行コマンド:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' `
  --background --factory-startup `
  --python scripts/grimo/build-carol-3d.py
```

### 3.2 マテリアルを定義する

Pythonで、顔、羊毛、耳、脚、目、虹彩、頬、口、舌、金色の装飾などのPrincipled BSDFマテリアルを作る。色は原画を見ながら設定し、sRGBからlinearへの変換を行って照明下で白飛びしないようにする。

羊毛の色は単純なマテリアル貼り分けだけにせず、後述の頂点カラーも使う。頂点カラー用の属性をマテリアルのVertex Colorノードへ接続しないとGLBへ色が出ないため、ノード接続を明示する。

### 3.3 羊毛の塊を作る

羊毛は、最終的に交差した球の集合をそのまま見せる方式にはしない。工程は以下。

1. 複数の楕円球を、胴体の上下左右へ配置する。
2. BlenderのVoxel Remeshで結合して、ひと続きの表面にする。
3. Smooth modifierで谷と段差を柔らかくする。
4. Decimate modifierでWeb用ポリゴン数を減らす。
5. 頂点カラーで、クリーム・青・紫の大きな色面を描く。
6. GLB書き出し時に頂点カラーを使うマテリアルへ接続する。

胴体と頭の羊毛は別オブジェクトにし、実行時に接触点を局所的に押し込めるようにする。高密度なリアル毛シミュレーションは採用していない。目的は原画の丸い絵本的な形をWebで保つこと。

### 3.4 顔を作る

顔は単一の平面ではなく、次のパーツを別オブジェクトまたは別階層で作る。

- Face: クリーム色の楕円形の顔
- EyeL / EyeR: 黒い大きな目
- Iris: 茶色の虹彩
- EyeStar: 星形の光
- EyeGlint: 白いハイライト
- ClosedEyeL / ClosedEyeR: 閉じ目用の曲線
- CheekL / CheekR: 頬の色面
- Nose: 小さな鼻
- Mouth: 口の開閉グループ
- Tongue: 口の中の舌

閉じ目を別パーツとして用意した理由は、原画の顔の同一性を守りつつ、なでたときに「目を細めて喜ぶ」表情を出すため。AIに新しい顔画像を生成させて差し替える方式は採用していない。

### 3.5 可動パーツと装飾を作る

次の名前付きpivot階層を用意する。名前はWeb側のアニメーションコードが参照するため変更しない。

- `Carol`: 全体のルート
- `Body`: 胴体
- `Head`: 頭
- `EyeL`, `EyeR`, `ClosedEyeL`, `ClosedEyeR`
- `EarL`, `EarR`
- `LegLFront`, `LegRFront`, `LegLBack`, `LegRBack`
- `Tail`
- `Mouth`

月、胸の星、羊毛の星、頭の星、瞳の星は、薄い立体メッシュとして作る。凹形の月を単一のconcave ngonで作ると三角形分割が崩れるため、月は外周・内周のquad stripとして生成する。

### 3.6 GLBを書き出す

BlenderのglTF 2.0 exporterで、カメラとライトは書き出さず、モデルとマテリアルだけをGLB化する。

出力:

`public/grimo/carol-3d/carol.glb`

実測サイズは約1.61MiB（1,685,696 bytes。スクリプト修正時には変動しうる）。ランタイムが読み込む配布assetはこの1ファイルだけ。

## 4. Three.jsランタイムの制作工程

### 4.1 専用ページを作る

Reactのページは次のファイルで構成する。

| ファイル | 役割 |
| --- | --- |
| `src/app/plant/carol-3d/page.tsx` | `/plant/carol-3d`のルート |
| `src/components/grimo/carol-3d-screen.tsx` | React画面、ボタン、読み込み状態、エラー状態 |
| `src/components/grimo/carol-3d-world.ts` | Three.js scene、GLB、入力、演技、カメラ |
| `src/lib/domain/carol-3d-input.ts` | gesture分類の純粋関数 |
| `src/app/globals.css` | `.carol3d-*`だけのページ固有CSS |

既存の `/plant` は変更せず、新しい比較用経路だけを追加する。Buttonは既存のshadcn部品を利用し、角丸0、カード群なし、キャラクターを主役にする。

### 4.2 Sceneを初期化する

`createCarolWorld(host, hooks)` が次を作る。

1. `WebGLRenderer`を作る。
2. devicePixelRatioを最大1.6に制限する。
3. sRGB色空間、ACESFilmicToneMapping、影を設定する。
4. PerspectiveCameraを作る。
5. 空のグラデーション、星、雲の足場、HemisphereLight、DirectionalLightを作る。
6. `/grimo/carol-3d/carol.glb`をfetch + GLTFLoaderで読み込む。
7. GLB内の名前付きノードをMapへ登録し、初期位置・回転を保存する。
8. `ResizeObserver`でカメラ比率とcanvasサイズを更新する。

読み込みには有限timeoutとAbortControllerを使う。失敗した場合は「再読み込み」ボタンを表示する。コンポーネントunmount時はRAF、イベント、geometry、material、texture、rendererをdisposeする。

### 4.3 接触点を決める

キャラクターを画面全体の矩形として扱わず、Three.js Raycasterで実際のmeshへrayを飛ばす。交点から親階層をたどり、`Head`、`Body`、`EarL/R`、`LegL/R`、`Tail`などの部位名を得る。

これにより、触れた位置に応じて、頭・耳・脚・羊毛などの反応を変えられる。背景を触った場合は接触ではなくカメラ回転として扱う。

### 4.4 gestureを分類する

純粋なgestureドメインは `src/lib/domain/carol-3d-input.ts` にある。

- `touch`: 接触開始直後
- `poke`: 移動が小さいまま短く離した
- `pet`: 総移動量が9pxを超え、速度がゆっくりな連続ストローク
- `hold`: 総移動量が9px以下で520ms以上保持

速度は「一度でも動いたか」ではなく、移動距離 / 前回からの経過時間で計算する。これにより、長押しとゆっくりなでる操作を区別する。

pointerupは最後の反応を消さない。pointercancel、lostpointercapture、blur、visibilitychangeは接触を解除するが、誤ってpokeを発火しない。2本目のpointerが来た場合はholdを中止してpinch操作へ切り替える。

### 4.5 表情と身体演技を付ける

`react(gesture, strength)` が演技の種類と余韻時間を設定する。演技はキューに積まず、現在の演技を安全に中断して新しい反応へ切り替える。

通常のフレーム更新では次を行う。

- `pet`: 目を閉じる、頬を明るくする、耳と頭を小さく揺らす、羊毛を少し押す
- `poke`: 目を見開く、口を変える、驚きの頭・耳反応
- `hold`: 身体を少し圧縮し、接触部の羊毛を局所的に押す
- `touch`: 視線を接触側へ寄せる
- 待機: 瞬き、呼吸、尻尾、微細な身じろぎ
- `walk`: 脚を交互に動かし、短い距離を往復する

羊毛は接触したmeshとローカル交点を記録し、shader uniformの接触位置・強度で局所的に法線方向へ押す。表情・部位反応・接触余韻が「触った意味」を伝えることを優先する。

### 4.6 カメラを付ける

- 背景ドラッグ: yaw / pitchを変更
- マウスwheel: 距離を変更
- 2本指: 2点間距離の変化で拡大・縮小
- `正面へ`: 初期yaw、pitch、距離へ戻す
- 左右ボタン: yawを少し変える
- 上下ボタン: zoom in / out
- キャロル歩行中: aimを少し追従させる

縦長画面ではaspectに応じてカメラ距離を補正し、耳や脚が320px幅で見切れないようにする。

### 4.7 reduced-motionと失敗復帰

`prefers-reduced-motion: reduce`では、呼吸・歩行・カメラの連続運動を止める。ただし、なでる・つつく・長押しの顔の結果は即時に表示する。

次の失敗は画面に回復操作を出す。

- GLB fetch失敗 / timeout
- 動的import失敗
- WebGL context loss
- ページhidden中のRAF停止

復帰後にcanvasが多重生成されないこと、既存データへ触らないことを守る。

## 5. UIの制作工程

画面の主要目的は「キャロルに触れる」一つだけ。上部には名前と既存画面へ戻るリンク、中央には3D stage、下部には必要最小限の操作を置く。

表示する操作:

- なでる
- つつく
- そっと押す
- 歩いてみて
- 左右回転
- 正面へ
- 拡大・縮小

通常の説明文は短く「そっと触れて、ゆっくりなでて。」とする。演技内容は画面を説明パネルで覆わず、実際の反応で伝える。

## 6. 検証の工程

### 6.1 静的検証

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify
```

今回の最終確認では `pnpm verify` が成功し、全189テストが通った。

### 6.2 ブラウザ確認

開発サーバー:

```powershell
pnpm dev --port 3000
```

URL:

`http://localhost:3000/plant/carol-3d`

Next.js開発時は `127.0.0.1` ではなく `localhost` を使う。dev origin保護でchunkが403になる場合があるため、設定を緩めず正しいhostで開く。

Chrome DevToolsまたはPlaywrightで、次の幅を確認する。

- 320 × 740
- 390 × 844
- 1280 × 800

確認項目:

1. GLBが読み込まれ、canvasが1個だけ存在する。
2. キャロルの顔・月・星・瞳・脚が見える。
3. なでると閉じ目と頬、つつくと驚き、長押しで圧縮反応が出る。
4. 直接meshへ触れた部位が記録される。
5. なでてから離しても、releaseで反応が消えない。
6. pointercancel / lostpointercaptureで誤タップが発生しない。
7. 歩行中のなでる・つつくで歩行が中断される。
8. 背景ドラッグ、wheel、pinch、正面復帰が動く。
9. reduced-motionでも顔の反応は残る。
10. 横スクロールがない。
11. 通常状態のconsole error/warnがない。
12. `/plant`へ戻れる。
13. 既存IndexedDBへ新しい書き込みがない。

Playwright再確認スクリプト:

- `scripts/grimo/qa-carol-3d.js`: 主要操作20項目
- `output/playwright/carol-3d-edge.js`: pinch、GLB 503失敗、WebGL context loss、再試行8項目

QAの画像は `output/playwright/` に保存され、リポジトリの成果物としては扱わない。

### 6.3 性能確認の意味

開発PCでの単発測定は、入力から次のRAFまで6.3ms、90フレームの間隔中央値16.7ms、p95 16.9ms、約84 draw calls、約150,350 trianglesだった。これは実スマートフォンGPUの保証ではない。実機性能を出荷判断に使う場合は、対象端末で別途測定する。

## 7. 重要な保護条件

別AIが続きを実装する場合、以下を破ってはいけない。

- `assets/grimo/source/carol-transparent.png`を上書きしない。
- `/plant`を勝手に3D版へ置き換えない。
- IndexedDB schema、task、plant、reward、backupを変更しない。
- 外部AI画像・動画・3D素材をランタイム取得しない。
- API課金、無料トライアル登録、外部サービスへの秘密送信をしない。
- 既存の未コミット差分をreset、checkout、全stageしない。
- `Carol`以下の名前付きノードを、Webコードを更新せずに改名しない。
- 造形の品質を、テスト成功やフレームレートだけで合格扱いしない。
- SVの内部実装やタイミングを確認済みだと推測しない。
- 残り4体の制作や製品画面置換へ、利用者の明示判断なしに進まない。

## 8. 現在の品質境界

できていること:

- 一体の立体モデルを再現可能なスクリプトから生成できる。
- 顔・耳・脚・尻尾・羊毛の接触に意味のある反応がある。
- 触り方の違いをpoke / pet / holdとして区別する。
- スマートフォン縦幅とdesktop幅で試遊できる。
- 表情と操作を人間が比較判断できる。

まだ未達のこと:

- 原画の絵筆感、発光、細かな羊毛層の完全再現
- SV級の複雑な表情・身体演技
- 歩行の足接地や重量感の完成度
- 実スマートフォンGPUでの性能保証
- 5体展開、既存画面の置換、公開

別AIは、まずこのページを試遊して「顔」「全体シルエット」「触ったときの反応」「歩行」のどれを直すか確認する。その判断なしに全面リビルドや別方式への移行を始めない。

## 9. 次のAIへの作業指示テンプレート

以下を次のAIへの依頼文として使える。

```text
あなたはGrimoireというNext.js PWAの制作担当です。既存タスク管理機能とIndexedDBを壊さず、/plant/carol-3dの3Dキャロル試遊版だけを改善してください。

原画はassets/grimo/source/carol-transparent.pngで、上書き禁止です。Blender 5.2.1のscripts/grimo/build-carol-3d.pyがpublic/grimo/carol-3d/carol.glbを生成し、Three.js 0.185.1のsrc/components/grimo/carol-3d-world.tsが読み込んでいます。Carol、Body、Head、EyeL/R、ClosedEyeL/R、EarL/R、LegLFront、LegRFront、LegLBack、LegRBack、Tail、Mouthのノード名を保ってください。WebGPU/WebGPURendererへの全面移行は対象外です。

制作の目的はSV級を宣言することではなく、キャロル一体を実際に触って造形と触感を人間が判断できることです。短タップ=つつく、ゆっくり移動=なでる、520ms以上静止=そっと押す、背景ドラッグ=カメラ回転、pinch=拡大縮小です。releaseは反応を消してはいけません。pointercancel、lostcapture、blur、visibility、WebGL context loss、asset失敗を回復可能にしてください。reduced-motionでも顔の反応は残してください。

変更前に未コミット差分を保護し、まず現在の画面をlocalhost:3000/plant/carol-3dで確認してください。変更後はpnpm verifyと、320/390/1280幅、通常操作、連続入力、pinch、reduced-motion、console/networkを確認し、SV品質を達成したと過大報告しないでください。
```

この文書自体が現在の制作工程の完全な説明であり、実装の正本は上記の各ファイルである。
