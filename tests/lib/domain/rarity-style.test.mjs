import test from "node:test";
import assert from "node:assert/strict";
import { RARITY_STYLE, rarityBand, rarityStyle } from "../../../src/lib/domain/rarity-style.ts";

const HEX = /^#[0-9a-f]{6}$/i;

test("all 8 ranks are present", () => {
  for (let rarity = 1; rarity <= 8; rarity++) {
    assert.ok(RARITY_STYLE[rarity], `missing rank ${rarity}`);
  }
});

test("every rank has a valid hex color", () => {
  for (let rarity = 1; rarity <= 8; rarity++) {
    assert.match(RARITY_STYLE[rarity].color, HEX);
  }
});

test("dwell duration is non-decreasing across the ladder", () => {
  for (let rarity = 2; rarity <= 8; rarity++) {
    assert.ok(RARITY_STYLE[rarity].duration >= RARITY_STYLE[rarity - 1].duration);
  }
});

test("rarityStyle falls back to rank 1 for an unknown rank", () => {
  assert.deepEqual(rarityStyle(99), RARITY_STYLE[1]);
  assert.deepEqual(rarityStyle(0), RARITY_STYLE[1]);
});

test("rarityBand buckets low(1-3)/mid(4-6)/high(7-8)", () => {
  for (const rarity of [1, 2, 3]) assert.equal(rarityBand(rarity), "low");
  for (const rarity of [4, 5, 6]) assert.equal(rarityBand(rarity), "mid");
  for (const rarity of [7, 8]) assert.equal(rarityBand(rarity), "high");
});
