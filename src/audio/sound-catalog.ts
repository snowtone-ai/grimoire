/**
 * Every sound the interface can make, and the one place a file path appears.
 *
 * The assets are Kenney's "Interface Sounds" (CC0 1.0), vendored under
 * `public/audio/ui/` with the pack's licence file beside them — nothing here is
 * synthesised by the app (D-013). `gain` exists because the pack is mixed for
 * games: played at unity these read as arcade feedback, not as the quiet
 * field-journal tone 決定事項ログ F-13 asks for.
 *
 * `minIntervalMs` is the anti-machine-gun rule from F-13 ("連続操作で過剰に鳴らさない"):
 * a cue re-triggered inside its window is dropped rather than layered.
 */
export type SoundCue =
  | 'catalogOpen'
  | 'catalogPage'
  | 'discovery'
  | 'error'
  | 'navigate'
  | 'press'
  | 'sheetClose'
  | 'sheetOpen'
  | 'taskComplete'
  | 'taskReopen'
  | 'toggleOff'
  | 'toggleOn'

export interface SoundDefinition {
  readonly src: string
  /** Linear gain, 0–1. Kept low: these are punctuation, not events. */
  readonly gain: number
  readonly minIntervalMs: number
}

export const SOUND_CATALOG: Readonly<Record<SoundCue, SoundDefinition>> =
  Object.freeze({
    press: { src: '/audio/ui/tick_002.wav', gain: 0.16, minIntervalMs: 45 },
    navigate: { src: '/audio/ui/click_002.wav', gain: 0.2, minIntervalMs: 90 },
    toggleOn: { src: '/audio/ui/toggle_001.wav', gain: 0.22, minIntervalMs: 90 },
    toggleOff: { src: '/audio/ui/toggle_002.wav', gain: 0.22, minIntervalMs: 90 },
    sheetOpen: { src: '/audio/ui/open_001.wav', gain: 0.2, minIntervalMs: 160 },
    sheetClose: { src: '/audio/ui/close_001.wav', gain: 0.18, minIntervalMs: 160 },
    taskComplete: {
      src: '/audio/ui/confirmation_001.wav',
      gain: 0.26,
      minIntervalMs: 140,
    },
    taskReopen: { src: '/audio/ui/back_001.wav', gain: 0.18, minIntervalMs: 140 },
    error: { src: '/audio/ui/error_004.wav', gain: 0.24, minIntervalMs: 400 },
    discovery: { src: '/audio/ui/glass_002.wav', gain: 0.3, minIntervalMs: 300 },
    catalogPage: { src: '/audio/ui/scratch_003.wav', gain: 0.16, minIntervalMs: 110 },
    catalogOpen: { src: '/audio/ui/pluck_001.wav', gain: 0.24, minIntervalMs: 160 },
  })

export const SOUND_CUES = Object.freeze(
  Object.keys(SOUND_CATALOG) as readonly SoundCue[],
)
