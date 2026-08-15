import test from "node:test";
import assert from "node:assert/strict";
import {
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
import { REGIONS, EXPEDITION_REGIONS, getRegionById } from "../../../src/lib/domain/regions.ts";

/* Catalog integrity + long-term-use simulation.
 *
 * D-032 rebuilt the catalog from a single frozen-tundra theme into an
 * eight-region world atlas (region material ranks 1/2/3/5/6/7) plus the
 * unchanged home-garden season axis (rank 4/8). Unlike D-031's 5x expansion,
 * this rewrite intentionally does NOT preserve old drop ids — the user
 * explicitly authorized breaking backward compatibility for the world-theme
 * change (docs/decisions.md D-032). So these tests check structural
 * invariants of the new catalog rather than pinning specific legacy ids.
 *
 * The drops table is still an append-only ledger of the user's real history,
 * and a dropId that no longer resolves is silently skipped by getCollection()
 * — so *future* edits to this catalog should still avoid renaming/removing
 * ids without a good reason, even though this particular rewrite was an
 * authorized one-time break. */

test("every catalog entry lives in the pool matching its own rarity", () => {
  for (const drop of DROP_CATALOG) {
    assert.ok(
      POOL_BY_RARITY[drop.rarity].includes(drop),
      `${drop.id} declares RARE${drop.rarity} but is not in that rank's pool`
    );
  }
});

test("catalog entries are well formed and non-duplicated", () => {
  const ids = new Set();
  const names = new Set();

  for (const drop of DROP_CATALOG) {
    assert.ok(!ids.has(drop.id), `duplicate id: ${drop.id}`);
    ids.add(drop.id);
    assert.ok(!names.has(drop.name), `duplicate name: ${drop.name}`);
    names.add(drop.name);

    assert.ok(drop.name.trim().length > 0, `${drop.id} has a name`);
    assert.ok(drop.flavor.trim().length > 0, `${drop.id} has flavor text`);
    assert.match(drop.color, /^#[0-9a-fA-F]{6}$/, `${drop.id} has a hex color`);
    assert.ok(
      Number.isInteger(drop.rarity) && drop.rarity >= 1 && drop.rarity <= 8,
      `${drop.id} has a rank in 1-8`
    );

    // RARE8 is photo-backed; every other rank renders an emoji.
    if (drop.rarity === 8) {
      assert.ok(drop.photo, `${drop.id} (RARE8) has a photo`);
    } else {
      assert.ok(drop.emoji, `${drop.id} has an emoji`);
    }
  }
});

test("every drop belongs to a real region, and region use matches the season/expedition split", () => {
  const regionIds = new Set(REGIONS.map((region) => region.id));
  for (const drop of DROP_CATALOG) {
    assert.ok(regionIds.has(drop.region), `${drop.id} has an unknown region "${drop.region}"`);
    assert.doesNotThrow(() => getRegionById(drop.region));

    if (drop.rarity === 4 || drop.rarity === 8) {
      assert.equal(drop.region, "garden", `${drop.id} (RARE${drop.rarity}) must be the home-garden region`);
    } else {
      assert.notEqual(drop.region, "garden", `${drop.id} (RARE${drop.rarity}) must be an expedition region`);
    }
  }
});

test("every expedition region contributes to every non-seasonal rank", () => {
  for (const region of EXPEDITION_REGIONS) {
    for (const rarity of [1, 2, 3, 5, 6, 7]) {
      const count = POOL_BY_RARITY[rarity].filter((drop) => drop.region === region.id).length;
      assert.ok(count > 0, `region ${region.id} has no RARE${rarity} materials`);
    }
  }
});

test("the catalog is a full RARE 1-8 ladder sized in the 400-500 range", () => {
  for (let rarity = 1; rarity <= 8; rarity++) {
    assert.ok(POOL_BY_RARITY[rarity].length > 0, `rank ${rarity} has drops`);
  }
  assert.equal(SSR_DROPS.length, 12, "RARE8 stays the 12 photo-backed seasonal vistas");
  assert.ok(
    DROP_CATALOG.length >= 400 && DROP_CATALOG.length <= 500,
    `catalog should be in the 400-500 range, got ${DROP_CATALOG.length}`
  );
});

test("RARE4 keeps exactly one canonical specimen per month for the chronicle", () => {
  // book-screen builds a month -> emoji Map from RARE_DROPS; more than one
  // canonical entry per month would make that map order-dependent.
  assert.equal(RARE_DROPS.length, 12);
  const months = RARE_DROPS.map((drop) => drop.month).sort((a, b) => a - b);
  assert.deepEqual(months, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  for (const species of PLANT_SPECIES) {
    const canonical = getDropById(`r-${species.nameEn}`);
    assert.ok(canonical, `canonical RARE4 for ${species.nameEn}`);
    assert.equal(canonical.month, species.month);
  }
});

/* Unlike the expedition-region ids (376 of them, intentionally NOT preserved
 * by D-032), these 60 season-linked "garden" ids already have real drop
 * records in the user's IndexedDB from before this rewrite, and D-032
 * explicitly promised to leave them byte-identical. If a future edit ever
 * moved one of these to a different rank, grantDropForTask's rarity-scoped
 * lookup (rewardDb.ts) would stop finding the user's existing record and
 * show it as permanently "NEW!" (the exact failure D-031 warned about) — so
 * this is a literal snapshot, not derived from drops.ts, and fails on that
 * kind of accidental move. */
const SEASON_DROPS_BY_RARITY = {
  4: [
    "r-plum", "r-wintersweet", "r-sakura", "r-wisteria", "r-rose", "r-hydrangea",
    "r-sunflower", "r-morning_glory", "r-cosmos", "r-osmanthus", "r-chrysanthemum", "r-cyclamen",
    "r-plum-seed", "r-plum-pressed", "r-plum-bud",
    "r-wintersweet-sprout", "r-wintersweet-oil", "r-wintersweet-dried",
    "r-sakura-seed", "r-sakura-pressed", "r-sakura-sprout",
    "r-wisteria-bud", "r-wisteria-cutting", "r-wisteria-petal",
    "r-rose-seed", "r-rose-pressed", "r-rose-cutting",
    "r-hydrangea-cutting", "r-hydrangea-dried", "r-hydrangea-bud",
    "r-sunflower-seed", "r-sunflower-pollen", "r-sunflower-pressed",
    "r-morning_glory-seed", "r-morning_glory-bud", "r-morning_glory-pressed",
    "r-cosmos-seed", "r-cosmos-pressed", "r-cosmos-sprout",
    "r-osmanthus-oil", "r-osmanthus-dried", "r-osmanthus-bud",
    "r-chrysanthemum-cutting", "r-chrysanthemum-pressed", "r-chrysanthemum-tea",
    "r-cyclamen-seed", "r-cyclamen-bud", "r-cyclamen-pressed",
  ],
  8: [
    "s-plum", "s-wintersweet", "s-sakura", "s-wisteria", "s-rose", "s-hydrangea",
    "s-sunflower", "s-morning_glory", "s-cosmos", "s-osmanthus", "s-chrysanthemum", "s-cyclamen",
  ],
};

test("season-linked garden ids (RARE4/RARE8) stay pinned to their rank, per D-032", () => {
  for (const [rarityKey, ids] of Object.entries(SEASON_DROPS_BY_RARITY)) {
    const rarity = Number(rarityKey);
    assert.equal(ids.length, rarity === 4 ? 48 : 12, `RARE${rarity} garden id count`);
    for (const id of ids) {
      const drop = getDropById(id);
      assert.ok(drop, `expected garden drop ${id} to exist`);
      assert.equal(drop.rarity, rarity, `${id} must stay RARE${rarity}`);
      assert.equal(drop.region, "garden", `${id} must stay in the garden region`);
    }
  }
});

test("every RARE4 entry carries a month so seasonal weighting applies", () => {
  for (const drop of POOL_BY_RARITY[4]) {
    assert.ok(
      Number.isInteger(drop.month) && drop.month >= 1 && drop.month <= 12,
      `${drop.id} needs a month for current-month weighting`
    );
  }
});

test("every catalog entry is actually reachable from pickDrop", () => {
  // A weighting bug (or a pool whose entries are shadowed) would leave items
  // permanently unobtainable — invisible in tests that only check bounds.
  const month = 7;
  for (let rarity = 1; rarity <= 8; rarity++) {
    const pool = POOL_BY_RARITY[rarity];
    const seen = new Set();
    const steps = pool.length * 500;
    for (let i = 0; i < steps; i++) {
      seen.add(pickDrop(() => i / steps, rarity, month).id);
    }
    assert.equal(
      seen.size,
      pool.length,
      `rank ${rarity}: ${pool.length - seen.size} entries are unreachable`
    );
  }
});

/** Deterministic PRNG so the simulation is reproducible across runs. */
function mulberry32(seed) {
  return function rng() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Replays the reward loop the way rewardDb.grantDropForTask does it:
 * rollsSinceSsr counts rolls after the most recent RARE8, and the first roll
 * of each local day is floored to RARE4.
 */
function simulate({ days, perDay, seed = 1 }) {
  const rng = mulberry32(seed);
  const history = [];
  let lastSsrIndex = -1;

  for (let day = 0; day < days; day++) {
    // Walk the calendar so seasonal weighting shifts month to month.
    const date = new Date(2026, 0, 1 + day);
    const month = date.getMonth() + 1;

    for (let n = 0; n < perDay; n++) {
      const rollsSinceSsr =
        lastSsrIndex < 0 ? history.length : history.length - 1 - lastSsrIndex;
      // Rolls the pity rule forced to RARE8, and rolls the first-of-day floor
      // lifted, are not samples of RARITY_RATES — track them so the
      // distribution check can look at the freely-rolled ones only.
      const pityForced = rollsSinceSsr >= PITY_LIMIT;
      const rarity = decideRarity(rng, { rollsSinceSsr, isFirstOfDay: n === 0 });
      const drop = pickDrop(rng, rarity, month);
      history.push({ rarity, id: drop.id, day, isFirstOfDay: n === 0, pityForced });
      if (rarity === 8) lastSsrIndex = history.length - 1;
    }
  }
  return history;
}

test("simulation: three years of daily use never violates the reward rules", () => {
  const days = 365 * 3;
  const perDay = 4;
  const history = simulate({ days, perDay });
  assert.equal(history.length, days * perDay);

  // Every roll resolves to a real catalog entry.
  for (const entry of history) {
    const drop = getDropById(entry.id);
    assert.ok(drop, `rolled id ${entry.id} must resolve`);
    assert.equal(drop.rarity, entry.rarity);
  }

  // The first roll of every day is floored to RARE4 or better.
  for (const entry of history) {
    if (entry.isFirstOfDay) {
      assert.ok(entry.rarity >= 4, `first roll of day ${entry.day} was RARE${entry.rarity}`);
    }
  }

  // Pity: the gap between RARE8s can never exceed PITY_LIMIT + 1 rolls.
  let previousSsr = -1;
  for (let i = 0; i < history.length; i++) {
    if (history[i].rarity !== 8) continue;
    if (previousSsr >= 0) {
      assert.ok(
        i - previousSsr <= PITY_LIMIT + 1,
        `RARE8 gap of ${i - previousSsr} exceeded the pity limit`
      );
    }
    previousSsr = i;
  }

  // Every rank actually shows up over three years.
  const byRarity = new Map();
  for (const entry of history) {
    byRarity.set(entry.rarity, (byRarity.get(entry.rarity) ?? 0) + 1);
  }
  for (let rarity = 1; rarity <= 8; rarity++) {
    assert.ok(byRarity.get(rarity) > 0, `rank ${rarity} never dropped in 3 years`);
  }
});

test("simulation: long-term variety is high enough to stay interesting", () => {
  // A year of use should not exhaust the catalog, and no single item should
  // dominate what the user sees.
  const history = simulate({ days: 365, perDay: 4 });
  const counts = new Map();
  for (const entry of history) {
    counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
  }

  const distinct = counts.size;
  assert.ok(
    distinct >= 150,
    `a year of use should surface many distinct materials, saw ${distinct}`
  );

  // No single non-seasonal item should be more than ~8% of all rolls.
  const mostCommon = Math.max(...counts.values());
  assert.ok(
    mostCommon / history.length < 0.08,
    `one item was ${((mostCommon / history.length) * 100).toFixed(1)}% of all rolls`
  );
});

test("simulation: rarity distribution stays close to the published rates", () => {
  const history = simulate({ days: 2000, perDay: 6, seed: 7 });
  // Only rolls that actually sampled RARITY_RATES: the first-of-day floor
  // lifts sub-RARE4 results, and pity overrides the roll entirely, so
  // including either would understate every low rank.
  const rolls = history.filter((entry) => !entry.isFirstOfDay && !entry.pityForced);
  const expected = { 8: 0.025, 7: 0.035, 6: 0.06, 5: 0.09, 4: 0.12, 3: 0.17, 2: 0.22, 1: 0.28 };

  for (const [rarity, rate] of Object.entries(expected)) {
    const hits = rolls.filter((entry) => entry.rarity === Number(rarity)).length;
    const observed = hits / rolls.length;
    assert.ok(
      Math.abs(observed - rate) < 0.02,
      `RARE${rarity} observed ${observed.toFixed(3)} vs expected ${rate}`
    );
  }
});

test("simulation: pity meaningfully lifts the effective RARE8 rate", () => {
  // The player-facing rate is higher than the 2.5% base because pity tops it
  // up; this pins that the safety net is actually doing something.
  const history = simulate({ days: 2000, perDay: 6, seed: 7 });
  const ssr = history.filter((entry) => entry.rarity === 8).length;
  const effective = ssr / history.length;
  assert.ok(effective > 0.025, `effective RARE8 rate ${effective.toFixed(3)} should exceed the 2.5% base`);
  assert.ok(effective < 0.15, `effective RARE8 rate ${effective.toFixed(3)} is implausibly high`);
});

test("simulation: a brand-new user's first day feels rewarding", () => {
  // Fresh install, no history: the very first completion must not be a RARE1,
  // and the first day should not be a wall of identical commons.
  for (let seed = 1; seed <= 50; seed++) {
    const firstDay = simulate({ days: 1, perDay: 5, seed });
    assert.ok(firstDay[0].rarity >= 4, `seed ${seed}: first ever roll was RARE${firstDay[0].rarity}`);
    for (const entry of firstDay) {
      assert.ok(getDropById(entry.id), `seed ${seed}: ${entry.id} resolves`);
    }
  }
});
