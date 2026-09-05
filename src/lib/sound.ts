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
 * Feedback preferences are independent: audio and device vibration can each
 * be disabled without weakening the other. Existing `fx-enabled` installs are
 * migrated lazily the first time either preference is read.
 *   - the AudioContext is created inside the first user gesture, so a cue that
 *     fires after async work is not swallowed by the autoplay policy.
 *   - at most one cue and one haptic per action.
 */

import {
  ALL_CUE_SOURCES,
  clearAction,
  PAGE_ACTION,
  SOUND_CUES,
  STARTUP_FLOURISH,
  type SoundAction,
} from "./domain/sound-cues.ts";

export type { SoundAction };

const LEGACY_PREF_KEY = "fx-enabled";
const SOUND_PREF_KEY = "sound-enabled";
const HAPTIC_PREF_KEY = "haptic-enabled";

type PreferenceFallback = {
  enabled: boolean;
  persistedValue: string | null | undefined;
};

// A storage write can fail while reads still return the previous value (for
// example, a quota/security exception from setItem only). Keep that failed
// intent in memory until storage successfully changes or a later read sees a
// value written by another tab.
const failedPreferenceWrites = new Map<string, PreferenceFallback>();

function readPreference(key: string): boolean {
  const fallback = failedPreferenceWrites.get(key);
  try {
    const stored = localStorage.getItem(key);
    if (fallback) {
      if (
        fallback.persistedValue === undefined ||
        stored === fallback.persistedValue
      ) {
        return fallback.enabled;
      }
      failedPreferenceWrites.delete(key);
    }
    if (stored !== null) return stored !== "0";
    const legacy = localStorage.getItem(LEGACY_PREF_KEY);
    if (legacy !== null) {
      const enabled = legacy !== "0";
      try {
        localStorage.setItem(key, legacy);
        failedPreferenceWrites.delete(key);
      } catch {
        failedPreferenceWrites.set(key, { enabled, persistedValue: null });
      }
      return enabled;
    }
    return true;
  } catch {
    return fallback?.enabled ?? true;
  }
}

function writePreference(key: string, enabled: boolean): void {
  let persistedValue: string | null | undefined;
  try {
    persistedValue = localStorage.getItem(key);
    localStorage.setItem(key, enabled ? "1" : "0");
    failedPreferenceWrites.delete(key);
  } catch {
    failedPreferenceWrites.set(key, { enabled, persistedValue });
  }
}

export function isSoundEnabled(): boolean {
  return readPreference(SOUND_PREF_KEY);
}

export function setSoundEnabled(enabled: boolean): void {
  writePreference(SOUND_PREF_KEY, enabled);
  if (!enabled) cancelActiveStartup?.();
}

export function isHapticEnabled(): boolean {
  return readPreference(HAPTIC_PREF_KEY);
}

export function setHapticEnabled(enabled: boolean): void {
  writePreference(HAPTIC_PREF_KEY, enabled);
}

/** Backward-compatible aliases for older call sites and stored installs. */
export function isFxEnabled(): boolean {
  return isSoundEnabled();
}

export function setFxEnabled(enabled: boolean): void {
  setSoundEnabled(enabled);
}

let ctx: AudioContext | null = null;

/* Every browser blocks audio until the user has interacted with the page, and
 * a suspended AudioContext does not advance its clock — so anything scheduled
 * before that first interaction is not dropped, it is *queued*, and fires the
 * instant the context resumes. Found in browser QA: on a fresh load the
 * app-open flourish's three-step cue sat silent, then played in full several
 * seconds later when the user tapped an unrelated button.
 *
 * So cues are skipped outright until a gesture has been seen. Silence is the
 * correct failure here — a sound that arrives detached from the moment it was
 * describing is worse than no sound at all.
 *
 * The sampler therefore deliberately skips the app-open flourish, which fires
 * before a user gesture. playStartupFlourish() below makes a separate, single
 * HTMLMediaElement attempt for environments where policy already allows it;
 * blocked environments stay silent and never replay the cue late. */
let unlocked = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined" || !isSoundEnabled()) return null;
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
/** Sources that are permanently unavailable — a 404, or audio data the browser
 * cannot decode. Never retried: both mean a build mistake (the cue-map test
 * catches the first), not a transient condition, and retrying would hammer the
 * network on every tap.
 *
 * A network failure or a 5xx is deliberately NOT in here. This is a PWA whose
 * first gesture kicks off all ~25 cue fetches at once, so one offline moment —
 * opening the installed app on a train before the service worker has cached
 * the audio — would otherwise blacklist the entire cue set and leave the app
 * silent for the rest of the page-load even after signal came back. */
const permanentlyFailed = new Set<string>();

function load(audio: AudioContext, src: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(src);
  if (cached) return Promise.resolve(cached);
  if (permanentlyFailed.has(src)) return Promise.resolve(null);

  const pending = inflight.get(src);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await fetch(`/audio/${src}`);
      if (response.status === 404) {
        permanentlyFailed.add(src);
        console.error(`[sound] missing asset ${src}`);
        return null;
      }
      if (!response.ok) return null; // 5xx / offline SW fallback — retry later.
      const bytes = await response.arrayBuffer();
      try {
        const buffer = await audio.decodeAudioData(bytes);
        buffers.set(src, buffer);
        return buffer;
      } catch (err) {
        permanentlyFailed.add(src);
        console.error(`[sound] could not decode ${src}:`, err);
        return null;
      }
    } catch {
      return null; // Network error. Transient by assumption; try again next press.
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
 * set is well under a megabyte and the service worker caches it after that.
 *
 * MUST be installed app-wide (PwaRegister, in the root layout), not from one
 * screen. `unlocked` gates every cue and every haptic, so calling this from
 * the home screen's mount effect left the app completely silent for the whole
 * page-load whenever it was opened directly at /settings, /book, /all or
 * /plant — a reload, a bookmark, or a home-screen shortcut.
 *
 * Both `pointerdown` and `keydown` count: a keyboard user pressing Enter on a
 * button never fires a pointer event, and would otherwise get no sound and no
 * haptics all session. */
export function primeAudioOnFirstGesture(): void {
  if (typeof window === "undefined") return;

  const unlock = () => {
    // Set before the context work, and on `window` at the bubble phase, so a
    // cue fired from the very same press's onClick handler is already allowed
    // through — the first tap of a session should sound like every later one.
    unlocked = true;
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    const audio = ac();
    if (!audio) return;
    for (const src of ALL_CUE_SOURCES) void load(audio, src);
  };

  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
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
  if (!isHapticEnabled() || !unlocked) return;
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

export type StartupPlaybackState =
  | "loading"
  | "playing"
  | "blocked"
  | "error"
  | "ended"
  | "cancelled"
  | "disabled";

export interface SoundPlayback {
  cancel(): void;
  /** Retry from a user gesture without creating a second media element. */
  retry(): void;
  getState(): StartupPlaybackState;
  subscribe(listener: (state: StartupPlaybackState) => void): () => void;
}

function inactivePlayback(state: "disabled" | "error"): SoundPlayback {
  return {
    cancel() {},
    retry() {},
    getState: () => state,
    subscribe(listener) {
      listener(state);
      return () => {};
    },
  };
}
let cancelActiveStartup: (() => void) | null = null;
const STARTUP_PLAY_TIMEOUT_MS = 2_000;

/**
 * Attempt the one app-start cue through a single HTMLMediaElement.
 *
 * Unlike the sampler above, this path may run before a gesture. Browsers can
 * permit that for an installed PWA, an engaged origin, or a user allow-list;
 * otherwise play() rejects and the visual continues silently. The caller can
 * observe a blocked state and retry synchronously from an explicit gesture;
 * an old rejection can never replay the cue after cancellation.
 *
 * One pre-mixed media file preserves the cue's internal 0/200/400 ms timing.
 * This function never awaits loading or playback, so it cannot hold up the
 * startup visual or the app beneath it. The returned handle also aborts a
 * pending play promise by pausing and detaching the source. A finite deadline
 * prevents a browser that never settles play() from retaining the element.
 */
export function playStartupFlourish(): SoundPlayback {
  // Calling this twice must never stack two arrivals. Cancel first even when
  // the second call finds sound disabled, so a live preference change wins.
  cancelActiveStartup?.();

  if (!isSoundEnabled()) return inactivePlayback("disabled");
  if (typeof Audio === "undefined") return inactivePlayback("error");

  let audio: HTMLAudioElement;
  try {
    audio = new Audio();
  } catch {
    return inactivePlayback("error");
  }

  let cancelled = false;
  let state: StartupPlaybackState = "loading";
  let attemptId = 0;
  let deadline: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(state: StartupPlaybackState) => void>();

  function notify(next: StartupPlaybackState): void {
    if (cancelled && next !== "cancelled") return;
    state = next;
    for (const listener of listeners) listener(next);
  }

  function clearDeadline(): void {
    if (deadline === null) return;
    clearTimeout(deadline);
    deadline = null;
  }

  function release(): void {
    if (cancelActiveStartup === cancel) cancelActiveStartup = null;
    audio.removeEventListener("ended", onEnded);
    audio.removeEventListener("error", onError);
  }

  function detachMedia(): void {
    try {
      audio.pause();
      audio.removeAttribute("src");
      // Reset the resource selection algorithm too: pause() alone can leave a
      // pending autoplay attempt eligible to start after activation.
      audio.load();
    } catch {
      // Cleanup is best-effort; the element is no longer retained here.
    }
  }

  function cancel() {
    if (cancelled) return;
    cancelled = true;
    attemptId += 1;
    clearDeadline();
    release();
    detachMedia();
    notify("cancelled");
  }

  function onEnded(): void {
    if (cancelled) return;
    attemptId += 1;
    clearDeadline();
    release();
    notify("ended");
  }

  function onError(): void {
    if (cancelled) return;
    attemptId += 1;
    clearDeadline();
    release();
    detachMedia();
    notify("error");
  }

  function finishPlaying(id: number): void {
    if (cancelled || id !== attemptId) return;
    clearDeadline();
    notify("playing");
  }

  function finishRejected(id: number, reason: unknown): void {
    if (cancelled || id !== attemptId) return;
    clearDeadline();
    const reasonName =
      typeof reason === "object" && reason !== null && "name" in reason
        ? reason.name
        : undefined;
    if (reasonName === "NotAllowedError") {
      // Keep the media source attached so retry() can be called from the
      // user's gesture. No visual or audio work is queued here.
      notify("blocked");
      return;
    }
    attemptId += 1;
    release();
    detachMedia();
    notify("error");
  }

  function finishDeadline(id: number): void {
    if (cancelled || id !== attemptId) return;
    attemptId += 1;
    deadline = null;
    release();
    detachMedia();
    notify("error");
  }

  function attempt(): void {
    if (cancelled) return;
    if (!isSoundEnabled()) {
      cancel();
      return;
    }

    const id = ++attemptId;
    clearDeadline();
    if (state === "ended") {
      try {
        audio.currentTime = 0;
      } catch {
        // Some test doubles and media implementations do not expose seeking.
      }
    }
    notify("loading");
    deadline = setTimeout(() => finishDeadline(id), STARTUP_PLAY_TIMEOUT_MS);

    try {
      const promise = audio.play();
      if (promise === undefined) {
        finishPlaying(id);
      } else {
        void promise.then(
          () => finishPlaying(id),
          (reason: unknown) => finishRejected(id, reason),
        );
      }
    } catch (reason) {
      finishRejected(id, reason);
    }
  }

  cancelActiveStartup = cancel;
  audio.preload = "auto";
  // Calling play() explicitly lets a blocked startup be retried only from a
  // deliberate gesture; an autoplay-eligible element must never linger.
  audio.autoplay = false;
  audio.volume = STARTUP_FLOURISH.gain;
  audio.src = `/audio/${STARTUP_FLOURISH.src}`;
  audio.addEventListener("ended", onEnded);
  audio.addEventListener("error", onError);
  attempt();

  return {
    cancel,
    retry: () => {
      if (state === "blocked") attempt();
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
  };
}

/** Play one action's cue. Fire-and-forget: never awaited by a call site, never
 * throws, and silently does nothing when sound is off or unavailable. */
export function playCue(action: SoundAction): void {
  const cue = SOUND_CUES[action];
  if (!cue) return;

  // Before the debounce bookkeeping: a cue that cannot play must not occupy
  // its action's retrigger window.
  if (!unlocked) return;

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
      if (buffer && isSoundEnabled()) {
        emit(audio, buffer, step.gain, Math.max(at, audio.currentTime));
      }
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
