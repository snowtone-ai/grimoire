# state.md

## Current
- Branch: main
- Active task: none (T016/T017/T019 verified and merged; T018 ready as next stage)
- Current executor: none
- Write lock: none
- Main agent: Claude Code (Sonnet-first; Opus for top-risk review only)
- Latest verification pointer: tasks.md T019
- Verification mode: standard

## Current Blocker
- None

## Next
- On-device QA after the auto-deploy finishes (drop reveal + sounds, /book, page
  turn, dark scheme, DB v3 migration keeps existing tasks).
- Manual (human, dashboard): Vercel project rename task-plant -> grimoire, then
  re-add the old production domain in Settings > Domains so the installed PWA
  origin (and its IndexedDB data) keeps working. See HANDOFF-JA.md.
- Manual (human, post-session): local folder rename to "grimoire".
- Next agent task: T018 (bounty board + 出発 button + streak insurance); consider
  adding JSON export/import there to make future origin migrations data-safe.
