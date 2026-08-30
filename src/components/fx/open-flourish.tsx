"use client";

/* Open-app flourish: the grimoire being opened, on app open.
 *
 * Gated by the "起動時の演出" toggle. Not built around the app icon/logo —
 * mid-session in T036 the owner corrected the initial "splash screen" framing:
 * this is "a gorgeous arrival effect," not a loading screen tied to branding.
 *
 * D-047 rebuilt it from the vendored assets, and the choreography is now one
 * physical action told in three beats rather than a frame that draws itself for
 * no stated reason:
 *
 *   0ms    the clasp springs open              (cues/clasp.wav)
 *   200ms  the cover lifts                     (cues/book-open.wav)
 *   260ms  a summoning circle opens underneath (vfx/arcane-circle.png)
 *   300ms  the gold frame draws itself in      (CSS, unchanged from T036)
 *   400ms  light rises out of the page         (cues/flourish.wav + motes)
 *
 * The sound half lives in domain/sound-cues.ts ("flourish", a three-step cue)
 * and the particle half in domain/vfx-scenes.ts (FLOURISH_SCENE); the delays
 * above are set in those two files, not here. This component owns only the
 * frame, the greeting, and the dismissal.
 *
 * Overlay only: {children} in layout.tsx mounts and starts loading its own data
 * immediately underneath, so this never blocks or delays the app's own content
 * the way a real loading splash would.
 *
 * sessionStorage-scoped (not localStorage): shows once per fresh session/tab,
 * not on every in-app navigation between routes. */

import { useEffect, useState } from "react";
import { isEffectEnabled } from "@/lib/fx";
import { playCue } from "@/lib/sound";
import { cancelEffects, fireFlourishEffect } from "@/lib/vfx";

const SESSION_KEY = "grimoire-flourish-shown";
/* Long enough for the last of FLOURISH_SCENE's particles to clear. The
 * longest-lived is the mote emitter: 460ms delay + up to 2400ms of life =
 * 2860ms, so the margin here is 140ms, not much. Shorter, and the overlay
 * would fade out from under its own particles — anyone retuning
 * FLOURISH_SCENE needs to re-check this number against the mote emitter. */
const AUTO_DISMISS_MS = 3000;
const CLOSE_DURATION_MS = 400;

type Phase = "hidden" | "shown" | "closing";

export function OpenFlourish() {
  const [phase, setPhase] = useState<Phase>("hidden");

  useEffect(() => {
    if (!isEffectEnabled("openFlourish")) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Deferred to a microtask: setting state straight from an effect body
    // triggers a cascading render (react-hooks/set-state-in-effect, see T013).
    // The sessionStorage check-and-claim also lives inside this microtask
    // (not synchronously in the effect body) so that React 19 dev/StrictMode's
    // mount->cleanup->mount double-invoke doesn't let the first, doomed mount
    // claim the token before its cleanup sets `cancelled`, which would leave
    // the second mount seeing the token already spent and never showing the
    // flourish at all.
    Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        if (sessionStorage.getItem(SESSION_KEY) === "1") return;
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // sessionStorage unavailable: fall through and show it anyway, once per mount.
      }
      setPhase("shown");
      // Both halves start here, on the same tick; each carries its own internal
      // timing so the sound and the light stay in step without a shared clock.
      playCue("flourish");
      fireFlourishEffect();
      timer = setTimeout(() => setPhase("closing"), AUTO_DISMISS_MS);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (phase !== "closing") return;
    const timer = setTimeout(() => setPhase("hidden"), CLOSE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "hidden") return null;

  function dismiss() {
    // Skipping has to take the particles with it: the sprite canvas is above
    // this overlay by design, so motes left running would keep drawing over the
    // quest list the user just skipped ahead to see.
    cancelEffects();
    setPhase("closing");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="アプリ起動演出"
      className={`open-flourish fixed inset-0 z-[90] flex w-full flex-col items-center justify-center bg-black/70 ${
        phase === "closing" ? "open-flourish-closing" : ""
      }`}
      onClick={dismiss}
    >
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
          <p className="font-display text-[0.6875rem] font-bold tracking-[0.32em] text-gold">
            GRIMOIRE
          </p>
          <p className="open-flourish-message mt-2 text-sm text-white/85">
            今日の記録を始めましょう
          </p>
        </div>
      </div>

      <button
        type="button"
        autoFocus
        onClick={dismiss}
        onKeyDown={(event) => {
          if (event.key === "Escape") dismiss();
        }}
        className="open-flourish-skip absolute bottom-10 text-[0.6875rem] text-white/60"
      >
        タップしてスキップ
      </button>
    </div>
  );
}
