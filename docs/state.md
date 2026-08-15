# state.md

## Current
- Branch: main
- Active task: none — T025 and T026 verified and merged (PR #19).
- Current executor: none
- Write lock: none
- Main agent: Claude Code (Sonnet-first; Opus for top-risk review only)
- Latest verification pointer: tasks.md T026
- Verification mode: standard

## Current Blocker
- DONE 2026-08-15 (human): `GEMINI_API_KEY` added to the Vercel project env vars.
- OPEN (human, or an agent session that has browser tools): Google Cloud OAuth
  consent screen. If the GIS client used by src/lib/api/google-auth.ts is still
  in "Testing" mode, the family's Google accounts must be added as test users or
  Gmail/Calendar sign-in fails for them. There is NO CLI/API path for this — the
  IAP OAuth Admin APIs were shut down in March 2026, so it is Cloud Console UI
  only. Browser automation was unavailable in the session that did this work (the
  playwright MCP dropped mid-session; its tools do not re-register until Claude
  Code restarts). Also blocked until the family's Google addresses are known.
  Scope: this gates only the optional Gmail/Calendar import — the core app works
  without any Google sign-in.

## Next
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
