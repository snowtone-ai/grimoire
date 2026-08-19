/**
 * main.js — entry point. Wires the scene, the panel and the page chrome together.
 *
 * The DOM overlay (title, loading state, fallback) is real HTML, never canvas-drawn text,
 * so it stays selectable and screen-reader readable.
 */

import { CoralArea } from './scene.js';
import { createParams } from './params.js';
import { ParamPanel } from './gui.js';
import { SustainedLowFpsFallback, activateFallbackMedia } from './fallback.js';

const canvas = document.getElementById('scene');
const overlay = document.getElementById('loading');
const overlayLabel = document.getElementById('loading-label');
const overlayBar = document.getElementById('loading-bar');
const fallback = document.getElementById('fallback');
const caption = document.getElementById('caption');

function showFallback(message, reason = 'render-unavailable') {
  if (overlay) overlay.hidden = true;
  if (!fallback) return;
  fallback.dataset.reason = reason;
  activateFallbackMedia(fallback);
  fallback.hidden = false;
  const detail = fallback.querySelector('[data-detail]');
  if (detail) detail.textContent = message;
}

function hasWebGL2() {
  try {
    const probe = document.createElement('canvas');
    return !!probe.getContext('webgl2');
  } catch {
    return false;
  }
}

if (!hasWebGL2()) {
  showFallback('この環境では WebGL2 が使えないため、軽量な静止画で背景世界を表示しています。', 'webgl2-unavailable');
} else {
  boot();
}

function boot() {
  const params = createParams();
  let area;

  try {
    area = new CoralArea(canvas, params);
  } catch (error) {
    showFallback(`レンダラの初期化に失敗しました: ${error?.message ?? error}`, 'renderer-init-failed');
    return;
  }
  const perfFallback = new SustainedLowFpsFallback({
    thresholdFps: params.quality.fallbackFps,
    durationSeconds: params.quality.fallbackWindow,
  });

  const panel = new ParamPanel(params, {
    onLive: () => {
      area.refreshEffective();
      area.syncUniforms();
      area.refreshSkyOctaves();
    },
    onPasses: () => {
      area.refreshEffective();
      area.post.setSize(
        area.renderer.domElement.width,
        area.renderer.domElement.height,
        area.effective
      );
      area.syncUniforms();
    },
    onGeometry: () => {
      area.refreshEffective();
      area.syncUniforms();
      rebuild();
    },
    onPreset: () => {
      area.refreshEffective();
      area.syncUniforms();
      area.refreshSkyOctaves();
      area.setSize(lastWidth, lastHeight);
      rebuild();
    },
    onAction: (name) => {
      if (name === 'screenshot') saveScreenshot(area, panel);
    },
  });

  area.onProgress = (label, frac) => {
    if (!overlay) return;
    overlay.hidden = false;
    if (overlayLabel) overlayLabel.textContent = label;
    if (overlayBar) overlayBar.style.width = `${Math.round(frac * 100)}%`;
    if (frac >= 1) {
      // One frame of settle so the first painted frame is the finished world.
      requestAnimationFrame(() => requestAnimationFrame(() => { overlay.hidden = true; }));
    }
  };

  let lastWidth = 0;
  let lastHeight = 0;
  const applySize = () => {
    lastWidth = window.innerWidth;
    lastHeight = window.innerHeight;
    area.setSize(lastWidth, lastHeight);
  };

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applySize, 150); // debounced, per the perf budget
  });

  document.addEventListener('visibilitychange', () => {
    if (!params.quality.pauseWhenHidden) return;
    if (document.hidden) {
      perfFallback.reset();
      area.stop();
    }
    else area.start();
  });

  area.on('built', ({ stats }) => {
    panel.updateStats({ ...area.stats, ...stats }, area.resolvedTier);
    if (caption) {
      caption.textContent =
        `${stats.primarySceneTriangles.toLocaleString('ja-JP')} primary scene三角形 / 生成 ${stats.buildMs} ms`;
    }
  });
  area.on('tier', ({ tier, reason }) => {
    panel.showToast(`品質段階を ${tier} に変更しました（${reason}）`);
  });
  area.on('contextlost', () => {
    area.stop();
    showFallback('WebGL コンテキストが失われたため、静止画へ切り替えました。', 'webgl-context-lost');
  });

  let statsTimer = setInterval(() => {
    panel.updateStats(area.stats, area.resolvedTier);
    const governor = area.qualityGovernor;
    if (perfFallback.update({
      now: performance.now(),
      mode: params.quality.tier,
      tier: area.resolvedTier,
      fpsP20: area.stats.fpsP20,
      building: area.building,
      warmupRemaining: governor.warmupRemaining,
      sampleCount: governor.samples.length,
      minimumSamples: params.quality.minSamples,
    })) {
      area.stop();
      clearInterval(statsTimer);
      showFallback(
        `reduced品質でも p20 FPS が ${params.quality.fallbackFps} 未満の状態が `
          + `${params.quality.fallbackWindow} 秒継続したため、静止画へ切り替えました。`,
        'sustained-low-fps'
      );
    }
  }, 500);
  window.addEventListener('pagehide', () => clearInterval(statsTimer));

  async function rebuild() {
    await area.rebuild();
  }

  applySize();
  area.start();
  rebuild();

  // Exposed for the verification loop (screenshot/FPS/draw-call checks) and for the
  // eventual グリモ module, which subscribes to the environment contract from here.
  window.grimoireArea = {
    area,
    panel,
    params,
    getEnvironment: () => area.getEnvironment(),
    getStats: () => ({ ...area.stats, tier: area.resolvedTier }),
    fallbackGuard: perfFallback,
    setPreset: (name) => panel.applyPreset(name, true),
    setCollapsed: (v) => panel.setCollapsed(v),
  };
}

function saveScreenshot(area, panel) {
  // The drawing buffer is not preserved, so render and read back in the same synchronous
  // block — an async toBlob() callback would land after the buffer has been cleared.
  area.renderFrame(0);
  let url;
  try {
    url = area.renderer.domElement.toDataURL('image/png');
  } catch (error) {
    panel.showToast(`スクリーンショットの取得に失敗しました: ${error?.message ?? error}`);
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = `area1-coral-${Date.now()}.png`;
  a.click();
  panel.showToast('PNG を保存しました');
}
