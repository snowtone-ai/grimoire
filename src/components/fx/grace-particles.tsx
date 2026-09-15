"use client";

/* Grace particles — the ambient background light layer.
 *
 * Modeled on Elden Ring's "guidance of grace" motes: warm-gold, drifting
 * upward rather than falling, at three depths so the screen has air in it
 * rather than one flat plane of dots.
 *
 * Why this one effect stays in CSS while every other effect in the app moved to
 * the sprite engine (D-047): it is the only *persistent* layer. src/lib/vfx.ts
 * is built to stop dead the moment its last particle dies — a background that
 * never ends would pin a requestAnimationFrame loop open for as long as the app
 * is on screen, which on a phone is exactly the shape of a battery complaint.
 * These are compositor-driven CSS animations instead: they cost nothing on the
 * main thread, and the browser throttles them on its own when the tab is
 * backgrounded. The mote still uses the vendored texture — `.grace-mote` masks
 * a gold fill through /vfx/mote.png — so it matches what the sprite engine
 * draws, it just gets there by a different route.
 *
 * D-047 raised the count from 13 to 44 at the owner's request. The old figure
 * came from matching the /plant snowfall's particle-count discipline (D-024);
 * that discipline is preserved in kind rather than in number — still
 * transform/opacity only, still no animated blur, still nothing that forces a
 * layout — because the reason for it was frame cost, not sparseness for its
 * own sake.
 */

import { type CSSProperties } from "react";

interface ParticleDef {
  left: number;
  size: number;
  dur: number;
  delay: number;
  sway: number;
  peakOpacity: number;
}

interface LayerDef {
  count: number;
  size: readonly [number, number];
  dur: readonly [number, number];
  sway: readonly [number, number];
  opacity: readonly [number, number];
}

/* Three depths. Far motes are small, dim and slow; near motes are large,
 * brighter and quicker, which is what produces parallax from a flat 2D layer.
 * The near layer stays the smallest population on purpose — it is the one the
 * eye actually tracks, and a crowd of them would read as snow. */
const LAYERS: readonly LayerDef[] = [
  { count: 26, size: [2, 4], dur: [26, 36], sway: [10, 22], opacity: [0.26, 0.42] },
  { count: 12, size: [5, 8], dur: [20, 27], sway: [16, 30], opacity: [0.44, 0.6] },
  { count: 6, size: [9, 14], dur: [15, 21], sway: [22, 40], opacity: [0.5, 0.68] },
];

/* Deterministic placement. Hand-authoring 44 entries the way the 13-mote
 * version did would be unreadable, but Math.random would give a different sky
 * on every render — and, more importantly, would make this component's output
 * impossible to reason about or diff. mulberry32 with a fixed seed gives a
 * fixed, reviewable arrangement that still looks scattered. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildAmbient(): ParticleDef[] {
  const random = seeded(0x6a17);
  const particles: ParticleDef[] = [];
  const between = (range: readonly [number, number]) =>
    range[0] + random() * (range[1] - range[0]);

  for (const layer of LAYERS) {
    for (let i = 0; i < layer.count; i++) {
      const dur = between(layer.dur);
      particles.push({
        // Spread across the width in even bands, jittered inside each band, so
        // no run of the generator can leave a visibly empty column.
        left: ((i + random()) / layer.count) * 100,
        size: Math.round(between(layer.size) * 10) / 10,
        dur: Math.round(dur * 10) / 10,
        // Negative delays start the loop mid-flight, so the screen is already
        // full of motes on the first frame instead of filling up over 30s.
        delay: -Math.round(random() * dur * 10) / 10,
        sway: Math.round(between(layer.sway)) * (random() < 0.5 ? -1 : 1),
        peakOpacity: Math.round(between(layer.opacity) * 100) / 100,
      });
    }
  }
  return particles;
}

const AMBIENT: readonly ParticleDef[] = buildAmbient();

export function GraceParticles() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {AMBIENT.map((particle, index) => (
        <span
          key={index}
          className="grace-mote"
          style={
            {
              left: `${particle.left}%`,
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
