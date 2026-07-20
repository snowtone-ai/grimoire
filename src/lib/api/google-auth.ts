/**
 * Google Identity Services (GIS) — browser-only OAuth 2.0 token flow.
 * No backend required. Tokens are kept in memory (lost on page reload).
 * This intentionally avoids Web Storage persistence for read-only API tokens.
 */

export type GoogleScope = "gmail" | "calendar";

const SCOPES: Record<GoogleScope, string> = {
  gmail: "https://www.googleapis.com/auth/gmail.readonly",
  calendar: "https://www.googleapis.com/auth/calendar.readonly",
};

const tokenMap: Partial<Record<GoogleScope, string>> = {};

// F2: at most one live GIS popup per scope — concurrent callers share the same promise.
const pendingRequests: Partial<Record<GoogleScope, Promise<string>>> = {};

interface GoogleWindow {
  google?: GoogleIdentityServices;
}

type GoogleOAuth2 = {
  initTokenClient: (cfg: {
    client_id: string;
    scope: string;
    callback: (resp: { error?: string; access_token?: string }) => void;
  }) => { requestAccessToken: (opts: { prompt: string }) => void };
  revoke?: (token: string, callback?: () => void) => void;
};

type GoogleIdentityServices = {
  accounts?: {
    oauth2?: GoogleOAuth2;
  };
};

export function getToken(scope: GoogleScope): string | null {
  return tokenMap[scope] ?? null;
}

export function hasToken(scope: GoogleScope): boolean {
  return !!tokenMap[scope];
}

/** Clear only the in-memory token (e.g. after a 401). Does not attempt remote revoke. */
export function clearToken(scope: GoogleScope): void {
  delete tokenMap[scope];
}

function getOAuth2(): GoogleOAuth2 | undefined {
  return (window as unknown as GoogleWindow).google?.accounts?.oauth2;
}

/** Poll until GIS script is ready (F3: guaranteed cleanup on every exit path). */
function waitForGIS(timeoutMs = 10_000, signal?: AbortSignal): Promise<GoogleOAuth2> {
  const immediate = getOAuth2();
  if (immediate) return Promise.resolve(immediate);

  return new Promise<GoogleOAuth2>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }

    const deadline = Date.now() + timeoutMs;
    const timer = setInterval(() => {
      const api = getOAuth2();
      if (api) { cleanup(); resolve(api); return; }
      if (Date.now() >= deadline) {
        cleanup();
        reject(new Error("Google認証ライブラリの読み込みがタイムアウトしました。ページを再読み込みしてください。"));
      }
    }, 200);

    const onAbort = () => { cleanup(); reject(new DOMException("Aborted", "AbortError")); };
    function cleanup() {
      clearInterval(timer);
      signal?.removeEventListener("abort", onAbort);
    }
    signal?.addEventListener("abort", onAbort);
  });
}

async function doRequestGoogleToken(scope: GoogleScope, signal?: AbortSignal): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured");

  const oauth2 = await waitForGIS(10_000, signal);

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES[scope],
      callback: (resp) => {
        if (resp.error) {
          const err = new Error(resp.error);
          err.name = resp.error === "popup_closed_by_user" ? "GISCancelled" : "GISError";
          reject(err);
          return;
        }
        // F4: guard missing access_token (GIS can invoke callback with neither field set).
        if (!resp.access_token) {
          const err = new Error("access_denied");
          err.name = "GISError";
          reject(err);
          return;
        }
        tokenMap[scope] = resp.access_token;
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: tokenMap[scope] ? "" : "consent" });
  });
}

// F2: dedup wrapper — concurrent callers share one popup per scope.
export function requestGoogleToken(scope: GoogleScope, signal?: AbortSignal): Promise<string> {
  const existing = pendingRequests[scope];
  if (existing) return existing;

  const p = doRequestGoogleToken(scope, signal).finally(() => {
    delete pendingRequests[scope];
  });
  pendingRequests[scope] = p;
  return p;
}

/** F1: thrown by googleAuthFetch on 401 — signals callers to re-auth and retry. */
export class GoogleAuthExpiredError extends Error {
  readonly scope: GoogleScope;
  constructor(scope: GoogleScope) {
    super(`${scope} token expired`);
    this.name = "GoogleAuthExpiredError";
    this.scope = scope;
  }
}

/**
 * F1: Authenticated fetch against a Google API.
 * On 401 it clears the stale token and throws GoogleAuthExpiredError so callers
 * can re-auth transparently and retry without user intervention.
 */
export async function googleAuthFetch(
  scope: GoogleScope,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const token = getToken(scope);
  if (!token) throw new GoogleAuthExpiredError(scope);

  const response = await fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    clearToken(scope);
    throw new GoogleAuthExpiredError(scope);
  }
  return response;
}

export function revokeToken(scope: GoogleScope): void {
  const token = tokenMap[scope];
  if (!token) return;
  // F6: Best-effort remote revoke; GIS provides no reliable failure signal in-browser.
  // Local state is cleared unconditionally so the UI reflects "disconnected" immediately.
  getOAuth2()?.revoke?.(token);
  delete tokenMap[scope];
}
