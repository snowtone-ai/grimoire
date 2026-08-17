/* Tap sparks — a one-frame glint under the finger on every press (D-036).
 *
 * User feedback: 「操作のたび、一瞬キラッとなるのとかも楽しい」. The app previously
 * had no feedback at all between "pressed a button" and "completed a quest", so
 * the only rewarding moments were the handful of completions in a day. This adds
 * the cheapest possible one, on the smallest possible surface.
 *
 * It is a single delegated pointerdown listener rather than a prop on every
 * button: the app already marks every pressable control with `btn-squish`, so
 * one listener covers every screen and no component has to opt in. The spark
 * group removes itself when its animation ends, so nothing accumulates.
 *
 * T036 juice pass: the single core flash now flings 2 small motes outward at
 * randomized angles alongside it (secondary motion) — the same "one physical
 * material springing apart" idea `.btn-squish` already uses, just on a smaller
 * scale. Both mote angle and reach are randomized per tap so repeated presses
 * don't read as a mechanical loop.
 *
 * Gated by the "タップの光" effect toggle — off (or OS reduced-motion, which
 * forces every visual effect off) produces nothing.
 */

import { isEffectEnabled } from "./fx.ts";

let attached = false;

const MOTE_COUNT = 2;
const MOTE_DIST_MIN = 14;
const MOTE_DIST_MAX = 26;

function spawnSpark(x: number, y: number): void {
  const group = document.createElement("span");
  group.className = "tap-spark-group";
  group.setAttribute("aria-hidden", "true");
  group.style.left = `${x}px`;
  group.style.top = `${y}px`;

  const core = document.createElement("span");
  core.className = "tap-spark";
  group.append(core);

  for (let i = 0; i < MOTE_COUNT; i++) {
    const mote = document.createElement("span");
    mote.className = "tap-spark-mote";
    const angle = Math.random() * 360;
    const dist = MOTE_DIST_MIN + Math.random() * (MOTE_DIST_MAX - MOTE_DIST_MIN);
    mote.style.setProperty("--angle", `${angle}deg`);
    mote.style.setProperty("--dist", `${dist}px`);
    group.append(mote);
  }

  group.addEventListener("animationend", () => group.remove(), { once: true });
  document.body.append(group);
  // Belt and braces: if the animation never fires (element hidden, animations
  // disabled mid-flight), still drop the node rather than leak it.
  setTimeout(() => group.remove(), 800);
}

function onPointerDown(event: PointerEvent): void {
  if (!isEffectEnabled("tapSpark")) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!target.closest(".btn-squish")) return;
  spawnSpark(event.clientX, event.clientY);
}

/** Install the delegated listener once per document. */
export function initTapSparks(): void {
  if (typeof window === "undefined" || attached) return;
  attached = true;
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
}
