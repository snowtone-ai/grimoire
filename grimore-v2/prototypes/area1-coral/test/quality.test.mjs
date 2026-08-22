import test from 'node:test';
import assert from 'node:assert/strict';

import { RuntimeQualityGovernor, percentile } from '../src/quality.js';
import { createParams, REDUCED_TIER } from '../src/params.js';

const CONFIG = Object.freeze({
  warmupWindow: 0.1,
  sampleFrames: 8,
  minSamples: 4,
  degradeFps: 48,
  recoverFps: 57,
  degradeWindow: 0.2,
  recoverWindow: 0.3,
  drawCallBudgetFull: 50,
  triangleBudgetFull: 150_000,
  triangleTolerance: 0.02,
  postPassBudgetFull: 10,
  recoverDrawCalls: 38,
  recoverTriangles: 100_000,
  recoverPostPasses: 8,
  tierDwell: 0.2,
  maxAutoDrops: 2,
});

function frame(governor, overrides = {}) {
  return governor.evaluate({
    dt: 1 / 60,
    currentTier: 'full',
    forcedTier: 'auto',
    building: false,
    drawCalls: 30,
    primarySceneTriangles: 80_000,
    postPasses: 8,
    config: CONFIG,
    ...overrides,
  });
}

function untilTransition(governor, overrides, limit = 240) {
  for (let i = 0; i < limit; i++) {
    const result = frame(governor, overrides);
    if (result.nextTier) return result;
  }
  assert.fail(`no transition in ${limit} frames`);
}

test('percentile interpolates without mutating input', () => {
  const values = [60, 20, 40, 80, 100];
  assert.equal(percentile(values, 0.2), 36);
  assert.deepEqual(values, [60, 20, 40, 80, 100]);
  assert.equal(percentile([], 0.2), 0);
});

test('production policy and reduced mobile profile stay on the calibrated contract', () => {
  const quality = createParams().quality;
  assert.deepEqual({
    degradeFps: quality.degradeFps,
    recoverFps: quality.recoverFps,
    sampleFrames: quality.sampleFrames,
    minSamples: quality.minSamples,
    drawCalls: quality.drawCallBudgetFull,
    triangles: quality.triangleBudgetFull,
    triangleTolerance: quality.triangleTolerance,
    fallbackFps: quality.fallbackFps,
    fallbackWindow: quality.fallbackWindow,
    postPasses: quality.postPassBudgetFull,
    cooldown: quality.tierDwell,
    maxDrops: quality.maxAutoDrops,
  }, {
    degradeFps: 48,
    recoverFps: 57,
    sampleFrames: 120,
    minSamples: 60,
    drawCalls: 50,
    triangles: 150_000,
    triangleTolerance: 0.02,
    fallbackFps: 40,
    fallbackWindow: 3,
    postPasses: 10,
    cooldown: 15,
    maxDrops: 2,
  });
  assert.deepEqual(REDUCED_TIER.quality, { pixelRatioCapMobile: 1.15, renderScale: 0.82 });
});

test('build and warmup frames never become performance evidence', () => {
  const governor = new RuntimeQualityGovernor();
  frame(governor, { dt: 0.1, building: true, drawCalls: 999 });
  let result = frame(governor, { dt: 0.05, drawCalls: 999 });
  assert.equal(result.metrics.sampleCount, 0);
  result = frame(governor, { dt: 0.05, drawCalls: 999 });
  assert.equal(result.metrics.sampleCount, 0);
  result = frame(governor, { dt: 1 / 60 });
  assert.equal(result.metrics.sampleCount, 1);
});

test('p20 FPS pressure degrades full only after sustained evidence', () => {
  const governor = new RuntimeQualityGovernor();
  const result = untilTransition(governor, { dt: 1 / 40 });
  assert.equal(result.nextTier, 'reduced');
  assert.match(result.reason, /fps-p20/);
  assert.equal(result.metrics.dropCount, 1);
  assert.equal(result.metrics.locked, false);
});

test('each explicit work budget can independently trigger degradation', async (t) => {
  for (const [name, pressure] of [
    ['draw calls', { drawCalls: 51 }],
    ['triangles', { primarySceneTriangles: 153_001 }],
    ['post passes', { postPasses: 11 }],
  ]) {
    await t.test(name, () => {
      const governor = new RuntimeQualityGovernor();
      const result = untilTransition(governor, pressure);
      assert.equal(result.nextTier, 'reduced');
      assert.match(result.reason, /draw-calls|triangles|post-passes/);
    });
  }
});

test('the documented two-percent triangle tolerance does not force a quality drop', () => {
  const governor = new RuntimeQualityGovernor();
  let result;
  for (let i = 0; i < 180; i++) {
    result = frame(governor, { primarySceneTriangles: 152_490 });
  }
  assert.equal(result.nextTier, null);
  assert.equal(result.metrics.dropCount, 0);
});

test('recovery requires headroom and cooldown; a second drop locks reduced', () => {
  const governor = new RuntimeQualityGovernor();

  const firstDrop = untilTransition(governor, { dt: 1 / 40 });
  assert.equal(firstDrop.nextTier, 'reduced');

  const recovered = untilTransition(governor, {
    currentTier: 'reduced',
    dt: 1 / 60,
    drawCalls: 30,
    primarySceneTriangles: 80_000,
    postPasses: 8,
  });
  assert.equal(recovered.nextTier, 'full');
  assert.equal(recovered.reason, 'auto-headroom-recovered');

  const secondDrop = untilTransition(governor, { currentTier: 'full', dt: 1 / 40 });
  assert.equal(secondDrop.nextTier, 'reduced');
  assert.equal(secondDrop.metrics.dropCount, 2);
  assert.equal(secondDrop.metrics.locked, true);

  let result;
  for (let i = 0; i < 120; i++) {
    result = frame(governor, { currentTier: 'reduced' });
    assert.equal(result.nextTier, null);
  }
  assert.equal(result.metrics.locked, true);

  result = frame(governor, { currentTier: 'reduced', forcedTier: 'full' });
  assert.equal(result.nextTier, 'full');
  assert.equal(result.reason, 'forced-full');
});

test('manual tier selection bypasses auto thresholds immediately', () => {
  const governor = new RuntimeQualityGovernor();
  const result = frame(governor, { forcedTier: 'reduced' });
  assert.equal(result.nextTier, 'reduced');
  assert.equal(result.reason, 'forced-reduced');
  assert.equal(result.metrics.sampleCount, 0);
});
