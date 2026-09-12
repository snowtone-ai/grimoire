# repo-map.md — Grimoire repository map

## Read policy

- Start with this Summary and `tasks.md`.
- Before editing an unfamiliar area, read the relevant row below and the target file.
- After moving or adding a top-level area, update only the affected rows.

## Summary

- Product: personal task-management PWA with task completion, rewards, plant growth, and optional Google/Gemini integrations.
- Stack: Next.js 16, React 19, TypeScript, Tailwind CSS v4, pnpm.
- Runtime source: `src/`; tests: `tests/`; static assets: `public/`.
- Main routes: `/`, `/all`, `/book`, `/plant`, `/settings`.
- Persistence: IndexedDB modules in `src/lib/` (`db.ts`, `taskDb.ts`, `rewardDb.ts`, `backup.ts`).
- Verification: `pnpm verify`; production smoke check: `pnpm check:production`.

## Top-level map

| Path | Responsibility | Notes |
|---|---|---|
| `src/app/` | App Router pages, layout, metadata, API routes | Route-specific UI and server endpoints. |
| `src/components/` | Reusable screen and domain UI | Keep pure/domain logic outside components. |
| `src/hooks/` | Client state and browser side effects | Auth, plant state, navigation, home-screen behavior. |
| `src/lib/domain/` | Pure task, reward, plant, date, FX, and catalog logic | Add or update tests for behavior changes. |
| `src/lib/api/` | Google/Gmail/Calendar/Gemini integration helpers | Secrets remain server-side; validate input and bound requests. |
| `src/lib/` | Persistence, backup, sound, VFX, errors, and shared utilities | Schema changes require compatibility and rollback review. |
| `tests/` | Unit, integration, and bounded resilience checks | Run the smallest relevant suite, then `pnpm verify`. |
| `public/` | PWA, icon, audio, VFX, and plant-reward assets | Generated/vendor assets are documented by local manifests and licenses. |
| `scripts/` | Setup, verification, asset, and resilience tooling | `verify.mjs` is the unified local quality gate. |
| `docs/` | Product memory and operational records | Vision, state, decisions, issues, sources, and this map. |
| `data/` | Generated production data artifacts | Do not treat generated output as human-authored docs. |
| `.github/` | CI configuration | `workflows/ci.yml` runs the merge checks. |

## Entry points

| Area | File | Purpose |
|---|---|---|
| Home | `src/app/page.tsx` | Main task/quest flow and reward reveal. |
| All tasks | `src/app/all/page.tsx` | Calendar and list views. |
| Survey notes | `src/app/book/page.tsx` | Reward collection and replay. |
| Plant | `src/app/plant/page.tsx` | Monthly botanical growth view. |
| Settings | `src/app/settings/page.tsx` | Preferences, effects, integrations, backup, and reset. |
| App shell | `src/app/layout.tsx` | Metadata, providers, transitions, and global effects. |
| Persistence | `src/lib/db.ts`, `src/lib/taskDb.ts`, `src/lib/rewardDb.ts` | IndexedDB setup and task/reward storage. |
| External API | `src/app/api/`, `src/lib/api/` | Server routes and integration clients. |
| Verification | `scripts/verify.mjs` | Lint, typecheck, tests, and production build. |

## Common workflows

| Change | Read first | Verify |
|---|---|---|
| Domain or persistence | `docs/decisions.md`, relevant `src/lib/`, `tests/` | `pnpm test`, then `pnpm verify` |
| Screen or UI | `docs/vision.md`, relevant route/component, `src/app/globals.css` | lint/typecheck/build plus real-browser checks |
| External API | `docs/decisions.md`, `src/lib/api/`, route | `pnpm verify` and failure/retry checks |
| Repository/system docs | `AGENTS.md`, `tasks.md`, `xp.md` | `git diff --check`, targeted consistency checks |

## Generated and sensitive paths

- Ignore generated outputs: `node_modules/`, `.next/`, `out/`, `build/`, `coverage/`, `.playwright-mcp/`, `*.tsbuildinfo`.
- Do not commit `.env.local`, credentials, tokens, OAuth material, or user data.
- Keep product source changes separate from generated evidence and local caches.

## Update rules

- Keep this file navigational and factual; put rationale in `docs/decisions.md`.
- Keep the Summary short and update the map when a top-level responsibility changes.
