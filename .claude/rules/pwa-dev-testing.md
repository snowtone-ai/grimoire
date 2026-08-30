---
paths:
  - "public/sw.js"
  - "src/components/**/pwa-register*"
---

# Stale service worker masks fresh dev-server builds

**Prevented for new dev sessions as of T046 (2026-08-23).**
`src/components/pwa-register.tsx` refuses to register the service worker outside
`NODE_ENV === "production"` and unregisters workers/caches once current code loads.
An already controlling stale worker can still serve the old cleanup bundle, so a
reused browser profile does not always self-heal.

What used to happen: `public/sw.js` serves `/_next/static/` cache-first, which
is correct in production (those filenames are content-addressed) and wrong in
development (they are stable paths). A browser context that reused its profile
across sessions kept replaying a bundle from before the last edit while the dev
server reported a successful rebuild. The tell was a stack trace or a computed
style pointing at source that grep shows no longer exists.

If it ever recurs — an old profile, a build that ran with `NODE_ENV` unset — use
a fresh browser context or perform this recovery before restarting the dev server
or deleting `.next`:
```js
const regs = await navigator.serviceWorker.getRegistrations();
for (const r of regs) await r.unregister();
for (const n of await caches.keys()) await caches.delete(n);
```
then reload.

由来: T036 (2026-08-17) — a genuinely deleted `EffectsSection` function kept
"crashing" across two full dev-server restarts and a `.next` cache wipe; the
actual cause was the SW cache, not the server-side build cache. Recurred in
T045 (see the QA section of docs/asset-production-ledger.md) and again in T046,
where a CSS edit stayed invisible in the browser while `getComputedStyle` kept
reporting the previous revision's values. Three occurrences of one lesson is
what promoted it from a written procedure to a build-time guarantee.
