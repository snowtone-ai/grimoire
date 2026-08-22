#!/usr/bin/env node
import fs from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const dirs = ['docs', 'scripts', 'templates', 'screenshots', 'logs']

for (const dir of dirs) {
  await fs.mkdir(dir, { recursive: true })
  console.log(`ready: ${dir}`)
}

// pm-zero v12.1 §16.7: per-project UI tool auto-provisioning, on framework
// detection only. Idempotent -- each step checks for its own prior effect
// before running, so re-invoking this script is always safe.
const FRONTEND_DEPS = ['react', 'vue', 'svelte', 'solid-js', 'next', 'nuxt', 'astro', '@angular/core']

function detectUiSurface() {
  if (!existsSync('package.json')) return false
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  if (FRONTEND_DEPS.some((name) => name in deps)) return true
  if (existsSync('DESIGN.md')) return true
  return false
}

function hasShadcn() {
  if (!existsSync('package.json')) return false
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  return 'shadcn' in deps || 'shadcn-ui' in deps
}

if (detectUiSurface()) {
  console.log('UI surface detected -- provisioning frontend tooling (pm-zero v12.1 §16.7)')

  if (!existsSync('.claude/skills/impeccable')) {
    const result = spawnSync('npx', ['impeccable', 'install'], { stdio: 'inherit', shell: process.platform === 'win32' })
    if (result.status !== 0) console.log('skip: impeccable install failed or unavailable (non-fatal)')
  } else {
    console.log('skip: .claude/skills/impeccable already present')
  }

  if (hasShadcn() && !existsSync('.claude/skills/shadcn')) {
    const result = spawnSync('npx', ['skills', 'add', 'shadcn/ui'], { stdio: 'inherit', shell: process.platform === 'win32' })
    if (result.status !== 0) console.log('skip: shadcn/ui skill install failed or unavailable (non-fatal)')
  } else if (hasShadcn()) {
    console.log('skip: .claude/skills/shadcn already present')
  }

  // No chrome-devtools MCP here: this repo already has Playwright MCP
  // registered and in active use for browser verification (T004, T008,
  // tests/e2e/). impeccable itself prefers the harness's existing browser
  // tool over a dedicated MCP (see its reference/critique.md), and its own
  // URL-scan engine falls back to a bundled Puppeteer, not chrome-devtools.
  // Adding a second overlapping browser-automation MCP is pure redundant
  // tool-schema cost with no functional gain (D-011 addendum, 2026-08-21).
} else {
  console.log('no UI surface detected -- skipping frontend tooling provisioning')
}

console.log('pm-zero v12.1 directory structure ready.')
