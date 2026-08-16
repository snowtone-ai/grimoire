import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FX_INTENSITY,
  FX_INTENSITIES,
  FX_INTENSITY_LABELS,
  fxProfile,
  parseIntensity,
  resolveIntensity,
} from "../../../src/lib/domain/fx.ts";

test("every intensity produces a profile", () => {
  for (const intensity of FX_INTENSITIES) {
    const profile = fxProfile(intensity);
    assert.equal(typeof profile.microFeedback, "boolean");
    assert.equal(typeof profile.confettiWaves, "number");
    assert.equal(typeof profile.confettiScale, "number");
    assert.equal(typeof profile.celebrationScale, "number");
    assert.equal(typeof profile.morningAmbience, "boolean");
  }
});

test("profiles are monotonic in loudness across quiet -> normal -> lively", () => {
  const [quiet, normal, lively] = FX_INTENSITIES.map(fxProfile);

  assert.ok(quiet.confettiWaves <= normal.confettiWaves);
  assert.ok(normal.confettiWaves <= lively.confettiWaves);

  assert.ok(quiet.celebrationScale <= normal.celebrationScale);
  assert.ok(normal.celebrationScale <= lively.celebrationScale);
});

test("quiet produces no confetti at all", () => {
  const profile = fxProfile("quiet");
  assert.equal(profile.confettiWaves, 0);
  assert.equal(profile.confettiScale, 0);
});

test("morning ambience is lively-only", () => {
  assert.equal(fxProfile("quiet").morningAmbience, false);
  assert.equal(fxProfile("normal").morningAmbience, false);
  assert.equal(fxProfile("lively").morningAmbience, true);
});

test("parseIntensity accepts exactly the three literals", () => {
  assert.equal(parseIntensity("quiet"), "quiet");
  assert.equal(parseIntensity("normal"), "normal");
  assert.equal(parseIntensity("lively"), "lively");
});

test("parseIntensity rejects garbage", () => {
  for (const garbage of [undefined, null, "", "loud", 3, {}]) {
    assert.equal(parseIntensity(garbage), null);
  }
});

test("resolveIntensity forces quiet when reducedMotion is true, even if lively is stored", () => {
  assert.equal(resolveIntensity("lively", true), "quiet");
  assert.equal(resolveIntensity("normal", true), "quiet");
  assert.equal(resolveIntensity(null, true), "quiet");
});

test("resolveIntensity falls back to the default for absent/garbage stored values", () => {
  assert.equal(resolveIntensity(null, false), DEFAULT_FX_INTENSITY);
  assert.equal(resolveIntensity(undefined, false), DEFAULT_FX_INTENSITY);
  assert.equal(resolveIntensity("loud", false), DEFAULT_FX_INTENSITY);
  assert.equal(resolveIntensity(42, false), DEFAULT_FX_INTENSITY);
});

test("resolveIntensity honors a valid stored value when reducedMotion is false", () => {
  assert.equal(resolveIntensity("lively", false), "lively");
  assert.equal(resolveIntensity("quiet", false), "quiet");
});

test("FX_INTENSITY_LABELS has an entry for every intensity", () => {
  for (const intensity of FX_INTENSITIES) {
    const entry = FX_INTENSITY_LABELS[intensity];
    assert.ok(entry, `missing label for ${intensity}`);
    assert.equal(typeof entry.label, "string");
    assert.ok(entry.label.length > 0);
    assert.equal(typeof entry.description, "string");
    assert.ok(entry.description.length > 0);
  }
});
