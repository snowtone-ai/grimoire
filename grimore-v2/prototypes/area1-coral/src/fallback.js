/** PERF-08: deterministic low-performance fallback policy and asset-free poster. */

export class SustainedLowFpsFallback {
  constructor({ thresholdFps = 40, durationSeconds = 3 } = {}) {
    this.thresholdFps = thresholdFps;
    this.durationMs = Math.max(0, durationSeconds) * 1000;
    this.lowSince = null;
    this.triggered = false;
  }

  reset() {
    this.lowSince = null;
    this.triggered = false;
  }

  /**
   * Returns true once auto/reduced has remained below the p20 floor for the full window.
   * Build, warmup and undersampled frames are deliberately ineligible evidence.
   */
  update({
    now,
    mode,
    tier,
    fpsP20,
    building = false,
    warmupRemaining = 0,
    sampleCount = 0,
    minimumSamples = 1,
  }) {
    if (this.triggered) return true;
    const eligible = mode === 'auto'
      && tier === 'reduced'
      && !building
      && warmupRemaining <= 0
      && sampleCount >= minimumSamples
      && Number.isFinite(fpsP20)
      && fpsP20 > 0
      && fpsP20 < this.thresholdFps;

    if (!eligible) {
      this.lowSince = null;
      return false;
    }

    const measuredAt = Number.isFinite(now) ? now : 0;
    if (this.lowSince === null || measuredAt < this.lowSince) {
      this.lowSince = measuredAt;
      return false;
    }
    if (measuredAt - this.lowSince < this.durationMs) return false;
    this.triggered = true;
    return true;
  }
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Draws a self-contained poster so fallback never depends on a missing network asset. */
export function drawFallbackPoster(canvas) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) return false;
  const width = 1280;
  const height = 720;
  canvas.width = width;
  canvas.height = height;

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#071323');
  sky.addColorStop(0.55, '#17364b');
  sky.addColorStop(1, '#d17a64');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const sun = ctx.createRadialGradient(910, 168, 8, 910, 168, 190);
  sun.addColorStop(0, 'rgba(255,238,192,.94)');
  sun.addColorStop(0.22, 'rgba(255,195,137,.45)');
  sun.addColorStop(1, 'rgba(255,167,118,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(690, 0, 440, 390);

  const rng = seededRandom(0xc04a1);
  for (let layer = 0; layer < 3; layer++) {
    const base = 530 + layer * 66;
    ctx.fillStyle = ['#263e48', '#142a35', '#091925'][layer];
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, base);
    for (let x = 0; x <= width + 80; x += 80) {
      const crown = base - 60 - rng() * (100 + layer * 35);
      ctx.quadraticCurveTo(x + 20, crown, x + 45, base - rng() * 32);
      ctx.quadraticCurveTo(x + 62, crown + 24, x + 80, base);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  }

  const haze = ctx.createLinearGradient(0, height * 0.45, 0, height);
  haze.addColorStop(0, 'rgba(163,213,220,0)');
  haze.addColorStop(1, 'rgba(7,13,24,.58)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height);
  return true;
}

/** Uses a configured video when present; the generated canvas remains its reliable poster. */
export function activateFallbackMedia(container) {
  if (!container) return Object.freeze({ kind: 'none' });
  const poster = container.querySelector('[data-fallback-poster]');
  drawFallbackPoster(poster);
  if (poster) poster.hidden = false;

  const video = container.querySelector('[data-fallback-video]');
  const source = video?.dataset?.src?.trim();
  if (!video || !source) return Object.freeze({ kind: 'poster' });

  video.src = source;
  video.hidden = false;
  const playback = video.play?.();
  playback?.catch?.(() => {
    video.hidden = true;
  });
  return Object.freeze({ kind: 'video', source });
}
