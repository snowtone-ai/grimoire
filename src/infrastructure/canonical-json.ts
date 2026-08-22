import type { CanonicalHasher } from "../application/ports";
import { payloadHash, type PayloadHash } from "../domain/primitives";

type CanonicalJson = null | boolean | number | string | readonly CanonicalJson[] | CanonicalObject;
interface CanonicalObject {
  readonly [key: string]: CanonicalJson;
}
function normalize(value: unknown, seen: Set<object>): CanonicalJson {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON does not support non-finite numbers");
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object") {
    throw new TypeError(`Canonical JSON does not support ${typeof value}`);
  }
  if (seen.has(value)) throw new TypeError("Canonical JSON does not support cycles");
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((entry) => normalize(entry, seen));
    const record = value as Record<string, unknown>;
    const result: Record<string, CanonicalJson> = {};
    for (const key of Object.keys(record).sort()) {
      const entry = record[key];
      if (entry === undefined) continue;
      result[key] = normalize(entry, seen);
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value, new Set()));
}

export class WebCryptoCanonicalHasher implements CanonicalHasher {
  constructor(private readonly cryptoApi: Pick<Crypto, "subtle"> = globalThis.crypto) {}

  async hash(value: unknown): Promise<PayloadHash> {
    const bytes = new TextEncoder().encode(canonicalJson(value));
    const digest = await this.cryptoApi.subtle.digest("SHA-256", bytes);
    const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
    return payloadHash(hex);
  }
}
