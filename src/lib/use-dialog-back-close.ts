"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const GUARD_HASH = "#explore";

type DialogGuard = {
  pathname: string;
  onPopState: () => void;
};

let activeDialogGuard: DialogGuard | null = null;

function registerDialogGuard(guard: DialogGuard) {
  activeDialogGuard = guard;
  return () => {
    if (activeDialogGuard === guard) activeDialogGuard = null;
  };
}

/**
 * Installs before next-view-transitions' passive popstate listener. The
 * bridge only consumes a Back traversal away from the active dialog's
 * synthetic hash entry; ordinary history events continue to the app router.
 */
export function DialogBackHistoryBridge() {
  useLayoutEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const guard = activeDialogGuard;
      if (
        !guard ||
        window.location.pathname !== guard.pathname ||
        window.location.hash === GUARD_HASH ||
        (event.state && event.state.dialogBackGuard)
      ) {
        return;
      }

      activeDialogGuard = null;
      event.stopImmediatePropagation();
      guard.onPopState();
    };

    window.addEventListener("popstate", handlePopState, true);
    return () => window.removeEventListener("popstate", handlePopState, true);
  }, []);

  return null;
}

/**
 * Lets the platform Back gesture close a full-screen dialog instead of
 * leaving the page underneath it. The returned requestClose function uses
 * the same guard entry for Radix's Escape/overlay and explicit close paths.
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
 * and mounts again. Deferring lets the first, doomed mount's cleanup flip
 * `cancelled` before its push would have run, so only the second mount's
 * push actually happens.
 */
export function useDialogBackClose(open: boolean, onOpenChange: (open: boolean) => void) {
  const pathname = usePathname();
  const guardActiveRef = useRef(false);
  const closePendingRef = useRef(false);
  const onOpenChangeRef = useRef(onOpenChange);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let unregisterGuard: (() => void) | null = null;
    guardActiveRef.current = false;
    closePendingRef.current = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      history.pushState({ dialogBackGuard: true }, "", `${pathname}${GUARD_HASH}`);
      guardActiveRef.current = true;
      unregisterGuard = registerDialogGuard({
        pathname,
        onPopState: () => {
          guardActiveRef.current = false;
          closePendingRef.current = false;
          onOpenChangeRef.current(false);
        },
      });
    });

    return () => {
      cancelled = true;
      unregisterGuard?.();
    };
  }, [open, pathname]);

  return useCallback(() => {
    if (closePendingRef.current) return;
    if (!guardActiveRef.current) {
      onOpenChangeRef.current(false);
      return;
    }
    closePendingRef.current = true;
    history.back();
  }, []);
}
