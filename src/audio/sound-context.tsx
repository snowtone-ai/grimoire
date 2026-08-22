'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'

import { AudioEngine } from './audio-engine'
import type { SoundCue } from './sound-catalog'

const SoundContext = createContext<((cue: SoundCue) => void) | null>(null)

export function SoundProvider({
  children,
  sfxEnabled,
}: {
  readonly children: ReactNode
  readonly sfxEnabled: boolean
}) {
  const engine = useRef<AudioEngine | null>(null)
  if (engine.current === null) engine.current = new AudioEngine()

  useEffect(() => {
    engine.current?.setSfxEnabled(sfxEnabled)
  }, [sfxEnabled])

  useEffect(() => {
    const instance = engine.current
    return () => instance?.dispose()
  }, [])

  const play = useMemo(() => {
    const instance = engine.current
    return (cue: SoundCue) => {
      void instance?.play(cue)
    }
  }, [])

  return <SoundContext.Provider value={play}>{children}</SoundContext.Provider>
}

const SILENT = () => {}

/**
 * Returns a play function that is always safe to call — outside a provider, in a
 * test, or with sound switched off it is simply a no-op. Nothing in the UI
 * should ever branch on whether sound is available.
 */
export function useSound(): (cue: SoundCue) => void {
  return useContext(SoundContext) ?? SILENT
}
