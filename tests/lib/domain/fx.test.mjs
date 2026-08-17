import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_EFFECT_PREFS,
  EFFECT_KEYS,
  EFFECT_LABELS,
  resolveEffect,
} from "../../../src/lib/domain/fx.ts";

test("every effect key has a boolean default", () => {
  for (const key of EFFECT_KEYS) {
    assert.equal(typeof DEFAULT_EFFECT_PREFS[key], "boolean");
  }
});

test("the two pre-existing lightweight effects default on, the new heavier ones default off", () => {
  assert.equal(DEFAULT_EFFECT_PREFS.tapSpark, true);
  assert.equal(DEFAULT_EFFECT_PREFS.completion, true);
  assert.equal(DEFAULT_EFFECT_PREFS.morningGreeting, false);
  assert.equal(DEFAULT_EFFECT_PREFS.openFlourish, false);
  assert.equal(DEFAULT_EFFECT_PREFS.ambientParticles, false);
  assert.equal(DEFAULT_EFFECT_PREFS.pageTransitions, false);
});

test("resolveEffect forces every key off when reducedMotion is true, even if stored true", () => {
  for (const key of EFFECT_KEYS) {
    assert.equal(resolveEffect(key, true, true), false);
    assert.equal(resolveEffect(key, null, true), false);
  }
});

test("resolveEffect falls back to the key's own default for an absent stored value", () => {
  for (const key of EFFECT_KEYS) {
    assert.equal(resolveEffect(key, null, false), DEFAULT_EFFECT_PREFS[key]);
    assert.equal(resolveEffect(key, undefined, false), DEFAULT_EFFECT_PREFS[key]);
  }
});

test("resolveEffect honors an explicit stored value when reducedMotion is false", () => {
  assert.equal(resolveEffect("tapSpark", false, false), false);
  assert.equal(resolveEffect("openFlourish", true, false), true);
});

test("EFFECT_LABELS has a non-empty label and description for every key", () => {
  for (const key of EFFECT_KEYS) {
    const entry = EFFECT_LABELS[key];
    assert.ok(entry, `missing label for ${key}`);
    assert.equal(typeof entry.label, "string");
    assert.ok(entry.label.length > 0);
    assert.equal(typeof entry.description, "string");
    assert.ok(entry.description.length > 0);
  }
});
