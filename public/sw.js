// Bump this when SW logic changes. All clients discard old caches on activate.
const CACHE_NAME = "task-manager-v10";
const AREA_CACHE_NAME = "task-manager-area-v1";
const AREA_CACHE_MAX_ENTRIES = 6;
const ITEM_THUMB_CACHE_NAME = "task-manager-item-thumb-v1";
const ITEM_INSPECT_CACHE_NAME = "task-manager-item-inspect-v1";
const ITEM_THUMB_CACHE_MAX_ENTRIES = 160;
const ITEM_INSPECT_CACHE_MAX_ENTRIES = 12;
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
        keys
          .filter(
            (key) =>
              key !== CACHE_NAME &&
              key !== AREA_CACHE_NAME &&
              key !== ITEM_THUMB_CACHE_NAME &&
              key !== ITEM_INSPECT_CACHE_NAME
          )
          .map((key) => caches.delete(key))
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

  // Vendored CC0 effect assets (D-047): immutable, and re-fetching them is
  // expensive — ~900 KB of cue audio plus ~280 KB of particle textures, all of
  // which the first gesture of every session requests at once. Under
  // network-first that was a fresh ~1.2 MB download per app open on cellular.
  // These files only ever change by being replaced under a new name.
  if (url.pathname.startsWith("/audio/") || url.pathname.startsWith("/vfx/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Exploration masters are loaded only when an Area is opened. Bounded to six
  // rather than precaching all regions or letting full-resolution art grow
  // storage without a limit. Eviction is oldest-inserted-first, not
  // least-recently-used: a cache hit returns before any write, so re-viewing an
  // entry does not move it to the back of the queue. Fine at this scale — the
  // cost of a wrong eviction is one re-fetch.
  if (url.pathname.startsWith("/area-heroes/explore/")) {
    event.respondWith(boundedCacheFirst(request, AREA_CACHE_NAME, AREA_CACHE_MAX_ENTRIES));
    return;
  }

  // Collection art is never precached. Thumbnails get a larger view-driven
  // cache; full inspection images stay tightly bounded to protect phone
  // storage and decoded-memory pressure across a long collection session.
  if (url.pathname.startsWith("/item-rewards/thumb/")) {
    event.respondWith(boundedCacheFirst(request, ITEM_THUMB_CACHE_NAME, ITEM_THUMB_CACHE_MAX_ENTRIES));
    return;
  }

  if (url.pathname.startsWith("/item-rewards/inspect/")) {
    event.respondWith(boundedCacheFirst(request, ITEM_INSPECT_CACHE_NAME, ITEM_INSPECT_CACHE_MAX_ENTRIES));
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

async function boundedCacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      // Storing and trimming must never block the response, and must never
      // fail it. Awaiting cache.put inside this try meant that a device with
      // no storage quota left rejected the write and fell into the catch —
      // discarding a perfectly good 200 and answering 503, which turns every
      // item thumbnail and area image on the page into its placeholder. Same
      // discipline as cacheFirst/networkFirst above. Trimming rides along
      // behind the put so the eviction scan is off the response path too.
      cache
        .put(request, response.clone())
        .then(() => cache.keys())
        .then((keys) =>
          Promise.all(
            keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key))
          )
        )
        .catch(() => {});
    }
    return response;
  } catch {
    return new Response("Network error", { status: 503 });
  }
}
