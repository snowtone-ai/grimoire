# Grimoire — Claude Code の入口

共通の作業規約は `AGENTS.md` を読む。現在地は `tasks.md`。
必要資料の場所は `pnpm context <topic>`、履歴は `pnpm context history <語>`。
旧規約のモデル指定・枠の推測・自動push・main編集例外は適用しない。
Claude固有の既存 `.claude/settings.json` とスコープ付きrulesは維持する。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
