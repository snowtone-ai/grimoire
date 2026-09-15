/* Exercises the real macaron write path against an in-memory IndexedDB. */
import "fake-indexeddb/auto";
globalThis.window ??= globalThis;

import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db } from "../../src/lib/db.ts";
import { buildBackupJson, importBackup, parseBackup } from "../../src/lib/backup.ts";
import {
  claimLoginMacaron,
  claimTaskAdditionMacaron,
  claimTaskCompletionMacaron,
  feedMacaron,
  getMacaronCount,
  getTaskCompletionMacaronsForDate,
  grantMacaronForLogin,
  grantMacaronForTaskCompletion,
} from "../../src/lib/macaronDb.ts";

beforeEach(async () => {
  await db.foodInventory.clear();
  await db.foodAwards.clear();
});

test("login reward is one macaron per local date and survives retries", async () => {
  const now = new Date(2026, 8, 10, 9, 0, 0);
  const first = await claimLoginMacaron(now);
  const retry = await claimLoginMacaron(new Date(2026, 8, 10, 9, 1, 0));

  assert.ok(first);
  assert.equal(first.source, "login");
  assert.equal(first.amount, 1);
  assert.equal(first.balance, 1);
  assert.equal(retry, null);
  assert.equal(await getMacaronCount(), 1);
  assert.equal(await db.foodAwards.count(), 1);
});

test("concurrent login attempts produce one award", async () => {
  const now = new Date(2026, 8, 11, 9, 0, 0);
  const results = await Promise.all([
    claimLoginMacaron(now),
    claimLoginMacaron(now),
  ]);

  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await getMacaronCount(), 1);
  assert.equal(await db.foodAwards.count(), 1);
});

test("task addition reward is once per day, independent of login", async () => {
  const now = new Date(2026, 8, 10, 10, 0, 0);
  const login = await claimLoginMacaron(now);
  const first = await claimTaskAdditionMacaron(new Date(2026, 8, 10, 10, 1, 0));
  const retry = await claimTaskAdditionMacaron(new Date(2026, 8, 10, 10, 2, 0));
  const nextDay = await claimTaskAdditionMacaron(new Date(2026, 8, 11, 10, 0, 0));

  assert.ok(login);
  assert.ok(first);
  assert.equal(retry, null);
  assert.ok(nextDay);
  assert.equal(await getMacaronCount(), 3);
  assert.equal(await db.foodAwards.count(), 3);
});

test("normal completions are lifetime-idempotent and recurring completions are daily", async () => {
  const first = await claimTaskCompletionMacaron(
    "normal-task",
    "none",
    new Date(2026, 8, 10, 11, 0, 0)
  );
  const normalRetry = await claimTaskCompletionMacaron(
    "normal-task",
    "none",
    new Date(2026, 8, 11, 11, 0, 0)
  );
  const recurringFirst = await claimTaskCompletionMacaron(
    "daily-task",
    "daily",
    new Date(2026, 8, 10, 12, 0, 0)
  );
  const recurringRetry = await claimTaskCompletionMacaron(
    "daily-task",
    "daily",
    new Date(2026, 8, 10, 12, 1, 0)
  );
  const recurringNextDay = await claimTaskCompletionMacaron(
    "daily-task",
    "daily",
    new Date(2026, 8, 11, 12, 0, 0)
  );

  assert.ok(first);
  assert.equal(normalRetry, null);
  assert.ok(recurringFirst);
  assert.equal(recurringRetry, null);
  assert.ok(recurringNextDay);
  assert.equal(await getMacaronCount(), 3);
});

test("completion rewards stop at three per local day", async () => {
  const now = new Date(2026, 8, 10, 13, 0, 0);
  const results = await Promise.all([
    grantMacaronForTaskCompletion("task-1", "2026-09-10", "none", now),
    grantMacaronForTaskCompletion("task-2", "2026-09-10", "none", now),
    grantMacaronForTaskCompletion("task-3", "2026-09-10", "none", now),
    grantMacaronForTaskCompletion("task-4", "2026-09-10", "none", now),
  ]);

  assert.equal(results.filter(Boolean).length, 3);
  assert.equal(await getTaskCompletionMacaronsForDate("2026-09-10"), 3);
  assert.equal(await getMacaronCount(), 3);
});

test("explicit login date form uses the supplied ledger date", async () => {
  const result = await grantMacaronForLogin(
    "2026-09-10",
    new Date(2026, 8, 10, 23, 59, 0)
  );
  assert.ok(result);
  assert.equal(result.dateKey, "2026-09-10");
  assert.equal(result.eventKey, "login:2026-09-10");
});

test("food balance and award ledger roundtrip through backup", async () => {
  await claimLoginMacaron(new Date(2026, 8, 10, 9, 0, 0));
  const payload = parseBackup(await buildBackupJson()).payload;
  assert.equal(payload.foodInventory[0].id, "macaron");
  assert.equal(payload.foodInventory[0].quantity, 1);
  assert.equal(payload.foodAwards.length, 1);

  await db.foodInventory.clear();
  await db.foodAwards.clear();
  await importBackup(payload);
  await importBackup(payload);
  assert.equal(await getMacaronCount(), 1);
  assert.equal(await db.foodAwards.count(), 1);
});

test("a legacy v4 backup without food fields does not erase new food data", async () => {
  await claimLoginMacaron(new Date(2026, 8, 10, 9, 0, 0));
  const current = parseBackup(await buildBackupJson()).payload;
  const legacy = { ...current, version: 4 };
  delete legacy.foodInventory;
  delete legacy.foodAwards;

  await importBackup(parseBackup(JSON.stringify(legacy)).payload);
  assert.equal(await getMacaronCount(), 1);
  assert.equal(await db.foodAwards.count(), 1);
});

test("feeding is atomic and never lets concurrent tabs spend the same macaron twice", async () => {
  await claimLoginMacaron(new Date(2026, 8, 10, 9, 0, 0));
  const [first, second] = await Promise.all([feedMacaron(), feedMacaron()]);
  assert.equal([first, second].filter(Boolean).length, 1);
  assert.equal(await getMacaronCount(), 0);
});
