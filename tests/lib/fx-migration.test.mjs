/* The defaults-on migration (D-047).
 *
 * This is the one part of the effects rebuild that can silently change what an
 * existing user sees without them touching anything, so it gets real tests
 * against a real storage shim rather than a reading of the code.
 *
 * The trap this pins: the D-039 migration shipped 2026-08-17, wrote three of
 * the six keys, and then deleted `fx-intensity`. So by the time defaults
 * flipped to on, every real user had already run it — and any "fix" that keys
 * off the retired dial protects nobody, because the dial is gone. The backfill
 * has to key off the presence of the keys themselves.
 */

import test from "node:test";
import assert from "node:assert/strict";

const STORAGE_KEY = {
  tapSpark: "fx-tap-enabled",
  completion: "fx-completion-enabled",
  morningGreeting: "fx-morning-enabled",
  openFlourish: "fx-open-enabled",
  ambientParticles: "fx-particles-enabled",
  pageTransitions: "fx-transitions-enabled",
};
const ALL_KEYS = Object.keys(STORAGE_KEY);

function installStorage(initial) {
  const map = new Map(Object.entries(initial));
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  // prefersReducedMotion() reads window.matchMedia; without a window it
  // short-circuits to false, which is what we want for these cases.
  delete globalThis.window;
  return map;
}

/** A fresh copy of the module, because the migration is one-shot per load. */
let loads = 0;
async function loadFx() {
  return import(`../../src/lib/fx.ts?case=${loads++}`);
}

test("a brand-new user gets the new defaults-on experience", async () => {
  installStorage({});
  const fx = await loadFx();
  for (const key of ALL_KEYS) {
    assert.equal(fx.isEffectEnabled(key), true, `${key} should be on for a new user`);
  }
});

test("a D-039-migrated 'quiet' user keeps every effect off", async () => {
  // Exactly the state main leaves behind: three keys written, three untouched,
  // fx-intensity already removed.
  const map = installStorage({
    [STORAGE_KEY.tapSpark]: "0",
    [STORAGE_KEY.completion]: "0",
    [STORAGE_KEY.morningGreeting]: "0",
  });
  const fx = await loadFx();

  for (const key of ALL_KEYS) {
    assert.equal(
      fx.isEffectEnabled(key),
      false,
      `${key} switched itself on for a user who had turned everything off`
    );
  }
  // The three that were never a choice are now recorded, not merely inferred.
  assert.equal(map.get(STORAGE_KEY.openFlourish), "0");
  assert.equal(map.get(STORAGE_KEY.ambientParticles), "0");
  assert.equal(map.get(STORAGE_KEY.pageTransitions), "0");
});

test("a D-039-migrated 'lively' user keeps what they had, and gains nothing silently", async () => {
  installStorage({
    [STORAGE_KEY.tapSpark]: "1",
    [STORAGE_KEY.completion]: "1",
    [STORAGE_KEY.morningGreeting]: "1",
  });
  const fx = await loadFx();

  assert.equal(fx.isEffectEnabled("tapSpark"), true);
  assert.equal(fx.isEffectEnabled("completion"), true);
  assert.equal(fx.isEffectEnabled("morningGreeting"), true);
  // These three were off for them under D-039 (unset meant off), so they stay
  // off until the user asks for them in /settings.
  assert.equal(fx.isEffectEnabled("openFlourish"), false);
  assert.equal(fx.isEffectEnabled("ambientParticles"), false);
  assert.equal(fx.isEffectEnabled("pageTransitions"), false);
});

test("an explicit on for one of the new effects survives the backfill", async () => {
  installStorage({
    [STORAGE_KEY.tapSpark]: "0",
    [STORAGE_KEY.openFlourish]: "1",
  });
  const fx = await loadFx();
  assert.equal(fx.isEffectEnabled("openFlourish"), true, "the user asked for this one");
  assert.equal(fx.isEffectEnabled("tapSpark"), false);
  assert.equal(fx.isEffectEnabled("ambientParticles"), false);
});

test("a user still on the retired dial is migrated by intensity, not zeroed by the backfill", async () => {
  // Someone who has not opened the app since before 2026-08-17.
  const map = installStorage({ "fx-intensity": "lively" });
  const fx = await loadFx();

  assert.equal(fx.isEffectEnabled("tapSpark"), true);
  assert.equal(fx.isEffectEnabled("completion"), true);
  assert.equal(fx.isEffectEnabled("morningGreeting"), true, "'lively' had the morning greeting");
  assert.equal(fx.isEffectEnabled("openFlourish"), true, "'lively' means effects are wanted");
  assert.equal(map.has("fx-intensity"), false, "the retired dial should be cleaned up");
});

test("a 'quiet' user still on the retired dial does not get the new effects", async () => {
  installStorage({ "fx-intensity": "quiet" });
  const fx = await loadFx();
  for (const key of ALL_KEYS) {
    assert.equal(fx.isEffectEnabled(key), false, `${key} came on for a 'quiet' user`);
  }
});

test("the backfill runs once and does not re-zero a later opt-in", async () => {
  installStorage({ [STORAGE_KEY.tapSpark]: "0" });
  const fx = await loadFx();

  assert.equal(fx.isEffectEnabled("pageTransitions"), false);
  fx.setEffectEnabled("pageTransitions", true);
  assert.equal(fx.isEffectEnabled("pageTransitions"), true);
  // ...and it stays on across the reads that follow, i.e. the migration is not
  // re-deciding on every access.
  assert.equal(fx.isEffectEnabled("pageTransitions"), true);
  assert.equal(fx.getStoredEffectPref("pageTransitions"), true);
});

test("setEffectEnabled on a fresh install does not trip the backfill into zeroing the rest", async () => {
  // The ordering hazard: if writing a key ran before the backfill decided
  // whether this user has history, that write would look like history and
  // switch every other effect off.
  installStorage({});
  const fx = await loadFx();

  fx.setEffectEnabled("tapSpark", false);
  assert.equal(fx.isEffectEnabled("tapSpark"), false);
  assert.equal(fx.isEffectEnabled("completion"), true, "a new user's other effects stay on");
  assert.equal(fx.isEffectEnabled("pageTransitions"), true);
});
