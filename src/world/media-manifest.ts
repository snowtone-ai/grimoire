/**
 * Owner-sourced footage (D-013). The owner drops files into `anime/` and
 * `node scripts/sync-world-media.mjs` copies them under `public/world/` and
 * writes the manifest this module reads.
 *
 * Everything here degrades to "no footage" rather than failing: until the assets
 * exist the app must still start, still show a world, and still let a task be
 * written — the same rule that kept Home off a 3D dependency
 * (docs/architecture.md §8).
 */

export const WORLD_MEDIA_SCHEMA = 1 as const;
export const WORLD_MEDIA_MANIFEST_URL = "/world/manifest.json";

export interface WorldMediaSource {
  readonly src: string;
  /** A full `type` attribute value, e.g. `video/webm; codecs=vp9`. */
  readonly type: string;
}

export interface WorldMediaEntry {
  readonly poster: string | null;
  readonly sources: readonly WorldMediaSource[];
}

export interface WorldMediaManifest {
  readonly schema: typeof WORLD_MEDIA_SCHEMA;
  readonly areas: Readonly<Record<string, WorldMediaEntry>>;
  readonly splash: WorldMediaEntry | null;
}

export const EMPTY_WORLD_MEDIA: WorldMediaManifest = Object.freeze({
  schema: WORLD_MEDIA_SCHEMA,
  areas: Object.freeze({}),
  splash: null,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSource(value: unknown): WorldMediaSource | null {
  if (!isRecord(value)) return null;
  const { src, type } = value;
  if (typeof src !== "string" || !src.startsWith("/")) return null;
  if (typeof type !== "string" || type.length === 0) return null;
  return Object.freeze({ src, type });
}

function normalizeEntry(value: unknown): WorldMediaEntry | null {
  if (!isRecord(value)) return null;
  const sources = Array.isArray(value.sources)
    ? value.sources
        .map(normalizeSource)
        .filter((source): source is WorldMediaSource => source !== null)
    : [];
  if (sources.length === 0) return null;
  const poster =
    typeof value.poster === "string" && value.poster.startsWith("/")
      ? value.poster
      : null;
  return Object.freeze({ poster, sources: Object.freeze(sources) });
}

/**
 * Accepts a parsed manifest of unknown provenance and keeps only the entries it
 * can vouch for. A malformed entry is dropped, not thrown on — one bad file
 * should cost one area's footage, not the whole screen.
 */
export function normalizeWorldMediaManifest(source: unknown): WorldMediaManifest {
  if (!isRecord(source) || source.schema !== WORLD_MEDIA_SCHEMA) {
    return EMPTY_WORLD_MEDIA;
  }

  const areas: Record<string, WorldMediaEntry> = {};
  if (isRecord(source.areas)) {
    for (const [areaId, entry] of Object.entries(source.areas)) {
      const normalized = normalizeEntry(entry);
      if (normalized !== null) areas[areaId] = normalized;
    }
  }

  return Object.freeze({
    schema: WORLD_MEDIA_SCHEMA,
    areas: Object.freeze(areas),
    splash: normalizeEntry(source.splash),
  });
}

/** Never rejects. A missing or unreadable manifest simply means "no footage yet". */
export async function loadWorldMediaManifest(
  signal?: AbortSignal,
): Promise<WorldMediaManifest> {
  try {
    const response = await fetch(WORLD_MEDIA_MANIFEST_URL, {
      cache: "no-cache",
      signal: signal ?? null,
    });
    if (!response.ok) return EMPTY_WORLD_MEDIA;
    return normalizeWorldMediaManifest(await response.json());
  } catch {
    return EMPTY_WORLD_MEDIA;
  }
}
