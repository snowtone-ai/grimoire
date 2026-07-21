// Bump this when SW logic changes. All clients discard old caches on activate.
const CACHE_NAME = "task-manager-v5";
const NAV_TIMEOUT_MS = 3000;

// ── Scheduled Notification Timers ─────────────────────────────────────────
/** Map of notification id -> setTimeout timer id */
const scheduledTimers = new Map();

self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data.type === "SCHEDULE_NOTIFICATIONS") {
    const { notifications } = event.data;

    for (const timerId of scheduledTimers.values()) {
      clearTimeout(timerId);
    }
    scheduledTimers.clear();

    const now = Date.now();
    for (const notif of notifications) {
      const delay = notif.scheduledAt - now;
      if (delay <= 0) continue;

      const timerId = setTimeout(() => {
        self.registration.showNotification(notif.title, {
          body: notif.body,
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-192x192.png",
          tag: notif.id,
          renotify: false,
        });
        scheduledTimers.delete(notif.id);
      }, delay);

      scheduledTimers.set(notif.id, timerId);
    }
    return;
  }

  if (event.data.type === "TEST_NOTIFICATION") {
    self.registration.showNotification("タスク管理 — テスト通知", {
      body: "通知が正常に動作しています！締切前日・当日の朝9:00にリマインドします。",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
    });
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
