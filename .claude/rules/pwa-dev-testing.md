---
paths:
  - "public/sw.js"
  - "src/components/**/pwa-register*"
---

# Stale service worker masks fresh dev-server builds

This app registers a PWA service worker (`public/sw.js`, cache name like
`task-manager-v6`) that a Playwright browser context reuses across sessions.
After editing client code, a browser tab that already has the SW installed
can keep serving an old cached JS bundle even after `.next` is deleted and
the dev server is restarted — the error overlay will show a stack trace
pointing at a component or line that no longer exists in source (e.g. a
comment block "crashing"), which is the tell that it's a stale-cache
artifact, not a real bug.

Fix: before trusting a browser console error during smoke testing, unregister
the SW and clear caches from that page context:
```js
const regs = await navigator.serviceWorker.getRegistrations();
for (const r of regs) await r.unregister();
for (const n of await caches.keys()) await caches.delete(n);
```
Then reload. Re-check the error before spending time investigating source
code that grep already shows doesn't contain the reported symbol.

由来: T036 (2026-08-17) — a genuinely deleted `EffectsSection` function kept
"crashing" across two full dev-server restarts and a `.next` cache wipe; the
actual cause was the SW cache, not the server-side build cache.
