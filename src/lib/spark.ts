/* Tap sparks — one delegated listener that turns every press into a glint.
 *
 * User feedback that started this (D-036): 「操作のたび、一瞬キラッとなるのとかも
 * 楽しい」. The app had no feedback at all between "pressed a button" and
 * "completed a quest", so the only rewarding moments were the handful of
 * completions in a day.
 *
 * It stays a single delegated pointerdown listener rather than a prop on every
 * button: the app already marks every pressable control with `btn-squish`, so
 * one listener covers every screen and no component has to opt in.
 *
 * D-047 moved the drawing itself out of here. It used to build a group of DOM
 * spans per tap and rely on `animationend` (plus a belt-and-braces timeout) to
 * take them back out of the document; the spark is now one scene in the shared
 * sprite engine, which owns particle lifetime for the whole app. This file is
 * left with the one job it was always really doing: deciding what counts as a
 * press, and where it happened.
 */

import { fireTapSpark } from "./vfx.ts";

let attached = false;

function onPointerDown(event: PointerEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!target.closest(".btn-squish")) return;
  fireTapSpark(event.clientX, event.clientY);
}

/** Install the delegated listener once per document. */
export function initTapSparks(): void {
  if (typeof window === "undefined" || attached) return;
  attached = true;
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
}
