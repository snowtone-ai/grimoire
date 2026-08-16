import type { DropDef } from "../drops.ts";

/* Fantasy item visual overhaul — prototype content (8 items, 3 domains).
 * See docs/decisions.md (pending D-036) and the approved plan at
 * C:\Users\chidj\.claude\plans\expressive-wobbling-meteor.md.
 *
 * region: "fantasy" (a single sentinel added to regions.ts) keeps these
 * items compatible with drop-catalog.test.mjs's "every drop belongs to a
 * real region" + "RARE4/8 must be garden, others must not" invariants
 * without touching that test. The real thematic grouping is `domain`
 * (domains.ts), which is independent of `region`.
 *
 * Flavor text is deliberately MH-codex style: a little dry humor, no
 * attempt at cross-item narrative consistency (explicit user instruction —
 * individual item appeal outranks world coherence). `model` points at a
 * self-hosted Kenney CC0 glTF (see docs/asset-sources.md); `emoji` stays
 * populated too so the existing book-screen grid (materialCardStyle, no
 * code changes needed there) keeps rendering a recognizable glyph — the
 * live 3D model is reserved for the new item-detail page. */

export const FANTASY_RARE1: DropDef[] = [
  {
    id: "fantasy-embercinder-shard",
    rarity: 1,
    region: "fantasy",
    domain: "embercinder",
    name: "燃え殻の欠片",
    emoji: "🔥",
    color: "#e0633a",
    model: "/models/items/mini-dungeon/embercinder-ember-shard.glb",
    flavor: "触れるとまだ熱い。なぜ拾ってしまうのか、狩人自身にも分からない。",
    params: [
      { label: "分類", value: "燃焼残滓" },
      { label: "手触り", value: "ざらつき、時々火傷" },
      { label: "備考", value: "焚き火に投げ込むと二度目の生を得る、らしい" },
    ],
  },
  {
    id: "fantasy-hollowmire-drop",
    rarity: 1,
    region: "fantasy",
    domain: "hollowmire",
    name: "澱みの滴",
    emoji: "💧",
    color: "#7a5ea8",
    model: "/models/items/graveyard-kit/hollowmire-mire-drop.glb",
    flavor: "毒ではない、たぶん。少なくとも、まだ誰も試した記録が残っていない。",
    params: [
      { label: "分類", value: "瘴気凝結物" },
      { label: "匂い", value: "形容しがたい" },
      { label: "飲用", value: "非推奨(強く)" },
    ],
  },
];

export const FANTASY_RARE2: DropDef[] = [
  {
    id: "fantasy-thornveil-bud",
    rarity: 2,
    region: "fantasy",
    domain: "thornveil",
    name: "棘紗の若葉",
    emoji: "🌿",
    color: "#5aa35e",
    model: "/models/items/nature-kit/thornveil-thorn-bud.glb",
    flavor: "触れれば刺すが、押し花にすると存外美しい。狩人という生き物の矛盾を煮詰めたような一枚。",
    params: [
      { label: "分類", value: "棘性植物" },
      { label: "手触り", value: "痛い(すぐ慣れる)" },
      { label: "用途", value: "押し花、まれに武器" },
    ],
  },
];

export const FANTASY_RARE3: DropDef[] = [
  {
    id: "fantasy-embercinder-blade",
    rarity: 3,
    region: "fantasy",
    domain: "embercinder",
    name: "灰帯びた剣先",
    emoji: "⚔️",
    color: "#c94f2e",
    model: "/models/items/mini-dungeon/embercinder-ashen-blade.glb",
    flavor: "折れてなお鋭い。持ち主の未練ごと研ぎ澄まされているという噂だ。",
    params: [
      { label: "分類", value: "破損武具" },
      { label: "推定用途", value: "儀式、あるいは花瓶敷き" },
      { label: "危険度", value: "★★★☆☆(素手で触るな)" },
    ],
  },
];

export const FANTASY_RARE5: DropDef[] = [
  {
    id: "fantasy-hollowmire-mask",
    rarity: 5,
    region: "fantasy",
    domain: "hollowmire",
    name: "虚ろな仮面の欠片",
    emoji: "🎭",
    color: "#5f4a80",
    model: "/models/items/graveyard-kit/hollowmire-hollow-mask.glb",
    flavor: "割れた顔の半分だけが、こちらをじっと見ている気がしてならない。",
    params: [
      { label: "分類", value: "呪具残欠" },
      { label: "視線", value: "感じる(個人差あり)" },
      { label: "由来", value: "不明、聞かない方がいい" },
    ],
  },
];

export const FANTASY_RARE6: DropDef[] = [
  {
    id: "fantasy-embercinder-heart",
    rarity: 6,
    region: "fantasy",
    domain: "embercinder",
    name: "残り火の心臓",
    emoji: "❤️‍🔥",
    color: "#f2884a",
    model: "/models/items/mini-dungeon/embercinder-ember-heart.glb",
    flavor: "消えたはずの炉が、まだ鼓動している。誰もが『触れるな』と言うのに、誰も触れずにはいられない。",
    params: [
      { label: "分類", value: "稀少遺物" },
      { label: "鼓動", value: "確認済み(要・要検査)" },
      { label: "取扱注意", value: "急に熱くなることがある" },
    ],
  },
  {
    id: "fantasy-thornveil-cap",
    rarity: 6,
    region: "fantasy",
    domain: "thornveil",
    name: "森を喰らう茸",
    emoji: "🍄",
    color: "#8a3f3f",
    model: "/models/items/nature-kit/thornveil-devouring-cap.glb",
    flavor: "一晩で切り株ひとつを飲み込むという。今のところ狩人を飲み込んだ記録はない。今のところは。",
    params: [
      { label: "分類", value: "侵食性菌類" },
      { label: "成長速度", value: "観測不能なほど速い" },
      { label: "食用", value: "自己責任で(強く非推奨)" },
    ],
  },
];

export const FANTASY_RARE7: DropDef[] = [
  {
    id: "fantasy-hollowmire-scepter",
    rarity: 7,
    region: "fantasy",
    domain: "hollowmire",
    name: "瘴気を纏う王笏",
    emoji: "👑",
    color: "#9c7fd8",
    model: "/models/items/graveyard-kit/hollowmire-miasma-scepter.glb",
    flavor: "かつて誰かを統べた杖。今はもう、瘴気だけがそれに忠実に従っている。",
    params: [
      { label: "分類", value: "王権遺物" },
      { label: "忠誠対象", value: "現在は瘴気のみ" },
      { label: "評価", value: "博物館級、ただし引き取り手は今のところいない" },
    ],
  },
];
