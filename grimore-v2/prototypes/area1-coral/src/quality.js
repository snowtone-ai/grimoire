/**
 * Runtime quality governor.
 *
 * This module deliberately has no browser or Three.js dependency.  The renderer feeds it
 * one measured frame at a time; it returns a tier transition only after the configured
 * evidence window has been satisfied.  Keeping the policy pure makes the Pixel 7a / Xiaomi
 * 14T Pro degradation contract deterministic and unit-testable.
 */

const VALID_TIERS = new Set(['full', 'reduced']);

/** Linear-interpolated percentile without mutating the caller's sample array. */
export function percentile(samples, quantile) {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const q = Math.min(1, Math.max(0, quantile));
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function finiteOr(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clampFrameDelta(dt) {
  // A resumed background tab can report an arbitrarily large delta.  It is not a rendered
  // frame, so cap it at 100 ms rather than letting one sample satisfy an entire time window.
  return Math.min(0.1, Math.max(0, finiteOr(dt)));
}

export class RuntimeQualityGovernor {
  constructor() {
    this.samples = [];
    this.observedTier = 'full';
    this.warmupRemaining = 0;
    this.cooldownRemaining = 0;
    this.degradeSeconds = 0;
    this.recoverSeconds = 0;
    this.dropCount = 0;
    this.locked = false;
    this.lastReason = 'initial-full';
  }

  /** Starts a new application session without changing the renderer's current tier. */
  reset(currentTier = 'full') {
    this.samples.length = 0;
    this.observedTier = VALID_TIERS.has(currentTier) ? currentTier : 'full';
    this.warmupRemaining = 0;
    this.cooldownRemaining = 0;
    this.degradeSeconds = 0;
    this.recoverSeconds = 0;
    this.dropCount = 0;
    this.locked = false;
    this.lastReason = `initial-${this.observedTier}`;
  }

  beginWarmup(seconds) {
    this.warmupRemaining = Math.max(0, finiteOr(seconds));
    this._clearEvidence();
  }

  /** Records the renderer's committed transition while preserving session lock history. */
  acceptTier(tier, reason = `external-${tier}`) {
    if (!VALID_TIERS.has(tier)) throw new TypeError(`Unknown quality tier: ${tier}`);
    this.observedTier = tier;
    this.lastReason = reason;
    this._clearEvidence();
  }

  _clearEvidence() {
    this.samples.length = 0;
    this.degradeSeconds = 0;
    this.recoverSeconds = 0;
  }

  _metrics(config) {
    const mean = this.samples.length
      ? this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length
      : 0;
    return Object.freeze({
      fpsMean: mean,
      fpsP20: percentile(this.samples, 0.2),
      sampleCount: this.samples.length,
      warmupRemaining: Math.max(0, this.warmupRemaining),
      cooldownRemaining: Math.max(0, this.cooldownRemaining),
      degradeSeconds: this.degradeSeconds,
      recoverSeconds: this.recoverSeconds,
      dropCount: this.dropCount,
      locked: this.locked,
      minSamples: Math.max(1, Math.round(config.minSamples)),
    });
  }

  _result(config, nextTier = null) {
    return Object.freeze({
      nextTier,
      reason: this.lastReason,
      metrics: this._metrics(config),
    });
  }

  /**
   * @param {object} frame
   * @param {number} frame.dt Raw requestAnimationFrame delta in seconds.
   * @param {'full'|'reduced'} frame.currentTier
   * @param {'auto'|'full'|'reduced'} frame.forcedTier
   * @param {boolean} frame.building Whether geometry/shader construction is in progress.
   * @param {number} frame.drawCalls Primary sky + world scene calls. Full-screen work is
   * measured separately through `postPasses`; total multipass calls remain diagnostic only.
   * @param {number} frame.primarySceneTriangles Visible world geometry triangle count;
   * sky and repeated renderer passes are excluded.
   * @param {number} frame.postPasses Full-screen post-processing pass count.
   * @param {object} frame.config All policy values, sourced from params.js.
   */
  evaluate({
    dt,
    currentTier,
    forcedTier = 'auto',
    building = false,
    drawCalls = 0,
    primarySceneTriangles = 0,
    postPasses = 0,
    config,
  }) {
    if (!VALID_TIERS.has(currentTier)) throw new TypeError(`Unknown quality tier: ${currentTier}`);
    if (!config) throw new TypeError('Quality governor config is required');

    const elapsed = clampFrameDelta(dt);
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - elapsed);

    // A tier can also be changed by the parameter panel.  Synchronise without losing the
    // session drop count: the two-drop lock must survive a full -> reduced -> full rebuild.
    if (currentTier !== this.observedTier) {
      this.observedTier = currentTier;
      this._clearEvidence();
    }

    if (forcedTier !== 'auto') {
      if (!VALID_TIERS.has(forcedTier)) throw new TypeError(`Unknown forced tier: ${forcedTier}`);
      this._clearEvidence();
      this.lastReason = `forced-${forcedTier}`;
      return this._result(config, forcedTier === currentTier ? null : forcedTier);
    }

    if (building) {
      this.beginWarmup(config.warmupWindow);
      return this._result(config);
    }

    if (this.warmupRemaining > 0) {
      this.warmupRemaining = Math.max(0, this.warmupRemaining - elapsed);
      this._clearEvidence();
      return this._result(config);
    }

    if (elapsed > 0) {
      this.samples.push(1 / elapsed);
      const maxSamples = Math.max(1, Math.round(config.sampleFrames));
      if (this.samples.length > maxSamples) this.samples.splice(0, this.samples.length - maxSamples);
    }

    const metrics = this._metrics(config);

    if (currentTier === 'full') {
      const pressure = [];
      if (metrics.sampleCount > 0 && metrics.fpsP20 < config.degradeFps) pressure.push('fps-p20');
      if (drawCalls > config.drawCallBudgetFull) pressure.push('draw-calls');
      const triangleLimit = config.triangleBudgetFull
        * (1 + Math.max(0, finiteOr(config.triangleTolerance)));
      if (primarySceneTriangles > triangleLimit) pressure.push('triangles');
      if (postPasses > config.postPassBudgetFull) pressure.push('post-passes');

      if (pressure.length) {
        this.degradeSeconds += elapsed;
        if (metrics.sampleCount >= metrics.minSamples
          && this.degradeSeconds >= config.degradeWindow) {
          this.degradeSeconds = 0;
          this.recoverSeconds = 0;
          this.dropCount += 1;
          this.locked = this.dropCount >= Math.max(1, Math.round(config.maxAutoDrops));
          this.cooldownRemaining = Math.max(0, finiteOr(config.tierDwell));
          this.lastReason = `auto-${pressure.join('+')}`;
          return this._result(config, 'reduced');
        }
      } else {
        // Slow decay prevents a single good frame from erasing sustained evidence while
        // still requiring the pressure to be broadly continuous.
        this.degradeSeconds = Math.max(0, this.degradeSeconds - elapsed * 0.5);
      }
      return this._result(config);
    }

    if (this.locked || this.cooldownRemaining > 0) {
      this.recoverSeconds = 0;
      return this._result(config);
    }

    const hasHeadroom = metrics.fpsP20 >= config.recoverFps
      && drawCalls <= config.recoverDrawCalls
      && primarySceneTriangles <= config.recoverTriangles
      && postPasses <= config.recoverPostPasses;

    if (hasHeadroom) {
      this.recoverSeconds += elapsed;
      if (metrics.sampleCount >= metrics.minSamples
        && this.recoverSeconds >= config.recoverWindow) {
        this.recoverSeconds = 0;
        this.degradeSeconds = 0;
        this.cooldownRemaining = Math.max(0, finiteOr(config.tierDwell));
        this.lastReason = 'auto-headroom-recovered';
        return this._result(config, 'full');
      }
    } else {
      this.recoverSeconds = Math.max(0, this.recoverSeconds - elapsed * 0.5);
    }
    return this._result(config);
  }
}
