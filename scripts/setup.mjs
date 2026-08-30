#!/usr/bin/env node
import fs from 'node:fs/promises'

const dirs = ['docs', 'scripts', 'templates', 'screenshots', 'logs']

for (const dir of dirs) {
  await fs.mkdir(dir, { recursive: true })
  console.log(`ready: ${dir}`)
}

console.log('pm-zero v12.1 directory structure ready.')
