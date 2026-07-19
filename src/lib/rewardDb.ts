import { db, type DropRecord } from "./db";
import {
  decideRarity,
  getDropById,
  pickDrop,
  type DropDef,
  type DropRarity,
} from "./domain/drops";

export interface GrantResult {
  drop: DropDef;
  rarity: DropRarity;
  /** First time this drop was ever recorded (unlocks a survey-notes entry). */
  isNew: boolean;
}

/**
 * Roll and persist exactly one drop for completing a task.
 * Returns null when this task already granted a drop today, so
 * check/uncheck cycles can never farm rewards (drops are also never revoked).
 */
export async function grantDropForTask(
  taskId: string,
  dateKey: string,
  now = new Date()
): Promise<GrantResult | null> {
  return db.transaction("rw", db.drops, async () => {
    const existing = await db.drops
      .where("[taskId+dateKey]")
      .equals([taskId, dateKey])
      .first();
    if (existing) return null;

    const all = await db.drops.toArray();
    const lastSsrIndex = all.findLastIndex((record) => record.rarity === 8);
    const rollsSinceSsr =
      lastSsrIndex < 0 ? all.length : all.length - 1 - lastSsrIndex;
    const isFirstOfDay = !all.some((record) => record.dateKey === dateKey);

    const rarity = decideRarity(Math.random, { rollsSinceSsr, isFirstOfDay });
    const drop = pickDrop(Math.random, rarity, now.getMonth() + 1);
    const isNew = !all.some((record) => record.dropId === drop.id);

    await db.drops.add({
      taskId,
      dateKey,
      dropId: drop.id,
      rarity,
      at: now.toISOString(),
    });

    return { drop, rarity, isNew };
  });
}

export interface CollectionSummary {
  /** dropId -> times obtained. */
  counts: Map<string, number>;
  totalRolls: number;
}

/** Bounty ids already rewarded today (claim ledger = drops table). */
export async function getTodayBountyClaims(dateKey: string): Promise<Set<string>> {
  const todays = await db.drops.where("dateKey").equals(dateKey).toArray();
  return new Set(
    todays
      .map((record) => record.taskId)
      .filter((taskId) => taskId.startsWith("bounty:"))
  );
}

export async function getCollection(): Promise<CollectionSummary> {
  const all: DropRecord[] = await db.drops.toArray();
  const counts = new Map<string, number>();
  for (const record of all) {
    // Skip records whose catalog entry no longer exists (future-proofing).
    if (!getDropById(record.dropId)) continue;
    counts.set(record.dropId, (counts.get(record.dropId) ?? 0) + 1);
  }
  return { counts, totalRolls: all.length };
}
