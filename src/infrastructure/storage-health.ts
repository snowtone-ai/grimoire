export interface StorageEstimateLike {
  readonly usage?: number;
  readonly quota?: number;
}

export interface StorageManagerLike {
  estimate?(): Promise<StorageEstimateLike>;
  persisted?(): Promise<boolean>;
  persist?(): Promise<boolean>;
}

export interface StorageHealth {
  readonly support: "unsupported" | "available";
  readonly durability: "unknown" | "best-effort" | "persistent";
  readonly pressure: "unknown" | "healthy" | "high";
  readonly usageBytes?: number;
  readonly quotaBytes?: number;
  readonly usageRatio?: number;
}

export async function inspectStorageHealth(
  storage: StorageManagerLike | undefined,
): Promise<StorageHealth> {
  if (!storage?.estimate && !storage?.persisted) {
    return Object.freeze({ support: "unsupported", durability: "unknown", pressure: "unknown" });
  }
  const [estimateResult, persistedResult] = await Promise.allSettled([
    storage.estimate?.() ?? Promise.resolve({}),
    storage.persisted?.() ?? Promise.resolve(false),
  ]);
  const estimate: StorageEstimateLike =
    estimateResult.status === "fulfilled" ? estimateResult.value : {};
  const persisted = persistedResult.status === "fulfilled" ? persistedResult.value : undefined;
  const usageBytes =
    typeof estimate.usage === "number" && Number.isFinite(estimate.usage) && estimate.usage >= 0
      ? estimate.usage
      : undefined;
  const quotaBytes =
    typeof estimate.quota === "number" && Number.isFinite(estimate.quota) && estimate.quota > 0
      ? estimate.quota
      : undefined;
  const usageRatio =
    usageBytes === undefined || quotaBytes === undefined
      ? undefined
      : Math.min(1, usageBytes / quotaBytes);
  return Object.freeze({
    support: "available",
    durability: persisted === undefined ? "unknown" : persisted ? "persistent" : "best-effort",
    pressure: usageRatio === undefined ? "unknown" : usageRatio >= 0.8 ? "high" : "healthy",
    ...(usageBytes === undefined ? {} : { usageBytes }),
    ...(quotaBytes === undefined ? {} : { quotaBytes }),
    ...(usageRatio === undefined ? {} : { usageRatio }),
  });
}

/** Call only from an explicit Settings/first-save user gesture. It never runs during bootstrap. */
export async function requestPersistentStorageFromUserGesture(
  storage: StorageManagerLike | undefined,
  context: Readonly<{ userConfirmed: true }>,
): Promise<boolean> {
  if (!context.userConfirmed || !storage?.persist) return false;
  try {
    return await storage.persist();
  } catch {
    return false;
  }
}

export function isQuotaExceededError(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "QuotaExceededError") ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "QuotaExceededError")
  );
}
