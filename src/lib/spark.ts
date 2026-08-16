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
 * element removes itself when its animation ends, so nothing accumulates.
 *
 * Gated by the effects preset — "しずか" (and therefore OS reduced-motion, which
 * forces that preset) produces nothing.
 */

import { currentFxProfile } from "./fx.ts";

const SPARK_CLASS = "tap-spark";
let attached = false;

function spawnSpark(x: number, y: number): void {
  const spark = document.createElement("span");
  spark.className = SPARK_CLASS;
  spark.setAttribute("aria-hidden", "true");
  spark.style.left = `${x}px`;
  spark.style.top = `${y}px`;
  spark.addEventListener("animationend", () => spark.remove(), { once: true });
  document.body.append(spark);
  // Belt and braces: if the animation never fires (element hidden, animations
  // disabled mid-flight), still drop the node rather than leak it.
  setTimeout(() => spark.remove(), 800);
}

function onPointerDown(event: PointerEvent): void {
  if (!currentFxProfile().microFeedback) return;
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
