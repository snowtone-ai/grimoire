import test from "node:test";
import assert from "node:assert/strict";
import {
  MANA_ORB_PARAMS,
  MAX_ORB_STEP,
  createOrbMotion,
  pressDirection,
  pressImpulse,
  stepOrbMotion,
} from "../../../src/lib/domain/mana-orb.ts";

/** One frame at a steady 60fps. */
const FRAME = 1 / 60;

function run(motion, input, frames, dt = FRAME) {
  let current = motion;
  for (let i = 0; i < frames; i++) current = stepOrbMotion(current, input, dt);
  return current;
}

const HELD = { pressing: true, pointerX: 0, pointerY: 0 };
const RELEASED = { pressing: false, pointerX: 0, pointerY: 0 };

test("ships the exact parameter set the owner approved", () => {
  // These are a signed-off design, not defaults. If a change to the orb needs
  // different numbers, that is a new decision and this assertion moves with it.
  assert.deepEqual(
    { ...MANA_ORB_PARAMS, tint: [...MANA_ORB_PARAMS.tint] },
    {
      density: 0,
      core: 1.5,
      hueBase: 0.8,
      hueSpan: 1.5,
      ior: 1.8,
      disp: 0.15,
      film: 2.5,
      tint: [0.88, 1.0, 1.22],
      amp: 0.12,
      k: 203,
      c: 5,
      clarity: 0,
      wobble: 0.79,
      squish: 1,
    }
  );
});

test("a released orb settles back to rest", () => {
  const settled = run(pressImpulse(createOrbMotion(), MANA_ORB_PARAMS), RELEASED, 240);
  assert.ok(Math.abs(settled.squash) < 0.001, `squash left at ${settled.squash}`);
  assert.ok(Math.abs(settled.squashV) < 0.01, `velocity left at ${settled.squashV}`);
  assert.ok(settled.pressAmt < 0.001, `press weight left at ${settled.pressAmt}`);
});

test("the press overshoots before settling, which is the squish", () => {
  // A critically damped spring would reach the target and stop; the point of
  // this one is that it goes past and comes back.
  const target = MANA_ORB_PARAMS.amp * (0.35 + MANA_ORB_PARAMS.squish * 0.9);
  let motion = pressImpulse(createOrbMotion(), MANA_ORB_PARAMS);
  let peak = 0;
  for (let i = 0; i < 120; i++) {
    motion = stepOrbMotion(motion, HELD, FRAME);
    peak = Math.max(peak, motion.squash);
  }
  assert.ok(peak > target * 1.1, `peak ${peak} never passed target ${target}`);
  assert.ok(Math.abs(motion.squash - target) < 0.005, `held squash drifted to ${motion.squash}`);
});

test("the spring stays inside its clamp at the largest accepted step", () => {
  // Explicit Euler is only conditionally stable, and the frame gap after a
  // backgrounded tab is exactly where it would blow up. Nothing may leave the
  // range the shader's SDF can represent.
  let motion = createOrbMotion();
  for (let i = 0; i < 600; i++) {
    motion = pressImpulse(motion, MANA_ORB_PARAMS);
    motion = stepOrbMotion(motion, i % 2 === 0 ? HELD : RELEASED, MAX_ORB_STEP);
    assert.ok(Number.isFinite(motion.squash) && Number.isFinite(motion.squashV));
    assert.ok(motion.squash <= 0.48 && motion.squash >= -0.42, `squash ${motion.squash}`);
  }
});

test("an oversized frame gap is clamped rather than integrated", () => {
  const start = pressImpulse(createOrbMotion(), MANA_ORB_PARAMS);
  assert.deepEqual(
    stepOrbMotion(start, HELD, 4),
    stepOrbMotion(start, HELD, MAX_ORB_STEP),
    "a multi-second gap must behave exactly like one clamped step"
  );
});

test("the interior lags the pointer instead of tracking it", () => {
  // The whole mass trailing the finger is the effect; an instantaneous match
  // would read as a texture pinned to the cursor.
  const moved = run(createOrbMotion(), { pressing: false, pointerX: 1, pointerY: 0 }, 1);
  assert.ok(moved.sloshX > 0, "slosh did not start moving toward the pointer");
  assert.ok(moved.sloshX < 0.34 * 0.5, `slosh jumped straight to ${moved.sloshX}`);

  const arrived = run(createOrbMotion(), { pressing: false, pointerX: 1, pointerY: 0 }, 300);
  assert.ok(Math.abs(arrived.sloshX - 0.34) < 0.01, `slosh settled at ${arrived.sloshX}`);
});

test("the press direction is a unit vector anywhere the finger can land", () => {
  for (const [x, y] of [
    [0, 0],
    [1, 0],
    [-1, -1],
    [1.6, 1.6],
    [-1.6, 0.4],
  ]) {
    const [dx, dy, dz] = pressDirection(x, y);
    assert.ok(Number.isFinite(dx) && Number.isFinite(dy) && Number.isFinite(dz), `${x},${y}`);
    assert.ok(Math.abs(Math.hypot(dx, dy, dz) - 1) < 1e-9, `not normalised at ${x},${y}`);
    assert.ok(dz > 0, `dent pushed through the back of the sphere at ${x},${y}`);
  }
});
