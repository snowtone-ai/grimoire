/* Confetti bursts — frost & ember star palette, gated by the "completion" effect
 * toggle (T036 / D-039, replacing the old confettiWaves/confettiScale intensity
 * plumbing — there is only one quality level now, not three).
 *
 * Extracted from use-home-screen so /book can replay a drop's moment (D-036).
 * Every burst goes through isEffectEnabled("completion"), so turning that toggle
 * off (or OS reduced-motion, which forces it off) produces nothing at all.
 *
 * Replay (tapping an already-collected item in /book) deliberately uses a
 * different burst than task completion: VoC feedback was that seeing the same
 * "quest clear" star-shower for an idle browse of the collection made the two
 * feel identical, when one is an achievement moment and the other is a look
 * back at something already earned. fireReplayEffect swaps stars for a gentler
 * radial twinkle. Both now read their color from rarity-style.ts's single
 * ascending ramp (previously two separately-maintained color tables).
 *
 * Juice pass (T036): every completion burst is preceded by a tiny high-velocity
 * "anticipation" puff ~40ms earlier, so the moment reads as wind-up -> release
 * instead of a flat pop, and higher-rank bursts get a touch of horizontal drift
 * and mixed star/circle shapes for texture instead of uniform stars.
 */

import confetti from "canvas-confetti";
import { isEffectEnabled } from "./fx.ts";
import { rarityStyle, type RarityBand } from "./domain/rarity-style.ts";

/* canvas-confetti draws straight onto document.body, outside React's tree, so a
 * queued step survives the unmount of whatever screen started it. Every pending
 * timer is tracked here so a screen can call cancelPendingConfetti() on the way
 * out and be sure nothing lands on its successor — a per-burst handle is easy to
 * forget at one of several call sites, which is exactly what happened once. */
const pendingWaves = new Set<ReturnType<typeof setTimeout>>();

/** Drop every step that has not fired yet, whoever queued it. */
export function cancelPendingConfetti(): void {
  for (const timer of pendingWaves) clearTimeout(timer);
  pendingWaves.clear();
}

const noop = () => {};

/** Fire a sequence of steps spaced `gapMs` apart (the first fires immediately).
 * Every scheduled step is tracked in the shared pending set; the returned
 * canceler additionally scopes to just this call's own steps. */
function fireSequence(steps: Array<() => void>, gapMs: number): () => void {
  if (steps.length === 0) return noop;
  const timers: ReturnType<typeof setTimeout>[] = [];
  steps[0]();
  for (let i = 1; i < steps.length; i++) {
    const step = steps[i];
    const timer = setTimeout(() => {
      pendingWaves.delete(timer);
      step();
    }, i * gapMs);
    timers.push(timer);
    pendingWaves.add(timer);
  }
  return () => {
    for (const timer of timers) {
      clearTimeout(timer);
      pendingWaves.delete(timer);
    }
  };
}

const BAND_PARAMS: Record<
  RarityBand,
  { particleCount: number; spread: number; startVelocity: number; scalar: number; originY: number; drift: number }
> = {
  low: { particleCount: 30, spread: 55, startVelocity: 28, scalar: 0.8, originY: 0.6, drift: 0 },
  mid: { particleCount: 70, spread: 75, startVelocity: 32, scalar: 1, originY: 0.55, drift: 0.3 },
  high: { particleCount: 130, spread: 100, startVelocity: 42, scalar: 1.15, originY: 0.5, drift: 0.6 },
};

const BAND_COMPANION_COLOR: Record<RarityBand, string> = {
  low: "#7dd3fc",
  mid: "#fbbf24",
  high: "#fde68a",
};

function dropBurst(rarity: number): confetti.Options {
  const style = rarityStyle(rarity);
  const params = BAND_PARAMS[style.band];
  return {
    particleCount: params.particleCount,
    spread: params.spread,
    startVelocity: params.startVelocity,
    scalar: params.scalar,
    origin: { y: params.originY },
    drift: params.drift,
    shapes: style.band === "high" ? ["star", "circle"] : ["star"],
    colors: [style.color, "#ffffff", BAND_COMPANION_COLOR[style.band]],
  };
}

/** A brief, low-count, high-velocity puff fired just ahead of the main burst —
 * the burst reads as "wind-up -> release" rather than a flat pop. */
function anticipationPuff(rarity: number): confetti.Options {
  const style = rarityStyle(rarity);
  return {
    particleCount: 6,
    spread: 40,
    startVelocity: 16,
    ticks: 22,
    scalar: 0.4,
    gravity: 0.4,
    origin: { y: 0.62 },
    colors: [style.color],
  };
}

export function fireDropConfetti(rarity: number): () => void {
  if (!isEffectEnabled("completion")) return noop;
  return fireSequence([() => confetti(anticipationPuff(rarity)), () => confetti(dropBurst(rarity))], 40);
}

/** Gentle radial twinkle: circles (not stars), falling outward from center
 * rather than launched upward, scaled by rank in reach and count only — the
 * shape and motion stay the same across ranks so it always reads as "replay",
 * distinguishing rank through color and size alone. */
function replayTwinkle(rarity: number): confetti.Options {
  const style = rarityStyle(rarity);
  return {
    particleCount: 14 + rarity * 3,
    startVelocity: 10 + rarity,
    spread: 360,
    ticks: 90,
    gravity: 0.5,
    scalar: 0.5 + rarity * 0.04,
    shapes: ["circle"],
    origin: { y: 0.42 },
    colors: [style.color, "#ffffff"],
  };
}

/** /book replay effect: a single gentle twinkle, distinct in shape and motion
 * from fireDropConfetti's star bursts, colored by the tapped item's rarity. */
export function fireReplayEffect(rarity: number): () => void {
  if (!isEffectEnabled("completion")) return noop;
  return fireSequence([() => confetti(replayTwinkle(rarity))], 0);
}

export function fireAllCompleteConfetti(): () => void {
  if (!isEffectEnabled("completion")) return noop;
  const colors = ["#fb923c", "#fbbf24", "#38bdf8", "#e0f2fe"];
  const particleCount = 110;
  const cannon = (angle: number, x: number) =>
    confetti({ particleCount, angle, spread: 70, shapes: ["star"], origin: { x, y: 0.6 }, colors });
  return fireSequence(
    [
      () => {
        cannon(60, 0);
        cannon(120, 1);
      },
    ],
    0
  );
}
