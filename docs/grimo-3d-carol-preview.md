# 3Dキャロル — 試遊版

2026-09-09 / `feat/carol-3d` / ローカルのみ・未公開

## 試す

- URL: http://localhost:3000/plant/carol-3d
- キャロルを短くタップでつつく、ゆっくり動かすとなでる、その場で約0.52秒触れるとそっと押す。
- 背景をドラッグして回転、2本指またはマウスwheelで拡大。下のボタンから同じ触れ合い、歩行、視点の操作ができる。
- キーボード: キャロルの領域にfocusし、Enterでつつく、Spaceでなでる、左右矢印で回転、上下で拡大縮小、Homeで視点を戻す。
- サーバー停止時は `pnpm dev --port 3000`。Nextのdev origin保護により、開発PCでは `127.0.0.1` ではなく `localhost` を使う。

## 今回できたこと

原画を保ったまま別の3Dモデルを制作し、既存画面を置換しない比較用経路へ接続した。クリーム色の顔、茶色と星の瞳、青紫の羊毛、茶色の耳と脚、金色の月と星を持つ。顔・耳・足・尻尾は階層で可動。羊毛は単に交差する球を並べた表示ではなく、結合して平滑化したmeshに色を描いている。

表情は開眼／閉じ目、驚き、口の変化、視線、瞬き。呼吸・耳と頭の身じろぎ・短い歩行を追加。接触した羊毛の局所変形と、触れた耳・脚への反応がある。連打や歩行途中の接触で演技を切り替えられる。入力解除で最後の演技を上書きしない。

## 制作物と再現

| 対象 | 場所 |
| --- | --- |
| 不変の原画 | `assets/grimo/source/carol-transparent.png` |
| 制作script | `scripts/grimo/build-carol-3d.py` |
| GLB（1,685,696 bytes / 約1.61 MiB） | `public/grimo/carol-3d/carol.glb` |
| 描画・入力・演技 | `src/components/grimo/carol-3d-world.ts` |
| React画面 | `src/components/grimo/carol-3d-screen.tsx` |
| 純粋なgesture判定 | `src/lib/domain/carol-3d-input.ts` |
| 操作の再確認 | `scripts/grimo/qa-carol-3d.js` |

制作: `& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python scripts/grimo/build-carol-3d.py`

Blender 5.2.1 LTS、Three.js 0.185.1、shadcn Buttonを使用。WebGPU/WebGPURendererへの移行は行わず、既存WebGLRendererを維持する。追加dependency、外部mesh/texture、生成API、MCP導入、費用なし。[既存Buttonの公式仕様](https://ui.shadcn.com/docs/components/radix/button)のvariantとkeyboard動作を再利用。出典不明のキャラクター素材は取り込んでいない。今回のGLBはBodyWool/HeadWoolに加え、疎なWoolCluster群、FaceのSmile/Surprise/Squint Shape Keysを含む。

## 確認結果

- `pnpm verify`: lint、typecheck、189/189 tests、production build成功。QA callbackのlint warningは専用形式を明記して修正し、changed-file lintとbuildを再確認した。
- 原画のhash・透過・RGBA一致を含む既存tests成功。DB/schema、backup、Google/Gemini、旧 `/plant` の実装は今回変更していない。
- Chrome DevTools: 320/390/1280幅、前面と背面、表情・カメラ、console/network確認。通常状態error/warnなし、GLB取得成功。画面幅はエミュレーションであり実スマートフォン端末の確認ではない。
- Playwright CLI: 主要操作20項目成功。直接mesh接触、長押し、なで中の長押し排除、離した後の表情維持、pointercancel/lostcapture、背景回転、keyboard、歩行中の割込み、reduced-motionと静止への復帰、320/1280のoverflow・操作部の収まり。
- 追加の一時QA: 実touchイベントによる2本指の競合と拡大、asset取得503後の再試行、WebGL context loss後の再試行、canvas多重生成なしの8項目成功。意図的な失敗時のconsole errorと通常状態の異常を区別した。
- 変更後のdesktop単発測定: 入力から次RAFまで6.3ms、90frameの描画間隔中央値16.7ms、p95 16.9ms。84 draw calls、150,350 triangles（shadow描画を含むrenderer統計）。ユーザー端末のp95やGPU完了時刻の保証ではない。
- 画像: `output/playwright/carol-3d-390.png`、`carol-3d-happy.png`、`carol-3d-poke.png`、`carol-3d-walk.png`、`carol-3d-reduced.png`、`carol-3d-320.png`、`carol-3d-1280.png`。生成QA成果物はgitignore内。

## 品質の境界と次

これはSV級の達成報告ではない。目を閉じて喜ぶ／驚くなどの表情の差と、手で触れる反応を体験できる一体になった段階。原画の絵筆・発光・細かな羊毛の層、歩行時の接地の精密さ、反応の演技の豊かさはまだ同等ではない。人間の造形・触感の評価と、実スマートフォンGPUの性能確認は未実施。

利用者が実物を触って、顔・全体の形・触感のどこを優先して直すか判断する。既存画面の置換や他4体への展開、公開はその前に行わない。
