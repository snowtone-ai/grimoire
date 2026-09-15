# ポケモンSV触れ合い調査 — 根拠台帳

調査日: 2026-09-08 JST。担当: main agent。利用者の単独実行指定以降は委譲なし。結論と実装案は [解析・設計書](grimo-picnic-analysis.md)。

## 根拠の扱い

- **一次・公式**: 製品公式説明、開発者本人の発言、仕様の保守元資料。
- **一次・利用者**: 本人のプレイ記録・写真・感想。実装の証明や全利用者の代表ではない。
- **二次**: 報道、攻略、他人の投稿を紹介する記事。一次資料を探す入口として使用。
- **直接観察**: 今回実際に見た静止画像、読んだコード。動画タイトルや検索抜粋から動作を観察した扱いにはしない。
- **設計提案**: グリモ用の独自判断。SV内部仕様、効果実証、計測済み数値とは区別する。

公開日と取得日は別。検索エンジンの「何年前」「更新」「クロール」の表示から、発売時の動作や現行版の動作を断定しない。攻略記事の孵化効率、SNSの性格パラメータ説、野外の天候反応を、ピクニックの内部仕様へ転用しない。

## 製品と制作担当者の一次資料

| ID | 出典・公開日 | 今回確認した内容と限界 |
|---|---|---|
| P01 | [公式・ピクニック](https://www.pokemon.co.jp/ex/sv/ja/features/221006_01/) — 2022-10-06公開系列 | 手持ちと伝説のポケモンが集まる、用品の意匠変更、写真。ページは開発中画面であることを明記。 |
| P02 | [公式・仲良くなる／ウォッシュ](https://www.pokemon.co.jp/ex/sv/ja/features/221006_03/) — 2022-10-06公開系列 | 自由な過ごし方、個別の会話、おもちゃ、スポンジとシャワー、汚れ・HP回復・絆。掲載画像も確認。 |
| P03 | [公式・サンドウィッチ](https://www.pokemon.co.jp/ex/sv/ja/features/221006_02/) — 2022-10-06公開系列 | 食事を共にする機能と効果。触れ合いと報酬目的が同じ場にあることの背景資料。 |
| P04 | [Nintendo公式ニュース](https://www.nintendo.com/us/whatsnew/new-pokemon-picnics-and-more-revealed-for-the-pokemon-scarlet-and-pokemon-violet-video-games/) — 2022-10-06 | 公式動画の発表とウォッシュ等の説明を照合。P02と同系列の発表なので、独立した実証とは数えない。 |
| D01 | [CGWORLD・制作担当者インタビューPART1](https://cgworld.jp/article/202304-pokemon1.html) — 2023-04-19 | クリーチャーズの小野寺瞬・深谷卓・米谷由貴氏の発言。生態・可動域を詰めて試作演技を作り、モデル、リグ、演技、内製ツールでのアニメーション状態設定を連携させる工程。媒体記事だが当事者発言は一次証言。 |
| D02 | [同PART2](https://cgworld.jp/article/202304-pokemon2.html) — 2023-04-20 | 顔の関節と表情プリセット、特殊な目でのUVスクロール併用、目の形の保護、遷移時の貫通と操作応答を考えた動作の修正、動作後の体重移動。ゲーム全般の制作説明であり、ピクニック専用の判定プログラム公開ではない。 |
| D03 | [同PART3](https://cgworld.jp/article/202304-pokemon3.html) — 2023-04-21 | 顔・体・動きの流れを基本的に同じアニメーターが担当。平均23・最大60モーション、新規個体で監修待ちを含む1.5〜2.5か月という制作規模。これらはピクニック専用本数・実作業人日・グリモ見積もりではない。 |
| D04 | [CEDEC2022公式講演概要](https://cedec.cesa.or.jp/2022/session/detail/61.html) — 2022-08-25開催 | ゲームフリーク前澤圭一氏。複数タイトルで使うポケモンモデル制作環境の整理。具体的な資料ファイルは [CEDiL](https://cedil.cesa.or.jp/cedil_sessions/view/2586) でログインが必要だったため未取得。 |
| D05 | [CEDEC2023公式・見た目の仕組み](https://cedec.cesa.or.jp/2023/session/detail/s64242ce14adbf.html) — 2023-08-23開催 | 独自の見た目、シェーダ、アセット構成を扱う講演の存在・目的。概要以上の非公開実装を断定しない。 |
| D06 | [CEDEC2023公式・サウンド](https://cedec.cesa.or.jp/2023/session/detail/s6429a1da844ee.html) — 2023-08-24開催 | 制作参加者による、環境音、鳴き声、実装・デバッグの解説概要。ピクニックの各鳴き声のファイル数・処理・遅延は未確認。 |

## YouTube・写真の観察記録

| ID | 出典 | 確認状況 |
|---|---|---|
| V01 | [公式「Jump into a Paldean Journey」](https://www.youtube.com/watch?v=4YEEDqke-D0) — 2022-10-06 | 公式チャンネル・タイトル・公開情報とブラウザのプレーヤーを確認。再生エラーで動作系列を観察できず。字幕からの補完、秒数の捏造はしていない。 |
| V02 | [レウンGameTV・小ネタ集5](https://www.youtube.com/watch?v=2AYr4K9JhqM) | 著者とタイトルをブラウザで確認。再生エラー。紹介記事にある332秒開始は「掲載側の指定」であって、こちらが測定した場面時刻ではない。既存のローカル取得手段でも動画実体は403となり取得できなかった。 |
| V03 | [制作資料・ヌメラの表情変化](https://www.youtube.com/watch?v=J3XVlSbVeI8) | D02に埋め込まれた公開リンクを確認。記事の説明を証拠とし、この動画を視聴済みとは扱わない。 |
| V04 | [制作資料・ナゲツケサル待機](https://www.youtube.com/watch?v=7SvrTEXceHk)、[従来の走り](https://www.youtube.com/watch?v=B5x0cN6MSv8)、[SVの走り](https://www.youtube.com/watch?v=XbuZXkgtA0w) | D02に埋め込まれた比較資料へのリンク。遷移については担当者の文章証言で確認。ピクニック専用映像ではない。 |
| O01 | P02の [洗う場面](https://www.pokemon.co.jp/ex/sv/assets/img/features/ja/221006_03/features_img_05.jpg) | 静止画を原寸で目視。ヌメラは閉じ目、体の複数箇所に泡、体に重なるスポンジ。画面下に道具切替・操作、左下に終了操作。 |
| O02 | P02の [洗い終わり](https://www.pokemon.co.jp/ex/sv/assets/img/features/ja/221006_03/features_img_07.jpg) | 静止画を原寸で目視。開いた目と大きく開いた口、泡のない体、音符と光。O01との差は背景だけでなく顔と体の状態にある。画像間の移行時間・音は測っていない。 |
| O03 | [レウン本人の再編集記事](https://www.gamememory.jp/entry/2023/07/05/203607) — 2023-07-05 | 本人がYouTube小ネタ集1〜5を記事化した旨を確認。ベトベター、デカヌチャンのハンマー、イッカネズミの子、ホゲータの頭の毛への洗浄反応を写真付きで説明。イッカネズミの掲載写真を別途目視。動作の前後や正確な当たり領域は未測定。 |

O01/O02とO03の画像は一時領域で参照しただけで、グリモの公開資産には入れていない。記事由来の同じ画像・動画を独立した複数の実験として数えない。

## 利用者本人の体験・SNS

肯定・否定・解釈の不確かさを含めて選んだ目的抽出標本。件数比率や人気度を推定する調査ではない。記述された行動が最新パッチでも同条件で起きるかは実機未検証。

| ID | 出典 | 記録されている体験 | グリモへの検討点 |
|---|---|---|---|
| U01 | [白湯・寝姿の写真記録](https://note.com/sayu_7373/n/n605d06a82159) — 2023-01-29 | 寝顔、足、耳、持ち物、背中を写真で楽しむ。 | 待機に個別の姿勢と観察する理由を作る。 |
| U02 | [オルカ・トリトドン写真記録](https://note.com/gps374/n/n8e053a1419a7) — 2024-10-01 | 2体の寄り方を異なる性格として捉え、育て方の解釈にも結び付けている。 | 行動の一貫性が個性として読まれる可能性。実際の性格パラメータの因果は未証明。 |
| U03 | [Reddit・直接なでられないのか](https://www.reddit.com/r/pokemon/comments/z173ya/can_you_still_pet_your_pok%C3%A9mon_in_sv/) | なでる操作を期待し、洗うだけでは代わりにならないという本人・返信者の不満。 | 道具だけにせず、指で触れる経路を中心にする。 |
| U04 | [Reddit・Picnics are disappointing?](https://www.reddit.com/r/PokemonScarletViolet/comments/17e3ifa/picnics_are_disappointing/) | 一対一の接点や操作内容が足りないという意見。食事・タマゴへの評価は混在。 | 作業や報酬だけで滞在させない。剣盾との比較意見をSVの機能一覧にしない。 |
| U05 | [Reddit・寝てばかりのメブキジカ](https://www.reddit.com/r/PokemonScarletViolet/comments/1ebf39x/my_sawsbuck_is_never_awake_during_picnics/) | よく眠る姿を「この子の性格」と解釈。返信には不具合説など複数の解釈。 | 眠りは魅力にも単調さにもなる。触ったら返事があることは維持。 |
| U06 | [Reddit・性格は行動に影響するか](https://www.reddit.com/r/PokemonScarletViolet/comments/1167wgh/do_pokemon_natures_affect_their_picnic_behavior/) | 観察談、NPCの説明の記憶、未確認という声が併存。 | 「SVがこう実装している」は結論にしない。グリモは制作側が明示的に個性を定義する。 |
| U07 | [本人のTwitter投稿](https://twitter.com/sayu_7373/status/1619564985256148992) — 2023-01-29 | U01に本人投稿が埋め込まれている。Twitter単体取得は403。 | 独立の追加証拠には数えず、U01で読めた範囲に限定。 |

検索で見つけた [「眺めるだけ」投稿](https://www.reddit.com/r/PokemonScarletViolet/comments/1covvif/) は本文の再取得が失敗したため、主要結論の根拠から除いた。

二次資料の [AUTOMATON・生態の記事](https://automaton-media.com/articles/newsjp/20221222-231618/) はO03の作者を特定する入口として使用。記事内の天候反応は野外行動であり、ピクニックの反応と混同しない。

## 設計・実装の一次資料

以下はグリモの実装可能性を支える資料であって、SVがこれらのライブラリを使用しているという意味ではない。

| ID | 保守元・研究者の資料 | 適用する範囲 |
|---|---|---|
| T01 | [Three.js Animation System](https://threejs.org/manual/en/animation-system.html) | 骨格・モーフ・材質等のアニメーション、同時再生とブレンド。 |
| T02 | [Three.js SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html)、[GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) | 既存Three.jsへ可動モデルを読み込む候補。 |
| T03 | [Three.js Raycaster](https://threejs.org/docs/pages/Raycaster.html) | 画面座標から交点・UVを取得し、キャラクター上の接点を求める。 |
| T04 | [Khronos glTF仕様](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) | node変換、skin、morph weightsのアニメーション。制作ツールからブラウザへ渡す形式。 |
| T05 | [Blender glTF Manual 5.0](https://docs.blender.org/manual/id/5.0/addons/import_export/scene_gltf2.html)、[Blender License](https://www.blender.org/about/license/) | アニメーション・shape key・skinning出力の候補。英語版manual本文取得が失敗し、検索取得できた公式ページの範囲を使用。BlenderのGPLを出力アートへ自動適用する必要はないという公式説明。 |
| T06 | [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) | 操作に応じた音の開始、利用者の操作からのAudioContext起動・再開。 |
| T07 | [Disney Animation・制作工程](https://www.disneyanimation.com/process/animation/) | タイミング、予備動作、余韻、二次動作を使う演技の基礎。SVの使用技術を示す資料ではない。 |
| T08 | [Michael Mateas / CMU・Believable Agents](https://www.cs.cmu.edu/Groups/oz/papers/CMU-CS-97-156.html) — 1997 | 個性・自己動機・観客から見た納得感を区別する理論。グリモの心理効果を検証した研究ではない。 |
| T09 | [Godot Web export 4.5](https://docs.godotengine.org/en/4.5/tutorials/export/exporting_for_web.html) | Web出力候補。スレッド有効時の条件を、すべてのWeb出力の条件と混同しない。 |
| T10 | [Live2D FREE/PRO比較](https://www.live2d.com/en/cubism/comparison/)、[Rive runtimes](https://rive.app/docs/runtimes/getting-started) | 2D制作候補の存在と、制作ツール／配信runtime条件を分ける確認。Rive runtimeがMITであることだけで制作・書出しまで無料とは判断しない。 |

## 残る検証の境界

1. SV実機の操作ログ、フレーム時刻、音声波形は取得していない。応答ms、揺れ角度、抽選確率は不明。
2. 公開された制作工程は確認できたが、ピクニックの行動選択コード、当たり判定、泡の保持方式、IK、物理、乱数、個体パラメータの対応は未確認。
3. YouTubeは公式・利用者動画とも再生が失敗。取得方法を変えた無限再試行や、ログイン・課金・アクセス制限の回避は行っていない。
4. X/Twitter単体の投稿取得は制限がある。本人の公開記事と埋め込みで読めた範囲を明示した。
5. 研究結果から仕様を提案することと、SV相当の完成品を実証することは別。グリモの実機試遊で受入を行う必要がある。
