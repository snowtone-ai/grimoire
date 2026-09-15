import {
  db,
  type DropRecord,
  type FoodAwardRecord,
  type FoodInventoryRecord,
  type PlantState,
  type Streak,
  type Task,
} from "./db.ts";

/* JSON backup of the whole local store. Import upserts by primary key in a
 * single transaction, so re-importing the same file is idempotent and an
 * import can never delete existing data. */

/**
 * Keep the backup format version at 4: the new food arrays are additive and
 * optional, so existing v4 backup files remain valid without a forced format
 * migration. The IndexedDB schema itself advances independently to v5.
 */
export const BACKUP_VERSION = 4;

export interface BackupPayload {
  app: "grimoire";
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  tasks: Task[];
  streaks: Streak[];
  plantState: PlantState[];
  drops: DropRecord[];
  foodInventory: FoodInventoryRecord[];
  foodAwards: FoodAwardRecord[];
}

export async function buildBackupJson(): Promise<string> {
  const [tasks, streaks, plantState, drops, foodInventory, foodAwards] = await Promise.all([
    db.tasks.toArray(),
    db.streaks.toArray(),
    db.plantState.toArray(),
    db.drops.toArray(),
    db.foodInventory.toArray(),
    db.foodAwards.toArray(),
  ]);
  const payload: BackupPayload = {
    app: "grimoire",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tasks,
    streaks,
    plantState,
    drops,
    foodInventory,
    foodAwards,
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadBackup(json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `grimoire-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export interface ParsedBackup {
  payload: BackupPayload;
  counts: { tasks: number; streaks: number; drops: number };
}

/** Validate the minimum shape we rely on; reject anything else loudly. */
export function parseBackup(text: string): ParsedBackup {
  const data: unknown = JSON.parse(text);
  if (typeof data !== "object" || data === null) {
    throw new Error("バックアップ形式ではありません");
  }
  const record = data as Record<string, unknown>;
  if (record.app !== "grimoire") {
    throw new Error("このアプリのバックアップではありません");
  }
  if (typeof record.version !== "number" || record.version > BACKUP_VERSION) {
    throw new Error("バックアップのバージョンがこのアプリより新しいため取り込めません");
  }
  const tasks = record.tasks;
  const streaks = record.streaks;
  const plantState = record.plantState;
  const drops = record.drops;
  // v1–v4 backups predate the food stores. Missing arrays are normalized to
  // empty here so those backups remain importable without touching any newly
  // earned macarons already present on this device.
  const foodInventory = record.foodInventory;
  const foodAwards = record.foodAwards;
  if (
    !Array.isArray(tasks) ||
    !Array.isArray(streaks) ||
    !Array.isArray(plantState) ||
    !Array.isArray(drops)
  ) {
    throw new Error("バックアップの中身が壊れています");
  }
  if (!tasks.every((task) => typeof (task as Task)?.id === "string")) {
    throw new Error("タスクデータのIDが不正です");
  }
  if (!streaks.every((streak) => typeof (streak as Streak)?.date === "string")) {
    throw new Error("ストリークデータの日付が不正です");
  }
  if (
    !drops.every(
      (drop) =>
        typeof (drop as DropRecord)?.taskId === "string" &&
        typeof (drop as DropRecord)?.dateKey === "string"
    )
  ) {
    throw new Error("ドロップデータの形式が不正です");
  }

  const normalizedFoodInventory = Array.isArray(foodInventory) ? foodInventory : [];
  const normalizedFoodAwards = Array.isArray(foodAwards) ? foodAwards : [];
  if (!normalizedFoodInventory.every((item) =>
    typeof (item as FoodInventoryRecord)?.id === "string" &&
    (item as FoodInventoryRecord).id.length > 0 &&
    Number.isSafeInteger((item as FoodInventoryRecord)?.quantity) &&
    (item as FoodInventoryRecord).quantity >= 0 &&
    typeof (item as FoodInventoryRecord)?.lastUpdated === "string"
  )) {
    throw new Error("食べ物在庫データの形式が不正です");
  }
  if (!normalizedFoodAwards.every((award) =>
    typeof (award as FoodAwardRecord)?.eventKey === "string" &&
    (award as FoodAwardRecord).eventKey.length > 0 &&
    ["login", "task-add", "task-completion"].includes((award as FoodAwardRecord)?.source) &&
    typeof (award as FoodAwardRecord)?.dateKey === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test((award as FoodAwardRecord).dateKey) &&
    Number.isSafeInteger((award as FoodAwardRecord)?.amount) &&
    (award as FoodAwardRecord).amount > 0 &&
    (award as FoodAwardRecord).amount <= 3 &&
    typeof (award as FoodAwardRecord)?.at === "string" &&
    ((award as FoodAwardRecord).taskId === undefined ||
      typeof (award as FoodAwardRecord).taskId === "string")
  )) {
    throw new Error("食べ物受取データの形式が不正です");
  }

  const payload = {
    ...(record as unknown as BackupPayload),
    foodInventory: normalizedFoodInventory,
    foodAwards: normalizedFoodAwards,
  };
  return {
    payload,
    counts: {
      tasks: tasks.length,
      streaks: streaks.length,
      drops: drops.length,
    },
  };
}

/** Upsert every record; same-id rows are overwritten, nothing is deleted. */
export async function importBackup(payload: BackupPayload): Promise<void> {
  await db.transaction("rw", [
    db.tasks,
    db.streaks,
    db.plantState,
    db.drops,
    db.foodInventory,
    db.foodAwards,
  ], async () => {
    await db.tasks.bulkPut(payload.tasks);
    await db.streaks.bulkPut(payload.streaks);
    await db.plantState.bulkPut(payload.plantState);
    // Drop ids are auto-increment and may collide across devices; strip them
    // and dedupe on the unique [taskId+dateKey] key instead.
    for (const drop of payload.drops) {
      const existing = await db.drops
        .where("[taskId+dateKey]")
        .equals([drop.taskId, drop.dateKey])
        .first();
      if (!existing) {
        const rest = { ...drop };
        delete rest.id;
        await db.drops.add(rest);
      }
    }
    // Backups written before v5 simply have no food arrays. Empty puts are
    // harmless and, importantly, do not clear existing inventory or awards.
    await db.foodInventory.bulkPut(payload.foodInventory ?? []);
    for (const award of payload.foodAwards ?? []) {
      const existing = await db.foodAwards
        .where("eventKey")
        .equals(award.eventKey)
        .first();
      if (!existing) {
        const rest = { ...award };
        delete rest.id;
        await db.foodAwards.add(rest);
      }
    }
  });
}
