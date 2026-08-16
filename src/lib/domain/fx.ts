/* Effects intensity — one three-step preset instead of a pile of toggles (D-036).
 *
 * The original design proposed N independent on/off switches (confetti, sound,
 * haptics, ambience, ...). N toggles means 2^N states, most of them never tested
 * and most of them nonsensical (e.g. celebration fanfare on but confetti off).
 * The core persona is an ADHD user for whom a long settings screen is itself a
 * cost — scanning and deciding across many switches is friction before the app
 * has done anything useful. A single "quiet / normal / lively" dial collapses
 * that surface to three tested, meaningful states, each one a coherent bundle.
 *
 * "Morning ambience" (a calm light/sound on early opens) lives in "lively" only.
 * It was a real user request, but playing it by default would interrupt the
 * app's core promise of showing today's tasks instantly — so it only exists in
 * the one preset that has explicitly opted into extra performance.
 */

export type FxIntensity = "quiet" | "normal" | "lively";

/** Ascending order: quiet -> normal -> lively. */
export const FX_INTENSITIES: readonly FxIntensity[] = ["quiet", "normal", "lively"];

export const DEFAULT_FX_INTENSITY: FxIntensity = "normal";

export interface FxProfile {
  /** Brief spark of light on ordinary taps. Kept separate from the sound/haptic
   * toggle so the two settings stay orthogonal rather than double-gating. */
  microFeedback: boolean;
  /** How many confetti bursts fire on a task completion / drop (0 = none). */
  confettiWaves: number;
  /** Multiplier applied to confetti particle counts. */
  confettiScale: number;
  /** Multiplier for the all-quests-cleared fanfare. */
  celebrationScale: number;
  /** Calm morning light/sound when the app is opened early. Lively-only; see file header. */
  morningAmbience: boolean;
}

const PROFILES: Record<FxIntensity, FxProfile> = {
  quiet: {
    microFeedback: false,
    confettiWaves: 0,
    confettiScale: 0,
    celebrationScale: 0.6,
    morningAmbience: false,
  },
  normal: {
    microFeedback: true,
    confettiWaves: 1,
    confettiScale: 1,
    celebrationScale: 1,
    morningAmbience: false,
  },
  lively: {
    microFeedback: true,
    confettiWaves: 2,
    confettiScale: 1.35,
    celebrationScale: 1.5,
    morningAmbience: true,
  },
};

export function fxProfile(intensity: FxIntensity): FxProfile {
  return PROFILES[intensity];
}

/** Returns `value` narrowed to FxIntensity only if it is exactly one of the three literals. */
export function parseIntensity(value: unknown): FxIntensity | null {
  return typeof value === "string" && (FX_INTENSITIES as readonly string[]).includes(value)
    ? (value as FxIntensity)
    : null;
}

/**
 * Resolves the effective intensity from a stored preference and the OS-level
 * reduced-motion setting. `reducedMotion` always wins: a user who has told
 * their OS to cut down on motion should never get "lively" back out of
 * localStorage, no matter what was saved before. Otherwise, fall back to the
 * default when `stored` is absent or not one of the three literals.
 */
export function resolveIntensity(stored: unknown, reducedMotion: boolean): FxIntensity {
  if (reducedMotion) return "quiet";
  return parseIntensity(stored) ?? DEFAULT_FX_INTENSITY;
}

/** Japanese label + one-line description per intensity, for the settings UI. */
export const FX_INTENSITY_LABELS: Record<FxIntensity, { label: string; description: string }> = {
  quiet: {
    label: "しずか",
    description: "エフェクトや効果音を最小限にし、静かに使えます。",
  },
  normal: {
    label: "ふつう",
    description: "タップの手応えと達成演出をバランスよく楽しめます。",
  },
  lively: {
    label: "にぎやか",
    description: "演出をたっぷり増やし、朝は穏やかな演出でアプリを出迎えます。",
  },
};
