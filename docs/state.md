# state.md

## Current
- Branch: feat/settings-and-fx-presets (T031/T032/T033, one PR — same bundling
  precedent as T018+T021). Base: main @ 17c6ef1.
- Active task: T031/T032/T033 — VoC-driven effects + settings work (D-036).
  Six pieces of user feedback were classified as PdM/UX input; two turned out to
  be defects rather than requests, and the rest were one root cause restated.
  - T031 (fix): drop reveal auto-dismissed in 2.0-3.4s while asking the user to
    read seven things, and the overlay's onClick covered the card, so reading it
    dismissed it. Now 4.0-9.0s by rank + stopPropagation + explicit close button.
    Deadline notifications existed but could never fire: the SW's setTimeout dies
    with the SW after seconds of idle, and notifications.ts bailed out entirely
    once 09:00 had passed (so opening later scheduled nothing, not even the next
    day). Replaced by catch-up-on-open through a new pure src/lib/domain/
    reminders.ts + a localStorage delivered-ledger; sw.js CACHE_NAME -> v6.
  - T032 (feat): /settings created; FxToggle, the notification panel, and
    /book's ARCHIVE + RESET cards all moved into it. Gear takes the slot the
    sound toggle vacated. BottomNav unknown paths now resolve to no active tab.
    Notification permission is asked once, after the first all-clear (F-7).
  - T033 (feat): effects intensity preset (しずか/ふつう/にぎやか) replacing the
    proposed pile of toggles; OS reduced-motion always forces しずか. Confetti
    extracted to src/lib/confetti.ts and made wave/scale driven. Tap sparks via
    one delegated listener (src/lib/spark.ts). /book entries replay their reveal.
    Morning ambience on にぎやか only, as an ambient layer behind content.
- Superseded (kept for history): T030 — pm-zero v11 -> v11.1.1 governance migration (D-035),
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
- Current executor: Claude Code main agent (2 Sonnet workers used on disjoint
  scopes: the fx preset model, and the /book replay + drop-reveal replay mode)
- Write lock: none
- Permanent constraint (from D-033): `shadcn` is exact-pinned to `4.1.2` (no caret)
  because 4.18.0 stopped shipping the `dist/tailwind.css` file this app's
  `globals.css` imports as its design-token base. Any future bump of `shadcn`
  must confirm `dist/tailwind.css` still ships before changing the pin.
- Informational (not a blocker, out of scope for T030): `~/.claude/settings.local.json`
  has a stale top-level `permissionMode` key not part of the loaded config
  hierarchy. No fix applied; recorded in D-035.
- Main agent: Claude Code (Sonnet 5-first; Opus 5 for top-risk review only)
- Latest verification pointer: tasks.md T033
- Known local-environment note (not a code issue): a stale
  `.next/dev/types/validator.ts` referencing a `/book/[dropId]` route that does
  not exist in the repo failed `pnpm typecheck` mid-session. Deleting that one
  generated file fixed it. Also worth knowing: the project deny rule
  `"Bash(rm -rf *)"` (introduced in T030) matches every `rm -rf`, including
  safe build-cache clears, not just the root/home cases it was meant for.
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
- 2026-08-16: T031/T032/T033 shipped on feat/settings-and-fx-presets (D-036).
  Deliberately NOT built, and why:
  - Random unprompted rewards on open: would dilute the 436-item rarity design
    (D-032). Held until we see whether /book replay already satisfies "もっと見たい".
  - Real scheduled push (Web Push + VAPID + cron + a subscription store): the
    app has no backend and no auth today, so this is pure new infrastructure.
    Catch-up-on-open ships first; decide after a week of real use.
  - Splitting sound and vibration into two switches: they share one preference
    in sound.ts, so the label says so instead of promising two.
  Open follow-up: re-interview the same person after they have used /book
  replay, and get VoC from the core persona (the ADHD student) — every piece of
  feedback so far is from one non-persona family member.
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
