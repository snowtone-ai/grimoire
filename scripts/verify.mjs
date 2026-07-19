#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const pnpm = 'pnpm'
const requiredPaths = [
  'CLAUDE.md',
  'HANDOFF-JA.md',
  'tasks.md',
  'docs/vision.md',
  'docs/state.md',
  'docs/decisions.md',
  'docs/issues.md',
  'docs/repo-map.md',
  '.claude/settings.json',
]

const failures = []

console.log('=== Grimoire verification ===')
for (const file of requiredPaths) {
  const ok = existsSync(file)
  console.log(`${ok ? 'OK' : 'MISSING'} ${file}`)
  if (!ok) failures.push(`required:${file}`)
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

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[verify] failed: ${failure}`)
  }
  process.exit(1)
}

console.log('[verify] all checks passed')
