/** Monthly chronicle domain — pure functions, no side effects.
 *
 * The survey log renews every month: a new seasonal subject (that month's
 * flower) arrives, and each past month is sealed into a permanent chronicle
 * page. This turns a finite catalog into an unbounded, self-writing record —
 * the anti-habituation engine for long-term daily use. Everything is derived
 * from the drops table (drops are never revoked), so no schema/migration is
 * needed; the chronicle just grows one page per month, forever.
 *
 * The `.ts` import extension keeps this resolvable by Node's type-stripping
 * test runner as well as the Next bundler. */

import { getSpeciesForMonth, monthKeyLocal, type PlantSpecies } from "./plant.ts";

export interface ChronicleDrop {
  dateKey: string; // YYYY-MM-DD (local)
  rarity: number;
}

export interface ChronicleMonth {
  monthKey: string; // YYYY-MM
  year: number;
  month: number; // 1-12
  species: PlantSpecies; // the season's flower theme
  totalDrops: number;
  rareDrops: number; // rarity >= 4
  activeDays: number; // distinct days with a drop
  isCurrent: boolean;
}

export function buildChronicle(drops: ChronicleDrop[], now: Date): ChronicleMonth[] {
  const byMonth = new Map<string, { total: number; rare: number; days: Set<string> }>();

  for (const drop of drops) {
    if (!drop.dateKey || drop.dateKey.length < 7) continue;
    const key = drop.dateKey.slice(0, 7);
    let entry = byMonth.get(key);
    if (!entry) {
      entry = { total: 0, rare: 0, days: new Set() };
      byMonth.set(key, entry);
    }
    entry.total += 1;
    if (drop.rarity >= 4) entry.rare += 1;
    entry.days.add(drop.dateKey);
  }

  // The current month always has a (possibly empty) live page — the fresh
  // subject waiting to be filled is the monthly novelty hook.
  const currentKey = monthKeyLocal(now);
  if (!byMonth.has(currentKey)) {
    byMonth.set(currentKey, { total: 0, rare: 0, days: new Set() });
  }

  const months: ChronicleMonth[] = [];
  for (const [key, entry] of byMonth) {
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7));
    if (!year || !month || month < 1 || month > 12) continue;
    months.push({
      monthKey: key,
      year,
      month,
      species: getSpeciesForMonth(month),
      totalDrops: entry.total,
      rareDrops: entry.rare,
      activeDays: entry.days.size,
      isCurrent: key === currentKey,
    });
  }

  months.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  return months;
}
