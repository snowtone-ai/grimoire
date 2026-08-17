"use client";

/* Grace particles — shared gold-mote primitive (T036), modeled on Elden Ring's
 * "guidance of grace" motes: sparse, slow, warm-gold, drifting upward rather
 * than falling. Four presets share one component instead of four bespoke
 * particle systems, since they are the same visual primitive at different
 * densities/speeds:
 *   - "ambient": the background layer on every route except /plant (13 motes,
 *     ~20-27s loop, matches the existing snowfall's particle-count discipline).
 *   - "morning": denser/brighter, one-shot, timed to the morning greeting's
 *     window.
 *   - "open": densest/fastest, one-shot, the one context explicitly authorized
 *     to be lavish (the app-open flourish).
 *   - "reveal": a handful, one-shot, behind a rank-8 drop-reveal card.
 *
 * Same authoring pattern as plant-screen.tsx's Snowfall: a hand-placed array of
 * particle definitions rendered as absolutely-positioned spans driven by CSS
 * custom properties, not a canvas/WebGL system (D-024's performance discipline —
 * transform/opacity only, no animated blur).
 */

import { type CSSProperties } from "react";

export type GraceParticlesPreset = "ambient" | "morning" | "open" | "reveal";

interface ParticleDef {
  left: string;
  size: number;
  dur: number;
  delay: number;
  sway: number;
  peakOpacity: number;
}

const AMBIENT: readonly ParticleDef[] = [
  { left: "4%", size: 3, dur: 24, delay: -4, sway: 20, peakOpacity: 0.6 },
  { left: "13%", size: 2, dur: 20, delay: -14, sway: -16, peakOpacity: 0.5 },
  { left: "22%", size: 4, dur: 27, delay: -8, sway: 24, peakOpacity: 0.65 },
  { left: "33%", size: 2, dur: 22, delay: -2, sway: -20, peakOpacity: 0.5 },
  { left: "41%", size: 3, dur: 25, delay: -18, sway: 18, peakOpacity: 0.55 },
  { left: "52%", size: 2, dur: 21, delay: -6, sway: -22, peakOpacity: 0.5 },
  { left: "60%", size: 4, dur: 26, delay: -11, sway: 20, peakOpacity: 0.6 },
  { left: "68%", size: 2, dur: 23, delay: -20, sway: -18, peakOpacity: 0.5 },
  { left: "76%", size: 3, dur: 20, delay: -3, sway: 22, peakOpacity: 0.55 },
  { left: "83%", size: 2, dur: 25, delay: -16, sway: -20, peakOpacity: 0.5 },
  { left: "89%", size: 4, dur: 22, delay: -9, sway: 18, peakOpacity: 0.6 },
  { left: "95%", size: 2, dur: 27, delay: -1, sway: -16, peakOpacity: 0.5 },
  { left: "48%", size: 3, dur: 24, delay: -22, sway: 24, peakOpacity: 0.55 },
] as const;

const MORNING: readonly ParticleDef[] = [
  { left: "8%", size: 3, dur: 3.6, delay: 0, sway: 14, peakOpacity: 0.85 },
  { left: "18%", size: 2, dur: 4.0, delay: 0.15, sway: -10, peakOpacity: 0.75 },
  { left: "29%", size: 4, dur: 3.4, delay: 0.3, sway: 16, peakOpacity: 0.9 },
  { left: "41%", size: 2, dur: 4.2, delay: 0.05, sway: -12, peakOpacity: 0.75 },
  { left: "53%", size: 3, dur: 3.8, delay: 0.4, sway: 14, peakOpacity: 0.85 },
  { left: "64%", size: 2, dur: 4.1, delay: 0.2, sway: -14, peakOpacity: 0.75 },
  { left: "74%", size: 4, dur: 3.5, delay: 0.1, sway: 12, peakOpacity: 0.9 },
  { left: "84%", size: 2, dur: 3.9, delay: 0.35, sway: -16, peakOpacity: 0.75 },
  { left: "92%", size: 3, dur: 4.0, delay: 0.25, sway: 14, peakOpacity: 0.85 },
  { left: "36%", size: 2, dur: 3.7, delay: 0.45, sway: -10, peakOpacity: 0.75 },
] as const;

const OPEN: readonly ParticleDef[] = [
  { left: "6%", size: 3, dur: 1.8, delay: 0, sway: 18, peakOpacity: 0.95 },
  { left: "14%", size: 4, dur: 2.1, delay: 0.06, sway: -14, peakOpacity: 0.9 },
  { left: "22%", size: 2, dur: 1.6, delay: 0.12, sway: 20, peakOpacity: 0.85 },
  { left: "30%", size: 5, dur: 2.3, delay: 0.02, sway: -16, peakOpacity: 1 },
  { left: "38%", size: 3, dur: 1.9, delay: 0.18, sway: 14, peakOpacity: 0.9 },
  { left: "46%", size: 2, dur: 2.0, delay: 0.08, sway: -18, peakOpacity: 0.85 },
  { left: "54%", size: 4, dur: 1.7, delay: 0.14, sway: 16, peakOpacity: 0.95 },
  { left: "62%", size: 3, dur: 2.2, delay: 0.04, sway: -14, peakOpacity: 0.9 },
  { left: "70%", size: 2, dur: 1.8, delay: 0.2, sway: 18, peakOpacity: 0.85 },
  { left: "78%", size: 5, dur: 2.1, delay: 0.1, sway: -20, peakOpacity: 1 },
  { left: "86%", size: 3, dur: 1.9, delay: 0.16, sway: 14, peakOpacity: 0.9 },
  { left: "94%", size: 2, dur: 2.3, delay: 0, sway: -16, peakOpacity: 0.85 },
  { left: "10%", size: 4, dur: 1.6, delay: 0.22, sway: 18, peakOpacity: 0.95 },
  { left: "58%", size: 2, dur: 2.0, delay: 0.28, sway: -14, peakOpacity: 0.85 },
  { left: "42%", size: 3, dur: 1.8, delay: 0.24, sway: 16, peakOpacity: 0.9 },
  { left: "82%", size: 4, dur: 2.2, delay: 0.06, sway: -18, peakOpacity: 0.95 },
] as const;

const REVEAL: readonly ParticleDef[] = [
  { left: "20%", size: 3, dur: 2.0, delay: 0, sway: 12, peakOpacity: 0.8 },
  { left: "38%", size: 2, dur: 2.3, delay: 0.12, sway: -10, peakOpacity: 0.7 },
  { left: "55%", size: 4, dur: 1.9, delay: 0.06, sway: 14, peakOpacity: 0.85 },
  { left: "70%", size: 2, dur: 2.2, delay: 0.18, sway: -12, peakOpacity: 0.7 },
  { left: "84%", size: 3, dur: 2.1, delay: 0.09, sway: 10, peakOpacity: 0.8 },
] as const;

const PRESET_PARTICLES: Record<GraceParticlesPreset, readonly ParticleDef[]> = {
  ambient: AMBIENT,
  morning: MORNING,
  open: OPEN,
  reveal: REVEAL,
};

/** "ambient" loops forever (it's a persistent background layer); the other
 * three are one-shot, tied to a finite moment. */
const PRESET_LOOPS: Record<GraceParticlesPreset, boolean> = {
  ambient: true,
  morning: false,
  open: false,
  reveal: false,
};

export function GraceParticles({ preset }: { preset: GraceParticlesPreset }) {
  const particles = PRESET_PARTICLES[preset];
  const loop = PRESET_LOOPS[preset];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((particle, index) => (
        <span
          key={`${preset}-${index}`}
          className={loop ? "grace-mote grace-mote-loop" : "grace-mote grace-mote-once"}
          style={
            {
              left: particle.left,
              width: particle.size,
              height: particle.size,
              "--dur": `${particle.dur}s`,
              "--delay": `${particle.delay}s`,
              "--sway": `${particle.sway}px`,
              "--peak-opacity": particle.peakOpacity,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
