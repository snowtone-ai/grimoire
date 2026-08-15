# state.md

## Current
- Branch: feat/gemini-server-proxy (PR #19, not yet merged)
- Active task: T025 — review pending (Tier 2 Opus fresh-context review running in background)
- Current executor: Claude Code
- Write lock: none
- Main agent: Claude Code (Sonnet-first; Opus for top-risk review only)
- Latest verification pointer: tasks.md T025
- Verification mode: standard

## Current Blocker
- T025 held pre-merge pending Tier 2 review result (security/deploy class — human
  confirmation required before merge per CLAUDE.md high-risk gate).
- Two manual (human) actions outstanding before family can actually use the app,
  neither is code and neither was done by the agent (secrets / external console):
  1. Add `GEMINI_API_KEY` (same value, no `NEXT_PUBLIC_` prefix) to Vercel project
     env vars (Production + Preview), then redeploy. The agent cannot read/write
     .env* secret values.
  2. Check the Google Cloud OAuth consent screen publishing status for the GIS
     client used by src/lib/api/google-auth.ts. If it's in "Testing" mode, family
     members' Google accounts must be added as test users or Gmail/Calendar
     sign-in will fail for them. The agent has no Google Cloud Console access.

## Next
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
