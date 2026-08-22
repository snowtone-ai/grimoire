/**
 * Subscribes to a `MediaQueryList` across the two APIs that exist in the wild.
 *
 * Safari only gained `addEventListener` on `MediaQueryList` in 14; before that
 * the deprecated `addListener` was the only route. A list that offers neither
 * (a test stub, an unusual embedded browser) is not an error — the query is
 * simply read once and never updates, which is a degraded but working page.
 */
type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: () => void) => void
  removeListener?: (listener: () => void) => void
}

export function listenToMediaQuery(
  list: MediaQueryList | undefined,
  onChange: () => void,
): () => void {
  if (list === undefined) return () => {}

  if (typeof list.addEventListener === 'function') {
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }

  const legacy = list as LegacyMediaQueryList
  if (typeof legacy.addListener === 'function') {
    legacy.addListener(onChange)
    return () => legacy.removeListener?.(onChange)
  }

  return () => {}
}

/** `window.matchMedia` when it exists, `undefined` on the server or a stub. */
export function matchMediaSafely(query: string): MediaQueryList | undefined {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return undefined
  }
  return window.matchMedia(query)
}
