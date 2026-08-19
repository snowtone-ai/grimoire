/**
 * main.js — entry point. Wires the scene, the panel and the page chrome together.
 *
 * The DOM overlay (title, loading state, fallback) is real HTML, never canvas-drawn text,
 * so it stays selectable and screen-reader readable.
 */

import { CoralArea } from './scene.js';
import { createParams } from './params.js';
import { ParamPanel } from './gui.js';

const canvas = document.getElementById('scene');
const overlay = document.getElementById('loading');
const overlayLabel = document.getElementById('loading-label');
const overlayBar = document.getElementById('loading-bar');
const fallback = document.getElementById('fallback');
const caption = document.getElementById('caption');

function showFallback(message) {
  if (overlay) overlay.hidden = true;
  if (!fallback) return;
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
  showFallback('この環境では WebGL2 が使えません。背景世界は静止画へのフォールバックが必要です。');
} else {
  boot();
}

function boot() {
  const params = createParams();
  let area;

  try {
    area = new CoralArea(canvas, params);
  } catch (error) {
    showFallback(`レンダラの初期化に失敗しました: ${error?.message ?? error}`);
    return;
  }

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
    if (document.hidden) area.stop();
    else area.start();
  });

  area.on('built', ({ stats }) => {
    panel.updateStats({ ...area.stats, ...stats }, area.resolvedTier);
    if (caption) {
      caption.textContent =
        `${stats.triangles.toLocaleString('ja-JP')} 三角形 / 生成 ${stats.buildMs} ms`;
    }
  });
  area.on('tier', ({ tier }) => panel.showToast(`品質段階を ${tier} に変更しました`));
  area.on('contextlost', () => showFallback('WebGL コンテキストが失われました。ページを再読み込みしてください。'));

  let statsTimer = setInterval(() => {
    panel.updateStats(area.stats, area.resolvedTier);
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
