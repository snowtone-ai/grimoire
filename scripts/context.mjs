#!/usr/bin/env node
// Bounded, local documentation routing. Never walks the repository or reads secrets.
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const routes = {
  current: ['tasks.md', 'docs/state.md'],
  carol: ['docs/grimo-carol-rebuild-review.md', 'docs/grimo-g01-product-contract.md'],
  product: ['docs/vision.md', 'CONTEXT.md'],
  assets: ['docs/asset-production-ledger.md', 'docs/asset-art-bible.md'],
  context: ['docs/context-workflow.md', 'docs/repo-map.md', 'docs/decisions.md'],
  history: ['docs/archive/2026-09-09/tasks.md', 'docs/archive/2026-09-09/state.md', 'docs/archive/2026-09-09/decisions.md'],
}
const budgets = {
  'AGENTS.md': 5500,
  'CLAUDE.md': 1600,
  'HANDOFF-JA.md': 600,
  'tasks.md': 4500,
  'docs/state.md': 1400,
  'docs/decisions.md': 2500,
  'docs/repo-map.md': 2600,
}
const startup = ['AGENTS.md', 'tasks.md']
const size = (path) => statSync(new URL(path, root)).size
const read = (path) => readFileSync(new URL(path, root), 'utf8')
const [topic = 'help', query, ...extra] = process.argv.slice(2)

function check() {
  let failed = false
  for (const path of new Set([...Object.keys(budgets), ...Object.values(routes).flat()])) {
    try {
      const bytes = size(path)
      const limit = budgets[path]
      if (limit && bytes > limit) throw new Error(`${bytes} > ${limit} bytes`)
      if (limit) console.log(`${path}: ${bytes}/${limit} bytes`)
    } catch (error) {
      console.error(`FAIL ${path}: ${error.code ?? error.message}`)
      failed = true
    }
  }
  // Validate local Markdown links in the small canonical entry documents only.
  for (const path of Object.keys(budgets)) {
    let body
    try { body = read(path) } catch { continue }
    for (const match of body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0]
      if (!target || /^(?:https?:|mailto:)/i.test(target)) continue
      try { statSync(new URL(target, new URL(path, root))) } catch {
        console.error(`FAIL link ${path}: ${target}`)
        failed = true
      }
    }
  }
  const bytes = startup.reduce((total, path) => total + (size(path)), 0)
  console.log(`startup (AGENTS + tasks): ${bytes}/10000 bytes; not a token count`)
  if (bytes > 10000) failed = true
  process.exitCode = failed ? 1 : 0
}

function select() {
  if (topic === 'help') {
    console.log('Usage: pnpm context <topic> [literal keyword] | pnpm context:check')
    console.log(`Topics: ${Object.keys(routes).join(', ')}`)
    console.log('Returns paths or at most 12 matching lines (240 characters each), never full files.')
    return
  }
  if (!Object.hasOwn(routes, topic) || extra.length || (query && query.length > 120)) {
    console.error('Invalid topic/arguments. Run pnpm context for usage. Keywords are literal, <=120 characters.')
    process.exitCode = 1
    return
  }
  let matches = 0
  for (const path of routes[topic]) {
    if (!query) { console.log(`${path} (${size(path)} bytes)`); continue }
    const lines = read(path).split(/\r?\n/)
    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].toLocaleLowerCase().includes(query.toLocaleLowerCase())) continue
      if (matches === 12) { console.log('Limit reached; narrow the keyword.'); return }
      const line = lines[index]
      console.log(`${path}:${index + 1}: ${line.slice(0, 240)}${line.length > 240 ? '…' : ''}`)
      matches += 1
    }
  }
  if (query && !matches) console.log('No match in this topic. Choose another topic or CodeGraph for code.')
}

try {
  if (topic === '--check') check()
  else select()
} catch (error) {
  console.error(`context: ${error.code ?? error.message} (root: ${fileURLToPath(root)})`)
  process.exitCode = 1
}
