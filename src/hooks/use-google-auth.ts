"use client";

import { useState } from "react";
import {
  requestGoogleToken,
  revokeToken,
  hasToken,
  type GoogleScope,
} from "@/lib/api/google-auth";

const GIS_ERROR_MESSAGES: Record<string, string> = {
  popup_failed_to_open: "ポップアップがブロックされました。ブラウザのポップアップ許可を確認してください。",
  access_denied: "Googleアカウントへのアクセスが拒否されました。",
  invalid_client: "OAuth設定が正しくありません。管理者にお問い合わせください。",
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
      // User closed the popup intentionally — not an error, silently return false.
      if (e instanceof Error && e.name === "GISCancelled") return false;
      const msg = toUserMessage(e);
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  function disconnect() {
    revokeToken(scope);
    setIsConnected(false);
  }

  return { isConnected, isLoading, error, connect, disconnect };
}
