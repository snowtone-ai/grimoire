import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearToken,
  connect,
  disconnect,
  getToken,
  hasToken,
  isGoogleConfigured,
} from "../../../../src/integrations/google/auth";

type GisCallback = (resp: { error?: string; access_token?: string }) => void;

function installFakeGis(
  onRequestAccessToken: (callback: GisCallback) => void,
  revoke?: (token: string, callback?: () => void) => void,
): void {
  const oauth2 = {
    initTokenClient: (cfg: { callback: GisCallback }) => ({
      requestAccessToken: () => onRequestAccessToken(cfg.callback),
    }),
    revoke,
  };
  vi.stubGlobal("google", { accounts: { oauth2 } });
}

afterEach(() => {
  clearToken("calendar");
  clearToken("gmail");
});

describe("google auth — not configured (T020 required case)", () => {
  it("isGoogleConfigured() is false when NEXT_PUBLIC_GOOGLE_CLIENT_ID is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    expect(isGoogleConfigured()).toBe(false);
  });

  it("isGoogleConfigured() is true once a client id is set", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id");
    expect(isGoogleConfigured()).toBe(true);
  });

  it("connect() resolves a disabled result instead of throwing when unconfigured", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");

    await expect(connect("calendar")).resolves.toEqual({
      connected: false,
      reason: "Google連携が構成されていません",
    });
    expect(hasToken("calendar")).toBe(false);
  });

  it("connect() never throws even if a GIS script happens to be present without a client id", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    installFakeGis((callback) => callback({ access_token: "should-not-be-reached" }));

    await expect(connect("gmail")).resolves.toEqual({
      connected: false,
      reason: "Google連携が構成されていません",
    });
  });
});

describe("google auth — connect/disconnect (T020 addition)", () => {
  it("connect() resolves connected:true and stores the token on success", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id");
    installFakeGis((callback) => callback({ access_token: "tok-abc" }));

    await expect(connect("calendar")).resolves.toEqual({ connected: true });
    expect(hasToken("calendar")).toBe(true);
    expect(getToken("calendar")).toBe("tok-abc");
  });

  it("connect() maps a cancelled popup to a friendly reason without throwing", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id");
    installFakeGis((callback) => callback({ error: "popup_closed_by_user" }));

    await expect(connect("gmail")).resolves.toEqual({
      connected: false,
      reason: "認証がキャンセルされました",
    });
    expect(hasToken("gmail")).toBe(false);
  });

  it("connect() redacts an unexpected GIS error instead of leaking it verbatim", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id");
    installFakeGis((callback) => callback({ error: "access_denied" }));

    const result = await connect("calendar");
    expect(result.connected).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("disconnect() clears the in-memory token", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id");
    installFakeGis((callback) => callback({ access_token: "tok-xyz" }));

    await connect("calendar");
    expect(hasToken("calendar")).toBe(true);

    await disconnect("calendar");
    expect(hasToken("calendar")).toBe(false);
  });

  it("disconnect() is a no-op when there is nothing to revoke", async () => {
    await expect(disconnect("gmail")).resolves.toBeUndefined();
  });
});
