import { describe, expect, it, vi } from "vitest";
import {
  inspectStorageHealth,
  isQuotaExceededError,
  requestPersistentStorageFromUserGesture,
} from "../../src/infrastructure/storage-health";

describe("storage health", () => {
  it("does not describe unavailable browser storage as durable", async () => {
    await expect(inspectStorageHealth(undefined)).resolves.toEqual({
      support: "unsupported",
      durability: "unknown",
      pressure: "unknown",
    });
  });

  it("surfaces best-effort pressure instead of silently promising persistence", async () => {
    await expect(
      inspectStorageHealth({
        estimate: async () => ({ usage: 850, quota: 1_000 }),
        persisted: async () => false,
      }),
    ).resolves.toMatchObject({
      support: "available",
      durability: "best-effort",
      pressure: "high",
      usageRatio: 0.85,
    });
  });

  it("requests persistence only through the explicit user-gesture boundary", async () => {
    const persist = vi.fn(async () => true);

    await expect(
      requestPersistentStorageFromUserGesture({ persist }, { userConfirmed: true }),
    ).resolves.toBe(true);
    expect(persist).toHaveBeenCalledOnce();
  });

  it("classifies quota errors without depending on one browser constructor", () => {
    expect(isQuotaExceededError({ name: "QuotaExceededError" })).toBe(true);
    expect(isQuotaExceededError(new Error("storage failed"))).toBe(false);
  });
});
