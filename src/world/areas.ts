import { DEFAULT_CORAL_ENVIRONMENT, type EnvironmentSnapshotV3 } from "./environment";

/**
 * The background world is owner-sourced footage (D-013), so an area is a
 * *description* here, not a renderer. Each area carries the static environment
 * descriptor that used to be emitted by the live Three.js scene: it is what the
 * creature layer reads for key-light direction and tone, and what the world
 * chrome reflects in its glow (決定事項ログ C, F-2).
 *
 * Areas are never locked behind progress (決定事項ログ F-5) — every entry here is
 * selectable from the first launch.
 */
export interface AreaDefinition {
  readonly id: string;
  /** Lore name, set in the lore register. */
  readonly name: string;
  /** One line of field-journal copy shown in the area picker. */
  readonly summary: string;
  readonly environment: EnvironmentSnapshotV3;
  /**
   * The colour the world chrome's afterglow borrows from this area's key light.
   * Icon bodies keep a fixed colour; only the halo follows the scene (F-2).
   */
  readonly chromeGlow: string; /* world: scene value, exempt from DESIGN.md */
  /**
   * Ambience drawn while footage is absent, still loading, or suppressed by a
   * motion preference. Scene art direction, not a reusable token.
   */
  readonly posterGradient: string; /* world: scene value, exempt from DESIGN.md */
}

/** Non-empty by construction, so `AREAS[0]` is always a real fallback. */
export const AREAS: readonly [AreaDefinition, ...AreaDefinition[]] = Object.freeze([
  Object.freeze({
    id: "area-01-coral-plateau",
    name: "陸珊瑚の台地",
    summary: "霧を貫く光芒と、穴の空いた岩の塔。骨色の枝珊瑚が斜面を埋める。",
    environment: DEFAULT_CORAL_ENVIRONMENT,
    /* world: scene value, exempt from DESIGN.md */
    chromeGlow: "rgb(255 216 168 / 42%)",
    /* world: scene value, exempt from DESIGN.md */
    posterGradient:
      "radial-gradient(120% 88% at 52% 12%, #f0d9b4 0%, #b9b7a4 26%, #5d6d72 58%, #1d2b33 100%)",
  }),
]);

export const DEFAULT_AREA_ID = AREAS[0].id;

/** Falls back to the first area: an unknown id is stale data, never a crash. */
export function findArea(areaId: string): AreaDefinition {
  return AREAS.find((area) => area.id === areaId) ?? AREAS[0];
}
