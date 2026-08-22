#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const pnpm = 'pnpm'
const requiredPaths = [
  'CLAUDE.md',
  'AGENTS.md',
  'HANDOFF-JA.md',
  'tasks.md',
  'docs/vision.md',
  'docs/state.md',
  'docs/decisions.md',
  'docs/issues.md',
  'docs/repo-map.md',
  '.claude/settings.json',
  '.codex/config.toml',
]

const failures = []

console.log('=== Grimoire verification ===')
for (const file of requiredPaths) {
  const ok = existsSync(file)
  console.log(`${ok ? 'OK' : 'MISSING'} ${file}`)
  if (!ok) failures.push(`required:${file}`)
}

/**
 * Whitespace damage across the whole branch, not just the working tree.
 * `git diff --check` with no arguments only inspects uncommitted changes, so a
 * clean tree says nothing about what was already committed — a distinction that
 * produced a verification claim in `tasks.md` that was not true. Vendored files
 * opt out through `.gitattributes`.
 */
function checkWhitespace() {
  console.log('\n--- whitespace ---')
  const base = spawnSync('git', ['merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8' })
  const range = base.status === 0 ? `${base.stdout.trim()}..HEAD` : 'HEAD'
  const result = spawnSync('git', ['diff', '--check', range], { encoding: 'utf8' })
  if (result.status === 0) {
    console.log('OK no whitespace errors')
    return
  }
  console.error(result.stdout || result.stderr)
  failures.push('whitespace')
}

function run(label, args) {
  console.log(`\n--- ${label} ---`)
  const result = spawnSync(pnpm, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    failures.push(label)
  }
}

run('lint', ['lint'])
run('typecheck', ['typecheck'])
run('test', ['test'])
run('build', ['build'])
checkWhitespace()

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[verify] failed: ${failure}`)
  }
  process.exit(1)
}

console.log('[verify] all checks passed')
