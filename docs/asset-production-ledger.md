# Asset Production Ledger

Last updated: 2026-08-23  
Current phase: Claude review/QA pass complete and shipped. The 23 flagged must-fix item masters ship as-is per owner decision (Claude has no image-generation tool in this environment); the system-Back-does-not-close-explorers gap is fixed (see "Claude QA pass" below).

## Locked decisions

- Art direction: realistic natural fantasy with region-specific darkness.
- Narrative target: each item carries an intriguing trace of backstory; do not copy franchise symbols or compositions.
- Item redesign: allowed. Update name/flavor only when the approved redesign no longer matches the current copy.
- Item backgrounds: region/object-specific within one archive camera and material language.
- Area heroes: the eight areas reachable from the Record page. `garden` is out of scope for Area hero generation.
- Area content: one roughly 2×2-viewport exploration canvas per Area, initially centered, with coherent discoverable outer bands; no people, only subordinate plausible fauna when useful, and no weather/time variants.
- Inspection UX: true mobile full-screen for Area and item. Area uses bounded two-axis pan plus zoom; item uses swipe navigation plus zoom. Close/back remains persistent and comfortable.
- Target devices: Xiaomi 14T Pro and Pixel 7a; quality/speed target 60/40.
- Undiscovered item art: hidden.
- Motion: completion may be strong; no screen shake or flashing.
- Sound: new assets allowed; sound and haptic settings split; no volume slider; haptic only on important actions.
- Source videos under `素材/`: unrelated and untouched.
- RARE 8: all twelve existing photographs and shared plant usage remain untouched.

## Exact production scope

| Rarity | Items | Primary reasoning/review tier |
|---:|---:|---|
| 1 | 88 | Luna / high |
| 2 | 80 | Luna / high |
| 3 | 72 | Terra / high–max |
| 4 | 48 | Terra / high–max |
| 5 | 56 | Terra / max; Sol review for important/flagged assets |
| 6 | 48 | Sol / xhigh; max for important assets |
| 7 | 32 | Sol / max |
| **RARE 1–7** | **424** | rarity × visual complexity × importance |
| Area heroes | 8 | Terra / max or Sol / xhigh for demanding scenes |

The same built-in image generation path is used for bitmap creation. The reasoning tiers above own brief quality, critique, and regeneration decisions; they are not claims about a selectable image model.

## Regeneration budget

The environment does not expose the user's weekly quota balance to the repository or agent, so it cannot be measured directly. Production therefore uses observable call counts and quality gates:

- Pilot: one initial generation per asset; at most one targeted regeneration per failed pilot.
- RARE 1–2: regenerate only failed silhouette/material/readability cases; target ceiling 5% of the tier.
- RARE 3–4: target ceiling 10%.
- RARE 5: target ceiling 15%.
- RARE 6: target ceiling 25%.
- RARE 7: target ceiling 50%, never automatic when the first image already clears the rubric.
- Area: at most one targeted retry per scene unless a broken composition makes the asset unusable.
- Stop a batch cleanly if the generation service reports a quota limit; preserve the ledger and resume without reissuing successful assets.

These are ceilings, not quotas. Metadata, duplicate, path, crop, and thumbnail checks happen before spending another generation.

## Pilot set

| Kind | Stable ID | Output | State |
|---|---|---|---|
| R1 | `frost-1-yukinoshita` | `public/item-rewards/pilot/rare-1-frost-yukinoshita.png` | pass; 1254×1254; 1 generation; 9.0/10 |
| R2 | `lantern-2-origami-tsuru` | `public/item-rewards/pilot/rare-2-lantern-origami-tsuru.png` | pass; 1254×1254; 1 generation; 9.0/10 |
| R3 | `tide-3-chouryuu-ishi` | `public/item-rewards/pilot/rare-3-tide-chouryuu-ishi.png` | pass; 1254×1254; 1 generation; 9.0/10 |
| R4 | `r-hydrangea-dried` | `public/item-rewards/pilot/rare-4-hydrangea-dried.png` | pass; 1254×1254; 1 generation; 9.0/10 |
| R5 | `canopy-5-jaguar-tamashii` | `public/item-rewards/pilot/rare-5-canopy-jaguar-soul.png` | pass; 1254×1254; 1 generation; 8.5/10 |
| R6 | `savanna-6-hoshiyomishi-tsue` | `public/item-rewards/pilot/rare-6-savanna-star-reader-staff-tip.png` | pass; 1254×1254; 1 generation; 9.2/10 |
| R7 | `caravan-7-negai-mahoubin` | `public/item-rewards/pilot/rare-7-caravan-wish-bottle.png` | pass; 1254×1254; 2 generations; 9.4/10 |
| Area | `aegis` | `public/area-heroes/pilot/aegis.png` | pass; 853×1844; 1 generation |
| Area | `grove` | `public/area-heroes/pilot/grove.png` | pass; 853×1844; 1 generation |

## Pilot review

- Observed built-in image-generation calls: 10 for 9 accepted outputs. The only retry was the RARE 7 framing correction; no other asset consumed a retry.
- Working-master footprint: 23,612,518 bytes across nine PNG files. Responsive shipping derivatives are deliberately deferred until approval.
- Integrity: all nine expected paths exist and SHA-256 comparison found no byte-identical duplicates.
- Rarity: progression is carried by specimen care, craft, provenance, silhouette, and one increasingly consequential material phenomenon rather than by generic glow or added gold.
- Region: item surfaces and motivated light remain distinct; the bright `aegis` and dark `grove` heroes demonstrate the intended tonal range without rendering-style drift.
- Mobile: item silhouettes remain intact at square inspection scale; both Area compositions retain foreground, traversable middle distance, landmark, and dark-detail separation in a phone portrait.
- Constraint review: no people, mascots, readable text, logos, watermarks, baked UI frames, screen-dependent flashing, or direct franchise motifs were found.
- Approval result: user visually approved the art system on 2026-08-23, with one required amendment: Area art must extend to roughly twice the viewport on both axes and support bounded exploration from an initially centered frame.
- Pilot impact: the seven approved item masters remain valid. `aegis` and `grove` remain composition/style references but require expanded exploration masters before shipping.

## Phase ledger

1. Repository reconnaissance — complete.
2. Mandatory interview — complete.
3. Global Art Bible — complete; approval candidate at `docs/asset-art-bible.md`.
4. Pilot generation — complete; nine accepted masters from ten observed calls.
5. Single user approval gate — complete; approved with Area exploration amendment.
6. Area exploration specification and eight expanded masters — complete; all center previews visually reviewed and the mobile explorer implemented.
7. Full brief generation and item asset production — complete; 417 production masters plus seven approved pilots.
8. Full-screen UX, ripple, celebration, sound/haptic split, and performance implementation — complete.
9. Full QA and four-role self-critique — complete. See "Claude QA pass (2026-08-23)" below.

## Claude QA pass (2026-08-23)

Performed by Claude Code per `task-plant-claude-handoff.md`. Two Opus 5 subagents did the full-catalog visual review (RARE 1-3 and RARE 4-7 respectively, one contact-sheet pass plus spot checks of full-resolution masters for borderline/high-rarity items); Claude itself did engineering review, browser QA (Playwright, 412x915 viewport), and the four-role critique.

**Scripts**: fixed a false-positive bug in `validate-item-assets.mjs` (sharp/libheif reports AVIF containers as `format: "heif"`, not `"avif"`; the check compared against the literal string and failed all 424 AVIF derivatives). After the fix, validation passes clean: 424/424 assets, correct rarity distribution, 424 unique master hashes (no duplicates), all four derivative sets present.

**Item art verdict by tier**:
| RARE | Verdict | Must-fix count |
|---:|---|---:|
| 1 (88) | pass | 3 |
| 2 (80) | pass | 1 |
| 3 (72) | conditional pass — silhouette monotony borderline on §5 | 4 |
| 4 (48) | pass | 1 |
| 5 (56) | conditional pass | 2 |
| 6 (48) | **fail as a tier** — highest defect density, 3 hard silhouette collisions from template reuse | 7 |
| 7 (32) | **fail as a tier** — 3 items broken on subject/geometry, 2 silhouette-collision pairs | 5 |

23 must-fix masters total (all within the ledger's per-tier retry ceilings). Root cause per both reviewing agents: the post-handoff acceptance of first-pass masters "without further visual critique, regeneration, or duplicate audit" (this file, above) let template reuse and a few broken generations through, concentrated in RARE 6-7 where §5 requires every item to have a distinct primary silhouette. Full lists with IDs, severity, and reasons are in the two subagent reports (not persisted as separate files; ask Claude to re-run the review or see the conversation transcript). Forbidden-pattern check (§10) cleared on all 424 items across both reviews.

**Area art**: all 8 masters reviewed at full resolution (both the centered initial window and the outer exploration bands) plus the generated preview crops. All pass — each matches its documented visual hook, keeps a readable landmark/foreground/middle-distance composition in the centered crop, and no empty edges or unreadable dark corners were found. `area-explorer.tsx` pan/zoom bounds math verified correct by hand (elastic drag resistance, hard-clamped settle, scale-aware bounds) and confirmed interactively (pan, pinch-equivalent zoom, double-tap, wheel, keyboard, locator, reset, Escape-close all work with zero console errors).

**Engineering review**: `item-explorer.tsx`, `reward-art.tsx`, `sound.ts`/`vfx.ts` sound-haptic split, `drop-reveal.tsx`, and the `sw.js` bounded-cache additions were read in full and are correct. `pnpm test` (110/110), `typecheck`, `lint`, `build`, `git diff --check`, and `node --check` on all changed scripts + `sw.js` all pass clean.

**Fixed — system Back now closes the full-screen explorers**: neither `AreaExplorer` nor `ItemExplorer` closed on the Android/browser Back gesture (art bible §7 and the user's Q18 answer both require this). Two approaches were tried and rejected first: an empty-URL `pushState` gets folded into Next's App Router's own history-state sync instead of creating a distinguishable entry, and `next/navigation`'s `router.push` with only a hash change is a silent no-op in this Next.js version (`history.length` does not move). The working fix, `src/lib/use-dialog-back-close.ts`, calls `history.pushState` directly with a real changed URL (pathname + `#explore`) instead of going through the router, deferred to a microtask so React 19 dev/StrictMode's mount→cleanup→mount does not double-push or race `history.back()`'s own async cleanup unwind (mirrors the existing pattern in `open-flourish.tsx`). Wired into both `AreaExplorer` and `ItemExplorer` via one `useDialogBackClose(open, onOpenChange)` call each.

Verified live end-to-end with Playwright against a fresh dev bundle (see below for why "fresh" mattered): opening either explorer pushes a real history entry and sets `history.state.dialogBackGuard`; pressing Back closes the dialog and lands cleanly back on `/book` with no stray hash; closing via the X button or Escape pops the same guard entry in cleanup so `history.length` returns to its pre-open value (no stray entries accumulate across open/close cycles); pressing Back while no explorer is open is untouched, since the `popstate` handler is a no-op unless its own guard is active. Zero console errors across every scenario. `eslint-plugin-react-hooks`'s newer `react-hooks/refs` rule flagged the initial `onOpenChangeRef.current = onOpenChange` assignment as a ref write during render; moved it into its own no-dependency `useEffect`. Full `node scripts/verify.mjs` (lint, typecheck, 110/110 tests, build) passes clean with the fix in place.

Diagnosing this cost significant time for an unrelated reason: a service worker left registered in the Playwright browser profile by an earlier dev session was serving stale JS bundles regardless of how fresh the dev server's own output was (confirmed by a deliberate visible-text edit that a `curl` fetch reflected immediately but the browser did not) — see the `dev-service-worker-stale-assets` memory. `navigator.serviceWorker.getRegistrations()` → `unregister()` plus `caches.keys()` → `caches.delete()` in the browser resolved it; no source change was needed since this repo has no `serviceWorker.register()` call of its own to guard.

**Browser QA**: Add flow (ripple, sound cue, capture sheet autofocus/submit), quest completion celebration, drop reveal (now shows real `RewardArt` instead of emoji for RARE 1-7), Area explorer, Item explorer, Settings sound/haptic split (no volume slider, confirmed independent toggles), dark mode, reduced motion, IndexedDB persistence (task + drop survive navigation), and the system Back gesture on both full-screen explorers all verified with zero console errors.

## Area exploration production

Eight accepted lossless masters live under `public/area-heroes/master/`. Each master represents one coherent roughly 2×2-viewport world canvas; the exact center 50% × 50% also passes as a complete portrait composition. Shipping derivatives are generated by `scripts/process-area-assets.mjs`:

- `public/area-heroes/preview/{id}.{avif,webp}` — centered crop at 384×480, matching
  the Record card's `aspect-[4/5] object-cover` exactly. Originally 384×768 (1:2), which
  the browser then cropped back to 4:5 — 37% of every preview decoded and discarded.
- `public/area-heroes/explore/{id}.{avif,webp}` — full exploration canvas, loaded only when its Area is opened.
- Runtime keeps only one decoded exploration image mounted and the service worker limits the exploration cache to six entries.

| Area | Master dimensions | SHA-256 prefix | New production calls after pilot | State |
|---|---:|---|---:|---|
| `frost` | 887×1774 | `e87c20ff7c2c` | 1 | pass |
| `aegis` | 864×1821 | `0c99848b6be2` | 2 | pass; approved pilot expanded, one center-layout correction |
| `caravan` | 887×1774 | `c095fc4852d5` | 1 | pass |
| `canopy` | 887×1774 | `6f65290b3612` | 1 | pass |
| `lantern` | 887×1774 | `a09c04d1ea42` | 1 | pass |
| `grove` | 853×1844 | `3efb8a4bc78a` | 1 | pass; approved pilot expanded |
| `savanna` | 864×1821 | `b90bbea61eb4` | 1 | pass |
| `tide` | 887×1774 | `17138ba89c49` | 3 | pass; two targeted center-landmark corrections under unusable-composition exception |

Observed Area generation calls: 13 total, including the two approved pilot calls; eight final exploration masters accepted. Full AVIF derivatives are 170–261 KB, full WebP derivatives are 240–423 KB, and centered previews are 29–47 KB AVIF / 42–75 KB WebP.

The full-screen explorer opens centered, supports one-finger two-axis pan, pinch/double-tap/wheel zoom, pointer capture, edge resistance and bounded settling, persistent safe-area close and zoom controls, keyboard alternatives, and a compact locator. Its CSS transform is compositor-only and reduced-motion removes settling animation.

## Item production batches

All outputs below are 1254×1254 PNG working masters in `public/item-rewards/master/`. Existing pilot masters remain approved and are excluded from repeat generation.

| Batch | Tier | Accepted | Retries | Notes |
|---|---|---:|---:|---|
| L1 | RARE 1, Luna/high | 12 | 1 | Catalog order through `aegis-1-laurel-leaf`; `frost-1-yugetsubaki` received one targeted retry |
| M1 | RARE 3, Terra/max | 10 | 1 | Catalog order through `aegis-3-soukaishou`; `frost-3-getsumeiseki` received one targeted retry |
| H1 | RARE 6, Sol/max | 8 | 1 | Catalog order through `aegis-6-gekkei-kanmuri`; that final asset received one targeted retry |
| L2 | RARE 1–2, Luna/high | 12 | 0 | Catalog order through `frost-2-koketsubu`; 13 calls because `aegis-1-shio-azami` was accidentally issued twice, both valid, one retained |
| M2 | RARE 3, Terra/max | 10 | 1 | Catalog order through `caravan-3-kougyokuzui`; `aegis-3-kaihouseki` corrected from coral-like to mineral |
| H2 | RARE 6, Sol/max | 8 | 0 | Catalog order through `caravan-6-fuyajou-lamp`; all eight passed first generation |
| L3 | RARE 2, Luna/high | 12 | 1 | Catalog order through `aegis-2-shionokesshou`; `frost-2-tounowa` corrected to restore breathing room around the branch |
| M3 | RARE 3, Terra/max | 10 | 1 | Catalog order through `canopy-3-kongouseki`; `caravan-3-hoshikuzu-sasho` corrected from a salt-like cube to an irregular sand aggregate |
| H3 | RARE 6, Sol/max | 8 | 1 | Catalog order through `canopy-6-tenkuu-kagamiishi`; `caravan-6-sabakuryuu-uroko` corrected from a leaf-like form to a mineralised scale |
| H4 | RARE 6, Sol/max | 8 | 1 | Catalog order through `lantern-6-ryuujinzou-tsuno` to `grove-6-ookamiou-kegawa`; `lantern-6-shirokitsune-men` corrected to remove unintended cheek apertures |
| H5 | RARE 6, Sol/max | 8 | 3 | Catalog order through `grove-6-rune-sekifu` to `savanna-6-sennen-baobab`; three silhouette/edge-clearance corrections |
| H6 | RARE 6–7, Sol/max | 8 | 2 | Catalog order through `savanna-6-oukoku-metsubou-hai` to `frost-7-koreitama`; the whale-bone framing and the RARE 7 orb optics were corrected |
| P1 | RARE 5, Terra/max | 10 | 0 | Reverse catalog order from `tide-5-shiomitsu-kahen` through `savanna-5-lion-tategami`; all passed first generation |
| P2 | RARE 5, Terra/max | 10 | 1 | Reverse catalog order from `savanna-5-taiyouou-hane` through `grove-5-elk-oja-tsuno`; `savanna-5-daichi-seirei-ashiato` was corrected from a generic animal print to an abstract geological impression |
| P3 | RARE 5, Terra/max | 10 | 0 | Reverse catalog order from `grove-5-mori-seirei-ashiato` through `canopy-5-ranka-mitsu`; all passed first generation |
| M4 | RARE 3, Terra/max | 10 | 0 | Catalog order from `canopy-3-ketsuaka-menou` through `lantern-3-kougyoku-kanzashi`; all passed source-resolution review |
| M5 | RARE 3, Terra/max | 10 | 0 | Catalog order from `lantern-3-gunjou-gansho` through `grove-3-ginkaiseki`; all passed source-resolution review |
| M6 | RARE 3, Terra/max | 10 | 0 | Catalog order from `grove-3-jushi-kaseki` through `savanna-3-zouge-sango`; all passed source-resolution review |

Third production boundary: 90 accepted production masters from 98 observed production calls. Duplicate byte checks, square-dimension checks, silhouette/material review, and per-tier retry ceilings passed. Together with the seven approved pilots, 97 of 424 RARE 1–7 masters are accepted. L4/M4/H4 and a non-overlapping reverse-order RARE 5 lane are in progress.

High-rarity second boundary: H4–H6 added 24 accepted masters from 30 observed calls. All are opaque 1254×1254 RGB PNGs with unique SHA-256 hashes and no byte-identical match across the then-current master and pilot sets. RARE 6 production is complete apart from its separately approved pilot, and the lane has moved into RARE 7.

RARE 5 reverse-lane first boundary: P1–P3 added 30 accepted masters from 31 observed calls. Every output is 1254×1254, individually reviewed at source resolution, and unique by hash. The lane continues toward the catalog midpoint without overlapping the approved RARE 5 pilot.

Mid-rarity second boundary: M4–M6 added 30 accepted 1254×1254 masters from 30 observed calls with no retries. Each image was reviewed at source resolution; no quota error, lane overlap, broken crop, or name/material mismatch was found. The lane continues through the remaining RARE 3 items and then into RARE 4.

## Final production boundary and handoff policy

- All 417 non-pilot RARE 1–7 working masters now exist under `public/item-rewards/master/`; the seven separately approved pilots remain under `public/item-rewards/pilot/`, yielding all 424 catalog assets.
- `scripts/process-item-assets.mjs` completed and generated the shipping thumbnail and inspection AVIF/WebP derivatives plus `public/item-rewards/manifest.json` for all 424 assets.
- `scripts/build-item-production-index.mjs` completed and generated `data/item-asset-index.json` for all 424 assets.
- Observed item-generation accounting is 432 production calls for 417 production masters, plus eight pilot calls for seven pilot masters: 440 item image-generation calls in total. Area accounting remains 13 calls for eight final exploration masters plus the two pilot references.
- After the user's 2026-08-23 instruction to conserve the remaining token budget, unfinished outputs were accepted as first-pass production masters without further visual critique, regeneration, or duplicate audit. Final visual review, validation, contact sheets, build, test, lint, typecheck, and four-role critique are explicitly delegated to Claude and are not claimed complete here.

## Interaction and performance references

Implementation decisions were checked against primary platform guidance: W3C Pointer Events and `touch-action` for low-latency direct manipulation and pointer capture; Android drag/scale and overscroll guidance for multi-pointer tracking, bounded zoom, edge resistance and settle; web.dev responsive-image guidance for display-sized derivatives; and mobile game-engine texture-streaming guidance for loading only visible/high-value imagery. These references inform mechanics and budgets, not the visual identity.

## Quest capture redesign

- Home and All now share one 64 px `QuestAddButton`: a restrained water-spring seal with segmented rune ring, tiny gold glint, reduced-motion fallback, and a standard plus affordance. Pointer-down still launches the two-ring/six-mote canvas ripple from the exact contact point and click plays one dedicated `add` cue before opening capture; the generic modal-open cue is suppressed here so the water drop and glass bloom remain one coherent response.
- The hand-built overlay was replaced by the existing Radix/shadcn dialog foundation for focus trapping, Escape/overlay dismissal, semantics and scroll locking. Initial focus lands on the quest title; dismiss remains quiet and save remains a single success cue.
- The quick path contains only title, Today/Tomorrow, exact date and optional time. Memo and recurrence are progressively disclosed, with 44 px option targets, a persistent safe-area save action, inline save failure recovery and no extra confirmation step.
- Mobile browser QA at 407×904 confirmed a 64×64 add target, title autofocus, bounded 560 px collapsed sheet, scrollable expanded state, enabled/disabled save state, recurrence selection and no runtime/console errors. Functional IndexedDB persistence is rechecked in final QA.
