import {
  ENVIRONMENT_SCHEMA,
  normalizeEnvironmentSnapshotV3,
  type EnvironmentSnapshotV3,
  type Vec3Tuple,
} from "./environment";

type UnknownRecord = Record<string, unknown>;

function record(name: string, value: unknown): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value as UnknownRecord;
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

function packedSrgb(name: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 0xffffff) {
    throw new RangeError(`${name} must be a packed 24-bit sRGB integer`);
  }
  return value;
}

function srgbChannelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function packedSrgbToLinearTuple(value: number): Vec3Tuple {
  const checked = packedSrgb("color", value);
  return Object.freeze([
    srgbChannelToLinear((checked >> 16) & 0xff),
    srgbChannelToLinear((checked >> 8) & 0xff),
    srgbChannelToLinear(checked & 0xff),
  ] as [number, number, number]);
}

/**
 * The only compatibility boundary for area1-coral's prototype `version: 2` value.
 * Prototype diagnostics and render internals are deliberately discarded.
 */
export function adaptPrototypeEnvironmentV2(
  source: unknown,
  revision: number,
): EnvironmentSnapshotV3 {
  const root = record("prototypeEnvironment", source);
  if (root.version !== 2) {
    throw new Error("Unsupported prototype environment contract");
  }
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new RangeError("revision must be a non-negative safe integer");
  }
  if (
    typeof root.areaId !== "string"
    || root.areaId.trim().length === 0
    || root.areaId.length > 128
  ) {
    throw new RangeError("prototypeEnvironment.areaId is invalid");
  }

  const quality = record("prototypeEnvironment.quality", root.quality);
  if (quality.tier !== "full" && quality.tier !== "reduced") {
    throw new RangeError("prototypeEnvironment.quality.tier is invalid");
  }
  const light = record("prototypeEnvironment.light", root.light);
  const direction = record("prototypeEnvironment.light.direction", light.direction);
  const x = finiteRange("prototypeEnvironment.light.direction.x", direction.x, -1e9, 1e9);
  const y = finiteRange("prototypeEnvironment.light.direction.y", direction.y, -1e9, 1e9);
  const z = finiteRange("prototypeEnvironment.light.direction.z", direction.z, -1e9, 1e9);
  if (Math.hypot(x, y, z) <= 1e-8) {
    throw new RangeError("prototypeEnvironment.light.direction must be non-zero");
  }

  const ambient = record("prototypeEnvironment.ambient", root.ambient);
  const tone = record("prototypeEnvironment.tone", root.tone);
  if (tone.mapping !== "aces") {
    throw new Error("Unsupported prototype tone mapping");
  }

  return normalizeEnvironmentSnapshotV3({
    schema: ENVIRONMENT_SCHEMA,
    revision,
    areaId: root.areaId,
    keyLight: {
      directionWorld: [x, y, z],
      colorLinear: packedSrgbToLinearTuple(
        packedSrgb("prototypeEnvironment.light.color", light.color),
      ),
      intensity: finiteRange("prototypeEnvironment.light.intensity", light.intensity, 0, 100),
      temperatureK: finiteRange(
        "prototypeEnvironment.light.temperatureK",
        light.temperatureK,
        2_500,
        10_000,
      ),
    },
    ambient: {
      skyLinear: packedSrgbToLinearTuple(
        packedSrgb("prototypeEnvironment.ambient.sky", ambient.sky),
      ),
      groundLinear: packedSrgbToLinearTuple(
        packedSrgb("prototypeEnvironment.ambient.ground", ambient.ground),
      ),
      intensity: finiteRange(
        "prototypeEnvironment.ambient.intensity",
        ambient.intensity,
        0,
        100,
      ),
    },
    exposure: finiteRange("prototypeEnvironment.tone.exposure", tone.exposure, 0, 4),
    toneMap: "aces-filmic",
    qualityTier: quality.tier,
  });
}
