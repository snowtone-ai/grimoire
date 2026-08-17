"use client";

/* Open-app flourish (T036): a gold ornate-frame + particle arrival moment on
 * app open, gated by the "起動時の演出" toggle (default off — opt-in only, for
 * users on the settings "追加の演出" section who explicitly want it). Not
 * built around the app icon/logo — mid-session the owner corrected the initial
 * "splash screen" framing: this is "a gorgeous arrival effect," not a loading
 * screen tied to branding. It's a pure choreography moment: vignette fade-in
 * -> gold frame draws in with its corners popping first (anticipation, via
 * --ease-spring) -> grace particles rise from within the frame -> a short
 * one-line greeting -> auto fade-out, tap/Escape-to-skip at any point.
 *
 * Overlay only: {children} in layout.tsx mounts and starts loading its own
 * data immediately underneath, so this never blocks or delays the app's own
 * content the way a real loading splash would (F-1 does not formally gate
 * this effect — the user opted into it via the toggle — but there is zero
 * cost to keeping the two concurrent anyway).
 *
 * sessionStorage-scoped (not localStorage): shows once per fresh session/tab,
 * not on every in-app navigation between routes. */

import { useEffect, useState } from "react";
import { isEffectEnabled } from "@/lib/fx";
import { GraceParticles } from "./grace-particles";

const SESSION_KEY = "grimoire-flourish-shown";
const AUTO_DISMISS_MS = 2600;

export function OpenFlourish() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isEffectEnabled("openFlourish")) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // sessionStorage unavailable: fall through and show it anyway, once per mount.
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Deferred to a microtask: setting state straight from an effect body
    // triggers a cascading render (react-hooks/set-state-in-effect, see T013).
    Promise.resolve().then(() => {
      if (cancelled) return;
      setVisible(true);
      timer = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
  }

  return (
    <button
      type="button"
      className="open-flourish fixed inset-0 z-[90] flex w-full flex-col items-center justify-center bg-black/70"
      aria-label="演出をスキップ"
      onClick={dismiss}
      onKeyDown={(event) => {
        if (event.key === "Escape") dismiss();
      }}
    >
      <GraceParticles preset="open" />
      <div className="relative flex h-[62vmin] w-[62vmin] max-h-[380px] max-w-[380px] items-center justify-center">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          fill="none"
          aria-hidden
        >
          <rect
            x="4"
            y="4"
            width="92"
            height="92"
            rx="6"
            pathLength={1}
            className="open-flourish-frame-rect"
            stroke="var(--gold)"
            strokeWidth="1.2"
          />
        </svg>
        <span className="open-flourish-corner open-flourish-corner-tl" aria-hidden />
        <span className="open-flourish-corner open-flourish-corner-tr" aria-hidden />
        <span className="open-flourish-corner open-flourish-corner-bl" aria-hidden />
        <span className="open-flourish-corner open-flourish-corner-br" aria-hidden />

        <div className="relative px-6 text-center">
          <p className="font-display text-[11px] font-bold tracking-[0.32em] text-gold">
            GRIMOIRE
          </p>
          <p className="open-flourish-message mt-2 text-sm text-white/85">
            今日の記録を始めましょう
          </p>
        </div>
      </div>

      <p className="open-flourish-skip absolute bottom-10 text-[11px] text-white/60">
        タップしてスキップ
      </p>
    </button>
  );
}
