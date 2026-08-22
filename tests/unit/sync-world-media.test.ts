import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = join(process.cwd(), 'scripts', 'sync-world-media.mjs')

let workspace: string

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'grimoire-sync-'))
  mkdirSync(join(workspace, 'anime'), { recursive: true })
})

afterEach(() => rmSync(workspace, { force: true, recursive: true }))

function drop(name: string, body = 'x'): void {
  writeFileSync(join(workspace, 'anime', name), body)
}

function sync(): string {
  const result = spawnSync(process.execPath, [SCRIPT], { cwd: workspace, encoding: 'utf8' })
  expect(result.status).toBe(0)
  return result.stdout
}

function manifest(): {
  areas: Record<string, { poster: string | null; sources: { src: string }[] }>
  bgm: Record<string, { sources: { src: string }[] }>
  schema: number
  splash: { sources: { src: string }[] } | null
} {
  return JSON.parse(readFileSync(join(workspace, 'public', 'world', 'manifest.json'), 'utf8'))
}

/**
 * The owner drops files into `anime/` and this script is what makes them
 * reachable by the browser. It runs from `predev` and `prebuild`, so a mistake
 * here is a mistake that happens automatically, without anyone asking for it.
 */
describe('sync-world-media', () => {
  it('routes footage, posters and BGM to their own destinations', () => {
    drop('area-01-coral-plateau.webm')
    drop('area-01-coral-plateau.poster.jpg')
    drop('bgm-area-01-coral-plateau.ogg')
    drop('splash.mp4')

    sync()

    expect(manifest()).toMatchObject({
      areas: {
        'area-01-coral-plateau': {
          poster: '/world/area-01-coral-plateau.poster.jpg',
          sources: [{ src: '/world/area-01-coral-plateau.webm' }],
        },
      },
      bgm: {
        'area-01-coral-plateau': { sources: [{ src: '/audio/bgm/bgm-area-01-coral-plateau.ogg' }] },
      },
      schema: 1,
      splash: { sources: [{ src: '/world/splash.mp4' }] },
    })
    expect(existsSync(join(workspace, 'public', 'audio', 'bgm', 'bgm-area-01-coral-plateau.ogg')))
      .toBe(true)
  })

  it('reports an unrecognised file instead of copying it', () => {
    drop('notes.txt')

    expect(sync()).toContain('ignored: notes.txt')
    expect(manifest().areas).toEqual({})
  })

  it('removes footage whose source file is gone', () => {
    drop('area-01-coral-plateau.webm')
    sync()
    rmSync(join(workspace, 'anime', 'area-01-coral-plateau.webm'))

    sync()

    expect(existsSync(join(workspace, 'public', 'world', 'area-01-coral-plateau.webm'))).toBe(false)
    expect(manifest().areas).toEqual({})
  })

  it('never deletes a file it did not put there', () => {
    // Regression: pruning removed every name absent from `anime/`, which took
    // out `public/audio/bgm/.gitkeep` on the first `pnpm build` — and would
    // have taken out a licence file or a hand-placed asset just as happily.
    const audio = join(workspace, 'public', 'audio', 'bgm')
    mkdirSync(audio, { recursive: true })
    writeFileSync(join(audio, '.gitkeep'), '')
    writeFileSync(join(audio, 'LICENSE.txt'), 'CC0')
    writeFileSync(join(audio, 'bgm-removed-area.ogg'), 'stale')
    drop('bgm-area-01-coral-plateau.ogg')

    sync()

    expect(existsSync(join(audio, '.gitkeep'))).toBe(true)
    expect(existsSync(join(audio, 'LICENSE.txt'))).toBe(true)
    // Still prunes what it does own.
    expect(existsSync(join(audio, 'bgm-removed-area.ogg'))).toBe(false)
  })

  it('writes an empty manifest when the drop folder does not exist', () => {
    rmSync(join(workspace, 'anime'), { recursive: true })

    sync()

    expect(manifest()).toEqual({ areas: {}, bgm: {}, schema: 1, splash: null })
  })
})
