# state.md

## Current
- 2026-08-19: T038 (D-042) — Grimoire v2 design consult session #1 (moved fully into
  Claude Code per owner's request, replacing the prior claude.ai chat). Branch
  `docs/grimo-dog-design-and-mhw-policy` off main. Read all 3 grimore-v2/ design docs;
  verified T037/D-041 evidence and tasks.md numbering (no issues found); confirmed
  BlenderMCP still `Pending approval` in `claude mcp list` (owner will run the manual
  Blender GUI "Connect to Claude" step + approve on next `claude` launch — no
  automation possible here, unchanged from T037). Two decisions recorded in D-042:
  (1) 犬系グリモ(水属性)の卵〜成体デザイン確定via 4-question x2-round consult (see
  grimore-v2/...統合版.md L-2章) — egg=frost/crystal translucent shell, infant=round
  soft body with fantasy elements confined to ear/tail-tip shape + ambient ripple VFX,
  child=infant extended (body grows, gradient starts filling in), adult=wolf/husky-base
  breed with full-body blue gradient, tone shifts cute->cute+cool across the arc; (2)
  MHW reference-image policy reversed — owner explicitly chose to use the 8 original
  images as-is for the *background world* (not the grimo creature) after being told
  twice the legal-risk picture (family now uses the app too per D-030, so the
  "personal-use-only" copyright exception doesn't cleanly apply; Three.js editing counts
  as derivative work, not just reproduction; risk is low-probability/non-zero since
  infringement is complaint-driven). Also researched and answered an owner question
  mid-session: GPT-5.6 Sol (OpenAI, released 2026-07-09) is real and technically usable
  here via Codex CLI (still active, MCP-capable, including an official Blender MCP
  Blender itself shipped in April 2026) — recommended staying single-agent (this
  project retired the dual-agent Codex+Claude split in D-020 for context-cost reasons
  that still apply) rather than switching, since no verified capability edge either
  way was found; flagged the official Blender MCP as a separate, non-model-related
  thing worth a future look (this project's T037 registered the community
  ahujasid/blender-mcp addon instead).
- 2026-08-19: T037 (D-041) — Grimoire v2 kickoff, environment prep only. Branch
  `chore/v2-env-setup` off main. Blender 4.5.10 LTS installed (winget), blender-mcp
  addon installed+enabled+persisted (headless python, save_userpref/save_homefile),
  PolyHaven scene toggle pre-set True in the default startup file. blender-mcp
  registered with Claude Code (`--scope project`); shows Pending approval in
  `claude mcp list` until the owner approves it at next `claude` launch. Remaining
  manual step (cannot be automated — the addon refuses to start its socket server in
  `--background` mode): open Blender GUI once and click "Connect to Claude" in the
  BlenderMCP sidebar tab. CC0 rigged-quadruped search on Sketchfab came up empty
  (downloadable+CC0+actually-rigged four-legged models are essentially nonexistent
  there); Quaternius's "Animated Animal Pack" (CC0, via poly.pizza, Shiba
  Inu/Husky/Wolf/Fox, Idle/Walk/Run/Jump/Death anims, FBX/glTF/Blend) identified as
  a strong candidate for the priority 犬(水属性) grimo — listed only, not downloaded,
  per the owner's explicit "decide next session" instruction. `grimore-v2/` design
  docs (3 files) added to the repo. No product code touched.
- 2026-08-17: T036 shipped — full effects rebuild (D-038 background
  particles, D-039 per-effect toggles replacing the old intensity dial,
  D-040 Tier 1 review fixes). Squash-merged via PR #29 to main (1bb8c8e),
  branch feat/aaa-fx-rebuild deleted, CI green on the merge commit, Vercel
  production deployment confirmed via the GitHub deployments API. Full
  narrative in tasks.md T036 (Evidence column has the complete browser-
  smoke and review-fix record); write scope there too (fx.ts domain+
  browser layers, confetti/spark/sound, drop-reveal, plant snowfall,
  settings screen, 3 new src/components/fx/ files, bottom-nav, layout.tsx,
  globals.css, docs/repo-map.md). Notable operational note from this task:
  this app's PWA service worker can mask fresh dev-server builds during
  browser smoke testing with a misleading stale-bundle error — see
  .claude/rules/pwa-dev-testing.md for the unregister+cache-clear recovery.
- 2026-08-17: T035 shipped on feat/notif-toggle-and-replay-fx, base main @ c5a6f36.
  Two user-reported defects: /settings had no way to turn notifications back off
  once granted (browser permission is a one-way ratchet, so a new app-level
  notif-enabled flag was added), and /book's item-tap replay used the exact
  same star-burst confetti as live task completion (now a distinct per-rarity
  "twinkle" via fireReplayEffect, distinct in shape and motion from the
  completion burst). pnpm verify green (80/80); browser smoke via Playwright
  confirmed both fixes with 0 console errors. CI green on PR #27; squash-merged
  to main and branch deleted; local checkout back on main @ c07d510.
- Previous branch: feat/settings-and-fx-presets (T031/T032/T033, one PR — same bundling
  precedent as T018+T021). Base: main @ 17c6ef1. PR #25 open.
- MERGE GATE: cleared. The owner explicitly authorised the merge on 2026-08-16
  after being shown that the diff falls in the 300+ line high-risk class and
  that merging auto-deploys to the production origin the family uses. Final
  pnpm verify green (80/80, 8 routes) immediately before merging; squash-merged
  via PR #25 and the branch deleted.
- Owner follow-up during the same exchange: asked for the sound-mute button to
  be moved into settings. Already done in T032 — the home header's FxToggle was
  removed and rebuilt as the FEEDBACK section of /settings; a grep confirms the
  only isFxEnabled/setFxEnabled UI in src/ is settings-screen.tsx. The button
  still appeared in the running app only because this branch had not yet merged.
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
- Superseded (kept for history): T034 — pm-zero v11.1.1 -> v12 governance migration
  (D-037), project scope only (global `~/.claude` was already on v12 before this task
  started). CLAUDE.md: header, Startup Read (+docs/issues.md), Budget/Continuity
  (absolute-window auto-compact replacing the PCT override, "do not split sessions"),
  Self-Review (Tier 2 retired), Self-Evolution (single machine-detectable-check loop,
  docs/lessons.md destination removed), Git merge-gate (CI green replacing self-reported
  verify) all rewritten. `.claude/settings.json` reduced to
  `{"permissions":{"defaultMode":"bypassPermissions"}}`, removing a real bug (a blanket
  `.env.*` deny pattern that blocked reading `.env.example` against documented policy)
  and the dead `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` env key, deferring fully to the
  already-v12 global deny + guard.mjs. `.github/workflows/ci.yml` added (Section 14
  migration item 6, task-plant named explicitly in the v12 doc) running the same
  lint/typecheck/test/build as pnpm verify, with branch protection requiring it.
  docs/issues.md stripped to the current-blockers-only template. docs/repo-map.md and
  tasks.md headers relabeled v12. docs/lessons.md/AGENTS.md do not exist in this repo.
  Product source untouched.
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
- 2026-08-16: T034 — pm-zero governance migrated v11.1.1 -> v12 (D-037), project scope
  (global already on v12). New: .github/workflows/ci.yml as the merge gate. Removed:
  Tier 2 review, docs/lessons.md as a promotion destination, "one task per session",
  the PCT-based auto-compact override, and a project settings.json bug that blocked
  reading .env.example. No product code touched.
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
