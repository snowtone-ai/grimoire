'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
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
