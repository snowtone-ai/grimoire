# state.md

## Current
- Branch: feat/fantasy-item-visual-overhaul (PR #24 open, not merged). T031 —
  fantasy item collection visual overhaul, prototype phase (D-036). New
  react-three-fiber-based item codex detail page (`/book/[dropId]`, live
  rotating 3D model + tap-to-replay burst + params block), app-open flourish,
  and a magic-burst layer on the task-completion effect. 8 prototype items
  across 3 new fantasy domains (embercinder/hollowmire/thornveil), built on
  free CC0 Kenney 3D models + UI frame assets (no paid APIs, no AI image
  generation — matches the hard Pro-plan budget constraint). `DropDef`
  extended additively (domain/model/effect/params, all optional); all 436
  existing items and the 8 world-atlas regions are untouched. `pnpm verify`
  green (74 tests, 9 routes); Playwright mobile-viewport (390x844) smoke
  confirmed all 4 new surfaces render. **Blocked on the user's own visual
  review on their phone** before deciding whether/how to scale to the
  remaining 428 items — do not merge PR #24 or start T032 (full-catalog
  rollout) without that confirmation. Tier 1/2 self-review deliberately
  deferred until direction is confirmed (scope may still change).
- Previous: main (T029 merged, PR #22 closed, branch deleted; T030 governance
  migration committed directly to main — process/config only, no PR needed)
- Prior active task: none. T030 — pm-zero v11 -> v11.1.1 governance migration (D-035),
  applied to both global (`~/.claude`, affects all of the user's other repos) and
  project scope. Global: CLAUDE.md, settings.json (env/fallbackModel/hooks), and
  guard.mjs (P7: Edit/Write/MultiEdit/NotebookEdit now block `.env`/`.env.*`
  writes, not just reads) all re-read in full and confirmed correctly migrated —
  no RTK references remain, Sonnet 5/Opus 5 routing in place. Project:
  CLAUDE.md rewritten for v11.1.1; `.claude/settings.json`'s dead
  `"Bash(rm -rf:*)"` deny rule (invalid colon syntax, never matched) fixed to
  `"Bash(rm -rf *)"`; `.claude/rules/tests.md` added (node:test relative-import
  lesson moved out of cross-project auto-memory per the memory-layer boundary
  rule). Product source untouched. Tier 1 self-audit (docs/config-only diff,
  no auth/billing/DB-schema/production-data class) substituted for Tier 2, same
  basis as T015.
- Current executor: none (paused pending user review of T031/PR #24)
- Write lock: none
- Permanent constraint (from D-033): `shadcn` is exact-pinned to `4.1.2` (no caret)
  because 4.18.0 stopped shipping the `dist/tailwind.css` file this app's
  `globals.css` imports as its design-token base. Any future bump of `shadcn`
  must confirm `dist/tailwind.css` still ships before changing the pin.
- Informational (not a blocker, out of scope for T030): `~/.claude/settings.local.json`
  has a stale top-level `permissionMode` key not part of the loaded config
  hierarchy. No fix applied; recorded in D-035.
- Main agent: Claude Code (Sonnet 5-first; Opus 5 for top-risk review only)
- Latest verification pointer: tasks.md T031
- Verification mode: standard

## Current Blocker
- none — both prior Google Cloud blockers closed 2026-08-15 by the owner (human
  action was required for both; the agent lacked either tooling or credentials to
  self-serve). Root cause and fix history:
  - `GEMINI_API_KEY`: the owner's screenshot of Vercel > Environment Variables
    showed the var was saved under its pre-PR#19 name, `NEXT_PUBLIC_GEMINI_API_KEY`
    (added May 9), while the route reads `process.env.GEMINI_API_KEY` (added in
    PR #19 / T025). A grep of `src/` confirmed `NEXT_PUBLIC_GEMINI_API_KEY` is no
    longer referenced anywhere — since Vercel SSO is now off in Production
    (D-030), that stale var was sitting exposed in the client JS bundle for
    anyone to read. Owner added `GEMINI_API_KEY` (Production) and removed the
    stale `NEXT_PUBLIC_` one; redeployed automatically (dpl_Gnf5VDiMxgLRVyXSdziSQ138nUqJ,
    READY). Re-verified 2026-08-15: POST /api/gemini/generate with a valid
    `{kind:"voice", text, todayDate}` body now returns 200 with real Gemini
    output; an invalid body still correctly returns 400 (request-shape guard
    from T025 intact).
  - Google OAuth consent screen test users: owner added the family's Gmail
    addresses directly in Cloud Console (console.cloud.google.com/auth/audience)
    without needing agent involvement — self-service by a non-owner account is
    not possible on Google's side (test-user list is edited only by the project
    owner/editor), so this was always going to be a manual step.

## Next
- 2026-08-15: T030 — pm-zero governance migrated v11 -> v11.1.1 (D-035), global
  + project scope. v11.1.1 chosen over v11.2 (config-only truth patch vs. a
  version requiring new maintained scripts). No product code touched.
- 2026-08-15: T027 — reward catalog rebuilt into an 8-region world atlas (308→436 items,
  D-032). Backward compat intentionally broken (user-authorized). RARE4/8 untouched
  (ids/names/photos; flavor text on 24 of 60 was reworded, see D-032 correction).
  AI-generated illustrations for RARE6-8 were requested but are out of reach in this
  environment (no image-gen tool/key access) — deferred to a future task (a standalone
  script the user runs with their own GEMINI_API_KEY). Also deferred: drop-reveal.tsx
  doesn't show the region name at the moment of reveal (Tier 2 review nit, no visual
  QA time this session). Shipped and merged 2026-08-15.
- 2026-08-15: T026 — reward catalog 63→308 and the completion hot path no longer
  reads the whole drops ledger. See D-031. Deferred options recorded there: a
  Dexie v4 `dropId` index (would make the isNew check fully O(log n)), and more
  RARE8 entries if additional vista photos are ever sourced.
- 2026-08-15: T025 — family multi-user access audit found the data layer already
  device-scoped (no code needed); real blockers were Vercel SSO gating prod
  entirely (scoped to preview-only via Vercel settings) and NEXT_PUBLIC_GEMINI_API_KEY
  becoming publicly extractable once prod opened up (fixed: moved server-side via
  new src/app/api/gemini/generate route, PR #19). See D-030.
- 2026-07-21: Category classification removed (b31d66e) + calendar reborn as the
  調査記録 ember heatmap (T022 / D-027, merged #15).
- 2026-07-21: Permanent-use survey-notes overhaul on feat/seasonal-chronicle —
  seasonal CHRONICLE (T023 / D-028) + honest RARE 1-8 ladder (T024 / D-029).
  Future options: chronicle folding / year dividers once it gets long; a
  moving-personal-best axis (deferred 4th option); per-day recurring completion
  history for the heatmap (D-027 note); rate/pity re-tuning on real usage.
- No agent tasks queued. The staged reward plan (案1+案3) is fully shipped:
  drops/collection (T017), bounty board + departure + streak insurance (T018),
  Iceborne vista art direction (T020), Grimoire rebrand (T019), JSON backup (T021).
- On-device QA (human, optional): after the auto-deploy, check bounty board
  auto-claims, 出発 button, streak freeze display, and /book ARCHIVE
  export/import on the phone.
- Vercel project name stays "task-plant" by user decision (renaming would change
  the production origin and orphan on-device IndexedDB data; JSON backup now
  makes a future migration possible if ever wanted).
- Manual (human, post-session): local folder rename —
  `Rename-Item "C:\Users\chidj\project\プロダクト\task-plant" grimoire`
