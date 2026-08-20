export const ENVIRONMENT_SCHEMA = 3 as const;

export type QualityTier = "full" | "reduced";
export type Vec3Tuple = readonly [x: number, y: number, z: number];

export interface EnvironmentSnapshotV3 {
  readonly schema: typeof ENVIRONMENT_SCHEMA;
  readonly revision: number;
  readonly areaId: string;
  readonly keyLight: Readonly<{
    directionWorld: Vec3Tuple;
    colorLinear: Vec3Tuple;
    intensity: number;
    temperatureK: number;
  }>;
  readonly ambient: Readonly<{
    skyLinear: Vec3Tuple;
    groundLinear: Vec3Tuple;
    intensity: number;
  }>;
  readonly exposure: number;
  readonly toneMap: "aces-filmic";
  readonly qualityTier: QualityTier;
}

export class UnsupportedEnvironmentSchemaError extends Error {
  constructor(schema: unknown) {
    super(`Unsupported environment schema: ${String(schema)}`);
    this.name = "UnsupportedEnvironmentSchemaError";
  }
}

type UnknownRecord = Record<string, unknown>;

function record(name: string, value: unknown): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value as UnknownRecord;
}

function exactKeys(name: string, value: UnknownRecord, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unexpected !== undefined) {
    throw new TypeError(`${name}.${unexpected} is not part of environment schema 3`);
  }
}

function finiteRange(name: string, value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be finite`);
  }
  if (value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}`);
  }
  return value;
}

function tuple(
  name: string,
  value: unknown,
  min: number,
  max: number,
): Vec3Tuple {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new TypeError(`${name} must contain exactly three components`);
  }
  return Object.freeze([
    finiteRange(`${name}[0]`, value[0], min, max),
    finiteRange(`${name}[1]`, value[1], min, max),
    finiteRange(`${name}[2]`, value[2], min, max),
  ] as [number, number, number]);
}

function normalizedDirection(name: string, value: unknown): Vec3Tuple {
  const source = tuple(name, value, -Number.MAX_VALUE, Number.MAX_VALUE);
  const length = Math.hypot(...source);
  if (length <= 1e-8) {
    throw new RangeError(`${name} must be non-zero`);
  }
  return Object.freeze([
    source[0] / length,
    source[1] / length,
    source[2] / length,
  ] as [number, number, number]);
}

/**
 * Copies and freezes an untrusted schema-3 snapshot before a renderer or creature reads it.
 * The exact-key checks prevent prototype-only fog, stage, or task data from leaking through.
 */
export function normalizeEnvironmentSnapshotV3(source: unknown): EnvironmentSnapshotV3 {
  const root = record("environment", source);
  if (root.schema !== ENVIRONMENT_SCHEMA) {
    throw new UnsupportedEnvironmentSchemaError(root.schema);
  }
  exactKeys("environment", root, [
    "schema",
    "revision",
    "areaId",
    "keyLight",
    "ambient",
    "exposure",
    "toneMap",
    "qualityTier",
  ]);

  if (!Number.isSafeInteger(root.revision) || (root.revision as number) < 0) {
    throw new RangeError("environment.revision must be a non-negative safe integer");
  }
  if (
    typeof root.areaId !== "string"
    || root.areaId.trim().length === 0
    || root.areaId.length > 128
  ) {
    throw new RangeError("environment.areaId must be a non-empty string up to 128 characters");
  }
  if (root.toneMap !== "aces-filmic") {
    throw new RangeError("environment.toneMap must be aces-filmic");
  }
  if (root.qualityTier !== "full" && root.qualityTier !== "reduced") {
    throw new RangeError("environment.qualityTier must be full or reduced");
  }

  const keyLight = record("environment.keyLight", root.keyLight);
  exactKeys("environment.keyLight", keyLight, [
    "directionWorld",
    "colorLinear",
    "intensity",
    "temperatureK",
  ]);
  const ambient = record("environment.ambient", root.ambient);
  exactKeys("environment.ambient", ambient, ["skyLinear", "groundLinear", "intensity"]);

  return Object.freeze({
    schema: ENVIRONMENT_SCHEMA,
    revision: root.revision as number,
    areaId: root.areaId,
    keyLight: Object.freeze({
      directionWorld: normalizedDirection(
        "environment.keyLight.directionWorld",
        keyLight.directionWorld,
      ),
      colorLinear: tuple("environment.keyLight.colorLinear", keyLight.colorLinear, 0, 4),
      intensity: finiteRange("environment.keyLight.intensity", keyLight.intensity, 0, 100),
      temperatureK: finiteRange(
        "environment.keyLight.temperatureK",
        keyLight.temperatureK,
        2_500,
        10_000,
      ),
    }),
    ambient: Object.freeze({
      skyLinear: tuple("environment.ambient.skyLinear", ambient.skyLinear, 0, 4),
      groundLinear: tuple("environment.ambient.groundLinear", ambient.groundLinear, 0, 4),
      intensity: finiteRange("environment.ambient.intensity", ambient.intensity, 0, 100),
    }),
    exposure: finiteRange("environment.exposure", root.exposure, 0, 4),
    toneMap: "aces-filmic",
    qualityTier: root.qualityTier,
  });
}

export const DEFAULT_CORAL_ENVIRONMENT = normalizeEnvironmentSnapshotV3({
  schema: ENVIRONMENT_SCHEMA,
  revision: 0,
  areaId: "area-01-coral-plateau",
  keyLight: {
    directionWorld: [-0.31, 0.74, 0.59],
    colorLinear: [1, 0.69, 0.39],
    intensity: 3.8,
    temperatureK: 4_200,
  },
  ambient: {
    skyLinear: [0.5, 0.63, 0.78],
    groundLinear: [0.029, 0.034, 0.061],
    intensity: 0.36,
  },
  exposure: 0.72,
  toneMap: "aces-filmic",
  qualityTier: "full",
});
