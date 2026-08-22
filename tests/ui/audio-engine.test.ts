import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AudioEngine } from '@/audio/audio-engine'
import { SOUND_CATALOG, SOUND_CUES } from '@/audio/sound-catalog'

class FakeBufferSource {
  buffer: unknown = null
  onended: (() => void) | null = null
  connect = vi.fn()
  disconnect = vi.fn()
  start = vi.fn()
}

function installWebAudio() {
  const started: FakeBufferSource[] = []
  const gains: { gain: { value: number } }[] = []

  class FakeAudioContext {
    state: 'running' | 'suspended' = 'running'
    destination = {}
    resume = vi.fn(async () => {
      this.state = 'running'
    })
    close = vi.fn(async () => {})
    createGain = vi.fn(() => {
      const node = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }
      gains.push(node)
      return node
    })
    createBufferSource = vi.fn(() => {
      const source = new FakeBufferSource()
      started.push(source)
      return source
    })
    decodeAudioData = vi.fn(async () => ({ duration: 0.1 }))
  }

  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })),
  )
  return { gains, started }
}

describe('sound catalog', () => {
  it('keeps every cue quiet enough to be punctuation', () => {
    for (const cue of SOUND_CUES) {
      expect(SOUND_CATALOG[cue].gain).toBeGreaterThan(0)
      expect(SOUND_CATALOG[cue].gain).toBeLessThanOrEqual(0.35)
    }
  })

  it('gives every cue a repeat window', () => {
    for (const cue of SOUND_CUES) {
      expect(SOUND_CATALOG[cue].minIntervalMs).toBeGreaterThan(0)
    }
  })

  it('points every cue at a vendored asset under /audio/', () => {
    for (const cue of SOUND_CUES) {
      expect(SOUND_CATALOG[cue].src).toMatch(/^\/audio\//)
    }
  })
})

describe('audio engine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-22T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('stays silent until sound effects are enabled', async () => {
    const { started } = installWebAudio()
    const engine = new AudioEngine()

    await engine.play('press')

    expect(started).toHaveLength(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('plays a cue once sound effects are on', async () => {
    const { started } = installWebAudio()
    const engine = new AudioEngine()
    engine.setSfxEnabled(true)

    await engine.play('press')

    expect(started).toHaveLength(1)
    expect(started[0]?.start).toHaveBeenCalledOnce()
  })

  it('drops a repeat inside the cue window instead of layering it', async () => {
    const { started } = installWebAudio()
    const engine = new AudioEngine()
    engine.setSfxEnabled(true)

    await engine.play('press')
    await engine.play('press')

    expect(started).toHaveLength(1)
  })

  it('allows the same cue again once its window has passed', async () => {
    const { started } = installWebAudio()
    const engine = new AudioEngine()
    engine.setSfxEnabled(true)

    await engine.play('press')
    vi.setSystemTime(Date.now() + SOUND_CATALOG.press.minIntervalMs + 1)
    await engine.play('press')

    expect(started).toHaveLength(2)
  })

  it('decodes each cue once and reuses the buffer', async () => {
    installWebAudio()
    const engine = new AudioEngine()
    engine.setSfxEnabled(true)

    await engine.play('taskComplete')
    vi.setSystemTime(Date.now() + 10_000)
    await engine.play('taskComplete')

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('resolves to silence when Web Audio is unavailable', async () => {
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('fetch', vi.fn())
    const engine = new AudioEngine()
    engine.setSfxEnabled(true)

    await expect(engine.play('press')).resolves.toBeUndefined()
  })

  it('resolves to silence when the asset cannot be fetched', async () => {
    installWebAudio()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) })),
    )
    const engine = new AudioEngine()
    engine.setSfxEnabled(true)

    await expect(engine.play('press')).resolves.toBeUndefined()
  })
})
