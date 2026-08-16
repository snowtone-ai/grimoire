"use client";

import { useEffect } from "react";
import { initTapSparks } from "@/lib/spark";

export function PwaRegister() {
  // Mounted once in the root layout, which makes it the app-wide place to
  // install the delegated tap-spark listener (it must cover every screen).
  useEffect(() => {
    initTapSparks();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    function reloadOnce() {
      try {
        if (sessionStorage.getItem("sw-updated-reload") === "1") return;
        sessionStorage.setItem("sw-updated-reload", "1");
      } catch {
        // Private mode / storage full — still reload once; worst case user reloads manually.
      }
      window.location.reload();
    }

    // Always listen for controller changes. The previous implementation only
    // attached this when a controller already existed, which missed the very
    // case we care about: a freshly-activated SW taking over a page that had none.
    navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);

    function register() {
      if (cancelled) return;
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          if (cancelled) return;

          // Prompt any already-waiting SW to take over.
          if (reg.waiting && navigator.serviceWorker.controller) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }

          // Watch for newly-found updates and activate them as soon as they install.
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (
                installing.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                installing.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });

          // Proactively check for a new SW on every page load.
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.error("[PWA] Service Worker registration failed:", err);
        });
    }

    // Defer registration until after first paint so SW install cannot delay
    // the initial JS from executing (mattered on slower Android devices).
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", reloadOnce);
    };
  }, []);

  return null;
}
