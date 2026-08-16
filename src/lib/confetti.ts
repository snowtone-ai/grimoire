/* Confetti bursts — frost & ember star palette, scaled by the effects preset.
 *
 * Extracted from use-home-screen so /book can replay a drop's moment with the
 * same visuals the original completion had (D-036). Every burst goes through the
 * current FxProfile, so "しずか" produces nothing at all and "にぎやか" both
 * throws more particles and adds a second wave — the second wave is what answers
 * the report that the confetti was over before the reward card had been read.
 *
 * Reduced motion needs no separate check here: getFxIntensity() already forces
 * the quiet profile when the OS asks for reduced motion.
 */

import confetti from "canvas-confetti";
import { currentFxProfile } from "./fx.ts";

const EMBER = ["#fb923c", "#fbbf24"];
const FROST = ["#7dd3fc", "#38bdf8", "#e0f2fe"];
const GOLD = ["#fbbf24", "#f59e0b", "#fde68a"];

/** Delay between waves: long enough to read as a second burst rather than a
 * thicker first one, short enough to still feel like one moment. */
const WAVE_GAP_MS = 450;

function scale(count: number, factor: number): number {
  return Math.max(1, Math.round(count * factor));
}

/** RARE 1-8 buckets into low(1-3) / mid(4-6) / high(7-8) confetti intensities. */
function dropBurst(rarity: number, factor: number): confetti.Options {
  if (rarity <= 3) {
    return {
      particleCount: scale(30, factor),
      spread: 55,
      startVelocity: 28,
      shapes: ["star"],
      scalar: 0.8,
      origin: { y: 0.6 },
      colors: [...EMBER, FROST[0]],
    };
  }
  if (rarity <= 6) {
    return {
      particleCount: scale(70, factor),
      spread: 75,
      shapes: ["star"],
      scalar: 1,
      origin: { y: 0.55 },
      colors: [...FROST, EMBER[1]],
    };
  }
  return {
    particleCount: scale(130, factor),
    spread: 100,
    startVelocity: 40,
    shapes: ["star"],
    scalar: 1.15,
    origin: { y: 0.5 },
    colors: [...GOLD, ...FROST],
  };
}

/* canvas-confetti draws straight onto document.body, outside React's tree, so a
 * queued wave survives the unmount of whatever screen started it. Every pending
 * timer is tracked here so a screen can call cancelPendingConfetti() on the way
 * out and be sure nothing lands on its successor — a per-burst handle is easy to
 * forget at one of several call sites, which is exactly what happened. */
const pendingWaves = new Set<ReturnType<typeof setTimeout>>();

/** Fire `waves` bursts spaced by WAVE_GAP_MS. Returns a cancel function for this
 * burst alone; see cancelPendingConfetti for the screen-level guarantee. */
function fireWaves(waves: number, fire: () => void): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  fire();
  for (let wave = 1; wave < waves; wave++) {
    const timer = setTimeout(() => {
      pendingWaves.delete(timer);
      fire();
    }, wave * WAVE_GAP_MS);
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

/** Drop every wave that has not fired yet, whoever queued it. */
export function cancelPendingConfetti(): void {
  for (const timer of pendingWaves) clearTimeout(timer);
  pendingWaves.clear();
}

const noop = () => {};

export function fireDropConfetti(rarity: number): () => void {
  const { confettiWaves, confettiScale } = currentFxProfile();
  if (confettiWaves < 1) return noop;
  return fireWaves(confettiWaves, () => confetti(dropBurst(rarity, confettiScale)));
}

export function fireAllCompleteConfetti(): () => void {
  const { confettiWaves, celebrationScale } = currentFxProfile();
  if (confettiWaves < 1 || celebrationScale <= 0) return noop;

  const colors = [...EMBER, ...FROST, GOLD[2]];
  const particleCount = scale(110, celebrationScale);
  const cannon = (angle: number, x: number) =>
    confetti({ particleCount, angle, spread: 70, shapes: ["star"], origin: { x, y: 0.6 }, colors });

  return fireWaves(confettiWaves, () => {
    cannon(60, 0);
    cannon(120, 1);
  });
}
