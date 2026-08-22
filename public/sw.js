const CACHE_PREFIX = 'grimoire-shell-'
const CACHE_VERSION = 'v3'
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`
/** App data the runtime asks for on every launch. Fresh when online, still
 *  answerable when not — the media manifest is the only one so far. */
const APP_DATA_URLS = ['/world/manifest.json']
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
  ...APP_DATA_URLS,
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

/**
 * `skipWaiting` because this app has one user family and one origin that main
 * deploys to automatically. Without it a new worker sits in `waiting` until
 * every tab for the origin is closed, so each deploy that touches `sw.js`
 * arrives a session late and the very first launch after an upgrade still runs
 * the worker it was meant to replace. Paired with `clients.claim()` below.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(installShell().then(() => self.skipWaiting()))
})

/**
 * Tapping a reminder has to reach the app — focus the window if one is open,
 * otherwise open it. Without this the notification is inert: on Android Chrome
 * it does not even dismiss, which makes the entire reminder feature look
 * broken at exactly the moment it is supposed to pay off.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => (clients.length > 0 ? clients[0].focus() : self.clients.openWindow('/'))),
  )
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

  // Navigations and app data share a strategy: always prefer the network so a
  // deploy is picked up immediately, and fall back to the last good copy when
  // there is no network. Cache-first would pin the media manifest to whatever
  // footage existed when the worker installed.
  if (request.mode === 'navigate' || APP_DATA_URLS.includes(url.pathname)) {
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
          const cached =
            (await caches.match(request)) ??
            (request.mode === 'navigate' ? await caches.match('/') : undefined)
          // `respondWith(undefined)` throws and hands the browser its own error
          // page. Install uses `allSettled`, so a shell entry can be missing
          // without anyone noticing — answer with something either way.
          return cached ?? new Response('Network error', { status: 503 })
        }),
    )
    return
  }

  // `/audio/` covers the interface sounds (D-015/D-016) — only cues that are
  // actually wired in `sound-catalog.ts` are ever fetched, so runtime cache
  // growth stays a few hundred KB even though the vendored pool (unwired,
  // never requested) is ~2.9MB. Silence offline would read as the app being
  // broken rather than quiet.
  // World footage is deliberately absent: those files are large, and the world
  // already degrades to its poster and ambience layers without them.
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/audio/') ||
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
