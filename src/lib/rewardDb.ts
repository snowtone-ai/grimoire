import { db, type DropRecord } from "./db.ts";
import {
  decideRarity,
  getDropById,
  pickDrop,
  type DropDef,
  type DropRarity,
} from "./domain/drops.ts";
import { buildChronicle, type ChronicleMonth } from "./domain/chronicle.ts";

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

    // These used to be three scans over db.drops.toArray(). The drops table is
    // append-only and grows for the life of the install (years of daily use),
    // so the hot path never materialises the whole history: the two counters
    // below are index lookups, and the isNew check walks a cursor over one
    // rarity partition (see its own note).
    const lastSsr = await db.drops.where("rarity").equals(8).last();
    const rollsSinceSsr =
      lastSsr?.id === undefined
        ? await db.drops.count()
        : await db.drops.where(":id").above(lastSsr.id).count();
    const isFirstOfDay =
      (await db.drops.where("dateKey").equals(dateKey).count()) === 0;

    const rarity = decideRarity(Math.random, { rollsSinceSsr, isFirstOfDay });
    const drop = pickDrop(Math.random, rarity, now.getMonth() + 1);
    // A given dropId always carries its catalog rarity (pinned by test), so
    // the rarity index narrows this to one rank instead of the whole table.
    // For an already-collected drop it stops at the first hit; only a genuinely
    // new drop walks that rank's full partition. A dropId index would make it
    // O(log n) outright, deferred as a schema change (D-031).
    const seen = await db.drops
      .where("rarity")
      .equals(drop.rarity)
      .filter((record) => record.dropId === drop.id)
      .first();
    const isNew = !seen;

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

/** Monthly chronicle derived from the (never-revoked) drops table. */
export async function getChronicle(now = new Date()): Promise<ChronicleMonth[]> {
  const all: DropRecord[] = await db.drops.toArray();
  return buildChronicle(all, now);
}
