/* Sound playback — a small sampler over the vendored CC0 cue assets (D-047).
 *
 * Replaces the Web Audio synthesis engine (D-022/T036) entirely. That engine
 * generated every sound from oscillators so the app could ship with zero audio
 * files; the tradeoff was that everything it could say sounded like an
 * oscillator, and a "quest clear" and a "button pressed" were the same timbre
 * one octave apart. The app now has three CC0 Kenney packs vendored, so the
 * sound design lives in the asset choice instead — see domain/sound-cues.ts,
 * which is the only place that decides what plays when.
 *
 * This module is the browser half: decode, cache, mix, schedule. It owns no
 * opinions about which sound belongs to which action.
 *
 * Deliberately unchanged from D-022/D-036:
 *   - one localStorage toggle ("fx-enabled") gates sound AND haptics together,
 *     and is NOT forced off by prefers-reduced-motion (that media query is a
 *     motion signal, not an audio one — see domain/fx.ts).
 *   - the AudioContext is created inside the first user gesture, so a cue that
 *     fires after async work is not swallowed by the autoplay policy.
 *   - at most one cue and one haptic per action.
 */

import {
  ALL_CUE_SOURCES,
  clearAction,
  PAGE_ACTION,
  SOUND_CUES,
  type SoundAction,
} from "./domain/sound-cues.ts";

export type { SoundAction };

const PREF_KEY = "fx-enabled";

export function isFxEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setFxEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, enabled ? "1" : "0");
  } catch {
    // Preference storage is best-effort.
  }
}

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined" || !isFxEnabled()) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

const buffers = new Map<string, AudioBuffer>();
const inflight = new Map<string, Promise<AudioBuffer | null>>();
/** Sources whose fetch or decode failed. Never retried: a missing asset is a
 * build mistake (the cue-map test catches it), not a transient condition, and
 * retrying would hammer the network on every tap. */
const failed = new Set<string>();

function load(audio: AudioContext, src: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(src);
  if (cached) return Promise.resolve(cached);
  if (failed.has(src)) return Promise.resolve(null);

  const pending = inflight.get(src);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await fetch(`/audio/${src}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await audio.decodeAudioData(await response.arrayBuffer());
      buffers.set(src, buffer);
      return buffer;
    } catch (err) {
      failed.add(src);
      console.error(`[sound] could not load ${src}:`, err);
      return null;
    } finally {
      inflight.delete(src);
    }
  })();

  inflight.set(src, request);
  return request;
}

/** Create and unlock the AudioContext inside the first user gesture, then warm
 * every cue in the background. Without the warm-up the first press of each
 * distinct control would play a beat late while its file downloads; the whole
 * set is well under a megabyte and the service worker caches it after that. */
export function primeAudioOnFirstGesture(): void {
  if (typeof window === "undefined") return;
  window.addEventListener(
    "pointerdown",
    () => {
      const audio = ac();
      if (!audio) return;
      for (const src of ALL_CUE_SOURCES) void load(audio, src);
    },
    { once: true, passive: true }
  );
}

function emit(audio: AudioContext, buffer: AudioBuffer, gain: number, startAt: number): void {
  const source = audio.createBufferSource();
  const amp = audio.createGain();
  source.buffer = buffer;
  amp.gain.value = gain;
  source.connect(amp).connect(audio.destination);
  source.start(startAt);
}

export function haptic(pattern: number | readonly number[]): void {
  if (!isFxEnabled()) return;
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern as number | number[]);
    } catch {
      // Vibration is best-effort.
    }
  }
}

/* Two presses closer together than this collapse into one. Rapid taps on the
 * same control otherwise stack identical buffers on top of each other, which
 * reads as a click rather than as feedback. */
const RETRIGGER_MIN_MS = 55;
const lastPlayedAt = new Map<SoundAction, number>();

/** Play one action's cue. Fire-and-forget: never awaited by a call site, never
 * throws, and silently does nothing when sound is off or unavailable. */
export function playCue(action: SoundAction): void {
  const cue = SOUND_CUES[action];
  if (!cue) return;

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - (lastPlayedAt.get(action) ?? -Infinity) < RETRIGGER_MIN_MS) return;
  lastPlayedAt.set(action, now);

  if (cue.haptic !== null) haptic(cue.haptic);

  const audio = ac();
  if (!audio) return;

  /* One time origin for the whole cue, captured before any await, so a
   * multi-step cue keeps its designed spacing even if one step's buffer has to
   * be fetched first. Steps whose slot has already passed play immediately
   * rather than being dropped. */
  const origin = audio.currentTime;
  for (const step of cue.steps) {
    const at = origin + step.delayMs / 1000;
    const ready = buffers.get(step.src);
    if (ready) {
      emit(audio, ready, step.gain, at);
      continue;
    }
    void load(audio, step.src).then((buffer) => {
      if (buffer) emit(audio, buffer, step.gain, Math.max(at, audio.currentTime));
    });
  }
}

/** Quest clear + drop, picked by the shared RARE 1-8 band ladder. */
export function playClear(rarity: number): void {
  playCue(clearAction(rarity));
}

/** Arrival at a route. Unknown paths (e.g. /settings, which is not a tab) get
 * the home flip rather than silence. */
export function playPage(path: string): void {
  playCue(PAGE_ACTION[path] ?? "pageHome");
}
