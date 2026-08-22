'use client'

import { useSyncExternalStore } from 'react'

import { listenToMediaQuery, matchMediaSafely } from './media-query-listener'

/**
 * Reads a media query and keeps following it. Server and first client render
 * both return `false`, so a layout must treat `false` as "not yet known" and
 * degrade to the narrow/most-conservative branch rather than flashing.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => listenToMediaQuery(matchMediaSafely(query), onStoreChange),
    () => matchMediaSafely(query)?.matches ?? false,
    () => false,
  )
}
