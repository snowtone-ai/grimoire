"use client";

import { useState } from "react";
import {
  requestGoogleToken,
  revokeToken,
  hasToken,
  GoogleAuthExpiredError,
  type GoogleScope,
} from "@/lib/api/google-auth";

// F4: extended with codes that appear in practice on mobile.
const GIS_ERROR_MESSAGES: Record<string, string> = {
  popup_failed_to_open: "ポップアップがブロックされました。ブラウザのポップアップ許可を確認してください。",
  access_denied: "Googleアカウントへのアクセスが拒否されました。",
  invalid_client: "OAuth設定が正しくありません。管理者にお問い合わせください。",
  interaction_required: "再度Googleでの認証が必要です。もう一度お試しください。",
  immediate_failed: "自動認証に失敗しました。もう一度接続してください。",
};

function toUserMessage(e: unknown): string {
  if (!(e instanceof Error)) return "Google認証に失敗しました";
  return GIS_ERROR_MESSAGES[e.message] ?? e.message;
}

export function useGoogleAuth(scope: GoogleScope) {
  const [isConnected, setIsConnected] = useState(() => hasToken(scope));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect(): Promise<boolean> {
    setIsLoading(true);
    setError(null);
    try {
      await requestGoogleToken(scope);
      setIsConnected(true);
      return true;
    } catch (e) {
      // F4: user closed popup or request aborted — not an error, silently return false.
      if (e instanceof Error && (e.name === "GISCancelled" || e.name === "AbortError")) return false;
      const msg = toUserMessage(e);
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * F1: Run an authenticated Google API operation with automatic token refresh.
   * Ensures a valid token before the call; on 401 (GoogleAuthExpiredError) re-auths
   * once and retries transparently. Returns null if the user cancels auth.
   */
  async function withAuth<T>(op: () => Promise<T>): Promise<T | null> {
    if (!hasToken(scope)) {
      const ok = await connect();
      if (!ok) return null;
    }
    try {
      return await op();
    } catch (e) {
      if (e instanceof GoogleAuthExpiredError) {
        const ok = await connect();
        if (!ok) return null;
        return await op();
      }
      throw e;
    }
  }

  function disconnect() {
    revokeToken(scope);
    setIsConnected(false);
  }

  return { isConnected, isLoading, error, connect, disconnect, withAuth };
}
