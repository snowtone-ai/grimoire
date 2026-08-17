"use client";

/* Ambient gold-particle background layer on every route except /plant (T036 /
 * D-038 — reopens D-024's "no full-screen particle display" rule, but scoped:
 * opt-in via the "背景の光の粒子" toggle (default off), excludes /plant (which
 * already has its own cold, downward-falling snow — the contrast in direction
 * and color temperature is intentional, not just clutter avoidance), and
 * matches the snow's sparse particle-count discipline rather than a dense
 * confetti-style field.
 *
 * Mounted once in layout.tsx alongside <PwaRegister />. Read once per pathname
 * change via an effect rather than during render, since layout.tsx is server-
 * rendered and localStorage/matchMedia are unavailable there — starting from
 * "not shown" and flipping on after mount avoids a hydration mismatch (same
 * read-once-per-mount tradeoff morning ambience already accepts: flipping the
 * toggle mid-session on another tab won't retroactively show/hide this layer
 * until the next navigation or app reopen). */

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isEffectEnabled } from "@/lib/fx";
import { GraceParticles } from "./grace-particles";

export function GraceParticlesGate() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Deferred to a microtask: setting state straight from an effect body
    // triggers a cascading render (react-hooks/set-state-in-effect, see T013).
    Promise.resolve().then(() => {
      setEnabled(pathname !== "/plant" && isEffectEnabled("ambientParticles"));
    });
  }, [pathname]);

  if (!enabled) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[-1]">
      <GraceParticles preset="ambient" />
    </div>
  );
}
