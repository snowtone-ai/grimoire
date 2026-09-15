# G01 — Carol Golden Reference 製品契約

確定日: 2026-09-08 JST  
状態: implementation-ready

## 目的と範囲

利用者が `/plant` を開き、キャロルへ直接触れ、接点の即時反応から人格ある返事と余韻までを感じられることをGolden Referenceの中心にする。G01〜G04ではキャロルと「星眠りの雲床」だけを製品品質まで作る。残り4体の原画・人格・世界・演技仕様は維持するが、キャロルの明示合格前に本格実装しない。

主要アクションは画面中央のキャロルへ触れること。相棒切替、音、道具は二次操作であり、Golden Referenceの接触領域を狭めない。数値メーター、日課、報酬、消費、期限、通知許可、評価ダイアログを追加しない。

## 5つの起動経路

| 経路 | 開始条件 | 必須の表示と遷移 | 禁止 |
|---|---|---|---|
| 初回 | Grimo選択・記憶がない | 既存データを読んだ後、キャロルと世界を空白なしで表示。0〜3秒で視線または姿勢が利用者へ向く。触れると説明を読まなくても反応する | 通知・音・ログイン許可、チュートリアルmodal、利用義務 |
| 通常再訪 | 前回状態が正常に読める | 前回の相棒設定を尊重する。Golden期間はキャロルへ復元。入口演技は短く、すぐ触れられる | 毎回同じ長い登場演技、入力ロック |
| 長期不在 | 最終訪問から7日以上を暫定境界 | 喜びは穏やかな再会表現だけにする。通常idleへ戻り、触れ合い内容は減らない | 衰弱、責める文言、連続日数、失効、過剰な歓迎圧力 |
| 保存失敗 | local persistenceの読書きが例外・quota・blocked | キャロルへの触れ合いを継続。状態はsession内で保持し、控えめな復旧案内と再試行経路を出す | 成功音、画面閉鎖、既存task/plant/dropの変更、無限retry |
| offline | オンライン訪問済みPWAの再訪でnetwork unavailable | cached shellとcanonical assetでキャロルを表示し、触れ合いはローカルで完結。外部API失敗をscene全体の失敗にしない | 初回完全offlineの保証、空白画面、自動再読込loop |

## 状態遷移

```text
boot -> restoring -> entering -> present.idle
                         |            |
                         |            +-> contact.tracking -> reaction.intent
                         |                                      |
                         |                                      +-> reaction.performing
                         |                                                |
                         +----------------------------------------------> settling -> present.idle

any visible state -> suspended -> previous stable pose -> present.idle
contact.tracking -> cancelled -> settling
restoring/save -> degraded.persistence (orthogonal; touch remains enabled)
online <-> offline (orthogonal; local scene remains enabled)
```

- `contact.tracking` は主pointer 1本だけを所有し、capture終了・`pointercancel`・`lostpointercapture`・`blur`・非表示で必ず解放する。
- 新入力は待ち行列へ積まず、現在poseと速度を始点に既存反応をredirectする。
- `reaction.intent` は接点の即時反応の後にある短い「意図の間」。入力feedback自体を遅らせない。
- `settling` は余韻を残しながらdt依存springで安定姿勢へ戻る。idleへsnapしない。
- `suspended` 中はrAF、自律timer、音を止め、復帰時の巨大dtをclampする。

## 入力から反応への契約

```text
currentPose + touchIntent + contactPoint + velocity + acceleration
+ previousAction + timeSinceContact + mood + worldContext
-> reaction nucleus -> pose + local deformation + secondary motion + world response + optional audio
```

G04の対象は「つつく」「ゆっくりなでる」「押して待つ」を各3核、合計9核。すべて `接点の即時返事 -> 意図の間 -> 人格ある動き -> releaseの余韻 -> settle` を持つ。直前の核だけを次回候補から外し、乱数だけで人格を決めない。連打でclipを先頭再生せず、60秒idleで呼吸・視線・世界の周期を同期させない。

キーボード経路はキャロルの主操作面をfocus可能にし、`Enter`/`Space`を「つつく」、明示ボタンの「なでる」「そっと押す」を同じinteraction commandへ接続する。静止状態でもfocus、hold、release、responseが色だけに依存せず読み取れる。

## Identity Layer / Dynamic Layer

Identity Layerとして顔、左右の目、鼻口、頭身、シルエット、紫と白の配色、茶色の耳と足、月と星の固有装飾を固定する。Dynamic Layerは呼吸、瞬き、視線、微細な姿勢差、sourceから安全に分離できたsecondary motion、局所変形、光、雲・星の環境反応だけを持つ。

G02でsourceに存在しない閉じ目、背面、耳や足の隠れ輪郭が必要と分かった場合は不足として記録する。黒い楕円の上貼り、別画風の補筆、生成AIによるcharacter再生成で穴を埋めない。

## 5体の固定表

| 相棒 | 外観の固定 | 世界 | movement grammar / touch response |
|---|---|---|---|
| キャロル | 紫白の雲羊、原画の顔・比率、茶色の耳と足、月と星 | 星眠りの雲床 | 接点をすぐ受け、毛→耳→体へゆっくり伝わり、体重を預けて長く戻る |
| ピノ | 青い水辺の獣、白い腹、頭の毛、丸い手足、虹の泡 | 泡の浅瀬 | 目→手→体が追い、泡と水輪へ好奇心が伝わる |
| ジル | 緑の体、黄緑の腹、小さい翼、尾、花葉の装飾 | 木漏れ日の苔の巣 | 胸→翼→尾へ弾み、葉と苔へ反応が渡る |
| シュシュ | 桃白のパンダ、丸い耳、頭花、瞳の花模様 | 花びらの小庭 | 確認の間→頬の接触→長いsettle、花びらが遅れて戻る |
| ムゥ | 虹色の恐竜、蝶ネクタイ、指揮棒、背中の小ピアノ | 虹音の花丘 | 一拍置いて頷き・尾・花へ拍が広がる。演奏の正誤を作らない |

## G01 Gate

- 5経路、状態遷移、主要アクション、5体の外観・世界・演技を本書で固定した。
- 罰、消費、時間制限、通知圧力を仕様から除外した。
- G02以降が未達のため、現時点は「製品品質達成」ではない。
- 次の操作はキャロルcanonicalのhash・bounds・layer候補・anchor・z-order・可動範囲を実測し、静止再合成を検証すること。

