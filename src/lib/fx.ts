/* Effects intensity — browser-side accessors for the domain model (D-036).
 *
 * A single "quiet / normal / lively" preset replaces what used to be a pile of
 * independent on/off toggles; see src/lib/domain/fx.ts for the full rationale
 * and the pure profile logic. This module only wires that model to the two
 * runtime inputs that decide it: the persisted preference (localStorage) and
 * the OS-level prefers-reduced-motion setting, which always overrides it. All
 * storage access is best-effort and swallows errors, matching src/lib/sound.ts.
 */

import {
  DEFAULT_FX_INTENSITY,
  FX_INTENSITIES,
  FX_INTENSITY_LABELS,
  fxProfile,
  parseIntensity,
  resolveIntensity,
  type FxIntensity,
  type FxProfile,
} from "./domain/fx.ts";

export {
  DEFAULT_FX_INTENSITY,
  FX_INTENSITIES,
  FX_INTENSITY_LABELS,
  fxProfile,
  parseIntensity,
  resolveIntensity,
};
export type { FxIntensity, FxProfile };

const PREF_KEY = "fx-intensity";

/** OS-level prefers-reduced-motion, guarded for SSR and any matchMedia throw. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** The intensity the user actually chose, ignoring any reduced-motion override.
 * The settings UI needs this so the selected segment still reflects the user's
 * own choice while it explains that the OS is currently overriding it. */
export function getStoredFxIntensity(): FxIntensity {
  try {
    return parseIntensity(localStorage.getItem(PREF_KEY)) ?? DEFAULT_FX_INTENSITY;
  } catch {
    return DEFAULT_FX_INTENSITY;
  }
}

/** The effective intensity: persisted preference, unless reduced motion forces "quiet". */
export function getFxIntensity(): FxIntensity {
  try {
    const stored = localStorage.getItem(PREF_KEY);
    return resolveIntensity(stored, prefersReducedMotion());
  } catch {
    return DEFAULT_FX_INTENSITY;
  }
}

export function setFxIntensity(intensity: FxIntensity): void {
  try {
    localStorage.setItem(PREF_KEY, intensity);
  } catch {
    // Preference storage is best-effort.
  }
}

export function currentFxProfile(): FxProfile {
  return fxProfile(getFxIntensity());
}

/** True when the OS is overriding the user's stored preference down to "quiet". */
export function isReducedMotionForced(): boolean {
  return prefersReducedMotion();
}
