# Grimoire — Final Production Tasks
更新日: 2026-09-09 JST
状態: チェックページと再開記録を保存してセッション終了可能。造形は制作途中、公開なし。

## 最新の再開点 — チェックページを渡して終了（2026-09-09）

- 最新指示: トークンlimitが近いため、早めにチェックページを出し、セッションを終了できる状態にする。新たな改修は止めた。
- チェック: `http://localhost:3000/plant/carol-3d`。開発サーバー稼働中。終了後に止まっていたら、このrepoで `pnpm dev`。静止画は `output/playwright/carol-rebuild/check-front.png`。
- ブランチは `feat/carol-reference-rebuild`。commit/push/公開なし。ユーザー既存差分・原画・IndexedDB不変。サブエージェント不使用。
- 変更: 本体を切り抜かない不透明の全周UVテクスチャ、背面の放射状ピンチ修正と房、星を羊毛表面に密着。最新GLB 11,639,028 bytes。新版生成は `scripts/grimo/build-carol-reference.py`（旧builderは実行しない）。
- 動作: `src/components/grimo/carol-3d-motion.ts` に演技とノード/morph名を分離。歩行を接地・持ち上げ区間へ分け、停止は顔/耳/歩行も現在姿勢で凍結。比較操作・停止中disabled・再読み込み時の状態を修正。
- 検証: 対象3TS/TSX lint、typecheck、`pnpm test` **191/191**、`pnpm build`成功。320/390/1280でreadyと横はみ出しなし。通常クリックの原画切替、なでる、表情停止、歩行途中停止→再開→終了を確認。停止はスクリーンショットの一致でも確認。Chrome DevTools通常console error/warnなし。reduced-motionへの切替確認。
- **未合格**: 羊毛側面の筋/層状の形、顔と毛の境界、星の縁、月の浮き/下地との重複、横・背面の絵柄、自然な足の接地/演技の最終目視。最新GLBは約11.6MBで重い。直接接触中断/pinch/失敗復帰/性能の新版一式と短い動画は今回未実施。過去版の結果を新版の合格に流用しない。
- 次: 利用者のチェック結果を受け、上記造形を優先して直す。続きを頼まれたら `docs/grimo-carol-rebuild-review.md` の最新節と対象ファイルから。残り4体や本番置換へ展開しない。
- 配信トラブル: 開発キャッシュが旧CSS/削除済みrender-spikeを保持。自分の開発serverを停止し `.next/dev` を `.next/dev-carol-stale` へ退避して再生成。新CSSをブラウザで実測し、ボタンへのクリックがstageへ抜けないことを確認済み。

## 再開はここから — compact前の保存（2026-09-09）

- 利用者の最新指示: 切りの良いところで止めてcompactを案内する。再開命令後は再承認を求めず下記の続きへ。サブエージェント禁止を継続。
- 追加要件: キャロルを全グリモの品質基準にする。人間の優れた制作者の制作・評価手法を調査して取り入れる。将来の動作追加を見据え、可動部/表情の名前と演技の編集境界を整える。
- 再開資料: `docs/grimo-carol-rebuild-review.md`。今回の変更、失敗、読めた一次資料3件、未確認、次の具体操作を保存済み。
- ブランチ: `feat/carol-reference-rebuild`。旧作・既存未コミット差分を保持。公開/commit/pushなし。
- 新ビルダー `scripts/grimo/build-carol-reference.py` → `public/grimo/carol-3d/carol.glb`（制作途中10.61MB）。旧 `build-carol-3d.py` はまだ前作用なので混同しない。原画採寸は `reference-landmarks.json`。
- 前作退避と編集可能な新版blend: `output/playwright/carol-rebuild/`。原画624×400は不変。
- 検証: 新版の型・対象lint・diff checkは成功、GLB出力とunlit材質を確認。実表示の正面と横方向を自分で見て **側面の裂け目/引き延ばし/頭と胴の接合/前面の継ぎ目を不合格** とした。幅別/全操作/新版production buildは未完了。
- 次: 無地の立体を正面/45/90/背面で評価し、alphaで本体を切り抜く処理と不自然なボリューム構造を修正する。原画の色で形の問題を隠さない。その後、境界・表情・演技の分離・足接地・実ブラウザ一式を仕上げ、比較画像と動作の実物を渡す。
- Codex副依頼: global `model_auto_compact_token_limit=180880` 設定済み。現在の実効258400の70%。Astraの公称105万、Codexカタログの既定272000/拡張上限872000との違いを説明済み。context_window拡張は未実施。詳細は再開資料末尾。

## 原画基準の再制作（2026-09-09）

- 依頼: AI-FB.mdの全3モデルの指摘を評価し、自分でも原画・前作の表示を比較して、忠実度を改善した3Dと動きを試遊可能にする。サブエージェント禁止、Context7使用。
- ブランチ: `feat/carol-reference-rebuild`。以前からの未コミット差分を保持。追加費用0円、公開なし、原画・既存データ不変。
- 実測: 原画は624×400。左右対称の丸い頭ではなく、右下へ傾いた顔、左の青い羊毛、大きな月、ほぼ隠れた3本の脚が識別点。前作の球体unionと小さなクラスタ追加ではこれを保持できていない。
- 制作: 原画座標を基準に、厚みを持つ閉じた3D表面、房の起伏、可動部、投影UVを組み直す。硬いセル影・黒い輪郭・一律bloomは原画の淡い陰影と合わないため採用しない。横・背面は原画にない補完として記録する。
- 受入: 同じ基準視点で原画と見比べられる試作品、顔の傾き/目/耳/月/脚の配置、羊毛の色と輪郭、回転時の厚み、瞬き/なで/つつく/押す/短い歩行を実画面で確認。320/390/1280、reduced-motion、入力中断、console/networkと関連lint/typecheck/buildを確認する。テスト成功を造形合格の代用にしない。
- 現在地: 原画、全FB、前作の実画面、制作コードを確認済み。次はモデル再構築と比較レンダー。

## 最新更新 — Blender 5.2.1 LTS + 造形品質の最小改善（2026-09-09）

- Blenderを5.2.1 LTSへ更新し、Three.js 0.185.1と既存WebGLRenderer、Next.js、ノード名/APIは維持。
- `scripts/grimo/build-carol-3d.py`へ疎な羊毛クラスタとFaceのShape Keys（Smile/Surprise/Squint）を追加。Three.js側は既存反応値をShape Keysへ接続。
- Blender 5.2.1で`public/grimo/carol-3d/carol.glb`を再生成済み（2,534,524 bytes）。WebGPU/WebGPURenderer全面移行は実施しない。
- 検証: `pnpm test` 189/189、target lint/typecheck、production build、`git diff --check` pass。Blender 5.2.1でノード名全件保持・17クラスタ・4 Shape Keysを実測。Playwrightでready/なでる→happy/320・390・1280のoverflowなしを確認（consoleはReact DevTools/HMR infoのみ）。
- 残り: SV級の造形合格は利用者の試遊判断に委ねる。

## 現在地 — 3Dキャロルを触れる状態へ（2026-09-09）

- ブランチ: `feat/carol-3d`。既存の大量の未コミット差分を保護。commit/push/公開なし。
- 試遊: `http://localhost:3000/plant/carol-3d`。開発サーバー稼働中。旧 `/plant`、IndexedDB、task/plant/reward/backup、認証は変更していない。
- 実装: Blender Pythonで一体の連続した羊毛mesh、頂点色、顔、星入りの瞳、月・星、耳・脚・尻尾を制作し、1.61MiBのGLBへ書き出した。原画は不変。実行時生成API、新規依存、費用なし。
- 操作: 直接つつく・連続なで・長押し、触点の羊毛変形と部位反応、閉じ目・驚き・口・視線・瞬き・呼吸、短い往復歩行、背景ドラッグ回転、2本指拡大、正面復帰と代替ボタン。全身の自動経路探索や広いmapは作っていない。
- 検証: `pnpm verify`成功、189/189 tests。変更後のlint/buildも成功。Chrome DevToolsと既存Playwright CLIで320/390/1280、主要操作20項目、pinch・asset失敗・WebGL中断の復帰8項目を確認。通常状態console error/warnなし。単発の操作→次frame6.3ms、desktop描画間隔中央値16.7ms/p95 16.9ms（90frame、開発PC上。実スマホGPUの保証ではない）。詳細 `docs/grimo-3d-carol-preview.md`。
- 重要な未達: SV級の造形・演技品質を達成したとは扱わない。原画の絵筆感、複雑な羊毛の細部、歩行の足接地、端末ごとの性能には改善余地がある。今回の合格は「一体を実際に触って判断できる」まで。残り4体や既存画面の置換へ勝手に進まない。
- 次: 利用者が実物を試し、造形・顔・触感のどこを直すか判断する。修正依頼では再調査せず、この一体と `scripts/grimo/build-carol-3d.py` / `src/components/grimo/carol-3d-world.ts` を直接改善する。main agentのみの指定を維持。
- 区切りの運用: 次の大きな制作段階の前に必要ならcompactを案内する。現在地は保存済み。新たな依頼が来るまで品質合格を自己判定して展開しない。

## 実装開始時の記録 — 以下は着手前の履歴

- 最新の依頼: 品質は感覚を含むため、SV品質を目標にキャロル一体を実際に作り、利用者が触って判断する。3D実装は承認済み。計画や簡単な模型だけで終えず、原画のデザイン、自然な顔・身体の反応、滑らかさを目指す。SVと同一タイミングは不要。
- 制作範囲: 一体＋専用世界。表情／視線／瞬き、なでる・つつく・押す際の部位反応、待機と余韻、短い歩行と移動、回転・拡大・正面へ戻すカメラ。主役はスマートフォンでの癒しの触れ合い。全5体展開、広い探索マップ、罰・日課、課金は対象外。SV級の達成は約束せず、実物で判断できる状態を完成条件とする。
- 現在: 3Dキャロルのモデル・rig・新画面は未着手。調査済みなので再調査の周回や事前ベンチマークはしない。main agentのみという利用者指定を維持し、サブエージェントは使わない。
- 次の具体操作: 既存の `src/components/grimo/`、`src/app/plant/page.tsx`、`src/app/globals.css`、package/test構成を必要部分だけ読む。専用実装ブランチを作り、別の比較用経路（例 `/plant/carol-3d`）で既存画面を壊さず制作。Blender Pythonで原画をもとにモデル・顔・可動部を作り、GLBを既存Three.jsへ接続。自動生成の未修正meshや単なる球の集合を完成品にしない。
- 原画: `assets/grimo/source/carol-transparent.png`。本人AI生成オリジナル、公開権利確認済み。大きな茶系の瞳と星の光、淡いcream/lavender/blueの羊毛の塊、茶色の耳・脚、金色の星と月。原本は不変。横・背面は自然に補完が必要。GPT Imageを補助に使う場合はimagegen skillと組み込み経路、既存契約内のみ。ランタイム生成APIなし。
- 制作環境: `C:/Program Files/Blender Foundation/Blender 4.5/blender.exe`、4.5.10 LTS。background factory-startupでPython操作とglTF exporter存在を確認済み。Blender MCPは未導入・当面不要。追加ツールは無料で有用なら導入許可あり。外部有料生成、telemetry、秘密の送信は許可と混同しない。GPUはAMD Radeon (TM) Graphics、Web性能は未実測。
- 作業ツリー: 現ブランチ `docs/grimo-picnic-analysis`、以前から大量の未コミット変更あり。全て保護しreset/一括stageしない。既存DB、task/plant/reward/backup、認証、公開状態を変えない。開発サーバーは今回まだ起動していない。
- 検証: 実装後に関連する型・lint・テスト/buildとChrome DevToolsの実画面を必要十分に確認。顔と反応の目視、320/390/desktop、pointer中断・連続入力、カメラと接触の競合、reduced-motion、console/networkを対象にする。見た目の失敗は実際に直すが、成功済みの無目的反復はしない。実際に触れるURLと画像を渡す。
- 実装前にfrontend-design、shadcn（components.json適用時）、chrome-devtoolsのskillを読む。前turnでは本文を読んだだけでUI実装未着手。UIは角丸0・カード群なし・既存部品とstyleを再利用。過去調査は `docs/grimo-picnic-analysis.md` と `docs/grimo-free-animation-options.md`、能力選定D-066を必要時のみ参照。
- 利用者の運用指定: トークン節約のため適切な区切りでcompact/clearを案内する。先にこの台帳へ再開点を保存し、その後いったん止まる。利用者が実行して「実装を続けて」と言ったら、再承認を求めずここから実装する。今回は調査完了→実装開始の区切りでcompactを案内。

## 最新の現在地 — 2026-09-09 JST

- 最新補足（下の移動不要条件を更新）: 原画のデザインでSVのような自然な反応・触れ合いを希望。同一タイミングは不要。移動・歩行・自由カメラも品質が成立するなら希望するが、3D品質を見て判断したい。無料の有用な制作ツール導入は許可済み。
- 能力確認: `C:/Program Files/Blender Foundation/Blender 4.5/blender.exe` の4.5.10 LTSが既存。factory-startupのbackground Python実行とglTF export operatorの存在確認に成功。新規導入不要で3D制作に着手可能。MCPは未導入、3Dキャロルの品質・実書出し・Web描画は未検証。次は全製品を3Dへ置換せず、原画に寄せたキャロルの短い3D実物を作って比較する案。詳細D-066。

- 利用者の最新条件: SVピクニックの触れ合い反応を手本に、スマートフォン内で癒される定位置の触れ合いへ集中する。移動・歩行・経路探索・自由カメラは不要。顔、視線、触点側の耳や毛、身じろぎ、余韻は必要な演技として残す。これにより固定視点の2.5D＋事前生成演技を優先する。

- 既存のG04は「9演技が完成」とは扱わない。一枚絵の全体移動と雲・星が中心で、顔と身体の意味ある演技が不足。releaseによる個別反応目標の上書き、長押しと移動の競合等をソース監査で特定した。
- SVの公式・制作担当者・利用者記録を分析し、改善2.5D、限定3D、事前生成アニメを比較。[分析](docs/grimo-picnic-analysis.md)、[根拠と閲覧限界](docs/grimo-picnic-evidence.md)、[GPT Image・無料候補・着手順](docs/grimo-free-animation-options.md)。YouTubeの時間解析とSV内部実装は未確認。
- 追加費用0円・速度優先の推奨は、少数の表情／決めポーズ＋2.5Dの即時制御、必要な演技だけ事前生成クリップ。全身3Dと大量動画を先に作らない。原本は保存し、キャラクター同一性と表情の画素固定を区別する提案。採用・素材制作は未実施。
- 今回は調査文書と台帳だけ変更。新規登録・生成・依存追加・API課金・製品実装・公開・DB変更なし。次の実装依頼ではキャロル一体の表情、つつく、連続なで、待機を直接作り、重要操作だけ実画面で確認する。実装前の全候補検証は不要。
- 以下のPhase A〜Cは過去の作業記録。旧「slider調整／目視判断待ち」を現時点の次の操作として使わない。

## フェーズ台帳

### Phase A — Carol透過assetの受入・完全ローカル化（完了）

- `carol-透過.png` を `assets/grimo/source/carol-transparent.png` へ移動。
- 既存sharpだけでsource hash、RGBA同一性、透明pixel、半透明edgeを検証し、derived/publicのPNGを出力。外部API・Webサービス・追加依存・費用は0。
- 利用者確認により、Grimo原画は本人がAI生成したオリジナルで公開権利ありとしてmanifestを更新。
- 受入: focused asset test 4/4 pass。詳細は `docs/grimo-asset-reality.md` とD-062。

### Phase B — renderer方式の比較・固定（完了）

transparent Carolと空・月・雲・キャロル・前景の5層、world-side局所変形を4方式へ同条件で追加。390pxで全方式60fps、320/1280で横あふれなし、reduced-motion state、console/network、Three.js traceを確認した。Three.js 0.185.1へ固定し、不採用のPixiJS・比較spike・関連CSSを削除。`pnpm test` 180/180、production build pass。詳細は `docs/grimo-rendering-decision.md`。

受入: pass。identity lock、実ブラウザ証跡、console/network異常0、reduced-motion静止経路、選定理由を記録済み。cleanup完了後もG03へは人間の明示合格まで進まない。

### Phase C — Carol入力・9反応核（実装完了・人間の最終判断待ち）

Phase Bの人間合格を受け、G03を開始した。`/plant` はThree.jsのCarol専用sceneへ移行し、透明canonical原画を剛体planeとして表示する。primary pointerのcapture、move、up/cancel/lostcapture、blur、非表示を入力解除へ接続し、キーボードのEnter/Spaceと「つつく／なでる／そっと押す」の代替経路を置いた。原画面は変形せず、接点の返答は最大の剛体微移動と雲側の局所変化だけに限定する。

G03の入力判定はpure domain testへ固定済み。画面上の状態説明「キャロルは待っている」は撤去し、接点だけで返事を伝える。顔・頭・左右の毛並み・足元の5接触位置、到着・つつく・ゆっくりなでる・長押し・ドラッグ・離す・連打・待つ・直接接触の9反応を、現在姿勢から即時に切り替える。`目視調整を開く` は、canonical原画を固定したまま、空・月・遠近雲・星・キャロルの配置/大きさと、返事量・追従・戻り・余韻・視差を36項目の色選択/sliderとして同時に示す。操作値はこのレビュー中だけ反映し、保存・既存データには触れない。production buildの実画面で320/1280、pointer、キーボード・代替ボタン、console/networkを確認済み。

次の操作: 利用者が `/plant?review=1` の「目視調整を開く」で、キャロルの見た目と触感を調整・目視判断し、明示合格または修正値を返す。表情差分はcanonical原画の同一性を保つ承認済み原画がないため、勝手な生成物を採用していない。次のキャロル変更はこの判断に沿う。

Golden Referenceの順序: `P00監査 -> G01製品契約 -> G02 canonical asset -> renderer比較/決定 -> G03入力 -> G04 9反応核 -> 人間の明示合格 -> 残り4体`。各Gate未達のまま次へ進めない。

受入資料: [実装前監査](docs/grimo-final-audit.md) / [G01製品契約](docs/grimo-g01-product-contract.md) / [G02資産実測](docs/grimo-asset-reality.md) / [character manifest](data/grimo/character-manifest.json) / [renderer比較の現在地](docs/grimo-rendering-decision.md)

次の操作はPhase Cの利用者目視判断を優先する。

## 0. North Star
5体の癒し系キャラクターと5つの専用世界を、原画の魅力を壊さず「触ると生きている」と感じる完成品へ。
主役: 撫でる / 触る / つつく / 押す / ドラッグ / 眺める / 待つ / 会いに行く。
成功: 開く→目が合う→接点が即時に返事→少し遅れて人格ある反応→離すと余韻→眺めても生命感→また触りたくなる。

## 1. Hard Constraints
- キャロル / ピノ / ジル / シュシュ / ムゥ。1体 + 専用世界のみ表示。
- 顔・目・シルエット・比率・色・装飾はcanonical固定。
- 全員初回から選択可。罰・衰弱・期限・拒絶・連続利用義務なし。
- ランタイム画像生成なし。カメラ/マイクなし。
- 追加費用0円。有料API/従量課金/商用・ライセンス不明素材なし。
- 既存タスク/植物/報酬/記録/backupを壊さない。
- コードが動くだけでは完成としない。

## 2. Final Technology Strategy
### Renderer
**第一候補: Three.js 0.185.x系**
- 2D art を OrthographicCamera + depth-layered planes/textures として舞台化。
- parallax / shader / local deformation / particles / lighting を必要箇所だけ使用。
- Three.js現行WebGLRendererはWebGL2、compileAsync、initTexture、renderer.info、disposeを備える。ShaderMaterialはWebGLRendererでGLSL、SpriteMaterialは透明2D textureに対応。
**第二候補: PixiJS 8.20.x**
- 2D GPU表現が明確に勝つ場合のみ採用。
**React**
- 既存Next.js App Router + React。
- @react-three/fiberは必要性が証明された場合のみ。高頻度pose更新はReact treeから分離する方針。
**補助**
- TypeScript: state/reaction/spring/domain
- Web Audio API: 合成 + 既存CC0音
- CSS/WAAPI: UI/極小演出
- Canvas 2D: 軽量transient FX
- sharp: preprocessing
- Pointer Events
- prefers-reduced-motion
- navigator.vibrate(): 任意。必須体験にしない
- View Transitions: 既存実装を必要範囲だけ利用
**最初から導入しない:** Unity / Godot / Unreal / Live2D / Spine / Rive / Matter.js。

## 3. GPT-Image Policy
OpenAIの現行API画像モデルは **GPT-Image-2**。ChatGPT Images 2.0も2026-04-21公開。ChatGPT Images 2.0は全プランで利用可能だが、GPT-Image-2 APIはFree API tier非対応。よって0円条件ではAPIをランタイム/CI基盤にしない。
### 使用可
背景コンセプト、遠景/中景、空白領域拡張、小物、隠れ部分の下絵、世界の光/季節バリエーション。
### 使用禁止
canonical face / eyes / silhouette / proportions / decorations の再生成、無検証の表情差分、本番ランタイム生成。
### 絶対CodeX担当
原画取り込み、hash、manifest、license/source record、sharp加工、alpha/mask、derived assets、contact sheet、canonical composite、validation、public配置、git/CI/build/verify、生成物の採用ledger。
生成自体は他環境でも可。ただし本番資産への昇格はCodeXのみ。

## 4. Production Protocol
Skillは7個を固定しない。5つへ統合:
S01 Character & Identity
S02 World & Composition
S03 Animation / Interaction / Game Feel
S04 Visual / Technical Critic
S05 Asset Consistency & Final Polish

## 5. Execution Plan
### P00 Audit & Preservation — CodeX
git status / branch / existing diff / CLAUDE/docs / Skill/MCP / dependency / asset / DB / runtime を監査。
Gate: 既存差分消失0、重複導入0、製品コード未変更。
Output: docs/grimo-final-audit.md

### P01 Asset Reality — CodeX
5体のsource/hash/alpha/bounds/visible parts/hidden parts/anchors/layer candidates/safe deformation/touch zones/GPT-image補助要否を確認。
実際に分離→再合成し、分離可能と仮定しない。
Output: data/grimo/character-manifest.* / docs/grimo-asset-reality.md

### P02 Rendering Architecture Spike — CodeX
同じキャロル原画 + 同じ背景断片で A DOM/CSS, B Canvas2D, C PixiJS, D Three.js を最小実装。
比較: identity, appeal, depth, motion, touch, interruption, mobile, reduced-motion, complexity, CPU/GPU, memory, texture upload, disposal。
Gate: Three.js第一候補。ただし実測でPixiJSが明確に勝てばPixiJS。
Output: docs/grimo-rendering-decision.md
**方式決定前に5体本実装を開始しない。**

### P03 Canonical Asset Pipeline — CodeX
source hash / layered assets / face layers / secondary layers / z-order / anchors / touch regions / world layers / contact sheets / static composite。
Gate: ORIGINAL == STATIC RECOMPOSITE。顔/比率/色/線/装飾driftはFAIL。

### P04 Golden Scene
Carol + 月雲世界のみ。
必須: depth 4〜5層、subtle parallax、breathing、blink、attention/eye response、secondary motion、signature touch、interactive prop 1、ambient motion、touch→response→settle、interruption、60秒idle。
Gate: 以後4体の品質基準になる。

### P05 First Critic — S04
証拠: screenshot / 5〜15秒 interaction / 60秒 idle / reduced-motion / 320/390/1280 / console/network / 1 performance trace。
Rubric: SILHOUETTE, CHARACTER APPEAL, IDENTITY CONSISTENCY, ORIGINALITY, COLOR HARMONY, COMPOSITION, DEPTH, MOTION QUALITY, GAME FEEL, UI INTRUSION, READABILITY, PERFORMANCE, COHESION。
Major/Blocker=0。Minorは体験を壊すものだけ直す。

### G01–G04 Carol Vertical Slice
Input: touch / poke / slow stroke / hold / drag / release / repeated tap / wait。
Pointer capture/cancel/lostcapture/blur/primary pointer。
Reaction:
currentPose + touchIntent + contactPoint + velocity + acceleration + previousAction + timeSinceContact + mood + worldContext → reaction → pose/FX/audio。
**clip再生中心にしない。**
新入力は現在姿勢からredirect。idleへsnap / queueing禁止。
Springはdt依存、clamp、damping、settle threshold、max displacementを持つ自作実装。
R02 Hard Review後に方式固定。

### G05–G08 Remaining Characters
Pino: eyes→hands→body / 水・泡・浅瀬
Jill: chest→wings→tail / 苔・植物・dragon grove
Shushu: check→cheek contact→settle / 花・panda garden
Muu: one-beat pause→reply / 虹音・flower hill
5体共通技術基盤。個体差はmotion grammar / timing / reaction selection / world responseで作る。速度違いの水増し禁止。

### G09 World Composition
far / mid / character stage / near。
顔・指・接触点を隠さない。各世界interactive propはまず1個。
因果: input → prop → character → world → settle。

### G10 Switching
target decode/validation完了後swap。
current worldをloading中維持、latest selection wins、stale async load discard、offline missing targetは現状維持、blank screen禁止、複数体露出禁止。

### G11 Accessibility
keyboard equivalents / visible focus / Escape / no drag-only / pinch not blocked / reduced-motion / audio optional / static states distinguish touch-hold-release-idle-response / large text compatibility。

### G12 Persistence
最小状態: selected companion / preferences / bounded memory。
既存tasks / plant / drops / backup保持。
保存失敗時もtouch継続、retry可能、部分破損なし。

### G13 Performance
測る: input→first visible response / CPU frame / GPU frame when available / FPS / draw calls / texture count/size / rAF / listeners / canvas / texture upload / long-idle growth。
条件: normal / mobile / CPU throttle / cold / warm / background/foreground / repeated switching / reduced-motion。
p95 < 100msは暫定目標。原因がなければ追加最適化しない。

### G14 Long-life
30分相当の短縮試験 + visibility suspend/resume。
rAF/timer/listener/canvas/texture leak、WebGL context recoveryを確認。

### G15 Browser QA — CodeX
actual running appで screenshot + interaction + console + network + runtime error + 主要viewport。
DOMだけで合格にしない。

### G16 Human Playtest
可能なら5名程度。説明なしで time-to-first-touch / first response / alive感 / spontaneous re-touch / world-character unity を観察。
AIの感想をhuman testに算入しない。
人試験不可なら technical complete / playtest unverified と記録。

## 6. Final
### F01 Visual Polish
identity → touch → motion → world integration → timing → sound → light/particle → UI → micro polish。
弱い演出は追加より削除。
### F02 Asset Consistency
hash / manifest / composite / dimensions / alpha / duplicates / missing derived assets。
### F03 Final Critic
S04再評価。FAILがある限り完成扱いしない。Minorのみになったら改善価値とリスクで固定。
### F04 Regression
5体/5世界/major touch/switching/persistence/offline/reduced-motion/keyboard/audio off/large text/console/resource cleanup/production build。

## 7. Release Gate
### Experience
first touch immediate / response intentional / interruption natural / identity drift none / idle alive / world not wallpaper / UI non-dominant。
### Technical
renderer evidence / canonical validation / stale-load protection / cleanup / accessibility / CI green / browser QA green。
### Asset
source/provenanceあり / license unknownなし / GPT-image usage documented / original preserved。
### Cost
追加費用0 / runtime generationなし / paid SDKなし / accidental metered APIなし。

## 8. Agent Responsibility
### CodeX / VSCode PowerShell — mandatory
production source, dependencies/lockfile, asset promotion/validation, tests, Playwright, screenshots/evidence, CI/build, git, tasks/state/decisions。
### Cursor等 — allowed
disjoint prototype/refactor/review only。canonical assets、manifest、dependency変更、release claimは禁止。
### Image-capable agent
background / props / hidden-region draft / atmosphere exploration。
昇格経路: generated source → review → CodeX preprocessing → manifest → canonical promotion。

## 9. Token/Test Economy
必須: domain pure tests / state-reaction / spring safety / pointer boundaries/cancel / asset integrity / persistence migration/rollback / critical accessibility / switching race。
不要: 巨大snapshot / 全frame pixel test / 同一browser smoke重複 / 全reaction個別E2E / 毎タスク30分試験。
原則: **失敗した観点だけ再確認する。**

## 10. Immediate Order
P00 → P01 → P02 → P03 → P04 → P05 → Carol vertical slice → R02 → remaining 4 → worlds → accessibility/persistence → performance/browser QA → playtest → final polish/release。

## 11. Evidence Basis
2026-09-08時点でOpenAI公式: GPT-Image-2。ChatGPT Images 2.0は全プラン利用可、API Free tierは非対応。
npm現行確認: three 0.185.1、pixi.js 8.20.1、@react-three/fiber 9.7.0。
Next.js docs最新: 16.3.4。
Three.js docs現行: WebGL2 renderer / compileAsync / initTexture / renderer.info / dispose / ShaderMaterial / SpriteMaterial。
View Transition API Level 2をMDNで確認。
これらは「全部導入する」という意味ではなく、**候補を確認した上で実原画のSpikeで採否を決める**ことを意味する。

## 12. Final Principle
「触った瞬間、絵が動いた」ではなく、
**「そこにいる存在が触れられて返事をした」**
と感じるか。
この基準を満たさない実装は、機能完成でも未完成とする。
