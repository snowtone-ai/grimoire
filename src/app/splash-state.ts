import type { SplashDisplayMode } from '@/ui/tokens'

export const SPLASH_TIMED_MS = 900
export const SPLASH_REDUCED_MS = 150
export const SPLASH_HARD_MAX_MS = 1_200
export const SPLASH_SESSION_KEY = 'grimoire:splash:timed-shown'

export function shouldDisplaySplash(
  mode: SplashDisplayMode,
  timedWasShownThisSession: boolean,
): boolean {
  if (mode === 'off') return false
  if (mode === 'always') return true
  return !timedWasShownThisSession
}

export function getSplashDuration(
  mode: SplashDisplayMode,
  reducedMotion: boolean,
): number {
  if (mode === 'off') return 0
  if (reducedMotion) return SPLASH_REDUCED_MS
  return Math.min(SPLASH_TIMED_MS, SPLASH_HARD_MAX_MS)
}
