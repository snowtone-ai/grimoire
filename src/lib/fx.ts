/* Effects preferences — browser-side accessors for the domain model (D-039).
 *
 * Six independent on/off toggles replace what used to be one quiet/normal/lively
 * dial; see src/lib/domain/fx.ts for the full rationale and the pure resolve
 * logic. This module only wires that model to the two runtime inputs that decide
 * it: one localStorage flag per effect, and the OS-level prefers-reduced-motion
 * setting, which always overrides every key here. Sound/haptics are NOT one of
 * these keys — they keep independent sound and haptic toggles in sound.ts,
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
/** Set once the defaults-on backfill below has run, so it runs exactly once
 * per user rather than every page load. */
const DEFAULTS_V2_KEY = "fx-defaults-v2";
let migrated = false;

/** One-shot migration from the retired quiet/normal/lively dial (D-036) to the
 * six independent toggles (D-039). Without this, a user who had explicitly
 * chosen "quiet" would silently get effects turned back on after a deploy —
 * the wrong direction for the ADHD persona D-039 exists to protect. Guarded so
 * it only touches storage once per page load, and only if the new keys haven't
 * already been set (e.g. by a previous run of this same migration).
 *
 * D-047 note: this now writes an explicit value for EVERY key rather than
 * leaving the three newer ones unset. Under D-039 an unset key meant "off",
 * so leaving them alone happened to give a "quiet" user the right answer; now
 * that every default is on, an unset key means the opposite, and silence has
 * to be recorded rather than assumed.
 *
 * That change alone is not enough, and on its own it protects nobody real —
 * see backfillDefaultsV2 below. */
function migrateFromIntensity(): void {
  try {
    const old = localStorage.getItem(OLD_INTENSITY_KEY);
    if (old === null) return;
    const alreadyChosen = EFFECT_KEYS.some((key) => localStorage.getItem(STORAGE_KEY[key]) !== null);
    if (!alreadyChosen) {
      // "normal" and "lively" both had tapSpark/completion on; only "lively"
      // had the morning greeting; the three effects that did not exist under
      // the old dial follow whether the user wanted effects at all.
      const enabled = old !== "quiet";
      const value: Record<EffectKey, boolean> = {
        tapSpark: enabled,
        completion: enabled,
        morningGreeting: old === "lively",
        openFlourish: enabled,
        ambientParticles: enabled,
        pageTransitions: enabled,
      };
      for (const key of EFFECT_KEYS) {
        localStorage.setItem(STORAGE_KEY[key], value[key] ? "1" : "0");
      }
    }
    localStorage.removeItem(OLD_INTENSITY_KEY);
  } catch {
    // Preference storage is best-effort.
  }
}

/* Preserve what an existing user is actually seeing, now that the defaults
 * flipped from off to on.
 *
 * The D-039 migration above shipped on 2026-08-17 and `main` auto-deploys, so
 * for every real user it has already run: it wrote three keys, deleted
 * `fx-intensity`, and left openFlourish/ambientParticles/pageTransitions
 * unset. Its own `old === null` guard therefore returns immediately from now
 * on — which means fixing *it* to write all six keys protects only a user who
 * has not opened the app since that date. That is nobody in this family.
 *
 * So the trigger here is key presence, not the retired dial. If any of the six
 * keys is set, the user has a history under the old model, where an unset key
 * meant off — and off is what they have been looking at. Record that, rather
 * than letting the new default silently switch on an app-open flourish, 44
 * ambient motes and per-page transitions for someone who had turned every
 * switch they were offered to off.
 *
 * A user with no keys at all is genuinely new and gets the new defaults-on
 * experience, which is the point of the change. */
function backfillDefaultsV2(): void {
  try {
    if (localStorage.getItem(DEFAULTS_V2_KEY) === "1") return;
    localStorage.setItem(DEFAULTS_V2_KEY, "1");

    const hasHistory = EFFECT_KEYS.some((key) => localStorage.getItem(STORAGE_KEY[key]) !== null);
    if (!hasHistory) return;

    for (const key of EFFECT_KEYS) {
      if (localStorage.getItem(STORAGE_KEY[key]) === null) {
        localStorage.setItem(STORAGE_KEY[key], "0");
      }
    }
  } catch {
    // Preference storage is best-effort.
  }
}

/** Both one-shot migrations, guarded so storage is touched once per page load. */
function ensureMigrated(): void {
  if (migrated) return;
  migrated = true;
  migrateFromIntensity();
  backfillDefaultsV2();
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
  ensureMigrated();
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
  // Ordering guard: the backfill keys off "does this user have any stored
  // preference", so it has to settle before this function creates one.
  ensureMigrated();
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
