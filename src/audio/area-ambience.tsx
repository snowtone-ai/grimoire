'use client'

import { useEffect, useRef } from 'react'

import type { WorldAudioEntry } from '@/world/media-manifest'

const FADE_MS = 900
const FADE_STEP_MS = 60
/** Quiet enough to sit under the interface, per 決定事項ログ F-13's "低密度". */
const BED_VOLUME = 0.34

export interface AreaAmbienceProps {
  /** Only used to key the element, so switching areas restarts cleanly. */
  readonly areaId: string
  readonly enabled: boolean
  /** The area's track, or null while the owner has not supplied one. */
  readonly track: WorldAudioEntry | null
}

/**
 * 決定事項ログ F-13 — the low-density BGM, and only where it belongs.
 *
 * It is mounted by the Grimo screen alone: Home, Calendar and Settings are
 * near-silent by decision, so there is nothing here to switch off on those
 * screens because nothing was ever started. The audio is owner-sourced
 * (D-013); until a file exists this renders nothing at all, which is why the
 * BGM preference can ship before the assets do.
 *
 * A `<audio>` element rather than the Web Audio graph in `AudioEngine`: a
 * multi-minute loop should stream, not be decoded whole into memory, and the
 * short cues and the bed have no reason to share a context.
 */
export function AreaAmbience({ areaId, enabled, track }: AreaAmbienceProps) {
  const element = useRef<HTMLAudioElement>(null)
  const fade = useRef<number | undefined>(undefined)

  useEffect(() => {
    const audio = element.current
    if (audio === null) return

    const stopFade = () => {
      if (fade.current !== undefined) {
        window.clearInterval(fade.current)
        fade.current = undefined
      }
    }

    // Ramping the volume by hand: `<audio>` has no fade, and arriving in a
    // world at full volume is the one thing a quiet ambience must not do.
    const rampTo = (target: number, onArrive?: () => void) => {
      stopFade()
      const step = FADE_STEP_MS / FADE_MS
      fade.current = window.setInterval(() => {
        const delta = target - audio.volume
        if (Math.abs(delta) <= step) {
          audio.volume = target
          stopFade()
          onArrive?.()
          return
        }
        audio.volume += Math.sign(delta) * step
      }, FADE_STEP_MS)
    }

    if (enabled) {
      audio.volume = 0
      // Autoplay may be refused until the person has interacted with the page.
      // That is not an error: the world is silent, and the next visit will
      // start it. Nothing else in the UI depends on this resolving. `play()`
      // predates promises and still returns undefined in some engines.
      const started: Promise<void> | undefined = audio.play()
      if (started === undefined) rampTo(BED_VOLUME)
      else void started.then(() => rampTo(BED_VOLUME)).catch(() => {})
    } else {
      rampTo(0, () => audio.pause())
    }

    return () => {
      stopFade()
      audio.pause()
    }
    // `areaId` belongs here even though the body never reads it: it keys the
    // element below, so moving between two areas that happen to share a track
    // object replaces the <audio> node without this effect noticing. The
    // detached element would keep playing until GC while the new one was never
    // started.
  }, [areaId, enabled, track])

  if (track === null) return null

  return (
    <audio
      key={areaId}
      ref={element}
      loop
      preload="none"
      aria-hidden="true"
      tabIndex={-1}
    >
      {track.sources.map((source) => (
        <source key={source.src} src={source.src} type={source.type} />
      ))}
    </audio>
  )
}
