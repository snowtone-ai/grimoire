# asset-sources.md — Fantasy item visual overhaul (prototype)

3Dモデル・UIフレーム素材の出典記録。すべて CC0 1.0 Universal(パブリックドメイン相当、表記義務なし)。既存の`docs/plant-reward-image-sources.md`と同じ記録目的。

## 3Dモデル(public/models/items/)

パックごとにサブディレクトリを分けている。mini-dungeon/graveyard-kitのGLBは相対パス
`Textures/colormap.png` で自パックのテクスチャアトラスを参照するため(GLB化されていても
テクスチャは埋め込まれず外部参照のまま)、パックを混在させると同名ファイルが衝突する。
nature-kitのモデルはテクスチャ参照なし(頂点カラーのみ)。

| ローカルファイル | 由来パック | 元ファイル名 | 出典 |
|---|---|---|---|
| mini-dungeon/embercinder-ember-shard.glb | Kenney Mini Dungeon 2.0 | rocks.glb | https://kenney.nl/assets/mini-dungeon |
| mini-dungeon/embercinder-ashen-blade.glb | Kenney Mini Dungeon 2.0 | weapon-sword.glb | https://kenney.nl/assets/mini-dungeon |
| mini-dungeon/embercinder-ember-heart.glb | Kenney Mini Dungeon 2.0 | potion.glb | https://kenney.nl/assets/mini-dungeon |
| mini-dungeon/Textures/colormap.png | Kenney Mini Dungeon 2.0 | Textures/colormap.png | https://kenney.nl/assets/mini-dungeon |
| graveyard-kit/hollowmire-mire-drop.glb | Kenney Graveyard Kit 5.0 | detail-bowl.glb | https://kenney.nl/assets/graveyard-kit |
| graveyard-kit/hollowmire-hollow-mask.glb | Kenney Graveyard Kit 5.0 | gravestone-broken.glb | https://kenney.nl/assets/graveyard-kit |
| graveyard-kit/hollowmire-miasma-scepter.glb | Kenney Graveyard Kit 5.0 | cross-wood.glb | https://kenney.nl/assets/graveyard-kit |
| graveyard-kit/Textures/colormap.png | Kenney Graveyard Kit 5.0 | Textures/colormap.png | https://kenney.nl/assets/graveyard-kit |
| nature-kit/thornveil-thorn-bud.glb | Kenney Nature Kit | flower_purpleB.glb | https://kenney.nl/assets/nature-kit |
| nature-kit/thornveil-devouring-cap.glb | Kenney Nature Kit | mushroom_redTall.glb | https://kenney.nl/assets/nature-kit |

## UIフレーム素材(public/ui/borders/)

| ローカルファイル | 由来パック | 元ファイル名 | 出典 |
|---|---|---|---|
| panel-frame.png | Kenney Fantasy UI Borders (Double style) | panel-004.png | https://kenney.nl/assets/fantasy-ui-borders |
| panel-border.png | Kenney Fantasy UI Borders (Double style) | panel-border-004.png | https://kenney.nl/assets/fantasy-ui-borders |
| divider.png | Kenney Fantasy UI Borders (Double style) | divider-000.png | https://kenney.nl/assets/fantasy-ui-borders |

すべて白色の透過線画で、CSS(`mask-image`/`filter`)でアプリの`--gold`/`--frost`トークンに合わせて着色する前提の素材。

## ライセンス

作者: Kenney (www.kenney.nl)。ライセンス: CC0 1.0 Universal — 個人・教育・商用利用すべて可、法的な表記義務なし(任意でクレジット歓迎: "Kenney" / "www.kenney.nl")。

## 未使用だが検討した候補

- Quaternius "Fantasy Props MegaKit"(CC0、94点無料)— itch.ioのpay-what-you-want購入フロー経由でのみ配布されており、直接URLでの自動取得ができなかったため今回は見送り。将来436アイテム規模へ拡張する際、より広いカテゴリが必要になれば手動ダウンロードを検討。
- ZSS Game Lab / Nexa Visuals のダークファンタジー系RPG UIキット — ページ上でライセンス条件が明記されておらず(CC0/商用可の明言なし)、確実に無料・商用利用可能なKenney製UIキットを優先した。
