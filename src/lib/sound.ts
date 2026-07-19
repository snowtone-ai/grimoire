/* Sound design — one coherent audio identity, zero audio assets.
 *
 * Every sound is synthesized from a single C-major pentatonic palette
 * (C-D-E-G-A), so nothing can ever clash. Rarity reuses ONE ascending
 * motif at growing lengths (recognition, not random novelty):
 *   tap 1 note -> clear 3 notes -> RARE4 4 notes -> RARE8 6-note run.
 * Budget per action: at most 1 sound + 1 haptic. Volume stays low.
 * The toggle persists in localStorage and also gates haptics. */

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
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  amp.gain.setValueAtTime(0.0001, startAt);
  amp.gain.exponentialRampToValueAtTime(gain, startAt + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(amp).connect(audio.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

/** Short filtered-noise swish (notebook page turn). */
function swish(audio: AudioContext, startAt: number): void {
  const duration = 0.16;
  const buffer = audio.createBuffer(1, audio.sampleRate * duration, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const source = audio.createBufferSource();
  source.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(900, startAt);
  filter.frequency.exponentialRampToValueAtTime(300, startAt + duration);
  filter.Q.value = 1.2;
  const amp = audio.createGain();
  amp.gain.setValueAtTime(0.0001, startAt);
  amp.gain.exponentialRampToValueAtTime(0.06, startAt + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  source.connect(filter).connect(amp).connect(audio.destination);
  source.start(startAt);
}

function arpeggio(freqs: number[], step: number, gain: number): void {
  const audio = ac();
  if (!audio) return;
  const t = audio.currentTime;
  freqs.forEach((freq, i) => tone(audio, freq, t + i * step, 0.22, gain));
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

/** Notebook page turn (route change). */
export function playPage(): void {
  const audio = ac();
  if (!audio) return;
  swish(audio, audio.currentTime);
}

/** Quest clear + drop, scaled by rarity — the same motif, extended. */
export function playClear(rarity: 1 | 4 | 8): void {
  if (rarity === 1) {
    arpeggio([N.C5, N.E5, N.G5], 0.07, 0.1);
    haptic(12);
    return;
  }
  if (rarity === 4) {
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

/** All quests for the day cleared — chord swell fanfare. */
export function playFanfare(): void {
  const audio = ac();
  if (!audio) return;
  const t = audio.currentTime;
  [N.C5, N.E5, N.G5].forEach((freq) => tone(audio, freq, t, 0.5, 0.07));
  tone(audio, N.C6, t + 0.18, 0.55, 0.09);
  haptic([20, 50, 30]);
}
