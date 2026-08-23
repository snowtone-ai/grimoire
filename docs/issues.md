# issues.md

## Error Log

### 本番CSSにT045/T046のカスタムクラスが1つも含まれていない（2026-08-23、調査中）

`f8b5c85`（T045+T046のsquash merge）のProduction deployは`READY`で、`public/`の
新アセットはバイト単位で正しく配信されている（`/area-heroes/preview/frost.avif`は
384×480でローカル生成物とsha256一致）。JSも新しい（`.quest-add-button`に`is-orb`が
付き、canvasが存在する）。しかしCSSだけが噛み合っていない。

- 配信中: `/_next/static/immutable/chunks/2b0s-t4rq7k0a.css` (113,729 bytes)
- ローカルの`pnpm build`: `2muv3-52q2jae.css` (126,770 bytes)
- 配信中のCSSに **無い**: `.quest-add-button`, `.is-orb`, `.area-explorer-plane`,
  `.item-explorer-art`, `page-plain-out`（いずれも本ブランチで追加した手書きCSS）
- 配信中のCSSに **有る**: `.morning-light`, `.drop-reveal`, `page-turn`,
  `btn-squish`（T044以前からある手書きCSS）
- 同じ配信中CSSに、本ブランチの新コンポーネントだけが要求するTailwindユーティリティ
  （`--container-sm`, `--blur-xs`, `--font-display`, `--tracking-wide`）は**入っている**

つまりTailwindのユーティリティ層は新しいソースを走査できているのに、`globals.css`の
手書き部分だけが古い。ビルドログは`Restored build cache from previous deployment
(B8LA6s8nW7czNcUpq2bLYwePpJP1)`を出しており、エラーも警告もなく15秒で完了している。
`origin/main`の`src/app/globals.css`には該当クラスが確かに存在する（42,997 bytes、
grep 12件）。ローカルの本番ビルドは同じソースから正しいCSSを出す。

影響: クエスト追加ボタンのcanvasが300×150のインライン要素のまま右下からはみ出し、
`+`とQUESTラベルが出ない。エクスプローラのpan/zoom平面とアイテム拡大面も無レイアウト。
本番のホーム画面が壊れて見える。

現在の仮説: VercelのTurbopack永続キャッシュの不整合。次の手として、必要な作業でも
あるこのファイルの更新をmainへ直接コミットして再デプロイを走らせ、2回目のビルドで
解消するかを見る。解消しなければ`vercel.json`の`build.env`に
`VERCEL_FORCE_NO_BUILD_CACHE=1`を入れて恒久的にキャッシュを切る。

## Escalation
（なし）
