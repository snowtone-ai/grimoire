// The .ts extension keeps this import resolvable by Node's type-stripping
// test runner (node --test) as well as the Next bundler.
import { PLANT_SPECIES, type PlantSpecies } from "./plant.ts";
import { FROST_RARE1, FROST_RARE2, FROST_RARE3, FROST_RARE5, FROST_RARE6, FROST_RARE7 } from "./reward-catalog/frost.ts";
import { AEGIS_RARE1, AEGIS_RARE2, AEGIS_RARE3, AEGIS_RARE5, AEGIS_RARE6, AEGIS_RARE7 } from "./reward-catalog/aegis.ts";
import { CARAVAN_RARE1, CARAVAN_RARE2, CARAVAN_RARE3, CARAVAN_RARE5, CARAVAN_RARE6, CARAVAN_RARE7 } from "./reward-catalog/caravan.ts";
import { CANOPY_RARE1, CANOPY_RARE2, CANOPY_RARE3, CANOPY_RARE5, CANOPY_RARE6, CANOPY_RARE7 } from "./reward-catalog/canopy.ts";
import { LANTERN_RARE1, LANTERN_RARE2, LANTERN_RARE3, LANTERN_RARE5, LANTERN_RARE6, LANTERN_RARE7 } from "./reward-catalog/lantern.ts";
import { GROVE_RARE1, GROVE_RARE2, GROVE_RARE3, GROVE_RARE5, GROVE_RARE6, GROVE_RARE7 } from "./reward-catalog/grove.ts";
import { SAVANNA_RARE1, SAVANNA_RARE2, SAVANNA_RARE3, SAVANNA_RARE5, SAVANNA_RARE6, SAVANNA_RARE7 } from "./reward-catalog/savanna.ts";
import { TIDE_RARE1, TIDE_RARE2, TIDE_RARE3, TIDE_RARE5, TIDE_RARE6, TIDE_RARE7 } from "./reward-catalog/tide.ts";
import { FANTASY_RARE1, FANTASY_RARE2, FANTASY_RARE3, FANTASY_RARE5, FANTASY_RARE6, FANTASY_RARE7 } from "./reward-catalog/fantasy.ts";

/* Material-drop reward domain — pure functions, no side effects. (D-032)
 *
 * Completing a quest (task) rolls exactly one drop, Monster-Hunter style:
 * an unpredictable material reward at the moment of completion. Rarity is a
 * full RARE 1-8 ladder (like MHW), with a material pool at every rank so the
 * scale has no gaps. Higher ranks are exponentially rarer.
 *
 * World-atlas structure (D-032, full rewrite — see docs/decisions.md): the
 * institute dispatches survey expeditions to eight world regions (an
 * original fusion of a real culture/era/mythology with light fantasy —
 * see regions.ts), each contributing ranks 1/2/3/5/6/7. Rank 4 and rank 8
 * stay on a separate axis: the institute's own seasonal home garden, one
 * canonical specimen (RARE4) and one vista photo (RARE8) per month/species,
 * unchanged from before this rewrite because they are mechanically load-
 * bearing (book-screen derives its month->emoji map from RARE_DROPS, and
 * SSR_DROPS reuses the 12 real plant-reward photos — there is no way to
 * "reflavor" a photo). Every DropDef carries a `region` id from regions.ts;
 * garden items use region "garden".
 *
 * Anti-frustration rules (unchanged): pity (PITY_LIMIT rolls without a
 * RARE8 guarantees the next one) and a first-of-day floor to RARE4+. Drops
 * are never revoked. */

export type DropRarity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface DropDef {
  id: string;
  rarity: DropRarity;
  /** Region id from regions.ts. Garden (season-linked) entries use "garden". */
  region: string;
  name: string;
  flavor: string;
  /** RARE1-7 use an emoji icon; RARE8 uses a photo. */
  emoji?: string;
  photo?: string;
  /** Season month for RARE4/RARE8 (drives the current-month weighting). */
  month?: number;
  color: string;

  /* --- Fantasy item visual overhaul (prototype, additive-only fields) ---
   * Independent of `region`; see src/lib/domain/domains.ts. Undefined on all
   * 436 legacy entries, which keep rendering via the emoji/color-mix path. */

  /** Fantasy-domain id from domains.ts, independent of `region`. */
  domain?: string;
  /** Self-hosted glTF/GLB path for the live 3D item-detail viewer. */
  model?: string;
  /** Effect-recipe id (src/lib/three/domain-recipes.ts). Falls back to the domain default when absent. */
  effect?: string;
  /** MH-codex-style flavor "parameters" shown on the item detail page, ordered for stable display. */
  params?: { label: string; value: string }[];
}

const SPECIES_EMOJI: Record<string, string> = {
  plum: "🌸", wintersweet: "💮", sakura: "🌸", wisteria: "🪻",
  rose: "🌹", hydrangea: "🪷", sunflower: "🌻", morning_glory: "🌺",
  cosmos: "🌸", osmanthus: "🏵️", chrysanthemum: "🌼", cyclamen: "🌺",
};

function rareFromSpecies(species: PlantSpecies): DropDef {
  return {
    id: `r-${species.nameEn}`,
    rarity: 4,
    region: "garden",
    name: species.name,
    emoji: SPECIES_EMOJI[species.nameEn] ?? "🌸",
    month: species.month,
    color: species.color,
    // Reworded from "研究所で" to "本部で" for the D-032 world-atlas framing;
    // id/name/photo/month/color stay byte-identical (see D-032 correction).
    flavor: `${species.month}月の希少植物。本部の庭で大切に育てられている`,
  };
}

function ssrFromSpecies(species: PlantSpecies): DropDef {
  return {
    id: `s-${species.nameEn}`,
    rarity: 8,
    region: "garden",
    name: `${species.name}の絶景`,
    photo: species.rewardImage,
    month: species.month,
    color: species.accentColor,
    // Reworded (see the RARE4 flavor comment above) for the same reason.
    flavor: `調査班が記録した、本部の庭に広がる一面の${species.name}`,
  };
}

/** RARE1 — common gathering materials, all eight expedition regions. */
export const COMMON_DROPS: DropDef[] = [
  ...FROST_RARE1, ...AEGIS_RARE1, ...CARAVAN_RARE1, ...CANOPY_RARE1,
  ...LANTERN_RARE1, ...GROVE_RARE1, ...SAVANNA_RARE1, ...TIDE_RARE1,
  ...FANTASY_RARE1,
];

/** RARE2 — good-quality materials. */
export const TIER2_DROPS: DropDef[] = [
  ...FROST_RARE2, ...AEGIS_RARE2, ...CARAVAN_RARE2, ...CANOPY_RARE2,
  ...LANTERN_RARE2, ...GROVE_RARE2, ...SAVANNA_RARE2, ...TIDE_RARE2,
  ...FANTASY_RARE2,
];

/** RARE3 — crystals and ores. */
export const TIER3_DROPS: DropDef[] = [
  ...FROST_RARE3, ...AEGIS_RARE3, ...CARAVAN_RARE3, ...CANOPY_RARE3,
  ...LANTERN_RARE3, ...GROVE_RARE3, ...SAVANNA_RARE3, ...TIDE_RARE3,
  ...FANTASY_RARE3,
];

/** RARE5 — special materials. */
export const TIER5_DROPS: DropDef[] = [
  ...FROST_RARE5, ...AEGIS_RARE5, ...CARAVAN_RARE5, ...CANOPY_RARE5,
  ...LANTERN_RARE5, ...GROVE_RARE5, ...SAVANNA_RARE5, ...TIDE_RARE5,
  ...FANTASY_RARE5,
];

/** RARE6 — precious specimens. */
export const TIER6_DROPS: DropDef[] = [
  ...FROST_RARE6, ...AEGIS_RARE6, ...CARAVAN_RARE6, ...CANOPY_RARE6,
  ...LANTERN_RARE6, ...GROVE_RARE6, ...SAVANNA_RARE6, ...TIDE_RARE6,
  ...FANTASY_RARE6,
];

/** RARE7 — treasured relics. */
export const TIER7_DROPS: DropDef[] = [
  ...FROST_RARE7, ...AEGIS_RARE7, ...CARAVAN_RARE7, ...CANOPY_RARE7,
  ...LANTERN_RARE7, ...GROVE_RARE7, ...SAVANNA_RARE7, ...TIDE_RARE7,
  ...FANTASY_RARE7,
];

/** RARE4 — the 12 canonical home-garden specimens (one per season month).
 * Unchanged by D-032: book-screen derives its month -> emoji map from this
 * array, so it must stay exactly one entry per month. */
export const RARE_DROPS: DropDef[] = PLANT_SPECIES.map(rareFromSpecies);

/** RARE4 variants — 3 collected forms per month's plant, so RARE4 (rolled
 * often via the first-of-day floor) doesn't repeat the same 12 items.
 * Unchanged by D-032 (same ids/names/flavor as before the world-atlas
 * rewrite — only the DropDef `region: "garden"` field is new). */
export const RARE4_VARIANT_DROPS: DropDef[] = [
  { id: "r-plum-seed",              rarity: 4, region: "garden", name: "梅の種子",         emoji: "🌰", month: 1,  color: "#f8b4c8", flavor: "硬い殻に包まれた、香り高い梅の種" },
  { id: "r-plum-pressed",           rarity: 4, region: "garden", name: "梅の押し花",       emoji: "🍃", month: 1,  color: "#f8b4c8", flavor: "調査記録帳に挟んで乾かした梅の花" },
  { id: "r-plum-bud",               rarity: 4, region: "garden", name: "梅の蕾",           emoji: "🌱", month: 1,  color: "#f8b4c8", flavor: "綻ぶ直前で摘み取られた硬い蕾" },
  { id: "r-wintersweet-sprout",     rarity: 4, region: "garden", name: "蝋梅の芽",         emoji: "🌿", month: 2,  color: "#ffe066", flavor: "雪の下から顔を出した黄色い新芽" },
  { id: "r-wintersweet-oil",        rarity: 4, region: "garden", name: "蝋梅の香油",       emoji: "🧴", month: 2,  color: "#ffe066", flavor: "花を漬け込んで作った、甘い香りの油" },
  { id: "r-wintersweet-dried",      rarity: 4, region: "garden", name: "蝋梅の乾燥花",     emoji: "🥀", month: 2,  color: "#ffe066", flavor: "蝋のような光沢を保ったまま乾いた花" },
  { id: "r-sakura-seed",            rarity: 4, region: "garden", name: "桜の種子",         emoji: "🌰", month: 3,  color: "#ffb7c5", flavor: "小さな果実の中に眠る、来春への種" },
  { id: "r-sakura-pressed",         rarity: 4, region: "garden", name: "桜の押し花",       emoji: "🍃", month: 3,  color: "#ffb7c5", flavor: "花びらの薄紅がそのまま残った押し花" },
  { id: "r-sakura-sprout",          rarity: 4, region: "garden", name: "桜の芽",           emoji: "🌱", month: 3,  color: "#ffb7c5", flavor: "固い枝先で春を待つ、小さな芽" },
  { id: "r-wisteria-bud",           rarity: 4, region: "garden", name: "藤の蕾",           emoji: "🌱", month: 4,  color: "#c5a0e8", flavor: "房になって垂れ下がる前の、小さな蕾の束" },
  { id: "r-wisteria-cutting",       rarity: 4, region: "garden", name: "藤の挿し木",       emoji: "🪴", month: 4,  color: "#c5a0e8", flavor: "根付くと何十年も棚を覆うという枝" },
  { id: "r-wisteria-petal",         rarity: 4, region: "garden", name: "藤の花弁標本",     emoji: "🍃", month: 4,  color: "#c5a0e8", flavor: "紫のグラデーションを保った花弁の標本" },
  { id: "r-rose-seed",              rarity: 4, region: "garden", name: "バラの種子",       emoji: "🌰", month: 5,  color: "#e83a3a", flavor: "実の中に隠れた、棘を持たない種" },
  { id: "r-rose-pressed",           rarity: 4, region: "garden", name: "バラの押し花",     emoji: "🍃", month: 5,  color: "#e83a3a", flavor: "色褪せずに深紅を保った押し花" },
  { id: "r-rose-cutting",           rarity: 4, region: "garden", name: "バラの挿し木",     emoji: "🪴", month: 5,  color: "#e83a3a", flavor: "棘のついたまま根付いた若い枝" },
  { id: "r-hydrangea-cutting",      rarity: 4, region: "garden", name: "紫陽花の挿し木",   emoji: "🪴", month: 6,  color: "#7b9fe8", flavor: "土の性質で色が変わるという若い枝" },
  { id: "r-hydrangea-dried",        rarity: 4, region: "garden", name: "紫陽花の乾燥花",   emoji: "🥀", month: 6,  color: "#7b9fe8", flavor: "水分が抜けても形を保つ、乾いた花房" },
  { id: "r-hydrangea-bud",          rarity: 4, region: "garden", name: "紫陽花の蕾",       emoji: "🌱", month: 6,  color: "#7b9fe8", flavor: "梅雨入り前、まだ固く閉じた蕾" },
  { id: "r-sunflower-seed",         rarity: 4, region: "garden", name: "ひまわりの種子",   emoji: "🌰", month: 7,  color: "#ffd700", flavor: "縞模様が特徴の、油分の多い種" },
  { id: "r-sunflower-pollen",       rarity: 4, region: "garden", name: "ひまわりの花粉",   emoji: "✨", month: 7,  color: "#ffd700", flavor: "太陽の色そのままの、細かな花粉" },
  { id: "r-sunflower-pressed",      rarity: 4, region: "garden", name: "ひまわりの押し花", emoji: "🍃", month: 7,  color: "#ffd700", flavor: "大輪のまま押し花にするのは至難という" },
  { id: "r-morning_glory-seed",     rarity: 4, region: "garden", name: "朝顔の種子",       emoji: "🌰", month: 8,  color: "#6a8ed4", flavor: "小さく黒い、朝を待つ硬い種" },
  { id: "r-morning_glory-bud",      rarity: 4, region: "garden", name: "朝顔の蕾",         emoji: "🌱", month: 8,  color: "#6a8ed4", flavor: "ねじれたまま夜明けを待つ蕾" },
  { id: "r-morning_glory-pressed",  rarity: 4, region: "garden", name: "朝顔の押し花",     emoji: "🍃", month: 8,  color: "#6a8ed4", flavor: "しぼむ前の一瞬を閉じ込めた押し花" },
  { id: "r-cosmos-seed",            rarity: 4, region: "garden", name: "コスモスの種子",   emoji: "🌰", month: 9,  color: "#f4a0c8", flavor: "細長く軽い、風に運ばれやすい種" },
  { id: "r-cosmos-pressed",         rarity: 4, region: "garden", name: "コスモスの押し花", emoji: "🍃", month: 9,  color: "#f4a0c8", flavor: "秋風に揺れていた姿のままの押し花" },
  { id: "r-cosmos-sprout",          rarity: 4, region: "garden", name: "コスモスの芽",     emoji: "🌱", month: 9,  color: "#f4a0c8", flavor: "涼しくなった頃にだけ顔を出す芽" },
  { id: "r-osmanthus-oil",          rarity: 4, region: "garden", name: "金木犀の香油",     emoji: "🧴", month: 10, color: "#f5a623", flavor: "小さな花を大量に集めて抽出した香油" },
  { id: "r-osmanthus-dried",        rarity: 4, region: "garden", name: "金木犀の乾燥花",   emoji: "🥀", month: 10, color: "#f5a623", flavor: "香りを閉じ込めたまま乾かした花" },
  { id: "r-osmanthus-bud",          rarity: 4, region: "garden", name: "金木犀の蕾",       emoji: "🌱", month: 10, color: "#f5a623", flavor: "開く直前が最も香り高いという蕾" },
  { id: "r-chrysanthemum-cutting",  rarity: 4, region: "garden", name: "菊の挿し木",       emoji: "🪴", month: 11, color: "#f0f0f0", flavor: "霜が降りる前に切り分けられた若い枝" },
  { id: "r-chrysanthemum-pressed",  rarity: 4, region: "garden", name: "菊の押し花",       emoji: "🍃", month: 11, color: "#f0f0f0", flavor: "白い花弁の輪郭がくっきり残る押し花" },
  { id: "r-chrysanthemum-tea",      rarity: 4, region: "garden", name: "菊の花弁茶",       emoji: "🍵", month: 11, color: "#f0f0f0", flavor: "乾かした花弁を浮かべて飲む、香り高い茶" },
  { id: "r-cyclamen-seed",          rarity: 4, region: "garden", name: "シクラメンの種子", emoji: "🌰", month: 12, color: "#e84080", flavor: "球根の代わりに稀に採れる小さな種" },
  { id: "r-cyclamen-bud",           rarity: 4, region: "garden", name: "シクラメンの蕾",   emoji: "🌱", month: 12, color: "#e84080", flavor: "花茎がくるりと巻いた状態の蕾" },
  { id: "r-cyclamen-pressed",       rarity: 4, region: "garden", name: "シクラメンの押し花",emoji: "🍃", month: 12, color: "#e84080", flavor: "反り返った花弁の形そのままの押し花" },
];

/** RARE4 roll pool: the 12 canonical species plus their 36 collected-form
 * variants. RARE_DROPS itself stays exactly the 12 canonical entries because
 * book-screen.tsx derives its month -> emoji map from it. */
export const RARE4_POOL: DropDef[] = [...RARE_DROPS, ...RARE4_VARIANT_DROPS];

/** RARE8 — the 12 scenic home-garden vista photographs. */
export const SSR_DROPS: DropDef[] = PLANT_SPECIES.map(ssrFromSpecies);

/** The material pool for each rarity rank (RARE 1-8, no gaps). */
export const POOL_BY_RARITY: Record<DropRarity, DropDef[]> = {
  1: COMMON_DROPS,
  2: TIER2_DROPS,
  3: TIER3_DROPS,
  4: RARE4_POOL,
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
  ...RARE4_VARIANT_DROPS,
  ...TIER5_DROPS,
  ...TIER6_DROPS,
  ...TIER7_DROPS,
  ...SSR_DROPS,
];

// getCollection() calls this once per stored drop record, and the record
// count grows for the life of the install. A linear scan over the catalog
// would make opening the survey notes O(records x catalog).
const DROP_BY_ID: Map<string, DropDef> = new Map(
  DROP_CATALOG.map((drop) => [drop.id, drop])
);

export function getDropById(id: string): DropDef | undefined {
  return DROP_BY_ID.get(id);
}

export const PITY_LIMIT = 12;
/** The in-season drop is this many times likelier within its rarity pool. */
const CURRENT_MONTH_WEIGHT = 4;

/* Per-rank probabilities (sum to 1), highest rank first. Exponential-ish
 * decay grounded in gacha rate curves: most completions yield low ranks so
 * the top ranks stay special. Pity and the first-of-day floor sit on top.
 * Unchanged by D-032 — only catalog content/structure changed. */
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
