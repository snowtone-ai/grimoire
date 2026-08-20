export type WorldFallbackReason =
  | "webgl-unavailable"
  | "renderer-init-failed"
  | "context-lost"
  | "shader-failed"
  | "sustained-low-fps"
  | "schema-incompatible";

export type WorldHealthSample = Readonly<{
  measuredAt: number;
  mode: "auto" | "full" | "reduced";
  tier: "full" | "reduced";
  p20Fps: number;
  sampleCount: number;
  minimumSamples: number;
  warmup: boolean;
  building: boolean;
}>;

export type WorldFallbackDecision = Readonly<{
  active: boolean;
  reason?: WorldFallbackReason;
}>;

/** Product-level fallback policy; the prototype remains responsible for collecting metrics. */
export class WorldFallbackGuard {
  readonly #floorFps: number;
  readonly #sustainMs: number;
  #lowSince: number | undefined;
  #decision: WorldFallbackDecision = Object.freeze({ active: false });

  constructor({ floorFps = 40, sustainMs = 3_000 } = {}) {
    if (!Number.isFinite(floorFps) || floorFps <= 0) {
      throw new RangeError("floorFps must be positive");
    }
    if (!Number.isFinite(sustainMs) || sustainMs < 0) {
      throw new RangeError("sustainMs must be non-negative");
    }
    this.#floorFps = floorFps;
    this.#sustainMs = sustainMs;
  }

  observe(sample: WorldHealthSample): WorldFallbackDecision {
    if (this.#decision.active) return this.#decision;

    const eligible = sample.mode === "auto"
      && sample.tier === "reduced"
      && !sample.warmup
      && !sample.building
      && sample.sampleCount >= sample.minimumSamples
      && Number.isFinite(sample.p20Fps)
      && sample.p20Fps > 0
      && sample.p20Fps < this.#floorFps;

    if (!eligible) {
      this.#lowSince = undefined;
      return this.#decision;
    }

    if (this.#lowSince === undefined || sample.measuredAt < this.#lowSince) {
      this.#lowSince = sample.measuredAt;
      return this.#decision;
    }
    if (sample.measuredAt - this.#lowSince < this.#sustainMs) {
      return this.#decision;
    }
    this.#decision = Object.freeze({ active: true, reason: "sustained-low-fps" });
    return this.#decision;
  }

  fail(reason: Exclude<WorldFallbackReason, "sustained-low-fps">): WorldFallbackDecision {
    this.#decision = Object.freeze({ active: true, reason });
    return this.#decision;
  }

  reset(): void {
    this.#lowSince = undefined;
    this.#decision = Object.freeze({ active: false });
  }
}
