# Grimo renderer comparison

更新日: 2026-09-08 JST  
状態: G02 renderer gate pass / Three.js採用

## 同一条件

`/plant/render-spike` でDOM/CSS、Canvas2D、PixiJS 8.20.1、Three.js 0.185.1を切り替えた。全方式は同じtransparent Carol PNG、同じ空・月・雲・キャロル・前景の5層、同じpointer正規化、最大3pxのrigid response、同じdt clamp/spring/settleを使った。顔を含むcanonical surfaceは変形せず、world-side cloud lensだけを接触点へ最大5%横伸縮する局所変形とした。高頻度poseはReact stateへ入れず、各rendererのloop内で更新した。

公式資料は [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)、[OrthographicCamera](https://threejs.org/docs/pages/OrthographicCamera.html)、[PixiJS Application](https://pixijs.com/8.x/guides/components/application)、[PixiJS Assets](https://pixijs.com/8.x/guides/components/assets) を2026-09-08に確認。両packageはMIT、追加料金・外部送信なし。

## 現時点の実測

Production buildとlocalhostを起動し、Chrome 390×844で全4方式を順に切替した。透明Carolへの切替後も、短時間接触、キーボード入力、再切替を確認した。

| 方式 | 表示 | 短時間FPS | draw / texture | 現時点の所見 |
|---|---|---:|---|---|
| DOM/CSS | transparent原画一致 | 60 | n/a / 1 | 最小。5層のworld parallaxは成立するが、将来のdepth/shader/local deformationがCSS・別canvasへ分散する |
| Canvas2D | transparent原画一致 | 60 | 1 / 1 | 小さく制御可能。各層・局所変形・GPU resource管理を手続き描画で保守する必要がある |
| PixiJS | transparent原画一致 | 60 | 1 / 1 | 2D scene graphは扱いやすい。採用水準には達するが、今回必要なorthographic depth、shader、resource計測をThree.jsより簡潔にはできない |
| Three.js | transparent原画一致 | 60 | 1 / 1 | OrthographicCameraとtransparent planeでidentityを保持。depth、shader候補、resource計測・disposeを同じruntimeに置ける |

Carol assetとrenderer moduleのrequestは200/304、切替後console error/warn/issueは0。320×720と1280×800ではhorizontal overflowなし。reduced-motionをemulateした別contextで`motion: reduced`と入力poseの静止を確認した。Three.jsの5秒traceはCLS 0.00、性能insightなしだった。

## 決定

**Three.js 0.185.1を採用する。** 4方式とも現段階のidentity fidelityと60fpsは同点で、PixiJSが明確に上回る実測はなかった。Carolの原画はflattened surfaceなので、顔・目・輪郭を無理に変形する方式は採らない。その上で将来必要な奥行きplane、world側局所shader、texture upload計測、context/disposeを一つの小さなruntimeにまとめられるThree.jsが最小の拡張経路になる。

DOM/CSS、Canvas2D、PixiJSと比較routeは決定後に削除済みで、`pixi.js` dependencyもlockfileから除去済み。G03では新しいThree.js専用sceneを最小に作り、今回確認した透明原画・face lock・world-side局所変形の境界を引き継ぐ。canonical characterのmesh変形は、source-backedなface-safe maskを実測できるまで禁止する。
