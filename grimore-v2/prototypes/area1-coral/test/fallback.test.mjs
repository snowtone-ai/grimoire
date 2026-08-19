import test from 'node:test';
import assert from 'node:assert/strict';

import { SustainedLowFpsFallback } from '../src/fallback.js';

function evidence(overrides = {}) {
  return {
    now: 0,
    mode: 'auto',
    tier: 'reduced',
    fpsP20: 39,
    building: false,
    warmupRemaining: 0,
    sampleCount: 60,
    minimumSamples: 60,
    ...overrides,
  };
}

test('PERF-08 requires a continuous three-second low-p20 window', () => {
  const guard = new SustainedLowFpsFallback({ thresholdFps: 40, durationSeconds: 3 });
  assert.equal(guard.update(evidence({ now: 1_000 })), false);
  assert.equal(guard.update(evidence({ now: 3_999 })), false);
  assert.equal(guard.update(evidence({ now: 4_000 })), true);
  assert.equal(guard.update(evidence({ now: 4_500, fpsP20: 60 })), true, 'fallback latches');
});

test('full, forced, building, warmup and undersampled readings never count', () => {
  const ineligible = [
    { tier: 'full' },
    { mode: 'reduced' },
    { building: true },
    { warmupRemaining: 0.1 },
    { sampleCount: 59 },
    { fpsP20: 40 },
    { fpsP20: 0 },
  ];
  for (const entry of ineligible) {
    const guard = new SustainedLowFpsFallback();
    assert.equal(guard.update(evidence({ now: 0, ...entry })), false);
    assert.equal(guard.update(evidence({ now: 4_000, ...entry })), false);
  }
});

test('one healthy sample resets the continuity window', () => {
  const guard = new SustainedLowFpsFallback();
  guard.update(evidence({ now: 0 }));
  guard.update(evidence({ now: 2_500 }));
  guard.update(evidence({ now: 2_600, fpsP20: 40 }));
  assert.equal(guard.update(evidence({ now: 3_100 })), false);
  assert.equal(guard.update(evidence({ now: 6_099 })), false);
  assert.equal(guard.update(evidence({ now: 6_100 })), true);
});
