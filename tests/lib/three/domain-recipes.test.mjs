import test from "node:test";
import assert from "node:assert/strict";
import {
  RECIPE_IDS,
  pickRecipe,
  randomRecipe,
  tierOfRarity,
} from "../../../src/lib/three/domain-recipes.ts";

test("tierOfRarity mirrors sound.ts's playClear bucketing (1-3/4-6/7-8)", () => {
  for (let rarity = 1; rarity <= 3; rarity++) assert.equal(tierOfRarity(rarity), "low");
  for (let rarity = 4; rarity <= 6; rarity++) assert.equal(tierOfRarity(rarity), "mid");
  for (let rarity = 7; rarity <= 8; rarity++) assert.equal(tierOfRarity(rarity), "high");
});

test("pickRecipe resolves a valid recipe for every domain across every rarity", () => {
  const domains = ["embercinder", "hollowmire", "thornveil", undefined];
  for (const domain of domains) {
    for (let rarity = 1; rarity <= 8; rarity++) {
      const recipe = pickRecipe(domain, rarity);
      assert.ok(RECIPE_IDS.includes(recipe), `domain=${domain} rarity=${rarity} -> ${recipe}`);
    }
  }
});

test("pickRecipe is deterministic per (domain, rarity) pair", () => {
  assert.equal(pickRecipe("embercinder", 1), pickRecipe("embercinder", 1));
  assert.equal(pickRecipe(undefined, 5), pickRecipe(undefined, 5));
});

test("pickRecipe honors an explicit effect override when valid", () => {
  assert.equal(pickRecipe("embercinder", 1, "void"), "void");
});

test("pickRecipe ignores an invalid effect override and falls back", () => {
  assert.equal(pickRecipe("embercinder", 1, "not-a-real-recipe"), pickRecipe("embercinder", 1));
});

test("legacy items (no domain) get a recipe purely from rarity tier", () => {
  assert.equal(pickRecipe(undefined, 2), pickRecipe(undefined, 3));
  assert.equal(pickRecipe(undefined, 5), pickRecipe(undefined, 6));
  assert.equal(pickRecipe(undefined, 7), pickRecipe(undefined, 8));
});

test("randomRecipe always returns a valid recipe id across the full rng range", () => {
  const samples = [0, 0.01, 0.2, 0.4, 0.5, 0.6, 0.8, 0.99, 0.999999];
  for (const value of samples) {
    const recipe = randomRecipe(() => value);
    assert.ok(RECIPE_IDS.includes(recipe), `rng=${value} -> ${recipe}`);
  }
});
