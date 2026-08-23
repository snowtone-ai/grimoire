"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const GUARD_HASH = "#explore";

/**
 * Lets the platform Back gesture close a full-screen dialog instead of
 * leaving the page underneath it. Radix's Escape/overlay handling already
 * calls onOpenChange directly, so this only has to bridge the browser/Android
 * history-back path.
 *
 * Two other approaches were tried and rejected (verified live, not just in
 * theory):
 *   - A pushState call with no URL change (empty/omitted url argument) does
 *     not produce a distinguishable entry here — Next's App Router folds it
 *     into its own state sync instead.
 *   - next/navigation's router.push with a hash-only change is silently a
 *     no-op in this Next.js version (history.length does not change) —
 *     App Router treats a same-pathname hash change as an in-page anchor
 *     scroll, not a navigation.
 * A raw history.pushState call with an actual different URL string (the
 * hash appended) does create a real entry that a real popstate fires
 * against, confirmed by inspecting history.length/location.hash before and
 * after in a live page. That is what this hook uses; it deliberately calls
 * the DOM API directly instead of the router.
 *
 * The push itself is deferred to a microtask, matching open-flourish.tsx's
 * pattern for the same reason: React 19 dev/StrictMode mounts, cleans up,
 * and mounts again, and history.back() (used to unwind an abandoned push in
 * cleanup) is itself asynchronous, so an immediate push-in-effect races the
 * second mount and can leave the guard entry missing or doubled. Deferring
 * lets the first, doomed mount's cleanup flip `cancelled` before its push
 * would have run, so only the second mount's push actually happens.
 */
export function useDialogBackClose(open: boolean, onOpenChange: (open: boolean) => void) {
  const pathname = usePathname();
  const guardActiveRef = useRef(false);
  const onOpenChangeRef = useRef(onOpenChange);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      history.pushState({ dialogBackGuard: true }, "", `${pathname}${GUARD_HASH}`);
      guardActiveRef.current = true;
    });

    const handlePopState = () => {
      if (!guardActiveRef.current) return;
      guardActiveRef.current = false;
      onOpenChangeRef.current(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      cancelled = true;
      window.removeEventListener("popstate", handlePopState);
      if (guardActiveRef.current) {
        guardActiveRef.current = false;
        history.back();
      }
    };
  }, [open, pathname]);
}
