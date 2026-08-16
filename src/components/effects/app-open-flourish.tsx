"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { randomRecipe, type RecipeId } from "@/lib/three/domain-recipes";
import { prefersReducedMotion } from "@/lib/view-transition";

/* Gorgeous, random full-screen flourish on cold app-open (item requirement
 * 4). Mounted from home-screen.tsx only (not layout.tsx) so it fires on
 * landing at "/" fresh, not on every internal route change. Fires at most
 * once per browser session (sessionStorage), auto-dismisses, tap-to-skip,
 * and is skipped entirely (no WebGL mount at all) under
 * prefers-reduced-motion — matching D-024's restraint rule of degrading to
 * near-nothing rather than a lesser version of the same animation. */

const SESSION_KEY = "grimoire-open-fx-shown";
const DURATION_MS = 1800;

// A few warm accent hexes to cycle through (independent of any single
// item's color, since this isn't tied to a specific drop) — reuses the
// same --gold/--frost/--brand family already established in globals.css.
const ACCENTS = ["#e8c868", "#7fb8e0", "#e0633a", "#c5a0e8", "#4f8f52"];

const RecipeBurst = dynamic(
  () => import("@/components/three/recipe-burst").then((m) => ({ default: m.RecipeBurst })),
  { ssr: false }
);

interface FlourishPlan {
  shouldShow: boolean;
  recipe: RecipeId;
  accent: string;
}

/** Decide once, synchronously, whether this mount should show the flourish
 * and which variant — a one-time read of reduced-motion + sessionStorage,
 * not something that needs its own effect+setState round trip. */
function decideFlourish(): FlourishPlan {
  if (prefersReducedMotion()) {
    return { shouldShow: false, recipe: "radiant", accent: ACCENTS[0] };
  }
  let shown = false;
  try {
    shown = sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    // Best-effort; if storage is unavailable, just don't show it twice
    // this render (no persistence across reloads, acceptable degrade).
  }
  if (shown) {
    return { shouldShow: false, recipe: "radiant", accent: ACCENTS[0] };
  }

  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Best-effort.
  }
  return {
    shouldShow: true,
    recipe: randomRecipe(),
    accent: ACCENTS[Math.floor(Math.random() * ACCENTS.length)],
  };
}

export function AppOpenFlourish() {
  const [plan] = useState(decideFlourish);
  const [visible, setVisible] = useState(plan.shouldShow);

  useEffect(() => {
    if (!plan.shouldShow) return;
    const timer = setTimeout(() => setVisible(false), DURATION_MS);
    return () => clearTimeout(timer);
  }, [plan.shouldShow]);

  if (!visible) return null;
  const { recipe, accent } = plan;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="ようこそ"
      className="fixed inset-0 z-[70] animate-fade-in"
      onClick={() => setVisible(false)}
    >
      <RecipeBurst recipe={recipe} color={accent} durationMs={DURATION_MS} onDone={() => setVisible(false)} />
    </div>
  );
}
