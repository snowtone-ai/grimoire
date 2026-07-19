# repo-map.md -- pm-zero v11 Repository Map

## Read Policy
- Session start: read Summary only.
- Before editing: read the section for the target area when target files are unclear.
- When navigation is unclear: read Entry Points and Directory Map.
- After structural changes: update only the affected section.

## Summary
- App type: Next.js PWA for personal task management.
- Main runtime: Next.js 16, React 19, TypeScript, Tailwind CSS v4.
- Package manager: pnpm.
- Primary source directory: src/.
- Primary test directory: tests/.
- Main entry points: src/app/page.tsx, src/app/plant/page.tsx, src/app/layout.tsx.
- Verification command: pnpm verify.

## Directory Map
| Path | Purpose | Edit Frequency | Notes |
|---|---|---|---|
| src/app/ | App Router pages and layout | high | Keep route concerns here. |
| src/components/ | UI components by screen/domain | high | Keep display logic out of domain modules. |
| src/hooks/ | React state and side-effect hooks | high | Browser/API side effects belong here. |
| src/lib/domain/ | Pure task and plant logic | high | Add tests for behavior changes. |
| src/lib/api/ | External API helpers | medium | Secrets must come from env values. |
| tests/ | node:test coverage | medium | Domain regressions live here. |
| public/ | PWA assets | low | Generated icons come from scripts/gen-icons.mjs. |
| public/plant-rewards/ | Plant reward photo assets | low | Final monthly photos live under `final/`; keep source URLs and selections in docs/plant-reward-image-sources.md and docs/plant-reward-image-selections.md. |
| docs/ | pm-zero project memory | medium | Vision, state, decisions, issues, repo map. |
| scripts/ | Project tooling | medium | setup, verify, icon generation. |

## Entry Points
| Area | File | Purpose |
|---|---|---|
| Home | src/app/page.tsx | Main task view. |
| Plant | src/app/plant/page.tsx | Plant progress view. |
| Layout | src/app/layout.tsx | App shell and metadata. |
| Verification | scripts/verify.mjs | Unified local checks. |

## Common Workflows
| Workflow | Read First | Edit Usually | Verify |
|---|---|---|---|
| Domain change | docs/decisions.md, src/lib/domain/ | src/lib/domain/, tests/ | pnpm test |
| Screen change | docs/vision.md, relevant component | src/components/, src/hooks/ | pnpm lint; pnpm typecheck; pnpm build |
| External API change | docs/decisions.md | src/lib/api/, src/hooks/ | pnpm lint; pnpm typecheck; pnpm build |
| pm-zero docs | CLAUDE.md | tasks.md, docs/, scripts/ | git diff --check; pnpm verify |

## Generated / External Files
| Path | Rule |
|---|---|
| node_modules/, .next/, out/, build/ | Ignore. |
| coverage/, .playwright-mcp/ | Ignore generated verification output. |
| logs/, screenshots/ | Ignore generated evidence unless explicitly requested. |
| .env, .env.* except .env.example | Ignore secrets. |
| *.tsbuildinfo, next-env.d.ts | Ignore generated TypeScript files. |

## Update Rules
- Keep Summary under 20 lines.
- Keep each directory note concrete.
- Move rationale to docs/decisions.md.
