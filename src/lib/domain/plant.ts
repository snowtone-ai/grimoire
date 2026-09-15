/** Plant growth domain logic — pure functions, no side effects. */

export interface PlantSpecies {
  month: number;
  name: string;
  nameEn: string;
  color: string;
  accentColor: string;
  rewardImage: string;
  archetype: "upright" | "cherry" | "hanging" | "delicate";
}

export interface CompletedTaskRecord {
  completed: boolean;
  completedAt: string | null;
}

export const PLANT_SPECIES: PlantSpecies[] = [
  { month: 1,  name: "梅",       nameEn: "plum",        color: "#f8b4c8", accentColor: "#e8a0b4", rewardImage: "/plant-rewards/final/01-plum.jpg", archetype: "cherry" },
  { month: 2,  name: "蝋梅",     nameEn: "wintersweet", color: "#ffe066", accentColor: "#f5c842", rewardImage: "/plant-rewards/final/02-wintersweet.jpg", archetype: "cherry" },
  { month: 3,  name: "桜",       nameEn: "sakura",      color: "#ffb7c5", accentColor: "#f090a8", rewardImage: "/plant-rewards/final/03-sakura.jpg", archetype: "cherry" },
  { month: 4,  name: "藤",       nameEn: "wisteria",    color: "#c5a0e8", accentColor: "#a07acc", rewardImage: "/plant-rewards/final/04-wisteria.jpg", archetype: "hanging" },
  { month: 5,  name: "バラ",     nameEn: "rose",        color: "#e83a3a", accentColor: "#c02020", rewardImage: "/plant-rewards/final/05-rose.jpg", archetype: "upright" },
  { month: 6,  name: "紫陽花",   nameEn: "hydrangea",   color: "#7b9fe8", accentColor: "#5a7ed4", rewardImage: "/plant-rewards/final/06-hydrangea.jpg", archetype: "hanging" },
  { month: 7,  name: "ひまわり", nameEn: "sunflower",   color: "#ffd700", accentColor: "#e6b800", rewardImage: "/plant-rewards/final/07-sunflower.jpg", archetype: "upright" },
  { month: 8,  name: "朝顔",     nameEn: "morning_glory", color: "#6a8ed4", accentColor: "#4a6ec0", rewardImage: "/plant-rewards/final/08-morning-glory.jpg", archetype: "delicate" },
  { month: 9,  name: "コスモス", nameEn: "cosmos",      color: "#f4a0c8", accentColor: "#e07aaa", rewardImage: "/plant-rewards/final/09-cosmos.jpg", archetype: "delicate" },
  { month: 10, name: "金木犀",   nameEn: "osmanthus",   color: "#f5a623", accentColor: "#e08010", rewardImage: "/plant-rewards/final/10-osmanthus.jpg", archetype: "delicate" },
  { month: 11, name: "菊",       nameEn: "chrysanthemum", color: "#f0f0f0", accentColor: "#d0d0d0", rewardImage: "/plant-rewards/final/11-chrysanthemum.jpg", archetype: "upright" },
  { month: 12, name: "シクラメン", nameEn: "cyclamen",  color: "#e84080", accentColor: "#c02060", rewardImage: "/plant-rewards/final/12-cyclamen.jpg", archetype: "upright" },
];

export type GrowthStage = 0 | 1 | 2 | 3 | 4 | 5;

/* Growth is cumulative within the calendar month — progress is never taken
 * away mid-month (ADHD-safe: no weekly confiscation). A new month brings a
 * new species, which is a fresh start, not a punishment. */
const THRESHOLDS = [0, 1, 3, 6, 10, Infinity] as const;

/** Map the monthly completed count to a growth stage (0-5). */
export function calcGrowthStage(monthlyCompleted: number): GrowthStage {
  const completed = Math.max(0, monthlyCompleted);
  const stage = THRESHOLDS.findIndex((threshold) => completed <= threshold);
  return Math.max(0, stage) as GrowthStage;
}

/** Progress percentage toward the next growth stage. */
export function calcProgress(monthlyCompleted: number, stage: GrowthStage): number {
  const hi = THRESHOLDS[stage];
  if (stage === 0) return 0;
  if (hi === Infinity) return 100;

  const lo = THRESHOLDS[stage - 1];
  const completed = Math.max(0, monthlyCompleted);
  const progress = Math.round(((completed - lo) / (hi - lo)) * 100);
  return Math.min(100, Math.max(0, progress));
}

export function getCurrentSpecies(): PlantSpecies {
  const month = new Date().getMonth() + 1; // 1-12
  return getSpeciesForMonth(month);
}

export function getSpeciesForMonth(month: number): PlantSpecies {
  const species = PLANT_SPECIES.find((plantSpecies) => plantSpecies.month === month);
  if (!species) throw new Error(`Invalid plant month: ${month}`);
  return species;
}

/** Count tasks completed within the local calendar month of `now`. */
export function countMonthlyCompletedTasks(
  tasks: CompletedTaskRecord[],
  now: Date
): number {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return tasks.filter((task) => {
    if (!task.completed || !task.completedAt) return false;
    const completedAt = new Date(task.completedAt);
    return completedAt >= monthStart && completedAt <= now;
  }).length;
}

/** Local-timezone month key, e.g. "2026-07". */
export function monthKeyLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const STAGE_LABELS = ["種", "芽吹き", "葉が出た", "つぼみ", "開花中", "満開"] as const;

export function getStageLabel(stage: GrowthStage): string {
  return STAGE_LABELS[stage];
}
