# state.md

## Current
- Branch: feat/gemini-server-proxy (PR #19, not yet merged)
- Active task: T026 — reward catalog 5x + hot-path perf; Tier 2 pre-merge review
  running. T025 (Gemini proxy) reviewed and fixed, riding the same branch.
- Current executor: Claude Code
- Write lock: none
- Main agent: Claude Code (Sonnet-first; Opus for top-risk review only)
- Latest verification pointer: tasks.md T026
- Verification mode: standard

## Current Blocker
- T025 held pre-merge: security/deploy class requires explicit human confirmation
  before merge per CLAUDE.md high-risk gate (Vercel SSO was already lifted for
  production per the user's earlier confirmation; merging PR #19 to main is the
  remaining irreversible step).
- Tier 2 Opus review (2026-08-15) found the route was an unauthenticated
  free-form LLM relay — fixed by replacing {prompt} with two typed request
  shapes (kind: "voice" | "gmail"); see D-030 and Review Notes/T025 for the
  full list of fixes (maxDuration, try/catch, header-based key, no upstream
  error echo, README fix). Re-verified green; not yet merged.
- Two manual (human) actions outstanding before family can actually use the app,
  neither is code and neither was done by the agent (secrets / external console):
  1. DONE 2026-08-15 (human): `GEMINI_API_KEY` added to the Vercel project env vars.
  2. OPEN: Google Cloud OAuth consent screen — if the GIS client used by
     src/lib/api/google-auth.ts is still in "Testing" mode, the family's Google
     accounts must be added as test users or Gmail/Calendar sign-in fails for
     them. Confirmed there is NO CLI/API path for this: the IAP OAuth Admin APIs
     were shut down in March 2026, so it is Cloud Console UI only. Browser
     automation was unavailable this session (the playwright MCP dropped
     mid-session and its tools do not re-register until Claude Code restarts),
     so this needs either a fresh session with playwright available, or a human.
     Blocked either way until the family's Google addresses are known.
     Scope note: this only gates the optional Gmail/Calendar import features —
     the core app works without any Google sign-in.

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
