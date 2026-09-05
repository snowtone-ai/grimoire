/* Sound cue map — every action in the app, and the asset it plays (D-047).
 *
 * This replaces the Web Audio synthesis engine from D-022/T036 outright. That
 * engine had one real virtue worth carrying forward: a single pentatonic
 * palette meant nothing could ever clash. The same discipline is kept here, by
 * source pack rather than by scale — three CC0 Kenney packs, each owning one
 * layer of the app's voice, all peak-normalised to the same -1.0 dBFS so the
 * mix below is the only thing that sets relative loudness:
 *
 *   TOUCH   audio/ui/*      Interface Sounds — pressing, toggling, opening,
 *                           failing. Short, neutral, no melody. It should feel
 *                           like the app responding, not like the app singing.
 *   WORLD   audio/cues/*    RPG Audio — page turns, a door, a clasp, coins.
 *                           This app is a grimoire, so navigating it makes the
 *                           sound of a book being handled. Each destination
 *                           sounds like arriving *there*, not like a generic
 *                           whoosh: the lab is a door, the collection is heavy
 *                           parchment, home is a quick flip.
 *   REWARD  audio/cues/*    Music Jingles — pizzicato for the RARE 1-8 ladder,
 *                           steel bells for the once-a-day moments. Rarity
 *                           reuses ONE ascending pizzicato motif at growing
 *                           lengths, exactly as D-022 did with its arpeggio:
 *                           recognition, not random novelty. Steel is reserved
 *                           for all-clear / morning / app-open so the biggest
 *                           moments are a different instrument, not just a
 *                           louder version of the small ones.
 *
 * Budget, unchanged from D-022: at most one cue and one haptic per action.
 * A cue may have more than one step, but only where the moment is genuinely
 * compound (a clasp, then a cover, then light) — never to make something
 * merely louder.
 *
 * Pure data: no Web Audio, no DOM. src/lib/sound.ts plays this; a test asserts
 * every `src` here exists under public/audio, so a typo fails the build instead
 * of shipping as a silent no-op.
 */

import { rarityBand, type RarityBand } from "./rarity-style.ts";

export type SoundAction =
  // TOUCH
  | "tap"
  | "add"
  | "save"
  | "undo"
  | "toggle"
  | "modalOpen"
  | "modalClose"
  | "confirm"
  | "error"
  | "depart"
  // WORLD
  | "pageHome"
  | "pageCalendar"
  | "pageLab"
  | "pageRecord"
  // REWARD
  | "replay"
  | "bounty"
  | "clearLow"
  | "clearMid"
  | "clearHigh"
  | "fanfare"
  // ONCE A DAY
  | "morning"
  | "flourish";

export interface CueStep {
  /** Path under /audio, e.g. "ui/click_002.wav". */
  readonly src: string;
  /** Linear gain. Sources are peak-normalised, so this alone sets the mix. */
  readonly gain: number;
  /** Offset from the start of the cue. 0 for every single-step cue. */
  readonly delayMs: number;
}

export interface SoundCue {
  readonly steps: readonly CueStep[];
  /** navigator.vibrate pattern, or null where the hand should feel nothing. */
  readonly haptic: number | readonly number[] | null;
}

/**
 * One pre-mixed file keeps the three audible beats locked to the same clock as
 * the startup visual. Separate media elements can begin at different times
 * while they buffer, which made the 0/200/400 ms choreography nondeterministic
 * on a cold launch. See docs/startup-sound-sources.md for the reproducible mix.
 */
export const STARTUP_FLOURISH = {
  src: "cues/startup-flourish.wav",
  gain: 1,
  durationMs: 1308.889,
  markersMs: {
    clasp: 0,
    bookOpen: 200,
    lightRise: 400,
  },
} as const;

const one = (src: string, gain: number, haptic: SoundCue["haptic"] = null): SoundCue => ({
  steps: [{ src, gain, delayMs: 0 }],
  haptic,
});

export const SOUND_CUES: Record<SoundAction, SoundCue> = {
  /* TOUCH — quiet on purpose. These fire dozens of times a session, and the
   * ADHD persona D-039 protects is the one who notices an over-eager UI first. */
  tap: one("ui/click_002.wav", 0.45, 8),
  /* A droplet landing, then a small glassy bloom. This is intentionally
   * distinct from a button click and is synchronized with the Add ripple. */
  add: {
    steps: [
      { src: "ui/drop_004.wav", gain: 0.44, delayMs: 0 },
      { src: "ui/glass_002.wav", gain: 0.2, delayMs: 75 },
    ],
    haptic: [14, 22, 8],
  },
  save: one("ui/confirmation_002.wav", 0.5, 16),
  undo: one("ui/back_002.wav", 0.45, [8, 26, 8]),
  toggle: one("ui/switch_003.wav", 0.4, 12),
  modalOpen: one("ui/open_002.wav", 0.4, [8, 22, 8]),
  modalClose: one("ui/close_002.wav", 0.4, [6, 18, 6]),
  /* The upward inquisitive blip, used only where the app has just asked a
   * question the user must answer twice — the destructive-reset confirm. It is
   * the one TOUCH cue that is meant to make you stop. */
  confirm: one("ui/question_002.wav", 0.45, 12),
  error: one("ui/error_004.wav", 0.45, [18, 60, 18]),
  /* 出発 — an ascending sweep, the one TOUCH cue allowed to point upward,
   * because committing to a quest is the only button press that is itself a
   * small act of momentum. */
  depart: one("ui/maximize_006.wav", 0.45, [14, 28, 10]),

  /* WORLD — the grimoire being handled. */
  pageHome: one("cues/page-home.wav", 0.4, [8, 24, 8]),
  pageCalendar: one("cues/page-calendar.wav", 0.4, [8, 24, 8]),
  pageLab: one("cues/page-lab.wav", 0.35, [8, 24, 8]),
  pageRecord: one("cues/page-record.wav", 0.4, [8, 24, 8]),

  /* REWARD */
  /* Looking back at something already earned: a short coin tick, deliberately
   * not the clear jingle. Same rule the replay VFX follows (D-036). */
  replay: one("cues/treasure-light.wav", 0.45, [9, 24, 9]),
  bounty: one("cues/treasure.wav", 0.5, [12, 40, 18]),
  clearLow: one("cues/clear-low.wav", 0.45, 12),
  clearMid: one("cues/clear-mid.wav", 0.5, [14, 36, 14]),
  /* The only layered REWARD cue: the pizzicato run plus a glass ring landing on
   * its final note, so RARE 7-8 is audibly a different event and not just the
   * mid cue turned up. */
  clearHigh: {
    steps: [
      { src: "cues/clear-high.wav", gain: 0.55, delayMs: 0 },
      { src: "ui/glass_004.wav", gain: 0.3, delayMs: 620 },
    ],
    haptic: [16, 30, 16, 30, 60],
  },
  fanfare: one("cues/fanfare.wav", 0.55, [20, 50, 30]),

  /* ONCE A DAY */
  /* The quietest thing in the app. Nothing has been earned; it is only saying
   * good morning, so it stays a flat low bell with no melodic rise (D-036). */
  morning: one("cues/morning.wav", 0.35, 10),
  /* The grimoire opening: the clasp springs, the cover lifts, light rises out.
   * Three steps because it is three physical events, timed to the frame-draw
   * choreography in open-flourish.tsx. The startup-only HTMLMediaElement path
   * uses STARTUP_FLOURISH instead; keeping that file out of this sampler also
   * keeps it out of the post-gesture warm-up after its launch moment passed. */
  flourish: {
    steps: [
      { src: "cues/clasp.wav", gain: 0.45, delayMs: 0 },
      { src: "cues/book-open.wav", gain: 0.45, delayMs: 200 },
      { src: "cues/flourish.wav", gain: 0.5, delayMs: 400 },
    ],
    haptic: [10, 60, 20],
  },
};

/** The RARE 1-8 ladder, bucketed through the same low/mid/high bands that
 * confetti, drop-reveal and the VFX scenes all share, rather than re-cut here. */
const CLEAR_BY_BAND: Record<RarityBand, SoundAction> = {
  low: "clearLow",
  mid: "clearMid",
  high: "clearHigh",
};

export function clearAction(rarity: number): SoundAction {
  return CLEAR_BY_BAND[rarityBand(rarity)];
}

/** Destination -> arrival cue. Keyed by route so bottom-nav's theme names and
 * this map cannot drift apart silently. */
export const PAGE_ACTION: Record<string, SoundAction> = {
  "/": "pageHome",
  "/all": "pageCalendar",
  "/plant": "pageLab",
  "/book": "pageRecord",
};

/** Every distinct asset the app can ever play. The sampler prefetches this set
 * after the first gesture so no cue is ever late on its first use. */
export const ALL_CUE_SOURCES: readonly string[] = Array.from(
  new Set(Object.values(SOUND_CUES).flatMap((cue) => cue.steps.map((step) => step.src)))
).sort();
