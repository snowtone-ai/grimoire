/* Sound design — one coherent audio identity, zero audio assets.
 *
 * Every sound is synthesized from a single C-major pentatonic palette
 * (C-D-E-G-A), so nothing can ever clash. Rarity reuses ONE ascending
 * motif at growing lengths (recognition, not random novelty). The RARE 1-8
 * ladder is bucketed into three motif lengths so the audio stays coherent:
 *   tap 1 note -> low(1-3) 3 notes -> mid(4-6) 4 notes -> high(7-8) 6-note run.
 * Budget per action: at most 1 sound + 1 haptic. Volume stays low.
 * The toggle persists in localStorage and also gates haptics.
 *
 * T036 timbre pass (still zero new assets, still the same 9-note palette):
 * every tone() now opens through a brief lowpass sweep so notes "bloom" open
 * instead of sounding like a raw oscillator beep; arpeggio() gets a few ms of
 * randomized jitter per step so repeated runs don't read as mechanically
 * quantized; playSave/playFanfare borrow a subtler version of playClear's
 * rank-8 detuned-sine shimmer; playPage() gains an optional per-page theme
 * so the sound and the new per-page CSS transition (T036) agree on identity.
 */

import { rarityBand } from "./domain/rarity-style.ts";

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

/** Create and unlock the AudioContext inside the first user gesture, so
 * sounds played after async work (e.g. quest completion) are not muted by
 * the autoplay policy on the session's very first interaction. */
export function primeAudioOnFirstGesture(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("pointerdown", () => void ac(), {
    once: true,
    passive: true,
  });
}

/** Pentatonic palette (Hz). */
const N = {
  E4: 329.63, G4: 392.0,
  C5: 523.25, D5: 587.33, E5: 659.26, G5: 783.99, A5: 880.0,
  C6: 1046.5, E6: 1318.51,
} as const;

function tone(
  audio: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  gain = 0.1,
  type: OscillatorType = "triangle"
): void {
  const osc = audio.createOscillator();
  const filter = audio.createBiquadFilter();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);

  // Juice: a brief lowpass sweep so each note "blooms" open instead of
  // sounding like a raw oscillator beep. Zero new assets, ~20ms.
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(freq * 1.2, startAt);
  filter.frequency.exponentialRampToValueAtTime(freq * 8, startAt + 0.02);
  filter.Q.value = 0.7;

  amp.gain.setValueAtTime(0.0001, startAt);
  amp.gain.exponentialRampToValueAtTime(gain, startAt + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(filter).connect(amp).connect(audio.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

/** Short filtered-noise swish (notebook page turn). `opts` lets playPage's
 * per-page themes reuse the same noise-through-bandpass technique at a
 * different center frequency/tail instead of inventing a new sound design. */
function swish(
  audio: AudioContext,
  startAt: number,
  opts?: { fromHz?: number; toHz?: number; duration?: number; gain?: number }
): void {
  const duration = opts?.duration ?? 0.16;
  const fromHz = opts?.fromHz ?? 900;
  const toHz = opts?.toHz ?? 300;
  const gain = opts?.gain ?? 0.06;

  const buffer = audio.createBuffer(1, audio.sampleRate * duration, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const source = audio.createBufferSource();
  source.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(fromHz, startAt);
  filter.frequency.exponentialRampToValueAtTime(toHz, startAt + duration);
  filter.Q.value = 1.2;
  const amp = audio.createGain();
  amp.gain.setValueAtTime(0.0001, startAt);
  amp.gain.exponentialRampToValueAtTime(gain, startAt + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  source.connect(filter).connect(amp).connect(audio.destination);
  source.start(startAt);
}

/** Two quiet detuned sines under a note for a touch of shimmer — the same
 * idea playClear's rank-8 run already used, generalized and turned down for
 * reuse on playSave/playFanfare. */
function shimmer(audio: AudioContext, freq: number, startAt: number, duration: number, gain: number): void {
  for (const detune of [0, 6]) {
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startAt);
    osc.detune.value = detune;
    amp.gain.setValueAtTime(0.0001, startAt);
    amp.gain.exponentialRampToValueAtTime(gain, startAt + duration * 0.35);
    amp.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(amp).connect(audio.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.05);
  }
}

/** ±5ms of randomized timing per step so a repeated arpeggio doesn't read as
 * a mechanically quantized loop, while staying tight enough that the motif
 * is still instantly recognizable (D-022/D-036: same run, extended by rank). */
function arpeggio(freqs: number[], step: number, gain: number): void {
  const audio = ac();
  if (!audio) return;
  const t = audio.currentTime;
  freqs.forEach((freq, i) => {
    const jitter = (Math.random() - 0.5) * 0.01;
    tone(audio, freq, t + i * step + jitter, 0.22, gain);
  });
}

export function haptic(pattern: number | number[]): void {
  if (!isFxEnabled()) return;
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Vibration is best-effort.
    }
  }
}

/** FAB / mic / minor confirmations. */
export function playTap(): void {
  const audio = ac();
  if (!audio) return;
  tone(audio, N.E5, audio.currentTime, 0.09, 0.08);
  haptic(8);
}

/** Quest saved (add/edit). */
export function playSave(): void {
  const audio = ac();
  if (!audio) return;
  const t = audio.currentTime;
  tone(audio, N.A5, t, 0.12, 0.09);
  tone(audio, N.C6, t + 0.07, 0.16, 0.07);
  shimmer(audio, N.C6, t + 0.07, 0.16, 0.02);
  haptic(10);
}

/** Completion undo — soft descending pair, deliberately non-punishing. */
export function playUndo(): void {
  const audio = ac();
  if (!audio) return;
  const t = audio.currentTime;
  tone(audio, N.G4, t, 0.12, 0.06, "sine");
  tone(audio, N.E4, t + 0.09, 0.16, 0.05, "sine");
}

/** Notebook page turn (route change). `theme` picks a per-destination variant
 * (T036) so the sound agrees with the new per-page CSS transition; "home"
 * reproduces the original swish exactly, so any existing call site that
 * passes nothing behaves exactly as before. */
export function playPage(theme: "home" | "plant" | "book" | "all" = "home"): void {
  const audio = ac();
  if (!audio) return;
  const t = audio.currentTime;

  if (theme === "plant") {
    tone(audio, N.C5, t, 0.16, 0.05, "sine");
    tone(audio, N.E5, t + 0.09, 0.2, 0.045, "sine");
    return;
  }
  if (theme === "book") {
    // Heavier parchment: lower center frequency, longer tail than the
    // default notebook-paper swish.
    swish(audio, t, { fromHz: 650, toHz: 200, duration: 0.24 });
    return;
  }
  if (theme === "all") {
    tone(audio, N.G5, t, 0.1, 0.07, "triangle");
    return;
  }
  swish(audio, t);
}

/** Quest clear + drop, scaled by rarity band — the same motif, extended.
 * Band comes from rarity-style.ts's single low(1-3)/mid(4-6)/high(7-8)
 * ladder, shared with confetti and drop-reveal rather than re-bucketed here. */
export function playClear(rarity: number): void {
  const band = rarityBand(rarity);
  if (band === "low") {
    arpeggio([N.C5, N.E5, N.G5], 0.07, 0.1);
    haptic(12);
    return;
  }
  if (band === "mid") {
    arpeggio([N.C5, N.E5, N.G5, N.C6], 0.08, 0.11);
    haptic([12, 40, 18]);
    return;
  }
  const audio = ac();
  if (!audio) return;
  const t = audio.currentTime;
  [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6].forEach((freq, i) =>
    tone(audio, freq, t + i * 0.075, 0.24, 0.11)
  );
  // Shimmer: two detuned sines gliding up under the run.
  for (const detune of [0, 6]) {
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(N.C6, t + 0.3);
    osc.frequency.exponentialRampToValueAtTime(N.E6, t + 0.85);
    osc.detune.value = detune;
    amp.gain.setValueAtTime(0.0001, t + 0.3);
    amp.gain.exponentialRampToValueAtTime(0.04, t + 0.42);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    osc.connect(amp).connect(audio.destination);
    osc.start(t + 0.3);
    osc.stop(t + 1);
  }
  haptic([16, 30, 16, 30, 60]);
}

/** Early-morning greeting — the quietest thing in the palette, a slow open
 * fifth that resolves upward. Deliberately not a reward sound: nothing has been
 * earned, the app is just saying good morning (D-036). */
export function playMorning(): void {
  const audio = ac();
  if (!audio) return;
  const t = audio.currentTime;
  tone(audio, N.C5, t, 0.9, 0.045, "sine");
  tone(audio, N.G5, t + 0.22, 0.9, 0.038, "sine");
  tone(audio, N.C6, t + 0.5, 1.1, 0.03, "sine");
}

/** All quests for the day cleared — chord swell fanfare. */
export function playFanfare(): void {
  const audio = ac();
  if (!audio) return;
  const t = audio.currentTime;
  [N.C5, N.E5, N.G5].forEach((freq) => tone(audio, freq, t, 0.5, 0.07));
  tone(audio, N.C6, t + 0.18, 0.55, 0.09);
  shimmer(audio, N.C6, t + 0.18, 0.5, 0.025);
  haptic([20, 50, 30]);
}
