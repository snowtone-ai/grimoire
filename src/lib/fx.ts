/* Effects preferences — browser-side accessors for the domain model (D-039).
 *
 * Six independent on/off toggles replace what used to be one quiet/normal/lively
 * dial; see src/lib/domain/fx.ts for the full rationale and the pure resolve
 * logic. This module only wires that model to the two runtime inputs that decide
 * it: one localStorage flag per effect, and the OS-level prefers-reduced-motion
 * setting, which always overrides every key here. Sound/haptics are NOT one of
 * these keys — they keep their own independent toggle in sound.ts (fx-enabled),
 * deliberately not reduced-motion-gated (D-036: that media query is a motion
 * signal, not an audio one). All storage access is best-effort and swallows
 * errors, matching src/lib/sound.ts.
 */

import {
  DEFAULT_EFFECT_PREFS,
  EFFECT_KEYS,
  EFFECT_LABELS,
  EFFECT_SECTIONS,
  resolveEffect,
  type EffectKey,
  type EffectLabel,
  type SettingsSection,
} from "./domain/fx.ts";

export { DEFAULT_EFFECT_PREFS, EFFECT_KEYS, EFFECT_LABELS, EFFECT_SECTIONS };
export type { EffectKey, EffectLabel, SettingsSection };

const STORAGE_KEY: Record<EffectKey, string> = {
  tapSpark: "fx-tap-enabled",
  completion: "fx-completion-enabled",
  morningGreeting: "fx-morning-enabled",
  openFlourish: "fx-open-enabled",
  ambientParticles: "fx-particles-enabled",
  pageTransitions: "fx-transitions-enabled",
};

const OLD_INTENSITY_KEY = "fx-intensity";
let migrated = false;

/** One-shot migration from the retired quiet/normal/lively dial (D-036) to the
 * six independent toggles (D-039). Only the three effects that existed under
 * the old model are mapped explicitly; the three brand-new ones
 * (openFlourish/ambientParticles/pageTransitions) simply keep their
 * off-by-default state, which is what a "quiet" or "normal" user would have
 * gotten anyway. Without this, a user who had explicitly chosen "quiet" would
 * silently get tapSpark/completion turned back on after this deploy — the
 * wrong direction for the ADHD persona D-039 exists to protect. Guarded so it
 * only touches storage once per page load, and only if the new keys haven't
 * already been set (e.g. by a previous run of this same migration). */
function migrateFromIntensity(): void {
  if (migrated) return;
  migrated = true;
  try {
    const old = localStorage.getItem(OLD_INTENSITY_KEY);
    if (old === null) return;
    const alreadyChosen = EFFECT_KEYS.some((key) => localStorage.getItem(STORAGE_KEY[key]) !== null);
    if (!alreadyChosen) {
      const enabled = old !== "quiet"; // "normal" and "lively" both had tapSpark/completion on
      localStorage.setItem(STORAGE_KEY.tapSpark, enabled ? "1" : "0");
      localStorage.setItem(STORAGE_KEY.completion, enabled ? "1" : "0");
      localStorage.setItem(STORAGE_KEY.morningGreeting, old === "lively" ? "1" : "0");
    }
    localStorage.removeItem(OLD_INTENSITY_KEY);
  } catch {
    // Preference storage is best-effort.
  }
}

/** OS-level prefers-reduced-motion, guarded for SSR and any matchMedia throw. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function readStored(key: EffectKey): boolean | null {
  migrateFromIntensity();
  try {
    const raw = localStorage.getItem(STORAGE_KEY[key]);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return null;
  } catch {
    return null;
  }
}

/** The user's own stored choice, ignoring any reduced-motion override. The
 * settings UI needs this so a toggle still reflects what the user picked while
 * it explains that the OS is currently overriding it. */
export function getStoredEffectPref(key: EffectKey): boolean {
  return readStored(key) ?? DEFAULT_EFFECT_PREFS[key];
}

/** The effective on/off state: persisted preference, unless reduced motion
 * forces every effect off. */
export function isEffectEnabled(key: EffectKey): boolean {
  return resolveEffect(key, readStored(key), prefersReducedMotion());
}

export function setEffectEnabled(key: EffectKey, enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY[key], enabled ? "1" : "0");
  } catch {
    // Preference storage is best-effort.
  }
}

/** True when the OS is overriding the user's stored preferences down to off. */
export function isReducedMotionForced(): boolean {
  return prefersReducedMotion();
}
