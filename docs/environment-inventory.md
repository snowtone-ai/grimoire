# Development environment inventory

更新日: 2026-09-12
対象: この PC で Grimoire の開発に関係する検出済みのソフトウェア、環境、MCP、plugin、skill

## Host and runtimes

| 項目 | 検出値 |
|---|---|
| OS | Microsoft Windows NT 10.0.26200.0 |
| PowerShell | 7.6.5 |
| Node.js | v24.14.0 (`C:\Program Files\nodejs\node.exe`) |
| npm | 11.9.0 |
| pnpm | 10.33.0 |
| Python | 3.13.14 (`python`), Python launcher reports 3.14.4 (`py`) |
| Git | 2.54.0.windows.1 |
| Codex CLI | 0.154.0 |
| Project package | `grimoire`; Next.js 16 / React 19 / TypeScript / Tailwind CSS v4 |

## Repository tooling

- Package manager: pnpm.
- Main commands: `pnpm dev`, `pnpm verify`, `pnpm check:production`.
- Local configuration files present: `.mcp.json`, `components.json`, `skills-lock.json`.
- Existing project MCP entries: `blender`, `codegraph`, `playwright`, `context7`.

## Configured MCP servers

`codex mcp list` detected the following entries. Values of environment variables and credentials are intentionally omitted.

| Name | Status | Launch/runtime |
|---|---|---|
| `chrome-devtools` | enabled | `npx chrome-devtools-mcp@latest` |
| `codegraph` | enabled | `codegraph serve --mcp` |
| `cua_repl` | enabled | bundled CUA Node runtime |
| `node_repl` | enabled | bundled Codex Node REPL |
| `clasp` | disabled | `npx @google/clasp mcp` |
| `codex_app` | disabled | bundled Codex app-tools server |
| `google-workspace` | disabled | `uvx workspace-mcp==1.25.2` |

## Installed/enabled plugins

- `codex-app-tools` 0.1.4
- `browser` 26.908.40834
- `unified-computer-use` 26.908.40834
- `chrome` 26.908.40834
- `computer-use` 26.908.40834
- `visualize` 1.0.37
- `documents` 26.909.12148
- `pdf` 26.909.12148
- `spreadsheets` 26.909.12148
- `presentations` 26.909.12148
- `template-creator` 26.909.12148
- `openai-templates` 0.1.1
- `deep-research-work` 0.1.15
- `plugin-management` 0.1.0

The large curated-remote catalog contains many available but not installed plugins; this inventory lists installed/enabled plugins only.

## Available skills

Repository-local skills under `.agents/skills/`:

- `impeccable`
- `migrate-radix-to-base`
- `resilience-tester`
- `shadcn`

User-level skills under `C:\Users\chidj\.codex\skills\`:

- `chrome-devtools`
- `frontend-design`
- `handoff`
- `hatch-pet`
- `playwright`
- `playwright-interactive`
- `screenshot`

The active Codex runtime also exposes bundled/system skills; those are not duplicated here as project-owned files.

## Codex compaction configuration

Global file: `C:\Users\chidj\.codex\config.toml`

```toml
[features]
context_management = { experimental_mode = true }
remote_compaction_v2 = true
```

`remote_compaction_v2` was enabled with the installed Codex CLI. The existing auto-compact threshold remains unchanged.

## Maintenance notes

- This is a point-in-time inventory, not a complete list of every application installed on Windows.
- Refresh versions and statuses when the host, Codex runtime, MCP registrations, or plugin set changes.
- Never add secrets, access tokens, OAuth contents, or full environment-variable values to this file.
