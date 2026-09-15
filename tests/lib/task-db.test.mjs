/* Executes the calendar-reset write path against an in-memory IndexedDB,
 * since it deletes real user data and Dexie's clear() cannot be reasoned
 * about by typecheck alone. */

// Must come before anything that touches Dexie.
import "fake-indexeddb/auto";
// getDb() refuses to run outside a browser; give it a window to find.
globalThis.window ??= globalThis;

import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db } from "../../src/lib/db.ts";
import {
  createTask,
  getAllTasks,
  getCalendarResetCounts,
  recordStreak,
  resetCalendar,
} from "../../src/lib/taskDb.ts";

beforeEach(async () => {
  await db.tasks.clear();
  await db.streaks.clear();
  await db.drops.clear();
});

test("getCalendarResetCounts reports the current tasks and streaks totals", async () => {
  await createTask({
    title: "t1",
    dueDate: "2026-08-15",
    dueTime: null,
    category: "life",
    completed: false,
    completedAt: null,
    recurrence: "none",
  });
  await recordStreak("2026-08-14", true);
  await recordStreak("2026-08-15", false);

  const counts = await getCalendarResetCounts();
  assert.deepEqual(counts, { tasks: 1, streaks: 2 });
});

test("resetCalendar clears tasks and streaks but leaves other tables alone", async () => {
  await createTask({
    title: "t1",
    dueDate: "2026-08-15",
    dueTime: null,
    category: "life",
    completed: false,
    completedAt: null,
    recurrence: "none",
  });
  await recordStreak("2026-08-15", true);
  await db.drops.add({ taskId: "task-1", dateKey: "2026-08-15", dropId: "x", rarity: 1, at: new Date().toISOString() });

  await resetCalendar();

  assert.deepEqual(await getAllTasks(), []);
  assert.equal(await db.streaks.count(), 0);
  assert.equal(await db.drops.count(), 1, "resetCalendar must not touch drops (survey notes)");
});
