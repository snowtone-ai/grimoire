// The .ts extension keeps this import resolvable by Node's type-stripping
// test runner (node --test) as well as the Next bundler.
import { PLANT_SPECIES, type PlantSpecies } from "./plant.ts";

/* Material-drop reward domain — pure functions, no side effects.
 *
 * Completing a quest (task) rolls exactly one drop, Monster-Hunter style:
 * an unpredictable material reward at the moment of completion. Rarity is a
 * full RARE 1-8 ladder (like MHW), with a material pool at every rank so the
 * scale has no gaps. Higher ranks are exponentially rarer. The two seasonal
 * anchors keep their ranks (RARE4 = the month's flower, RARE8 = its vista);
 * ranks 2/3/5/6/7 are generic frozen-survey materials. Anti-frustration rules:
 * - Pity: PITY_LIMIT rolls without a RARE8 guarantees the next one.
 * - First roll of the day is floored to RARE4 (a reason to start today).
 * Drops are never revoked (no punishment). */

export type DropRarity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface DropDef {
  id: string;
  rarity: DropRarity;
  name: string;
  flavor: string;
  /** RARE1/RARE4 use an emoji icon; RARE8 uses a photo. */
  emoji?: string;
  photo?: string;
  /** Season month for RARE4/RARE8 (drives the current-month weighting). */
  month?: number;
  color: string;
}

/** RARE1 — common gathering materials of the frozen survey region. */
export const COMMON_DROPS: DropDef[] = [
  { id: "c-yukinoshita", rarity: 1, name: "ユキノシタソウ", emoji: "🌿", color: "#8fbf9f", flavor: "雪の下でも枯れない、強い草" },
  { id: "c-kooribana",   rarity: 1, name: "コオリバナ",     emoji: "❄️", color: "#9fd3e8", flavor: "息を吹きかけると溶けて光る" },
  { id: "c-toudokinoko", rarity: 1, name: "トウドキノコ",   emoji: "🍄", color: "#d4907a", flavor: "凍土の岩陰にひっそり生える" },
  { id: "c-shimofuri",   rarity: 1, name: "シモフリムギ",   emoji: "🌾", color: "#d8c98a", flavor: "霜の朝にだけ穂を出す" },
  { id: "c-reikanomi",   rarity: 1, name: "レイカノミ",     emoji: "🫐", color: "#7a8fd4", flavor: "冷気を蓄えた、甘い実" },
  { id: "c-hidamari",    rarity: 1, name: "ヒダマリギク",   emoji: "🌼", color: "#f0d060", flavor: "吹雪の合間の陽だまりに咲く" },
  { id: "c-hikarigoke",  rarity: 1, name: "ヒカリゴケ",     emoji: "🌱", color: "#a0e8c0", flavor: "洞窟の壁で青白く光る" },
  { id: "c-yugetsubaki", rarity: 1, name: "ユゲツバキ",     emoji: "🌺", color: "#e88a9a", flavor: "温泉の湯気を浴びて育つ椿" },
  { id: "c-suishousou",  rarity: 1, name: "スイショウソウ", emoji: "🧊", color: "#b0d8f0", flavor: "氷の結晶とそっくりの草" },
  { id: "c-kazekusa",    rarity: 1, name: "カゼクサ",       emoji: "🍃", color: "#90c890", flavor: "風の通り道を教えてくれる" },
  { id: "c-koyukizakura",rarity: 1, name: "コユキザクラ",   emoji: "🌸", color: "#f0c0d0", flavor: "粉雪のような小さな花" },
  { id: "c-hoshikuzu",   rarity: 1, name: "ホシクズタケ",   emoji: "✨", color: "#e8d890", flavor: "夜になると星屑のように光る" },
];

const SPECIES_EMOJI: Record<string, string> = {
  plum: "🌸", wintersweet: "💮", sakura: "🌸", wisteria: "🪻",
  rose: "🌹", hydrangea: "🪷", sunflower: "🌻", morning_glory: "🌺",
  cosmos: "🌸", osmanthus: "🏵️", chrysanthemum: "🌼", cyclamen: "🌺",
};

function rareFromSpecies(species: PlantSpecies): DropDef {
  return {
    id: `r-${species.nameEn}`,
    rarity: 4,
    name: species.name,
    emoji: SPECIES_EMOJI[species.nameEn] ?? "🌸",
    month: species.month,
    color: species.color,
    flavor: `${species.month}月の希少植物。研究所で大切に育てられている`,
  };
}

function ssrFromSpecies(species: PlantSpecies): DropDef {
  return {
    id: `s-${species.nameEn}`,
    rarity: 8,
    name: `${species.name}の絶景`,
    photo: species.rewardImage,
    month: species.month,
    color: species.accentColor,
    flavor: `調査班が記録した、一面の${species.name}`,
  };
}

/** RARE2 — good-quality gathering materials. */
export const TIER2_DROPS: DropDef[] = [
  { id: "t2-aotsurara", rarity: 2, name: "アオツララ",   emoji: "🧊", color: "#a9d8ef", flavor: "青みを帯びた、溶けにくい氷柱" },
  { id: "t2-yukiwata",  rarity: 2, name: "ユキワタ",     emoji: "🪶", color: "#e8eef5", flavor: "雪原を舞う綿毛。上質な保温材になる" },
  { id: "t2-koketsubu", rarity: 2, name: "コケツブ",     emoji: "🍀", color: "#8fbf9f", flavor: "岩肌の苔が結晶化した粒" },
  { id: "t2-hiuchiishi",rarity: 2, name: "ヒウチイシ",   emoji: "🪨", color: "#9a9a9a", flavor: "打つと火花が散る硬い石" },
  { id: "t2-reitosui",  rarity: 2, name: "レイトウスイ", emoji: "🫧", color: "#bfe3f2", flavor: "凍らない不思議な水滴" },
  { id: "t2-shirakaba", rarity: 2, name: "シラカバ樹皮", emoji: "🪵", color: "#d8c9a8", flavor: "凍て地の白樺から剥がした樹皮" },
];

/** RARE3 — crystals and ores. */
export const TIER3_DROPS: DropDef[] = [
  { id: "t3-hyousho",    rarity: 3, name: "ヒョウショウ",   emoji: "🔷", color: "#7fb8e0", flavor: "六角形に育った氷の結晶" },
  { id: "t3-ginsazare",  rarity: 3, name: "ギンサザレ",     emoji: "⚪", color: "#c8c8d0", flavor: "銀色に光る細かな砂利" },
  { id: "t3-akanezuna",  rarity: 3, name: "アカネズナ",     emoji: "🔶", color: "#e0a060", flavor: "夕焼け色を宿した鉱砂" },
  { id: "t3-aokoseki",   rarity: 3, name: "アオコウセキ",   emoji: "💠", color: "#6fa8d8", flavor: "青く透きとおる鉱石" },
  { id: "t3-shirogane",  rarity: 3, name: "シロガネ鉱",     emoji: "🪫", color: "#b0b0b8", flavor: "叩くと澄んだ音が鳴る" },
  { id: "t3-tsuraragane",rarity: 3, name: "ツララガネ",     emoji: "🩵", color: "#90c0d8", flavor: "氷と金属が混じった塊" },
];

/** RARE5 — special materials. */
export const TIER5_DROPS: DropDef[] = [
  { id: "t5-yukibotaru", rarity: 5, name: "ユキボタル",       emoji: "🌟", color: "#d8e8a0", flavor: "雪原にだけ現れる、発光する虫" },
  { id: "t5-reikagai",   rarity: 5, name: "レイカガイ",       emoji: "🐚", color: "#d0c0a8", flavor: "冷気の中で育つ巻貝の殻" },
  { id: "t5-yugegoke",   rarity: 5, name: "ユゲランプゴケ",   emoji: "🕯️", color: "#f0d878", flavor: "温泉の湯気で仄かに灯る苔" },
  { id: "t5-hakuginyo",  rarity: 5, name: "ハクギンヨウ",     emoji: "🪙", color: "#d8d8e0", flavor: "銀箔のように薄い葉" },
  { id: "t5-koorichou",  rarity: 5, name: "コオリチョウ鱗粉", emoji: "🦋", color: "#b8d8e8", flavor: "凍蝶がまとう霜の鱗粉" },
  { id: "t5-yumigoori",  rarity: 5, name: "ユミゴオリ",       emoji: "🔮", color: "#9fd0e8", flavor: "弓なりに凍った透明な氷塊" },
];

/** RARE6 — precious specimens. */
export const TIER6_DROPS: DropDef[] = [
  { id: "t6-reikaseki", rarity: 6, name: "レイカセキ",       emoji: "🦴", color: "#d8cdb0", flavor: "凍て地で見つかる古い化石" },
  { id: "t6-murasui",   rarity: 6, name: "ムラサキスイショウ", emoji: "🟣", color: "#b090d0", flavor: "紫に発色する希少な水晶" },
  { id: "t6-ginkitsune",rarity: 6, name: "ギンギツネの毛",   emoji: "🦊", color: "#e0e0e8", flavor: "凍て地に棲む銀狐の抜け毛" },
  { id: "t6-yukihyou",  rarity: 6, name: "ユキヒョウの紋",   emoji: "🐆", color: "#c8d0d8", flavor: "雪豹が残した霜の紋様" },
  { id: "t6-seiraiseki",rarity: 6, name: "セイライ石",       emoji: "🔵", color: "#6088c0", flavor: "青雷を宿すと言われる鉱石" },
];

/** RARE7 — treasured relics. */
export const TIER7_DROPS: DropDef[] = [
  { id: "t7-koreitama", rarity: 7, name: "コレイタマ",     emoji: "🧿", color: "#7fbfe0", flavor: "調査班に語り継がれる霊珠" },
  { id: "t7-ginyoku",   rarity: 7, name: "ギンカの遺翼",   emoji: "🪽", color: "#d8d8e8", flavor: "銀化した古の翼の欠片" },
  { id: "t7-enshinseki",rarity: 7, name: "炎芯石",         emoji: "🔥", color: "#e08040", flavor: "地熱が結晶化した炉の核" },
  { id: "t7-hyoketsurin",rarity: 7, name: "ヒョウケツリン", emoji: "🌌", color: "#6a70b0", flavor: "夜空を封じ込めたような氷輪" },
];

/** RARE4 — the 12 rare research specimens (one per season month). */
export const RARE_DROPS: DropDef[] = PLANT_SPECIES.map(rareFromSpecies);

/** RARE8 — the 12 scenic survey photographs. */
export const SSR_DROPS: DropDef[] = PLANT_SPECIES.map(ssrFromSpecies);

/** The material pool for each rarity rank (RARE 1-8, no gaps). */
export const POOL_BY_RARITY: Record<DropRarity, DropDef[]> = {
  1: COMMON_DROPS,
  2: TIER2_DROPS,
  3: TIER3_DROPS,
  4: RARE_DROPS,
  5: TIER5_DROPS,
  6: TIER6_DROPS,
  7: TIER7_DROPS,
  8: SSR_DROPS,
};

export const DROP_CATALOG: DropDef[] = [
  ...COMMON_DROPS,
  ...TIER2_DROPS,
  ...TIER3_DROPS,
  ...RARE_DROPS,
  ...TIER5_DROPS,
  ...TIER6_DROPS,
  ...TIER7_DROPS,
  ...SSR_DROPS,
];

export function getDropById(id: string): DropDef | undefined {
  return DROP_CATALOG.find((drop) => drop.id === id);
}

export const PITY_LIMIT = 12;
/** The in-season drop is this many times likelier within its rarity pool. */
const CURRENT_MONTH_WEIGHT = 4;

/* Per-rank probabilities (sum to 1), highest rank first. Exponential-ish
 * decay grounded in gacha rate curves: most completions yield low ranks so
 * the top ranks stay special. Pity and the first-of-day floor sit on top. */
const RARITY_RATES: [DropRarity, number][] = [
  [8, 0.025],
  [7, 0.035],
  [6, 0.06],
  [5, 0.09],
  [4, 0.12],
  [3, 0.17],
  [2, 0.22],
  [1, 0.28],
];

export interface RollContext {
  rollsSinceSsr: number;
  isFirstOfDay: boolean;
}

/** Decide a roll's rarity from a [0,1) random source. */
export function decideRarity(rng: () => number, context: RollContext): DropRarity {
  if (context.rollsSinceSsr >= PITY_LIMIT) return 8;

  const roll = rng();
  let cumulative = 0;
  let rarity: DropRarity = 1;
  for (const [rank, rate] of RARITY_RATES) {
    cumulative += rate;
    if (roll < cumulative) {
      rarity = rank;
      break;
    }
  }

  // First roll of the day never lands below RARE4 — a reason to start today.
  if (context.isFirstOfDay && rarity < 4) return 4;
  return rarity;
}

/** Pick a drop of the given rarity; in-season drops are weighted up. */
export function pickDrop(rng: () => number, rarity: DropRarity, month: number): DropDef {
  const pool = POOL_BY_RARITY[rarity] ?? COMMON_DROPS;

  const weights = pool.map((drop) =>
    drop.month === month ? CURRENT_MONTH_WEIGHT : 1
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let target = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    target -= weights[i];
    if (target < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export function getRarityLabel(rarity: DropRarity): string {
  return `RARE ${rarity}`;
}
