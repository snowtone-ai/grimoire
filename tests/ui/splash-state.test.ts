import { describe, expect, it } from 'vitest'

import {
  getSplashDuration,
  shouldDisplaySplash,
  SPLASH_HARD_MAX_MS,
  SPLASH_REDUCED_MS,
  SPLASH_TIMED_MS,
} from '@/app/splash-state'

describe('splash policy', () => {
  it('defaults the timed policy to one display per tab session', () => {
    expect(shouldDisplaySplash('timed', false)).toBe(true)
    expect(shouldDisplaySplash('timed', true)).toBe(false)
  })

  it('keeps off and always independent from the session marker', () => {
    expect(shouldDisplaySplash('off', false)).toBe(false)
    expect(shouldDisplaySplash('always', true)).toBe(true)
  })

  it('uses a short static interval for reduced motion and never exceeds the hard max', () => {
    expect(getSplashDuration('off', false)).toBe(0)
    expect(getSplashDuration('timed', true)).toBe(SPLASH_REDUCED_MS)
    expect(getSplashDuration('always', false)).toBe(SPLASH_TIMED_MS)
    expect(getSplashDuration('always', false)).toBeLessThanOrEqual(SPLASH_HARD_MAX_MS)
  })
})
