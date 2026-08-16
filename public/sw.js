// Bump this when SW logic changes. All clients discard old caches on activate.
const CACHE_NAME = "task-manager-v6";
const NAV_TIMEOUT_MS = 3000;

// Notifications are shown by the page through registration.showNotification(),
// not scheduled here (D-036). A Service Worker is torn down after a few idle
// seconds, so any setTimeout parked in it — as an earlier version did — is
// destroyed long before a reminder hours away could fire. The page owns the
// timing and a delivered ledger; this worker only has to stay reachable.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return self.clients.openWindow("/");
      })
  );
});

// Install: never fail. Skip waiting immediately so the new SW can take over on next activate.
// We intentionally do NOT pre-cache app-shell via addAll() — any single 404 / network blip
// would fail the whole install and leave the user stuck on the previous SW version.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

// Activate: purge all caches that don't match CACHE_NAME, then claim every client
// so this SW immediately controls already-open pages.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== location.origin) return;

  // Navigation requests (HTML): network-first with 3s timeout, fallback to cache.
  // Always fetches the latest HTML after a deployment, but stays usable offline.
  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
    return;
  }

  // Next.js build assets (hashed): cache-first is safe — filenames are content-addressed.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else (including /_next/data, API, images): network-first.
  event.respondWith(networkFirst(request));
});

async function navigationHandler(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NAV_TIMEOUT_MS);
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    clearTimeout(timer);
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallback = await caches.match("/");
    if (fallback) return fallback;
    return new Response("Network error", { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response("Network error", { status: 503 });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return new Response("Network error", { status: 503 });
  }
}
