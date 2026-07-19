import { flushSync } from "react-dom";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Commit a React state update inside a native View Transition so the
 * browser FLIP-animates list changes. Falls back to a plain update when
 * the API is missing or the user prefers reduced motion. */
export function withViewTransition(update: () => void): void {
  if (
    typeof document === "undefined" ||
    typeof document.startViewTransition !== "function" ||
    prefersReducedMotion()
  ) {
    update();
    return;
  }
  document.startViewTransition(() => {
    flushSync(update);
  });
}
