const CACHE_PREFIX = 'grimoire-shell-'
const CACHE_VERSION = 'v2'
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`
const SHELL_URLS = [
  '/',
  '/calendar',
  '/grimo',
  '/catalog',
  '/settings',
  '/manifest.webmanifest',
  '/brand/grimoire-seal.svg',
  '/brand/grimoire-seal-inverse.svg',
  '/icons/icon-192.png',
]

async function installShell() {
  const cache = await caches.open(CACHE_NAME)
  const staticUrls = new Set()
  await Promise.allSettled(
    SHELL_URLS.map(async (url) => {
      const response = await fetch(url, { cache: 'reload' })
      if (!response.ok) return
      await cache.put(url, response.clone())
      if (!response.headers.get('content-type')?.includes('text/html')) return
      const html = await response.text()
      for (const match of html.matchAll(/\/_next\/static\/[^"'<>\s]+/gu)) {
        staticUrls.add(match[0].replaceAll('&amp;', '&'))
      }
    }),
  )
  await Promise.allSettled(
    [...staticUrls].map(async (url) => {
      const response = await fetch(url, { cache: 'reload' })
      if (response.ok) await cache.put(url, response)
    }),
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(installShell())
})

/**
 * Every cache on this origin except the current one is deleted, not only the
 * ones this worker named. The v1 app shipped to the same origin under
 * `task-manager-v*`, so a prefix filter would leave its shell cached forever on
 * every device that ever ran it — dead megabytes, and a stale copy of an app
 * this one replaces. Cache storage is origin-scoped and this app owns the
 * origin, so anything here that is not `CACHE_NAME` is ours to clear.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)))
          }
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          return cached ?? caches.match('/')
        }),
    )
    return
  }

  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/brand/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest'
  if (!isStaticAsset) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)))
        }
        return response
      })
    }),
  )
})
