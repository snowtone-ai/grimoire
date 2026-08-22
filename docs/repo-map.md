# repo-map.md -- pm-zero v12 Repository Map

## Read Policy
- Session start: read Summary only.
- Before editing: read the section for the target area when target files are unclear.
- When navigation is unclear: read Entry Points and Directory Map.
- After structural changes: update only the affected section.

## Summary
- App type: Next.js PWA for personal task management (Iceborne-inspired quest/drop reward loop).
- Main runtime: Next.js 16, React 19, TypeScript, Tailwind CSS v4, next-view-transitions.
- Package manager: pnpm.
- Primary source directory: src/.
- Primary test directory: tests/.
- Main entry points: src/app/page.tsx, src/app/plant/page.tsx, src/app/book/page.tsx, src/app/settings/page.tsx, src/app/layout.tsx.
- Reward core: src/lib/domain/drops.ts, src/lib/rewardDb.ts, src/lib/sound.ts, src/lib/domain/rarity-style.ts.
- Presentation/effects core: src/lib/domain/fx.ts (per-effect ON/OFF toggles), src/lib/fx.ts,
  src/lib/domain/vfx-scenes.ts + src/lib/vfx.ts (particle scenes + canvas engine),
  src/lib/domain/sound-cues.ts + src/lib/sound.ts (cue map + sampler), src/lib/spark.ts, src/components/fx/.
- Verification command: pnpm verify.

## Directory Map
| Path | Purpose | Edit Frequency | Notes |
|---|---|---|---|
| src/app/ | App Router pages and layout | high | Keep route concerns here. |
| src/components/ | UI components by screen/domain | high | Keep display logic out of domain modules. |
| src/hooks/ | React state and side-effect hooks | high | Browser/API side effects belong here. |
| src/lib/domain/ | Pure task and plant logic | high | Add tests for behavior changes. |
| src/lib/api/ | External API helpers | medium | Secrets must come from env values. |
| tests/ | node:test coverage | medium | Domain regressions live here. |
| public/ | PWA assets | low | Generated icons come from scripts/gen-icons.mjs. |
| public/audio/cues/ | The 14 CC0 sound cues actually used | low | Kenney CC0, peak-normalized to -1.0 dBFS, 44.1kHz/mono. Source pack and per-file mapping in LICENSE.txt; durations in manifest.json. Referenced only through src/lib/domain/sound-cues.ts. |
| public/audio/ui/ | Kenney Interface Sounds, full 100-file pack | low | Vendored in T042/D-045 as a palette to select from; only the handful named in sound-cues.ts is loaded at runtime. |
| public/vfx/ | The 13 CC0 particle textures | low | Kenney Particle Pack, 256x256 white-alpha (pix_fmt ya8) so they can be tinted at runtime with theme tokens. Referenced only through src/lib/domain/vfx-scenes.ts. |
| public/plant-rewards/ | Plant reward photo assets | low | Final monthly photos live under `final/`; keep source URLs and selections in docs/plant-reward-image-sources.md and docs/plant-reward-image-selections.md. |
| docs/ | pm-zero project memory | medium | Vision, state, decisions, issues, repo map. |
| scripts/ | Project tooling | medium | setup, verify, icon generation. |

## Entry Points
| Area | File | Purpose |
|---|---|---|
| Home | src/app/page.tsx | Main quest (task) view + drop reveal. |
| Plant | src/app/plant/page.tsx | Botanical research (monthly growth) view. |
| Survey notes | src/app/book/page.tsx | Drop collection (RARE1/4/8 encyclopedia); tapping a collected entry replays its reveal. |
| Settings | src/app/settings/page.tsx | Per-effect ON/OFF toggles, sound/haptics, notifications, backup, reset. Sub-page, not a nav tab. |
| Layout | src/app/layout.tsx | App shell, metadata, ViewTransitions provider, mounts GraceParticlesGate + OpenFlourish. |
| Sound engine | src/lib/sound.ts | Sampler over the vendored CC0 cues: fetch/decode/cache/schedule + haptics. Owns no opinion about which sound belongs to which action; skips everything until the first user gesture (a suspended AudioContext queues rather than drops). |
| Sound cue map | src/lib/domain/sound-cues.ts | The only place deciding what plays when. One SoundAction per action in the app; three CC0 packs each own one layer (touch / world / reward). Only clearHigh and flourish layer two sounds. |
| VFX engine | src/lib/vfx.ts | Canvas 2D additive sprite engine (globalCompositeOperation "lighter", offscreen source-in tint cache, DPR-aware, MAX_PARTICLES 700). One fixed z-95 canvas that removes itself when idle. prefers-reduced-motion short-circuits play() with no per-effect exception. |
| VFX scenes | src/lib/domain/vfx-scenes.ts | Pure emitter data per moment (tap / clear ladder / all-clear / replay / flourish / morning / per-destination page sweep). The RARE ladder is monotonic and the summoning circle is exclusive to RARE7-8 — both fixed by tests. |
| Effects model | src/lib/domain/fx.ts | Six independent EffectKey toggles (tapSpark/completion/morningGreeting/openFlourish/ambientParticles/pageTransitions); OS reduced-motion always forces all six off, sound stays on its own separate fx-enabled toggle. |
| Ambient/arrival fx | src/components/fx/ | grace-particles.tsx (44 ambient motes across 3 depth layers, seeded PRNG; deliberately CSS rather than canvas so no rAF loop stays open), grace-particles-gate.tsx (background layer, excludes /plant), open-flourish.tsx (app-open arrival overlay). |
| Verification | scripts/verify.mjs | Unified local checks. |

## Common Workflows
| Workflow | Read First | Edit Usually | Verify |
|---|---|---|---|
| Domain change | docs/decisions.md, src/lib/domain/ | src/lib/domain/, tests/ | pnpm test |
| Screen change | docs/vision.md, relevant component | src/components/, src/hooks/ | pnpm lint; pnpm typecheck; pnpm build |
| External API change | docs/decisions.md | src/lib/api/, src/hooks/ | pnpm lint; pnpm typecheck; pnpm build |
| pm-zero docs | CLAUDE.md | tasks.md, docs/, scripts/ | git diff --check; pnpm verify |

## Generated / External Files
| Path | Rule |
|---|---|
| node_modules/, .next/, out/, build/ | Ignore. |
| coverage/, .playwright-mcp/ | Ignore generated verification output. |
| logs/, screenshots/ | Ignore generated evidence unless explicitly requested. |
| .env, .env.* except .env.example | Ignore secrets. |
| *.tsbuildinfo, next-env.d.ts | Ignore generated TypeScript files. |

## Update Rules
- Keep Summary under 20 lines.
- Keep each directory note concrete.
- Move rationale to docs/decisions.md.
