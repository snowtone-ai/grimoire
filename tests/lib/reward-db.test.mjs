/* Executes the real reward write path against an in-memory IndexedDB.
 *
 * grantDropForTask is the app's most important write: every task completion
 * goes through it. It deliberately uses only indexed lookups (the drops table
 * is append-only and grows for the life of the install), and those Dexie
 * queries are the kind of thing typecheck cannot verify — so they are run
 * here for real rather than reasoned about. */

// Must come before anything that touches Dexie.
import "fake-indexeddb/auto";
// getDb() refuses to run outside a browser; give it a window to find.
globalThis.window ??= globalThis;

import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db } from "../../src/lib/db.ts";
import { grantDropForTask, getCollection } from "../../src/lib/rewardDb.ts";
import { PITY_LIMIT, getDropById } from "../../src/lib/domain/drops.ts";

const realRandom = Math.random;

beforeEach(async () => {
  await db.drops.clear();
});

afterEach(() => {
  Math.random = realRandom;
});

/** Force decideRarity/pickDrop down a predictable path. */
function stubRandom(value) {
  Math.random = () => value;
}

test("a completion persists exactly one drop and reports it as new", async () => {
  stubRandom(0.9); // low rank, but first-of-day floors it to RARE4
  const result = await grantDropForTask("task-1", "2026-08-15");

  assert.ok(result, "a first completion grants a drop");
  assert.equal(result.isNew, true);
  assert.ok(getDropById(result.drop.id), "the granted drop is a real catalog entry");
  assert.equal(result.drop.rarity, result.rarity);
  assert.equal(await db.drops.count(), 1);
});

test("the first roll of a day is floored to RARE4 even on an unlucky roll", async () => {
  stubRandom(0.99); // would be RARE1 without the floor
  const first = await grantDropForTask("task-1", "2026-08-15");
  assert.equal(first.rarity, 4);

  // A second completion the same day is no longer first-of-day.
  const second = await grantDropForTask("task-2", "2026-08-15");
  assert.equal(second.rarity, 1);
});

test("a task cannot farm rewards by toggling complete on and off", async () => {
  stubRandom(0.5);
  const first = await grantDropForTask("task-1", "2026-08-15");
  assert.ok(first);

  const repeat = await grantDropForTask("task-1", "2026-08-15");
  assert.equal(repeat, null, "same task on the same day grants nothing further");
  assert.equal(await db.drops.count(), 1);

  // The same task on a different day is a fresh quest and does grant.
  const nextDay = await grantDropForTask("task-1", "2026-08-16");
  assert.ok(nextDay);
  assert.equal(await db.drops.count(), 2);
});

test("isNew flips to false once a drop has been recorded before", async () => {
  stubRandom(0.99);
  const first = await grantDropForTask("task-1", "2026-08-15");
  // Same stub -> same rarity band and same pool index -> same drop.
  const again = await grantDropForTask("task-2", "2026-08-16");

  assert.equal(again.drop.id, first.drop.id, "stubbed rng should reproduce the drop");
  assert.equal(again.isNew, false, "a repeat of a known drop is not new");
});

test("pity forces a RARE8 once the limit is reached", async () => {
  // Seed PITY_LIMIT rolls that contain no RARE8 at all.
  for (let i = 0; i < PITY_LIMIT; i++) {
    await db.drops.add({
      taskId: `seed-${i}`,
      dateKey: "2026-08-01",
      dropId: "c-kooribana",
      rarity: 1,
      at: new Date(2026, 7, 1).toISOString(),
    });
  }

  stubRandom(0.99); // would be RARE1 if pity were not consulted first
  const result = await grantDropForTask("task-pity", "2026-08-02");
  assert.equal(result.rarity, 8, "the pity limit guarantees a RARE8");
});

test("the pity counter resets after a RARE8 and counts only later rolls", async () => {
  // A RARE8 followed by a handful of ordinary rolls must not trigger pity.
  await db.drops.add({
    taskId: "seed-ssr",
    dateKey: "2026-08-01",
    dropId: "s-sunflower",
    rarity: 8,
    at: new Date(2026, 7, 1).toISOString(),
  });
  for (let i = 0; i < PITY_LIMIT - 1; i++) {
    await db.drops.add({
      taskId: `seed-${i}`,
      dateKey: "2026-08-01",
      dropId: "c-kooribana",
      rarity: 1,
      at: new Date(2026, 7, 1).toISOString(),
    });
  }

  stubRandom(0.99);
  const result = await grantDropForTask("task-x", "2026-08-02");
  // 11 rolls since the RARE8, plus first-of-day -> floored to 4, not pity 8.
  assert.equal(result.rarity, 4);
});

test("getCollection aggregates the ledger and ignores unknown ids", async () => {
  stubRandom(0.5);
  await grantDropForTask("task-1", "2026-08-15");
  await grantDropForTask("task-2", "2026-08-15");
  // A record from a catalog entry that no longer exists must not break totals.
  await db.drops.add({
    taskId: "task-legacy",
    dateKey: "2026-08-15",
    dropId: "removed-from-catalog",
    rarity: 1,
    at: new Date().toISOString(),
  });

  const collection = await getCollection();
  assert.equal(collection.totalRolls, 3, "totalRolls counts every stored roll");
  for (const id of collection.counts.keys()) {
    assert.ok(getDropById(id), `${id} resolves in the catalog`);
  }
  assert.ok(!collection.counts.has("removed-from-catalog"));
});

test("granting never loads the whole drops ledger into memory", async () => {
  // Regression guard for the change that removed db.drops.toArray() from the
  // hot path. The ledger is append-only and grows for the life of the install,
  // so a full-table read per completion is what would make checking off a task
  // get slower every year. Asserting on the access pattern is stabler than
  // asserting on a wall-clock threshold.
  const bulk = [];
  for (let i = 0; i < 2000; i++) {
    bulk.push({
      taskId: `bulk-${i}`,
      dateKey: `2026-0${(i % 9) + 1}-01`,
      dropId: "c-kooribana",
      rarity: 1,
      at: new Date(2026, 0, 1).toISOString(),
    });
  }
  await db.drops.bulkAdd(bulk);

  const realToArray = db.drops.toArray.bind(db.drops);
  let fullReads = 0;
  db.drops.toArray = (...args) => {
    fullReads++;
    return realToArray(...args);
  };

  try {
    stubRandom(0.5);
    const result = await grantDropForTask("task-late", "2026-12-31");
    assert.ok(result, "a completion still grants against a large ledger");
    assert.equal(await db.drops.count(), 2001);
    assert.equal(fullReads, 0, "the hot path must not read the entire drops table");
  } finally {
    db.drops.toArray = realToArray;
  }
});
