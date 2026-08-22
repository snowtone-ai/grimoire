#!/usr/bin/env node
/**
 * DESIGN.md §7 — the raw-value lint (pm-zero v12.1 §16.2).
 *
 * The UI layer may only reach for colour, radius, shadow, type and z-index
 * through the tokens registered in DESIGN.md and emitted by
 * `src/styles/tokens.css`. A literal in a chrome file means either the value
 * belongs in the registry or the component is drifting from the system; both
 * are worth stopping the build for, which is why this is blocking rather than
 * advisory (DESIGN.md §7, D-011 addendum).
 *
 * It reads the whole scope rather than only changed files: the rebuild landed
 * the scope clean, so a full pass is both simpler than deriving a diff base and
 * strictly stronger — a violation cannot survive by never being touched again.
 *
 * The one escape hatch is the world's own art direction (component rule 5): a
 * scene value is registered by writing
 *
 *     /* world: scene value, exempt from DESIGN.md *\/
 *
 * on the value's line or one of the three lines above it. It is deliberately
 * verbose and grep-able — an explicit opt-out, not a loophole.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, posix, sep } from 'node:path'

const EXEMPTION = 'world: scene value, exempt from DESIGN.md'
const EXEMPTION_LOOKBACK = 3

/** The registry itself, plus files whose whole job is to define raw values. */
const REGISTRY_FILES = new Set(['src/styles/tokens.css'])

const CHECKS = [
  {
    id: 'color',
    // A colour literal: #rgb / #rrggbb / #rrggbbaa, or a functional notation.
    pattern: /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|color-mix)\(/,
    message: 'raw colour value — use a --color-* token from DESIGN.md §1/§9',
  },
  {
    id: 'radius',
    pattern: /border-radius:\s*(?![^;]*var\(--radius-)(?![^;]*\b(?:0|inherit|initial|unset)\b)/,
    message: 'raw border-radius — use --radius-control/panel/sheet/round (§3)',
  },
  {
    id: 'shadow',
    pattern: /box-shadow:\s*(?![^;]*var\(--(?:shadow|glow)-)(?![^;]*\bnone\b)/,
    message: 'raw box-shadow — use a --shadow-* or --glow-* token (§3/§9.6)',
  },
  {
    id: 'type',
    pattern: /font-size:\s*(?![^;]*var\(--text-)(?![^;]*\binherit\b)/,
    message: 'raw font-size — use a --text-* step from DESIGN.md §2.1',
  },
  {
    id: 'layer',
    pattern: /z-index:\s*(?![^;]*var\(--layer-)(?![^;]*\b(?:auto|0)\b)/,
    message: 'raw z-index — use a --layer-* value from DESIGN.md §5',
  },
]

/** Media and container queries cannot read custom properties (DESIGN.md §5). */
const QUERY_LINE = /^\s*@(?:media|container|supports)\b/

function isInScope(relativePath) {
  const path = relativePath.split(sep).join(posix.sep)
  if (REGISTRY_FILES.has(path)) return false

  const extension = extname(path)
  if (extension === '.css') {
    return (
      path.startsWith('src/app/')
      || path.startsWith('src/ui/')
      || path.startsWith('src/styles/')
      || /^src\/features\/[^/]+\/[^/]+\.module\.css$/.test(path)
    )
  }
  if (extension === '.tsx') {
    return (
      path.startsWith('src/app/')
      || path.startsWith('src/ui/')
      // Feature components are PascalCase; lower-case files there are models.
      || /^src\/features\/[^/]+\/[A-Z][^/]*\.tsx$/.test(path)
    )
  }
  return false
}

function* walk(directory) {
  for (const entry of readdirSync(directory).sort()) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) yield* walk(path)
    else yield path
  }
}

/**
 * In a `.tsx` file only inline styles can carry a raw value; a hex inside an
 * SVG path or a string of copy is not a design-system violation.
 */
function shouldInspect(line, extension) {
  if (extension === '.css') return !QUERY_LINE.test(line)
  return /style=\{|style:\s*\{|background|color|boxShadow|borderRadius|fontSize|zIndex/.test(line)
}

function isExempt(lines, index) {
  const from = Math.max(0, index - EXEMPTION_LOOKBACK)
  for (let cursor = from; cursor <= index; cursor += 1) {
    if (lines[cursor]?.includes(EXEMPTION)) return true
  }
  return false
}

const violations = []

for (const path of walk('src')) {
  const extension = extname(path)
  if (extension !== '.css' && extension !== '.tsx') continue
  if (!isInScope(path)) continue

  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  lines.forEach((line, index) => {
    if (!shouldInspect(line, extension)) return
    if (isExempt(lines, index)) return
    for (const check of CHECKS) {
      if (check.pattern.test(line)) {
        violations.push({
          check: check.id,
          line: index + 1,
          message: check.message,
          path: path.split(sep).join(posix.sep),
          source: line.trim(),
        })
      }
    }
  })
}

if (violations.length > 0) {
  console.error(`[design-lint] ${violations.length} raw value(s) outside the registry:`)
  for (const violation of violations) {
    console.error(`  ${violation.path}:${violation.line}  [${violation.check}] ${violation.message}`)
    console.error(`      ${violation.source}`)
  }
  console.error(
    '\n[design-lint] Register the value in DESIGN.md and src/styles/tokens.css, or — for a'
    + `\n              world scene value only — mark it with: /* ${EXEMPTION} */`,
  )
  process.exit(1)
}

console.log('[design-lint] UI chrome uses registered tokens only.')
