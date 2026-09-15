import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMON_DROPS,
  DROP_CATALOG,
  PITY_LIMIT,
  POOL_BY_RARITY,
  RARE_DROPS,
  SSR_DROPS,
  decideRarity,
  getDropById,
  pickDrop,
} from "../../../src/lib/domain/drops.ts";
import { PLANT_SPECIES } from "../../../src/lib/domain/plant.ts";

test("drop catalog is a full RARE 1-8 ladder with unique ids and no gaps", () => {
  assert.equal(new Set(DROP_CATALOG.map((drop) => drop.id)).size, DROP_CATALOG.length);
  // Every rank 1-8 has a non-empty pool (the ladder has no gaps).
  for (let rarity = 1; rarity <= 8; rarity++) {
    const pool = POOL_BY_RARITY[rarity];
    assert.ok(pool.length > 0, `rank ${rarity} has drops`);
    assert.equal(pool.every((drop) => drop.rarity === rarity), true);
  }
  // The catalog is exactly the union of the eight pools.
  const poolTotal = Array.from({ length: 8 }, (_, i) => POOL_BY_RARITY[i + 1].length).reduce((a, b) => a + b, 0);
  assert.equal(DROP_CATALOG.length, poolTotal);
  // Seasonal anchors keep their ranks and asset types.
  assert.equal(COMMON_DROPS.every((drop) => drop.rarity === 1 && drop.emoji), true);
  assert.equal(RARE_DROPS.every((drop) => drop.rarity === 4 && drop.emoji), true);
  assert.equal(SSR_DROPS.every((drop) => drop.rarity === 8 && drop.photo), true);
});

test("RARE8 photos reuse the monthly species reward images", () => {
  assert.deepEqual(
    new Set(SSR_DROPS.map((drop) => drop.photo)),
    new Set(PLANT_SPECIES.map((species) => species.rewardImage))
  );
  assert.deepEqual(
    SSR_DROPS.map((drop) => drop.month).sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  );
});

test("decideRarity: pity guarantees RARE8 after the limit", () => {
  const alwaysCommonRng = () => 0.99;
  assert.equal(decideRarity(alwaysCommonRng, { rollsSinceSsr: PITY_LIMIT, isFirstOfDay: false }), 8);
  assert.equal(decideRarity(alwaysCommonRng, { rollsSinceSsr: PITY_LIMIT + 3, isFirstOfDay: false }), 8);
});

test("decideRarity: full 1-8 rate bands and first-of-day floor", () => {
  const context = { rollsSinceSsr: 0, isFirstOfDay: false };
  // Cumulative bands (low roll = high rank): 8<.025, 7<.06, 6<.12, 5<.21,
  // 4<.33, 3<.50, 2<.72, else 1. Probe each band's interior (exact boundaries
  // are float-fragile and not meaningful).
  assert.equal(decideRarity(() => 0.01, context), 8);
  assert.equal(decideRarity(() => 0.04, context), 7);
  assert.equal(decideRarity(() => 0.09, context), 6);
  assert.equal(decideRarity(() => 0.16, context), 5);
  assert.equal(decideRarity(() => 0.27, context), 4);
  assert.equal(decideRarity(() => 0.42, context), 3);
  assert.equal(decideRarity(() => 0.61, context), 2);
  assert.equal(decideRarity(() => 0.85, context), 1);
  assert.equal(decideRarity(() => 0.99, context), 1);
  // The first roll of a day never lands below RARE4 (a reason to start).
  assert.equal(decideRarity(() => 0.99, { rollsSinceSsr: 0, isFirstOfDay: true }), 4);
  assert.equal(decideRarity(() => 0.61, { rollsSinceSsr: 0, isFirstOfDay: true }), 4);
});

test("pickDrop returns a drop of the requested mid rank", () => {
  const drop = pickDrop(() => 0.5, 5, 7);
  assert.equal(drop.rarity, 5);
});

test("pickDrop weights the in-season drop and stays in bounds", () => {
  const month = 7;
  // Others weigh 1, the current month weighs 4 -> total 15. Sweep the whole
  // range deterministically and count how often July is chosen.
  const total = 15;
  let julyHits = 0;
  for (let i = 0; i < total; i++) {
    const drop = pickDrop(() => i / total, 8, month);
    assert.equal(drop.rarity, 8);
    if (drop.month === month) julyHits++;
  }
  assert.equal(julyHits, 4);

  const edge = pickDrop(() => 0.999999, 1, month);
  assert.equal(edge.rarity, 1);
});

test("getDropById round-trips catalog entries", () => {
  for (const drop of DROP_CATALOG) {
    assert.equal(getDropById(drop.id), drop);
  }
  assert.equal(getDropById("missing"), undefined);
});
