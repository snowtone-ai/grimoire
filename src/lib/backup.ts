import { db, type DropRecord, type PlantState, type Streak, type Task } from "./db";

/* JSON backup of the whole local store. Import upserts by primary key in a
 * single transaction, so re-importing the same file is idempotent and an
 * import can never delete existing data. */

export interface BackupPayload {
  app: "grimoire";
  version: 3; // Dexie schema version this snapshot came from.
  exportedAt: string;
  tasks: Task[];
  streaks: Streak[];
  plantState: PlantState[];
  drops: DropRecord[];
}

export async function buildBackupJson(): Promise<string> {
  const [tasks, streaks, plantState, drops] = await Promise.all([
    db.tasks.toArray(),
    db.streaks.toArray(),
    db.plantState.toArray(),
    db.drops.toArray(),
  ]);
  const payload: BackupPayload = {
    app: "grimoire",
    version: 3,
    exportedAt: new Date().toISOString(),
    tasks,
    streaks,
    plantState,
    drops,
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
  const tasks = record.tasks;
  const streaks = record.streaks;
  const plantState = record.plantState;
  const drops = record.drops;
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

  const payload = record as unknown as BackupPayload;
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
  await db.transaction("rw", [db.tasks, db.streaks, db.plantState, db.drops], async () => {
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
  });
}
