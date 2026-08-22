import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import {
  ALL_CLEAR_SCENE,
  ALL_VFX_TEXTURES,
  clearScene,
  FLOURISH_SCENE,
  MORNING_SCENE,
  pageScene,
  RARITY_TINT,
  replayScene,
  TAP_SCENE,
} from "../../../src/lib/domain/vfx-scenes.ts";

const SCENES = {
  TAP_SCENE,
  ALL_CLEAR_SCENE,
  FLOURISH_SCENE,
  MORNING_SCENE,
  PAGE_HOME: pageScene("/"),
  PAGE_CALENDAR: pageScene("/all"),
  PAGE_LAB: pageScene("/plant"),
  PAGE_RECORD: pageScene("/book"),
  REPLAY_SCENE: replayScene(),
  CLEAR_LOW: clearScene(1),
  CLEAR_MID: clearScene(5),
  CLEAR_HIGH: clearScene(8),
};

/* Same reason as the sound-cue test: a texture name that does not resolve draws
 * nothing at all, and nothing about that failure is visible except the effect
 * quietly not happening. */
test("every texture a scene references exists under public/vfx", () => {
  for (const name of ALL_VFX_TEXTURES) {
    const path = new URL(`../../../public/vfx/${name}`, import.meta.url);
    assert.ok(existsSync(path), `missing texture: public/vfx/${name}`);
    assert.ok(statSync(path).size > 0, `empty texture: public/vfx/${name}`);
  }
});

test("ALL_VFX_TEXTURES covers every scene, with no duplicates", () => {
  const used = new Set(
    Object.values(SCENES).flatMap((scene) => scene.emitters.map((emitter) => emitter.texture))
  );
  assert.deepEqual([...ALL_VFX_TEXTURES].sort(), [...used].sort());
  assert.equal(ALL_VFX_TEXTURES.length, new Set(ALL_VFX_TEXTURES).size, "duplicate entries");
});

test("every emitter is well formed", () => {
  for (const [name, scene] of Object.entries(SCENES)) {
    assert.ok(scene.emitters.length > 0, `${name} has no emitters`);
    for (const emitter of scene.emitters) {
      const where = `${name}/${emitter.texture}`;
      assert.ok(emitter.count > 0, `${where}: count must be positive`);
      assert.ok(emitter.delayMs >= 0, `${where}: negative delay`);
      assert.ok(emitter.opacity > 0 && emitter.opacity <= 1, `${where}: opacity out of range`);
      for (const [key, range] of Object.entries({
        size: emitter.size,
        speed: emitter.speed,
        life: emitter.life,
        spin: emitter.spin,
      })) {
        assert.equal(range.length, 2, `${where}: ${key} must be [min, max]`);
        assert.ok(range[0] <= range[1], `${where}: ${key} min exceeds max`);
      }
      assert.ok(emitter.life[0] > 0, `${where}: zero-length life`);
      assert.ok(emitter.spread >= 0 && emitter.spread <= 180, `${where}: spread out of range`);
    }
  }
});

test("a scene fires the moment it is asked to, except the one that is choreographed", () => {
  for (const [name, scene] of Object.entries(SCENES)) {
    const earliest = Math.min(...scene.emitters.map((emitter) => emitter.delayMs));
    if (name === "FLOURISH_SCENE") {
      // The single deliberate exception: the app-open flourish is fired at the
      // same instant the overlay mounts, but its summoning circle is timed to
      // open *after* the gold frame has drawn itself in (open-flourish.tsx's
      // 0.3s stroke delay). Starting at 0 would put the particles in front of
      // an empty frame. Kept under half a second so it still reads as one
      // continuous moment rather than two.
      assert.ok(earliest > 0 && earliest < 500, `flourish lead-in is ${earliest}ms`);
      continue;
    }
    assert.equal(earliest, 0, `${name} does not start until ${earliest}ms`);
  }
});

test("the RARE ladder ascends: each band adds particles and a layer, never fewer", () => {
  const total = (scene) =>
    scene.emitters.reduce((sum, emitter) => sum + emitter.count, 0);
  const low = clearScene(1);
  const mid = clearScene(5);
  const high = clearScene(8);

  assert.ok(total(low) < total(mid), "mid should be denser than low");
  assert.ok(total(mid) < total(high), "high should be denser than mid");
  assert.ok(
    low.emitters.length < mid.emitters.length,
    "mid should add a layer low does not have"
  );
  assert.ok(
    mid.emitters.length < high.emitters.length,
    "high should add a layer mid does not have"
  );
  // The summoning circle is what makes RARE 7-8 a different event, not a
  // louder one. If it ever appears in a lower band, that distinction is gone.
  const usesArcane = (scene) =>
    scene.emitters.some((emitter) => emitter.texture === "arcane-circle.png");
  assert.equal(usesArcane(low), false);
  assert.equal(usesArcane(mid), false);
  assert.equal(usesArcane(high), true);
});

test("replay is shaped unlike a clear: nothing is launched, nothing falls", () => {
  for (const emitter of replayScene().emitters) {
    assert.notEqual(emitter.motion, "burst", "a replay must not read as a completion burst");
    assert.equal(emitter.gravity, 0, "nothing in a replay should fall");
  }
  assert.ok(
    clearScene(8).emitters.some((emitter) => emitter.motion === "burst"),
    "a clear must still burst, or the contrast this test protects is meaningless"
  );
});

test("the tap spark stays cheap enough to fire on every single press", () => {
  const count = TAP_SCENE.emitters.reduce((sum, emitter) => sum + emitter.count, 0);
  const longest = Math.max(
    ...TAP_SCENE.emitters.map((emitter) => emitter.delayMs + emitter.life[1])
  );
  assert.ok(count <= 10, `tap spawns ${count} sprites; it fires on every press`);
  assert.ok(longest <= 600, `tap lasts ${longest}ms; it should be gone before the next press`);
  assert.equal(TAP_SCENE.origin, "point", "the tap spark must follow the finger");
});

test("only scenes with a rarity to reflect use the rarity tint", () => {
  const tinted = Object.entries(SCENES)
    .filter(([, scene]) => scene.emitters.some((emitter) => emitter.color === RARITY_TINT))
    .map(([name]) => name)
    .sort();
  assert.deepEqual(tinted, ["CLEAR_HIGH", "CLEAR_LOW", "CLEAR_MID", "REPLAY_SCENE"]);
});
