'use client'

import { useEffect } from 'react'

/**
 * Registers the offline shell — in production builds only.
 *
 * `sw.js` serves `/_next/static/` cache-first, which is right when those URLs
 * are content-hashed and wrong in `next dev`, where chunk names are reused
 * across edits: the worker keeps answering with the previous build and a CSS or
 * component change simply never appears in the browser. Registering here is
 * skipped in development, and any worker left behind by an earlier dev session
 * is unregistered so the fix reaches machines that already have one.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister()
      })
      return
    }

    const register = () => {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Offline availability is an enhancement; task storage remains IndexedDB-backed.
      })
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
