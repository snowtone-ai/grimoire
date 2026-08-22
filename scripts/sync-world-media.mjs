#!/usr/bin/env node
/**
 * Bridges the owner's asset drop folder to what the browser can actually load.
 *
 * The owner adds footage to `anime/` (D-013). Next only serves `public/`, so
 * this copies recognised files into `public/world/` and writes the manifest
 * `src/world/media-manifest.ts` reads. Copies are skipped when the destination
 * already matches by size and mtime, so a rebuild does not rewrite gigabytes.
 *
 * Naming convention — the file name is the contract:
 *   splash.webm | splash.mp4                     the launch footage
 *   splash.jpg  | splash.png | splash.webp       its poster frame
 *   <area-id>.webm | <area-id>.mp4               that area's footage
 *   <area-id>.poster.jpg | .png | .webp | .avif  that area's poster frame
 *   bgm-<area-id>.ogg | .mp3 | .m4a | .webm       that area's looping BGM
 *
 * `<area-id>` must match an id in `src/world/areas.ts`, e.g.
 *   area-01-coral-plateau.webm
 *
 * Anything unrecognised is reported and ignored — never silently dropped.
 */
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, writeFileSync, rmSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

const SOURCE_DIR = 'anime'
const OUTPUT_DIR = join('public', 'world')
const AUDIO_OUTPUT_DIR = join('public', 'audio', 'bgm')
const MANIFEST_PATH = join(OUTPUT_DIR, 'manifest.json')
const SPLASH_KEY = 'splash'
const BGM_PREFIX = 'bgm-'

/** Ordered by preference: the browser takes the first source it can decode. */
const VIDEO_TYPES = new Map([
  ['.webm', 'video/webm'],
  ['.mp4', 'video/mp4'],
  ['.m4v', 'video/mp4'],
])
const VIDEO_PRIORITY = ['.webm', '.mp4', '.m4v']
const POSTER_EXTENSIONS = new Set(['.avif', '.webp', '.png', '.jpg', '.jpeg'])

/** Ordered by preference, same rule as video: first decodable source wins. */
const AUDIO_TYPES = new Map([
  ['.ogg', 'audio/ogg'],
  ['.m4a', 'audio/mp4'],
  ['.mp3', 'audio/mpeg'],
])
const AUDIO_PRIORITY = ['.ogg', '.m4a', '.mp3']

function classify(fileName) {
  const extension = extname(fileName).toLowerCase()
  const stem = basename(fileName, extname(fileName))

  // Checked before video, because a `.webm` may legitimately be either one and
  // the `bgm-` prefix is the only thing that can tell them apart.
  if (stem.startsWith(BGM_PREFIX) && (AUDIO_TYPES.has(extension) || extension === '.webm')) {
    return { extension, kind: 'audio', key: stem.slice(BGM_PREFIX.length) }
  }
  if (VIDEO_TYPES.has(extension)) {
    return { extension, kind: 'video', key: stem }
  }
  if (POSTER_EXTENSIONS.has(extension)) {
    // `<area>.poster.jpg` keeps a poster from colliding with a still image that
    // happens to share the area's name.
    const posterStem = stem.endsWith('.poster') ? stem.slice(0, -'.poster'.length) : stem
    return { extension, kind: 'poster', key: posterStem }
  }
  return { extension, kind: 'unknown', key: stem }
}

function copyIfChanged(from, to) {
  if (existsSync(to)) {
    const source = statSync(from)
    const destination = statSync(to)
    if (source.size === destination.size && source.mtimeMs <= destination.mtimeMs) {
      return false
    }
  }
  copyFileSync(from, to)
  return true
}

function main() {
  if (!existsSync(SOURCE_DIR)) {
    console.log(`[world-media] ${SOURCE_DIR}/ does not exist — nothing to sync.`)
    writeManifest({ areas: {}, splash: null })
    return
  }

  mkdirSync(OUTPUT_DIR, { recursive: true })
  mkdirSync(AUDIO_OUTPUT_DIR, { recursive: true })

  const entries = new Map()
  const bgmEntries = new Map()
  const ignored = []
  let copied = 0

  for (const fileName of readdirSync(SOURCE_DIR).sort()) {
    const from = join(SOURCE_DIR, fileName)
    if (!statSync(from).isFile()) continue

    const { extension, kind, key } = classify(fileName)
    if (kind === 'unknown') {
      ignored.push(fileName)
      continue
    }

    if (kind === 'audio') {
      if (copyIfChanged(from, join(AUDIO_OUTPUT_DIR, fileName))) copied += 1
      const track = bgmEntries.get(key) ?? { sources: [] }
      track.sources.push({
        src: `/audio/bgm/${fileName}`,
        type: AUDIO_TYPES.get(extension) ?? 'audio/webm',
      })
      bgmEntries.set(key, track)
      continue
    }

    const to = join(OUTPUT_DIR, fileName)
    if (copyIfChanged(from, to)) copied += 1

    const entry = entries.get(key) ?? { poster: null, sources: [] }
    if (kind === 'video') {
      entry.sources.push({ src: `/world/${fileName}`, type: VIDEO_TYPES.get(extension) })
    } else {
      entry.poster = `/world/${fileName}`
    }
    entries.set(key, entry)
  }

  for (const entry of entries.values()) {
    entry.sources.sort(
      (a, b) =>
        VIDEO_PRIORITY.indexOf(extname(a.src).toLowerCase())
        - VIDEO_PRIORITY.indexOf(extname(b.src).toLowerCase()),
    )
  }

  for (const track of bgmEntries.values()) {
    track.sources.sort(
      (a, b) =>
        AUDIO_PRIORITY.indexOf(extname(a.src).toLowerCase())
        - AUDIO_PRIORITY.indexOf(extname(b.src).toLowerCase()),
    )
  }

  const splash = entries.get(SPLASH_KEY) ?? null
  entries.delete(SPLASH_KEY)

  // A poster with no footage is not a playable entry; the world surface already
  // has an ambience layer for that case, so dropping it here keeps the manifest
  // honest about what can actually play.
  const areas = {}
  for (const [key, entry] of entries) {
    if (entry.sources.length === 0) {
      ignored.push(`${key} (poster with no video)`)
      continue
    }
    areas[key] = entry
  }

  writeManifest({
    areas,
    bgm: Object.fromEntries(bgmEntries),
    splash: splash !== null && splash.sources.length > 0 ? splash : null,
  })

  const areaCount = Object.keys(areas).length
  console.log(
    `[world-media] ${copied} file(s) copied, ${areaCount} area(s), ${bgmEntries.size} bgm track(s), splash ${splash === null ? 'absent' : 'present'}.`,
  )
  if (ignored.length > 0) {
    console.log(`[world-media] ignored: ${ignored.join(', ')}`)
  }
  const sourceNames = new Set(readdirSync(SOURCE_DIR))
  pruneStaleOutputs(OUTPUT_DIR, sourceNames, isWorldOutput)
  pruneStaleOutputs(AUDIO_OUTPUT_DIR, sourceNames, isAudioOutput)
}

/**
 * Removes only what this script could have written. The rule is narrow on
 * purpose: these directories are shared with the repository (a `.gitkeep`, a
 * licence file, hand-placed assets), and a sync step that deletes a file it did
 * not create is a data-loss bug waiting for the first person who puts something
 * there by hand.
 */
function pruneStaleOutputs(directory, sourceNames, isOwnOutput) {
  if (!existsSync(directory)) return
  for (const fileName of readdirSync(directory)) {
    if (fileName === 'manifest.json') continue
    if (fileName.startsWith('.')) continue
    if (!isOwnOutput(fileName)) continue
    if (sourceNames.has(fileName)) continue
    rmSync(join(directory, fileName))
    console.log(`[world-media] removed stale ${fileName}`)
  }
}

function isWorldOutput(fileName) {
  const { kind } = classify(fileName)
  return kind === 'video' || kind === 'poster'
}

function isAudioOutput(fileName) {
  return classify(fileName).kind === 'audio'
}

function writeManifest({ areas, bgm = {}, splash }) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  writeFileSync(
    MANIFEST_PATH,
    `${JSON.stringify({ schema: 1, areas, bgm, splash }, null, 2)}\n`,
    'utf8',
  )
}

main()
