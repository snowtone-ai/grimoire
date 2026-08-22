'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import type { AreaDefinition } from '@/world/areas'
import type { WorldMediaEntry } from '@/world/media-manifest'

import { useReducedMotion } from '../hooks/use-reduced-motion'
import styles from './world-surface.module.css'

export interface WorldSurfaceProps {
  readonly area: AreaDefinition
  /** Chrome drawn above the world. Still follows component rules 1–4. */
  readonly children?: ReactNode
  /** Footage for this area, or null while the owner has not supplied any. */
  readonly media: WorldMediaEntry | null
}

type Playback = 'error' | 'playing' | 'waiting'

/**
 * DESIGN.md §6.5 — World surface.
 *
 * Three states, in this order of preference: footage, the area's poster frame,
 * and the area's own ambience gradient. The last one always exists, which is
 * what lets Grimo open before any asset has been delivered, on a device that
 * refuses to autoplay, or under a reduced-motion preference — the world is
 * never a precondition for the app working (docs/architecture.md §8).
 *
 * Crossfade on area change is ~0.6 s and is skipped under reduced motion
 * (決定事項ログ F-6). There is no camera move, no cut to black, no warp.
 */
export function WorldSurface({ area, children, media }: WorldSurfaceProps) {
  const reducedMotion = useReducedMotion()
  const video = useRef<HTMLVideoElement>(null)
  const [playbackOf, setPlaybackOf] = useState<{
    readonly key: string
    readonly value: Playback
  }>({ key: '', value: 'waiting' })

  // Reduced motion means the footage must not move at all, so it is not
  // mounted — pausing a video still costs the decode and the first frame flash.
  const footage = reducedMotion ? null : media

  // Which clip the playback state belongs to. Switching areas resets it during
  // render rather than in an effect, so the new area never shows one frame of
  // the previous clip's "playing" state before the reset lands.
  const mediaKey = footage === null ? '' : `${area.id}:${footage.sources[0]?.src ?? ''}`
  if (playbackOf.key !== mediaKey) setPlaybackOf({ key: mediaKey, value: 'waiting' })
  const playback: Playback = playbackOf.key === mediaKey ? playbackOf.value : 'waiting'
  const setPlayback = (value: Playback) => setPlaybackOf({ key: mediaKey, value })

  useEffect(() => {
    const element = video.current
    if (element === null) return
    // Autoplay is a promise that can reject (a policy block, a background tab).
    // A rejection is not an error state and needs no handling: playback is
    // already 'waiting', and the poster underneath is a valid world. The catch
    // exists only so the rejection is not reported as unhandled. `play()`
    // predates promises and still returns undefined in some engines, so the
    // result is checked rather than assumed.
    const started: Promise<void> | undefined = element.play()
    if (started !== undefined) void started.catch(() => {})
  }, [mediaKey])

  const showingFootage = footage !== null && playback === 'playing'

  return (
    <div className={styles.surface} data-area={area.id}>
      <div
        className={styles.ambience}
        style={{ background: area.posterGradient }}
        aria-hidden="true"
      />
      {footage?.poster == null ? null : (
        <div
          className={styles.poster}
          data-hidden={showingFootage ? '' : undefined}
          style={{ backgroundImage: `url("${footage.poster}")` }}
          aria-hidden="true"
        />
      )}
      {footage === null || playback === 'error' ? null : (
        <video
          key={mediaKey}
          ref={video}
          className={styles.footage}
          data-visible={showingFootage ? '' : undefined}
          poster={footage.poster ?? undefined}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setPlayback('playing')}
          onError={() => setPlayback('error')}
        >
          {footage.sources.map((source) => (
            <source key={source.src} src={source.src} type={source.type} />
          ))}
        </video>
      )}
      {children === undefined ? null : (
        <div className={styles.chrome}>{children}</div>
      )}
    </div>
  )
}
