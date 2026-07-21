# state.md

## Current
- Branch: main
- Active task: none — all ledger tasks are verified or closed (T001-T022; zero open agent tasks)
- Current executor: none
- Write lock: none
- Main agent: Claude Code (Sonnet-first; Opus for top-risk review only)
- Latest verification pointer: tasks.md T022
- Verification mode: standard

## Current Blocker
- None

## Next
- 2026-07-21: Category classification removed (b31d66e) + calendar reborn as the
  調査記録 ember heatmap (T022 / D-027). Shipped together on feat/remove-category.
  Future option: track per-day recurring completion history so recurring quests
  contribute to the heatmap beyond their last-completed day (see D-027 review note).
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
