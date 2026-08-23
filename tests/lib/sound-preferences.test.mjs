import test from "node:test";
import assert from "node:assert/strict";
import {
  isHapticEnabled,
  isSoundEnabled,
  setHapticEnabled,
  setSoundEnabled,
} from "../../src/lib/sound.ts";

const values = new Map();
globalThis.localStorage = {
  getItem(key) {
    return values.get(key) ?? null;
  },
  setItem(key, value) {
    values.set(key, String(value));
  },
};

test("sound and haptic preferences can be changed independently", () => {
  values.clear();
  setSoundEnabled(false);
  setHapticEnabled(true);
  assert.equal(isSoundEnabled(), false);
  assert.equal(isHapticEnabled(), true);

  setSoundEnabled(true);
  setHapticEnabled(false);
  assert.equal(isSoundEnabled(), true);
  assert.equal(isHapticEnabled(), false);
});

test("the retired combined preference migrates lazily into both settings", () => {
  values.clear();
  values.set("fx-enabled", "0");
  assert.equal(isSoundEnabled(), false);
  assert.equal(isHapticEnabled(), false);
  assert.equal(values.get("sound-enabled"), "0");
  assert.equal(values.get("haptic-enabled"), "0");
});
