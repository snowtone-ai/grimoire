import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_EFFECT_PREFS,
  EFFECT_KEYS,
  EFFECT_LABELS,
  EFFECT_SECTIONS,
  resolveEffect,
} from "../../../src/lib/domain/fx.ts";

test("every effect key has a boolean default", () => {
  for (const key of EFFECT_KEYS) {
    assert.equal(typeof DEFAULT_EFFECT_PREFS[key], "boolean");
  }
});

test("every effect ships on by default (D-047, owner instruction)", () => {
  // Pinned deliberately rather than looped: flipping a default is a product
  // decision, and it should have to be made here as well as in the source.
  assert.equal(DEFAULT_EFFECT_PREFS.tapSpark, true);
  assert.equal(DEFAULT_EFFECT_PREFS.completion, true);
  assert.equal(DEFAULT_EFFECT_PREFS.morningGreeting, true);
  assert.equal(DEFAULT_EFFECT_PREFS.openFlourish, true);
  assert.equal(DEFAULT_EFFECT_PREFS.ambientParticles, true);
  assert.equal(DEFAULT_EFFECT_PREFS.pageTransitions, true);
});

test("an explicit off still beats the new on-by-default", () => {
  // The half of D-039 that D-047 did NOT change: turning something off has to
  // stick, or the per-effect switches are decoration.
  for (const key of EFFECT_KEYS) {
    assert.equal(resolveEffect(key, false, false), false, `${key} ignored an explicit off`);
  }
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

test("every effect key has exactly one settings-screen section, and vice versa", () => {
  for (const key of EFFECT_KEYS) {
    assert.ok(
      EFFECT_SECTIONS[key] === "basic" || EFFECT_SECTIONS[key] === "more",
      `missing/invalid section for ${key}`
    );
  }
  assert.equal(
    Object.keys(EFFECT_SECTIONS).length,
    EFFECT_KEYS.length,
    "EFFECT_SECTIONS has an entry for a key that no longer exists, or is missing one"
  );
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
