// The .ts extension keeps this import resolvable by Node's type-stripping
// test runner (node --test) as well as the Next bundler.
import { PLANT_SPECIES, type PlantSpecies } from "./plant.ts";

/* Material-drop reward domain — pure functions, no side effects.
 *
 * Completing a quest (task) rolls exactly one drop, Monster-Hunter style:
 * an unpredictable material reward at the moment of completion. Rarity uses
 * the RARE1 / RARE4 / RARE8 grammar. Anti-frustration rules:
 * - Pity: PITY_LIMIT rolls without a RARE8 guarantees the next one.
 * - First roll of the day is floored to RARE4 (a reason to start today).
 * Drops are never revoked (no punishment). */

export type DropRarity = 1 | 4 | 8;

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

/** RARE4 — the 12 rare research specimens (one per season month). */
export const RARE_DROPS: DropDef[] = PLANT_SPECIES.map(rareFromSpecies);

/** RARE8 — the 12 scenic survey photographs. */
export const SSR_DROPS: DropDef[] = PLANT_SPECIES.map(ssrFromSpecies);

export const DROP_CATALOG: DropDef[] = [...COMMON_DROPS, ...RARE_DROPS, ...SSR_DROPS];

export function getDropById(id: string): DropDef | undefined {
  return DROP_CATALOG.find((drop) => drop.id === id);
}

export const PITY_LIMIT = 12;
const SSR_RATE = 0.05;
const RARE_RATE = 0.27;
/** The in-season drop is this many times likelier within its rarity pool. */
const CURRENT_MONTH_WEIGHT = 4;

export interface RollContext {
  rollsSinceSsr: number;
  isFirstOfDay: boolean;
}

/** Decide a roll's rarity from a [0,1) random source. */
export function decideRarity(rng: () => number, context: RollContext): DropRarity {
  if (context.rollsSinceSsr >= PITY_LIMIT) return 8;
  const roll = rng();
  if (roll < SSR_RATE) return 8;
  if (roll < SSR_RATE + RARE_RATE) return 4;
  if (context.isFirstOfDay) return 4;
  return 1;
}

/** Pick a drop of the given rarity; in-season drops are weighted up. */
export function pickDrop(rng: () => number, rarity: DropRarity, month: number): DropDef {
  const pool =
    rarity === 8 ? SSR_DROPS : rarity === 4 ? RARE_DROPS : COMMON_DROPS;

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
