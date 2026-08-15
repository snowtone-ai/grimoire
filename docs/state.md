# state.md

## Current
- Branch: main (feat/reward-world-atlas merged, PR #20 closed, branch deleted)
- Active task: none — T027 done. Tier 2 Opus fresh-context review ran (pass with nits);
  2 major + 7 minor/nit findings fixed in a follow-up commit; pnpm verify re-run green
  (58/58 tests); merged with user's explicit go-ahead in the same session.
- Current executor: none
- Write lock: none
- Main agent: Claude Code (Sonnet-first; Opus for top-risk review only)
- Latest verification pointer: tasks.md T026
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
