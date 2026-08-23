/* Visual effect scenes — every effect in the app, described as data (D-047).
 *
 * Replaces canvas-confetti (D-036/T036). That library draws flat vector
 * shapes; the app now vendors the Kenney Particle Pack, so effects are built
 * from real light textures instead — additive sprites with glow, rotation and
 * layered timing. See public/vfx/manifest.json for what each texture is.
 *
 * Design rules carried over from the confetti era, all still load-bearing:
 *   - ONE ascending ladder. RARE 1-8 buckets into low/mid/high through
 *     rarity-style.ts, and a higher band never just repeats the lower one
 *     louder — it adds a layer the lower band does not have (a shockwave, then
 *     a summoning circle). Recognition, not random novelty.
 *   - Replay is not celebration. Tapping a collected item in /book plays a
 *     scene that differs in *shape and direction* from a live clear, not just
 *     in colour, because one is an achievement and the other is a look back
 *     (D-036).
 *   - Anticipation before release. The big scenes lead with a small, fast,
 *     early layer so the moment reads as wind-up -> release, not a flat pop.
 *
 * Pure data: no DOM, no canvas, no timers. src/lib/vfx.ts renders this.
 * A test asserts every `texture` here exists under public/vfx, so a typo fails
 * the build instead of silently drawing nothing.
 */

import { rarityBand, type RarityBand } from "./rarity-style.ts";

export type VfxMotion =
  /** Launched outward from the origin, then pulled down by gravity. */
  | "burst"
  /** Drifts upward, swaying, fading in and out — motes of light. */
  | "rise"
  /** A single sprite that scales up from nothing and fades — a shockwave. */
  | "expand"
  /** A single sprite at full size that only fades — a flash. */
  | "flash";

export interface VfxEmitter {
  /** File name under /vfx, e.g. "star.png". */
  readonly texture: string;
  readonly count: number;
  readonly motion: VfxMotion;
  /** Sprite size in CSS px, picked per particle in [min, max]. */
  readonly size: readonly [number, number];
  /** Initial speed in px/s, picked per particle. Ignored by expand/flash. */
  readonly speed: readonly [number, number];
  /** Lifetime in ms, picked per particle. */
  readonly life: readonly [number, number];
  /** Half-angle of the launch cone in degrees, measured from straight up.
   * 180 is a full circle. Ignored by expand/flash. */
  readonly spread: number;
  /** Downward acceleration in px/s^2. Ignored by expand/flash. */
  readonly gravity: number;
  /** Rotation in turns/s, picked per particle. */
  readonly spin: readonly [number, number];
  /** Delay from the start of the scene, in ms. */
  readonly delayMs: number;
  /** A CSS colour, or "rarity" to take the drop's own accent from
   * rarity-style.ts. Textures are white, so this is what tints them. */
  readonly color: string;
  /** Peak alpha, before the per-particle fade envelope. */
  readonly opacity: number;
}

export interface VfxScene {
  readonly emitters: readonly VfxEmitter[];
  /** Where the scene is anchored. "point" scenes are positioned by the caller
   * (a tap); the rest sit at a fixed fraction of the viewport. */
  readonly origin: "point" | { readonly x: number; readonly y: number };
}

/** Tint token meaning "use the drop's own rarity accent". */
export const RARITY_TINT = "rarity";

const GOLD = "#fbbf24";
const FROST = "#7dd3fc";
const WARM = "#fde68a";
const PALE = "#ffffff";

/* ---------------------------------------------------------------- tap ---- */

/** A glint under the finger. The smallest thing in the app that is still an
 * effect, fired on every press of any control — so it has to be genuinely
 * cheap: two emitters, six sprites, under 500ms. */
export const TAP_SCENE: VfxScene = {
  origin: "point",
  emitters: [
    {
      texture: "glint.png",
      count: 1,
      motion: "flash",
      size: [46, 46],
      speed: [0, 0],
      life: [320, 320],
      spread: 0,
      gravity: 0,
      spin: [0, 0],
      delayMs: 0,
      color: PALE,
      opacity: 0.85,
    },
    {
      texture: "mote.png",
      count: 5,
      motion: "burst",
      size: [7, 13],
      speed: [90, 190],
      life: [280, 460],
      spread: 180,
      gravity: 220,
      spin: [-0.6, 0.6],
      delayMs: 0,
      color: GOLD,
      opacity: 0.9,
    },
  ],
};

/** Add is a direct physical response: two low-alpha water-tension rings leave
 * the exact touch point, followed by a restrained magical bloom. */
export const ADD_RIPPLE_SCENE: VfxScene = {
  origin: "point",
  emitters: [
    {
      texture: "ring-pulse.png",
      count: 1,
      motion: "expand",
      size: [18, 150],
      speed: [0, 0],
      life: [520, 520],
      spread: 0,
      gravity: 0,
      spin: [0, 0],
      delayMs: 0,
      color: FROST,
      opacity: 0.76,
    },
    {
      texture: "ring.png",
      count: 1,
      motion: "expand",
      size: [12, 112],
      speed: [0, 0],
      life: [460, 460],
      spread: 0,
      gravity: 0,
      spin: [0, 0],
      delayMs: 75,
      color: PALE,
      opacity: 0.5,
    },
    {
      texture: "mote.png",
      count: 6,
      motion: "burst",
      size: [5, 9],
      speed: [45, 105],
      life: [330, 520],
      spread: 180,
      gravity: 70,
      spin: [-0.3, 0.3],
      delayMs: 65,
      color: WARM,
      opacity: 0.68,
    },
  ],
};

/* --------------------------------------------------------- completion ---- */

const CLEAR_LOW: VfxScene = {
  origin: { x: 0.5, y: 0.6 },
  emitters: [
    /* Anticipation: a fast, tiny puff that lands before the burst. */
    {
      texture: "mote.png",
      count: 7,
      motion: "burst",
      size: [8, 14],
      speed: [120, 200],
      life: [260, 380],
      spread: 40,
      gravity: 520,
      spin: [-0.4, 0.4],
      delayMs: 0,
      color: RARITY_TINT,
      opacity: 0.8,
    },
    {
      texture: "star.png",
      count: 26,
      motion: "burst",
      size: [12, 22],
      speed: [230, 430],
      life: [700, 1050],
      spread: 55,
      gravity: 620,
      spin: [-1, 1],
      delayMs: 55,
      color: RARITY_TINT,
      opacity: 0.95,
    },
    {
      texture: "glint.png",
      count: 8,
      motion: "burst",
      size: [10, 18],
      speed: [200, 380],
      life: [600, 900],
      spread: 55,
      gravity: 620,
      spin: [0, 0],
      delayMs: 55,
      color: PALE,
      opacity: 0.7,
    },
  ],
};

const CLEAR_MID: VfxScene = {
  origin: { x: 0.5, y: 0.56 },
  emitters: [
    {
      texture: "mote.png",
      count: 10,
      motion: "burst",
      size: [9, 16],
      speed: [140, 240],
      life: [280, 420],
      spread: 50,
      gravity: 540,
      spin: [-0.5, 0.5],
      delayMs: 0,
      color: RARITY_TINT,
      opacity: 0.85,
    },
    /* The layer low does not have: a shockwave ring that gives the burst a
     * physical centre to come out of. */
    {
      texture: "ring.png",
      count: 1,
      motion: "expand",
      size: [30, 340],
      speed: [0, 0],
      life: [640, 640],
      spread: 0,
      gravity: 0,
      spin: [0, 0],
      delayMs: 60,
      color: RARITY_TINT,
      opacity: 0.55,
    },
    {
      texture: "burst.png",
      count: 1,
      motion: "flash",
      size: [200, 200],
      speed: [0, 0],
      life: [420, 420],
      spread: 0,
      gravity: 0,
      spin: [0, 0],
      delayMs: 60,
      color: WARM,
      opacity: 0.7,
    },
    {
      texture: "star.png",
      count: 52,
      motion: "burst",
      size: [14, 26],
      speed: [280, 540],
      life: [850, 1250],
      spread: 75,
      gravity: 640,
      spin: [-1.2, 1.2],
      delayMs: 80,
      color: RARITY_TINT,
      opacity: 0.95,
    },
    {
      texture: "trail.png",
      count: 12,
      motion: "burst",
      size: [18, 34],
      speed: [300, 520],
      life: [700, 1000],
      spread: 75,
      gravity: 640,
      spin: [-0.3, 0.3],
      delayMs: 80,
      color: PALE,
      opacity: 0.55,
    },
  ],
};

const CLEAR_HIGH: VfxScene = {
  origin: { x: 0.5, y: 0.5 },
  emitters: [
    {
      texture: "mote.png",
      count: 14,
      motion: "burst",
      size: [10, 18],
      speed: [160, 280],
      life: [300, 460],
      spread: 60,
      gravity: 520,
      spin: [-0.5, 0.5],
      delayMs: 0,
      color: RARITY_TINT,
      opacity: 0.9,
    },
    /* The layer mid does not have: a summoning circle opening under the burst.
     * It is the one texture in the pack that reads as deliberate magic rather
     * than as light, and it is reserved for RARE 7-8 alone. */
    {
      texture: "arcane-circle.png",
      count: 1,
      motion: "expand",
      size: [40, 460],
      speed: [0, 0],
      life: [1100, 1100],
      spread: 0,
      gravity: 0,
      spin: [0.12, 0.12],
      delayMs: 40,
      color: GOLD,
      opacity: 0.7,
    },
    {
      texture: "halo.png",
      count: 1,
      motion: "flash",
      size: [260, 260],
      speed: [0, 0],
      life: [520, 520],
      spread: 0,
      gravity: 0,
      spin: [0, 0],
      delayMs: 90,
      color: WARM,
      opacity: 0.6,
    },
    {
      texture: "ring.png",
      count: 1,
      motion: "expand",
      size: [40, 620],
      speed: [0, 0],
      life: [760, 760],
      spread: 0,
      gravity: 0,
      spin: [0, 0],
      delayMs: 110,
      color: PALE,
      opacity: 0.5,
    },
    {
      texture: "burst.png",
      count: 1,
      motion: "flash",
      size: [300, 300],
      speed: [0, 0],
      life: [520, 520],
      spread: 0,
      gravity: 0,
      spin: [0, 0],
      delayMs: 110,
      color: RARITY_TINT,
      opacity: 0.8,
    },
    {
      texture: "star.png",
      count: 84,
      motion: "burst",
      size: [16, 32],
      speed: [340, 700],
      life: [1000, 1500],
      spread: 100,
      gravity: 660,
      spin: [-1.4, 1.4],
      delayMs: 130,
      color: RARITY_TINT,
      opacity: 1,
    },
    {
      texture: "bolt.png",
      count: 9,
      motion: "burst",
      size: [40, 78],
      speed: [260, 460],
      life: [520, 760],
      spread: 100,
      gravity: 300,
      spin: [-0.8, 0.8],
      delayMs: 130,
      color: FROST,
      opacity: 0.65,
    },
    {
      texture: "sigil.png",
      count: 14,
      motion: "burst",
      size: [14, 24],
      speed: [220, 480],
      life: [900, 1300],
      spread: 100,
      gravity: 660,
      spin: [-1.6, 1.6],
      delayMs: 130,
      color: GOLD,
      opacity: 0.85,
    },
    /* A slow tail of motes still rising after the burst has fallen, so a
     * rank-8 lingers instead of ending on a hard cut. */
    {
      texture: "mote.png",
      count: 16,
      motion: "rise",
      size: [8, 18],
      speed: [40, 90],
      life: [1400, 2100],
      spread: 0,
      gravity: 0,
      spin: [0, 0],
      delayMs: 260,
      color: GOLD,
      opacity: 0.7,
    },
  ],
};

const CLEAR_BY_BAND: Record<RarityBand, VfxScene> = {
  low: CLEAR_LOW,
  mid: CLEAR_MID,
  high: CLEAR_HIGH,
};

export function clearScene(rarity: number): VfxScene {
  return CLEAR_BY_BAND[rarityBand(rarity)];
}

/* ---------------------------------------------------------- all clear ---- */

/** Every quest done. The one moment that happens at most once a day, so it is
 * the only scene allowed to work at the scale of the whole screen: two corner
 * cannons plus a horizontal flare across the middle. */
export const ALL_CLEAR_SCENE: VfxScene = {
  origin: { x: 0.5, y: 0.62 },
  emitters: [
    {
      texture: "flare.png",
      count: 1,
      motion: "expand",
      size: [120, 900],
      speed: [0, 0],
      life: [820, 820],
      spread: 0,
      gravity: 0,
      spin: [0, 0],
      delayMs: 0,
      color: WARM,
      opacity: 0.55,
    },
    {
      texture: "swirl.png",
      count: 2,
      motion: "expand",
      size: [60, 520],
      speed: [0, 0],
      life: [900, 900],
      spread: 0,
      gravity: 0,
      spin: [0.5, 0.8],
      delayMs: 60,
      color: GOLD,
      opacity: 0.5,
    },
    {
      texture: "star.png",
      count: 96,
      motion: "burst",
      size: [14, 30],
      speed: [420, 820],
      life: [1100, 1700],
      spread: 180,
      gravity: 700,
      spin: [-1.4, 1.4],
      delayMs: 90,
      color: GOLD,
      opacity: 1,
    },
    {
      texture: "star.png",
      count: 48,
      motion: "burst",
      size: [12, 24],
      speed: [380, 720],
      life: [1000, 1500],
      spread: 180,
      gravity: 700,
      spin: [-1.2, 1.2],
      delayMs: 140,
      color: FROST,
      opacity: 0.9,
    },
    {
      texture: "mote.png",
      count: 28,
      motion: "rise",
      size: [9, 20],
      speed: [50, 110],
      life: [1600, 2400],
      spread: 0,
      gravity: 0,
      spin: [0, 0],
      delayMs: 300,
      color: WARM,
      opacity: 0.75,
    },
  ],
};

/* ------------------------------------------------------------- replay ---- */

/** /book: an item already collected, tapped to look at again. Deliberately the
 * inverse of a clear — nothing is launched upward, nothing falls. A ring opens
 * and a few motes drift up through it, so the two moments can never be
 * confused even at a glance. */
export function replayScene(): VfxScene {
  return REPLAY_SCENE;
}

const REPLAY_SCENE: VfxScene = {
  origin: { x: 0.5, y: 0.44 },
  emitters: [
    {
      texture: "ring-pulse.png",
      count: 1,
      motion: "expand",
      size: [40, 300],
      speed: [0, 0],
      life: [900, 900],
      spread: 0,
      gravity: 0,
      spin: [-0.15, -0.15],
      delayMs: 0,
      color: RARITY_TINT,
      opacity: 0.5,
    },
    {
      texture: "glint.png",
      count: 18,
      motion: "rise",
      size: [10, 20],
      speed: [45, 105],
      life: [900, 1400],
      spread: 0,
      gravity: 0,
      spin: [0, 0],
      delayMs: 80,
      color: RARITY_TINT,
      opacity: 0.8,
    },
  ],
};

/* ----------------------------------------------------------- flourish ---- */

/** The app-open flourish: a summoning circle opens, light rises out of it.
 * Timed against the frame-draw choreography in open-flourish.tsx. */
export const FLOURISH_SCENE: VfxScene = {
  origin: { x: 0.5, y: 0.5 },
  emitters: [
    {
      texture: "arcane-circle.png",
      count: 1,
      motion: "expand",
      size: [30, 520],
      speed: [0, 0],
      life: [1800, 1800],
      spread: 0,
      gravity: 0,
      spin: [0.08, 0.08],
      delayMs: 260,
      color: GOLD,
      opacity: 0.55,
    },
    {
      texture: "ring.png",
      count: 1,
      motion: "expand",
      size: [40, 700],
      speed: [0, 0],
      life: [1000, 1000],
      spread: 0,
      gravity: 0,
      spin: [0, 0],
      delayMs: 420,
      color: WARM,
      opacity: 0.4,
    },
    {
      texture: "mote.png",
      count: 40,
      motion: "rise",
      size: [8, 20],
      speed: [70, 170],
      life: [1500, 2400],
      spread: 0,
      gravity: 0,
      spin: [0, 0],
      delayMs: 460,
      color: GOLD,
      opacity: 0.85,
    },
    {
      texture: "glint.png",
      count: 22,
      motion: "rise",
      size: [10, 22],
      speed: [90, 200],
      life: [1200, 1900],
      spread: 0,
      gravity: 0,
      spin: [0, 0],
      delayMs: 560,
      color: PALE,
      opacity: 0.6,
    },
  ],
};

/* ------------------------------------------------------------ morning ---- */

/** The morning greeting. Warm, slow, and low-count — it accompanies a light
 * wash across the top of the screen, it is not an event of its own. */
export const MORNING_SCENE: VfxScene = {
  origin: { x: 0.5, y: 0.72 },
  emitters: [
    {
      texture: "mote.png",
      count: 26,
      motion: "rise",
      size: [7, 17],
      speed: [30, 75],
      life: [2600, 4000],
      spread: 0,
      gravity: 0,
      spin: [0, 0],
      delayMs: 0,
      color: WARM,
      opacity: 0.55,
    },
    {
      texture: "glint.png",
      count: 10,
      motion: "rise",
      size: [9, 18],
      speed: [40, 90],
      life: [2400, 3600],
      spread: 0,
      gravity: 0,
      spin: [0, 0],
      delayMs: 400,
      color: PALE,
      opacity: 0.4,
    },
  ],
};

/* --------------------------------------------------------- transition ---- */

/* Page arrival. Punctuation on the CSS page-turn, never something you wait
 * through — every one of these is done inside the turn's own 400ms.
 *
 * Each destination gets its own sweep for the same reason each destination
 * gets its own sound: arriving somewhere should feel like arriving *there*.
 * The lab is cold and the record is arcane, and the effect says so before the
 * page has finished rendering. */

/** Shared skeleton so the four themes differ only where they should. */
function pageSweep(
  streak: { texture: string; color: string; opacity: number; life: number },
  motes: { texture: string; color: string; count: number; size: readonly [number, number] }
): VfxScene {
  return {
    origin: { x: 0.5, y: 0.5 },
    emitters: [
      {
        texture: streak.texture,
        count: 1,
        motion: "expand",
        size: [200, 1100],
        speed: [0, 0],
        life: [streak.life, streak.life],
        spread: 0,
        gravity: 0,
        spin: [0, 0],
        delayMs: 0,
        color: streak.color,
        opacity: streak.opacity,
      },
      {
        texture: motes.texture,
        count: motes.count,
        motion: "rise",
        size: motes.size,
        speed: [110, 240],
        life: [500, 820],
        spread: 0,
        gravity: 0,
        spin: [0, 0],
        delayMs: 60,
        color: motes.color,
        opacity: 0.6,
      },
    ],
  };
}

/** 今日のクエスト — the hearth. Warm, plain, the baseline everything else
 * is heard against. */
const PAGE_HOME_SCENE = pageSweep(
  { texture: "flare.png", color: WARM, opacity: 0.34, life: 420 },
  { texture: "mote.png", color: GOLD, count: 16, size: [6, 14] }
);

/** 調査記録カレンダー — the ember heatmap. The quickest of the four. */
const PAGE_CALENDAR_SCENE = pageSweep(
  { texture: "flare.png", color: "#fb923c", opacity: 0.3, life: 340 },
  { texture: "glint.png", color: "#fdba74", count: 14, size: [6, 12] }
);

/** 研究所 — the frozen lab. Cold light, and a slow arc instead of a flare, so
 * it reads as a door swinging rather than a page catching the light. */
const PAGE_LAB_SCENE = pageSweep(
  { texture: "swirl.png", color: FROST, opacity: 0.3, life: 520 },
  { texture: "glint.png", color: "#bae6fd", count: 14, size: [6, 13] }
);

/** 記録 — the grimoire itself. The only page sweep that carries sigils. */
const PAGE_RECORD_SCENE = pageSweep(
  { texture: "flare.png", color: GOLD, opacity: 0.32, life: 480 },
  { texture: "sigil.png", color: GOLD, count: 12, size: [8, 15] }
);

const PAGE_SCENE_BY_PATH: Record<string, VfxScene> = {
  "/": PAGE_HOME_SCENE,
  "/all": PAGE_CALENDAR_SCENE,
  "/plant": PAGE_LAB_SCENE,
  "/book": PAGE_RECORD_SCENE,
};

/** Arrival sweep for a destination. Unknown paths (e.g. /settings, which is not
 * a tab) fall back to home, matching how PAGE_ACTION resolves its cue. */
export function pageScene(path: string): VfxScene {
  return PAGE_SCENE_BY_PATH[path] ?? PAGE_HOME_SCENE;
}

/** Every texture any scene can reference. The engine preloads this set, and a
 * test asserts each one exists under public/vfx. */
export const ALL_VFX_TEXTURES: readonly string[] = Array.from(
  new Set(
    [
      TAP_SCENE,
      ADD_RIPPLE_SCENE,
      CLEAR_LOW,
      CLEAR_MID,
      CLEAR_HIGH,
      ALL_CLEAR_SCENE,
      REPLAY_SCENE,
      FLOURISH_SCENE,
      MORNING_SCENE,
      PAGE_HOME_SCENE,
      PAGE_CALENDAR_SCENE,
      PAGE_LAB_SCENE,
      PAGE_RECORD_SCENE,
    ].flatMap((scene) => scene.emitters.map((emitter) => emitter.texture))
  )
).sort();
