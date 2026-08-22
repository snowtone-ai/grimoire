import { SOUND_CATALOG, type SoundCue } from './sound-catalog'

/**
 * The app's only route to the speakers.
 *
 * Three rules it enforces so no call site has to remember them:
 *
 * 1. Nothing is created before a real user gesture. `AudioContext` starts
 *    suspended without one, and the splash is explicitly silent
 *    (docs/architecture.md §7), so construction is deferred to the first `play`
 *    that follows an interaction.
 * 2. Sound is never load-bearing. Every failure path — no Web Audio, a decode
 *    error, a missing file, a context that will not resume — resolves to silence,
 *    because the visual result must already be complete on its own (F-13).
 * 3. Rapid repeats are dropped, not layered (F-13's "過剰に鳴らさない").
 *
 * `prefers-reduced-motion` deliberately does not mute anything: motion and sound
 * are separate preferences, and F-13 says so explicitly.
 */
export class AudioEngine {
  #context: AudioContext | null = null
  #master: GainNode | null = null
  #buffers = new Map<SoundCue, AudioBuffer>()
  #pending = new Map<SoundCue, Promise<AudioBuffer | null>>()
  #lastPlayedAt = new Map<SoundCue, number>()
  #sfxEnabled = false
  #unavailable = false

  setSfxEnabled(enabled: boolean): void {
    this.#sfxEnabled = enabled
  }

  get sfxEnabled(): boolean {
    return this.#sfxEnabled
  }

  /**
   * Fire and forget. Returns a promise only so tests can await settling; callers
   * in the UI are expected to ignore it.
   */
  async play(cue: SoundCue): Promise<void> {
    if (!this.#sfxEnabled || this.#unavailable) return

    const definition = SOUND_CATALOG[cue]
    const now = Date.now()
    const last = this.#lastPlayedAt.get(cue)
    if (last !== undefined && now - last < definition.minIntervalMs) return
    this.#lastPlayedAt.set(cue, now)

    const context = this.#ensureContext()
    if (context === null) return

    if (context.state === 'suspended') {
      try {
        await context.resume()
      } catch {
        return
      }
    }

    const buffer = await this.#buffer(cue)
    // The preference can be switched off while the file is still decoding.
    if (buffer === null || !this.#sfxEnabled || this.#master === null) return

    const source = context.createBufferSource()
    source.buffer = buffer
    const gain = context.createGain()
    gain.gain.value = definition.gain
    source.connect(gain)
    gain.connect(this.#master)
    source.start()
    source.onended = () => {
      source.disconnect()
      gain.disconnect()
    }
  }

  /** Releases the audio hardware. Safe to call more than once. */
  dispose(): void {
    this.#buffers.clear()
    this.#pending.clear()
    this.#lastPlayedAt.clear()
    void this.#context?.close().catch(() => {})
    this.#context = null
    this.#master = null
  }

  #ensureContext(): AudioContext | null {
    if (this.#context !== null) return this.#context
    if (typeof window === 'undefined') return null

    const Constructor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (Constructor === undefined) {
      this.#unavailable = true
      return null
    }

    try {
      const context = new Constructor()
      const master = context.createGain()
      master.gain.value = 1
      master.connect(context.destination)
      this.#context = context
      this.#master = master
      return context
    } catch {
      this.#unavailable = true
      return null
    }
  }

  async #buffer(cue: SoundCue): Promise<AudioBuffer | null> {
    const cached = this.#buffers.get(cue)
    if (cached !== undefined) return cached

    const inFlight = this.#pending.get(cue)
    if (inFlight !== undefined) return inFlight

    const load = this.#decode(cue)
    this.#pending.set(cue, load)
    const buffer = await load
    this.#pending.delete(cue)
    if (buffer !== null) this.#buffers.set(cue, buffer)
    return buffer
  }

  async #decode(cue: SoundCue): Promise<AudioBuffer | null> {
    const context = this.#context
    if (context === null) return null
    try {
      const response = await fetch(SOUND_CATALOG[cue].src)
      if (!response.ok) return null
      return await context.decodeAudioData(await response.arrayBuffer())
    } catch {
      return null
    }
  }
}
