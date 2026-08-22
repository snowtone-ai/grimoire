'use client'

import { useSyncExternalStore } from 'react'

/**
 * Whether motion should be suppressed right now.
 *
 * Three states, matching tokens.css: the OS preference is the initial value and
 * the in-app setting overrides it in both directions (決定事項ログ E-5). The
 * in-app setting reaches this hook the same way it reaches CSS — as `data-motion`
 * on the document element — so JS-driven motion and CSS-driven motion can never
 * disagree about which state is active.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, readReducedMotion, () => false)
}

function readReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  const setting = document.documentElement.dataset.motion
  if (setting === 'reduced') return true
  if (setting === 'full') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const list = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  list?.addEventListener('change', onStoreChange)

  // The in-app override is an attribute, so it needs an observer rather than a
  // media-query listener: nothing else notifies us when the user flips it.
  const observer = new MutationObserver(onStoreChange)
  observer.observe(document.documentElement, {
    attributeFilter: ['data-motion'],
  })

  return () => {
    list?.removeEventListener('change', onStoreChange)
    observer.disconnect()
  }
}
