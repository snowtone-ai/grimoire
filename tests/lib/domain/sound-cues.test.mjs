import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import {
  ALL_CUE_SOURCES,
  clearAction,
  PAGE_ACTION,
  SOUND_CUES,
  STARTUP_FLOURISH,
} from "../../../src/lib/domain/sound-cues.ts";

/* The check this file exists for: a cue whose `src` does not name a real file
 * fails silently at runtime — the sampler logs, and the user just gets no
 * sound. Every asset path is verified against the filesystem here so a rename
 * or a typo is a red build instead of a feature that quietly stopped working. */
test("every cue source names a file that actually exists under public/audio", () => {
  for (const src of ALL_CUE_SOURCES) {
    const path = new URL(`../../../public/audio/${src}`, import.meta.url);
    assert.ok(existsSync(path), `missing audio asset: public/audio/${src}`);
    assert.ok(statSync(path).size > 0, `empty audio asset: public/audio/${src}`);
  }
});

test("ALL_CUE_SOURCES is the deduplicated union of every step's source", () => {
  const fromMap = new Set(
    Object.values(SOUND_CUES).flatMap((cue) => cue.steps.map((step) => step.src))
  );
  assert.deepEqual([...ALL_CUE_SOURCES].sort(), [...fromMap].sort());
  assert.equal(ALL_CUE_SOURCES.length, new Set(ALL_CUE_SOURCES).size, "duplicate entries");
});

test("every cue has at least one step, and every step is well formed", () => {
  for (const [action, cue] of Object.entries(SOUND_CUES)) {
    assert.ok(cue.steps.length > 0, `${action} has no steps`);
    for (const step of cue.steps) {
      assert.match(step.src, /^(ui|cues)\/[a-z0-9_-]+\.wav$/, `${action}: odd src ${step.src}`);
      assert.ok(step.gain > 0 && step.gain <= 1, `${action}: gain out of range (${step.gain})`);
      assert.ok(step.delayMs >= 0, `${action}: negative delay`);
    }
  }
});

test("a multi-step cue's steps are ordered, so the first step is the moment's start", () => {
  for (const [action, cue] of Object.entries(SOUND_CUES)) {
    const delays = cue.steps.map((step) => step.delayMs);
    assert.deepEqual(delays, [...delays].sort((a, b) => a - b), `${action}: steps out of order`);
    assert.equal(delays[0], 0, `${action}: first step should start the cue`);
  }
});

test("the sound budget holds: layering is the exception, not the rule", () => {
  const layered = Object.entries(SOUND_CUES).filter(([, cue]) => cue.steps.length > 1);
  assert.deepEqual(
    layered.map(([action]) => action).sort(),
    ["add", "clearHigh", "flourish"],
    "a new layered cue was added; confirm it is a genuinely compound moment (D-047)"
  );
});

test("startup flourish is one verified file with exact visual beat markers", () => {
  assert.deepEqual(STARTUP_FLOURISH.markersMs, {
    clasp: 0,
    bookOpen: 200,
    lightRise: 400,
  });
  assert.equal(
    ALL_CUE_SOURCES.includes(STARTUP_FLOURISH.src),
    false,
    "a startup-only file must not be fetched by the post-gesture sampler warm-up"
  );

  const manifest = JSON.parse(
    readFileSync(new URL("../../../public/audio/cues/manifest.json", import.meta.url), "utf8")
  );
  const entry = manifest.files.find((file) => file.file === "startup-flourish.wav");
  assert.ok(entry, "startup mix is missing from the audio manifest");
  assert.deepEqual(entry.markersMs, STARTUP_FLOURISH.markersMs);
  assert.equal(entry.durationMs, STARTUP_FLOURISH.durationMs);

  const startupBytes = readFileSync(
    new URL("../../../public/audio/cues/startup-flourish.wav", import.meta.url)
  );
  assert.equal(createHash("sha256").update(startupBytes).digest("hex"), entry.sha256);

  for (const source of entry.sourceMix) {
    const sourceBytes = readFileSync(
      new URL(`../../../public/audio/cues/${source.file}`, import.meta.url)
    );
    assert.equal(
      createHash("sha256").update(sourceBytes).digest("hex"),
      source.sha256,
      `${source.file}: startup source changed without rebuilding the exact mix`
    );
  }
});

test("every sound action has a short, bounded haptic pattern", () => {
  for (const [action, cue] of Object.entries(SOUND_CUES)) {
    assert.notEqual(cue.haptic, null, `${action} has no haptic coverage`);
    const pattern = Array.isArray(cue.haptic) ? cue.haptic : [cue.haptic];
    assert.ok(pattern.length <= 5, `${action}: haptic pattern is too long`);
    assert.equal(pattern.length % 2, 1, `${action}: haptic pattern must end with a pulse`);
    assert.ok(
      pattern.every((value) => Number.isInteger(value) && value >= 0 && value <= 100),
      `${action}: haptic values must be short, non-negative integers`,
    );
    assert.ok(
      pattern.filter((_, index) => index % 2 === 0).every((value) => value > 0),
      `${action}: every vibration pulse must be positive`,
    );
    assert.ok(
      pattern.filter((_, index) => index % 2 === 0).reduce((total, value) => total + value, 0) <= 100,
      `${action}: total vibration time is too long`,
    );
    assert.ok(
      pattern.reduce((total, value) => total + value, 0) <= 240,
      `${action}: haptic pattern is too long overall`,
    );
  }
});

test("haptic patterns preserve the meaning of their action", () => {
  const pattern = (action) => JSON.stringify(SOUND_CUES[action].haptic);
  assert.notEqual(pattern("tap"), pattern("toggle"), "selection and toggle should differ");
  assert.notEqual(pattern("modalOpen"), pattern("modalClose"), "open and close should differ");
  assert.notEqual(pattern("pageHome"), pattern("add"), "navigation and add should differ");
  assert.notEqual(pattern("save"), pattern("undo"), "save and undo should differ");
  assert.notEqual(pattern("error"), pattern("clearMid"), "error and reward should differ");
  assert.notEqual(pattern("bounty"), pattern("clearMid"), "reward actions should differ");
  assert.ok(
    new Set(Object.values(SOUND_CUES).map((cue) => JSON.stringify(cue.haptic))).size >= 8,
    "meaningful actions should not collapse to one generic haptic",
  );
});

test("clearAction walks the RARE 1-8 ladder without gaps or repeats out of order", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 8].map(clearAction),
    [
      "clearLow",
      "clearLow",
      "clearLow",
      "clearMid",
      "clearMid",
      "clearMid",
      "clearHigh",
      "clearHigh",
    ]
  );
});

test("the reward ladder gets longer as rank rises, never shorter", () => {
  // Recognition, not novelty: the same pizzicato motif extended. The assets are
  // fixed-length files, so "extended" has to be asserted against the manifest.
  const manifest = JSON.parse(
    readFileSync(new URL("../../../public/audio/cues/manifest.json", import.meta.url), "utf8")
  );
  const ms = (file) => manifest.files.find((entry) => entry.file === file).durationMs;
  assert.ok(ms("clear-low.wav") < ms("clear-mid.wav"));
  assert.ok(ms("clear-mid.wav") < ms("clear-high.wav"));
  assert.ok(ms("clear-high.wav") < ms("fanfare.wav"), "the once-a-day cue should be the longest");
});

test("every navigation tab has an arrival cue, and they are all distinct", () => {
  const paths = ["/", "/all", "/plant", "/book"];
  const actions = paths.map((path) => PAGE_ACTION[path]);
  for (const [i, action] of actions.entries()) {
    assert.ok(action, `no arrival cue for ${paths[i]}`);
    assert.ok(SOUND_CUES[action], `${paths[i]} points at an action with no cue`);
  }
  assert.equal(new Set(actions).size, paths.length, "two tabs share an arrival cue");
});
