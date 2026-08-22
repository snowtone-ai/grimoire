'use client'

import { useSyncExternalStore } from 'react'

const EMPTY_SUBSCRIBE = () => () => {}

/**
 * Reads a media query and keeps following it. Server and first client render
 * both return `false`, so a layout must treat `false` as "not yet known" and
 * degrade to the narrow/most-conservative branch rather than flashing.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return EMPTY_SUBSCRIBE()
      const list = window.matchMedia(query)
      list.addEventListener('change', onStoreChange)
      return () => list.removeEventListener('change', onStoreChange)
    },
    () => {
      if (typeof window === 'undefined' || !window.matchMedia) return false
      return window.matchMedia(query).matches
    },
    () => false,
  )
}
