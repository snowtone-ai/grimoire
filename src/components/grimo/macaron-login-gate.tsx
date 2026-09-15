"use client";

import { useEffect } from "react";
import { claimLoginMacaron } from "@/lib/macaronDb";

/**
 * Grimoire has no account-login screen: reopening or foregrounding the local
 * PWA is the user's daily return. The grant itself is idempotent in IndexedDB,
 * so this deliberately runs on both first render and each foreground return.
 */
export function MacaronLoginGate() {
  useEffect(() => {
    const claim = () => {
      if (document.visibilityState !== "visible") return;
      claimLoginMacaron().catch((error) => console.error("[macaron] login grant failed:", error));
    };
    claim();
    document.addEventListener("visibilitychange", claim);
    return () => document.removeEventListener("visibilitychange", claim);
  }, []);

  return null;
}
