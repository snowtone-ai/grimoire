/* Mana orb — the quest-add button's tuning and motion model (D-049).
 *
 * The orb is a raymarched glass sphere drawn by src/lib/mana-orb.ts. This file
 * owns the two things that are *decisions* rather than rendering: the parameter
 * set the owner picked, and the physics that turns a press into a squash.
 * Neither needs a browser, so both can be tested.
 *
 * The values below are not defaults to be tuned later — they are the exact
 * numbers the owner selected in the 4-pattern prototype ("露 / Dew", tuned to
 * a fully clear shell with a bright core) and confirmed as final. Changing one
 * changes an approved design, so treat this as a locked palette entry.
 */

export interface ManaOrbParams {
  /** Volumetric interior density. 0 = an empty shell; the look is carried by
   * refraction and the rim film alone. */
  density: number;
  /** Emissive core brightness. */
  core: number;
  /** Base hue of the iridescent palette, 0-1 around the colour wheel. */
  hueBase: number;
  /** How far the hue travels across the body. */
  hueSpan: number;
  /** Index of refraction. */
  ior: number;
  /** Chromatic dispersion — how far apart R/G/B refract. */
  disp: number;
  /** Strength of the thin-film rim iridescence. */
  film: number;
  /** Per-channel tint applied to the palette. */
  tint: readonly [number, number, number];
  /** How far a press squashes the sphere. */
  amp: number;
  /** Spring stiffness of the squash. */
  k: number;
  /** Spring damping of the squash — lower leaves a longer wobble. */
  c: number;
  /** Overall transparency bias. 0 keeps the body reading as a solid jewel. */
  clarity: number;
  /** Surface wobble amount. */
  wobble: number;
  /** Multiplier on the press impulse. */
  squish: number;
}

export const MANA_ORB_PARAMS: ManaOrbParams = {
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
};

/** Largest simulation step accepted. A backgrounded tab can hand back a
 * multi-second gap; feeding that to the spring below would overshoot far past
 * its clamp and snap back visibly on the first visible frame. */
export const MAX_ORB_STEP = 0.05;

export interface OrbMotion {
  /** Current squash, positive = flattened along Y. */
  squash: number;
  squashV: number;
  /** Eased 0-1 press weight driving the local dent in the shader. */
  pressAmt: number;
  /** Interior slosh offset, lagging the pointer so the whole mass trails it. */
  sloshX: number;
  sloshZ: number;
  sloshVX: number;
  sloshVZ: number;
}

export interface OrbInput {
  pressing: boolean;
  /** Pointer position in orb-local space, -1..1, y up. */
  pointerX: number;
  pointerY: number;
}

export function createOrbMotion(): OrbMotion {
  return { squash: 0, squashV: 0, pressAmt: 0, sloshX: 0, sloshZ: 0, sloshVX: 0, sloshVZ: 0 };
}

/** Impulse added the instant a press begins, so the squash starts with an
 * inward kick instead of easing in. Separate from stepOrbMotion because it is
 * event-driven, not time-driven. */
export function pressImpulse(motion: OrbMotion, params: ManaOrbParams): OrbMotion {
  return { ...motion, squashV: motion.squashV + 11 * params.amp * (0.45 + params.squish) };
}

/**
 * Advances the orb one frame. Pure: same inputs, same output, no clock and no
 * DOM. `dt` is clamped to MAX_ORB_STEP, and the squash is clamped to the range
 * the shader's SDF can represent without inverting.
 */
export function stepOrbMotion(
  motion: OrbMotion,
  input: OrbInput,
  dt: number,
  params: ManaOrbParams = MANA_ORB_PARAMS
): OrbMotion {
  const step = Math.min(MAX_ORB_STEP, Math.max(0, dt));
  const target = input.pressing ? params.amp * (0.35 + params.squish * 0.9) : 0;

  let squashV = motion.squashV + (target - motion.squash) * params.k * step;
  squashV *= Math.exp(-params.c * step);
  const squash = Math.min(0.48, Math.max(-0.42, motion.squash + squashV * step));

  const pressAmt =
    motion.pressAmt + ((input.pressing ? 1 : 0) - motion.pressAmt) * Math.min(1, step * 12);

  const decay = Math.exp(-3 * step);
  const sloshVX = (motion.sloshVX + (input.pointerX * 0.34 - motion.sloshX) * 34 * step) * decay;
  const sloshVZ = (motion.sloshVZ + (input.pointerY * 0.34 - motion.sloshZ) * 34 * step) * decay;

  return {
    squash,
    squashV,
    pressAmt,
    sloshX: motion.sloshX + sloshVX * step,
    sloshZ: motion.sloshZ + sloshVZ * step,
    sloshVX,
    sloshVZ,
  };
}

/**
 * Maps a pointer position on the orb to the unit vector the shader dents the
 * shell along, so the dimple appears under the finger rather than at a fixed
 * spot. Points outside the silhouette are pulled back onto the near hemisphere.
 */
export function pressDirection(pointerX: number, pointerY: number): [number, number, number] {
  const px = pointerX * 0.95;
  const py = pointerY * 0.95;
  const pz = Math.sqrt(1 - Math.min(0.98, px * px + py * py)) + 0.12;
  const len = Math.hypot(px, py, pz) || 1;
  return [px / len, py / len, pz / len];
}
