import test from "node:test";
import assert from "node:assert/strict";
import {
  isHapticEnabled,
  isSoundEnabled,
  playCue,
  playStartupFlourish,
  primeAudioOnFirstGesture,
  setHapticEnabled,
  setSoundEnabled,
} from "../../src/lib/sound.ts";

const values = new Map();
let failSoundWrites = false;
globalThis.localStorage = {
  getItem(key) {
    return values.get(key) ?? null;
  },
  setItem(key, value) {
    if (failSoundWrites && key === "sound-enabled") {
      throw new Error("sound preference storage unavailable");
    }
    values.set(key, String(value));
  },
};

class FakeAudio {
  static instances = [];
  static playImpl = () => Promise.resolve();

  constructor() {
    this.autoplay = false;
    this.preload = "";
    this.src = "";
    this.volume = 1;
    this.pauseCalls = 0;
    this.loadCalls = 0;
    this.playCalls = 0;
    this.listeners = new Map();
    FakeAudio.instances.push(this);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }

  play() {
    this.playCalls += 1;
    return FakeAudio.playImpl();
  }

  pause() {
    this.pauseCalls += 1;
  }

  removeAttribute(name) {
    if (name === "src") this.src = "";
  }

  load() {
    this.loadCalls += 1;
  }

  emit(type) {
    this.listeners.get(type)?.();
  }
}

class FakeAudioContext {
  static starts = 0;

  constructor() {
    this.currentTime = 0;
    this.state = "running";
    this.destination = {};
  }

  createBufferSource() {
    return {
      connect: (target) => target,
      start: () => {
        FakeAudioContext.starts += 1;
      },
    };
  }

  createGain() {
    return {
      gain: { value: 0 },
      connect: (target) => target,
    };
  }

  decodeAudioData() {
    return Promise.resolve({});
  }

  resume() {
    return Promise.resolve();
  }
}

globalThis.Audio = FakeAudio;

function resetFakeAudio() {
  FakeAudio.instances.length = 0;
  FakeAudio.playImpl = () => Promise.resolve();
}

test("sound and haptic preferences can be changed independently", () => {
  values.clear();
  setSoundEnabled(false);
  setHapticEnabled(true);
  assert.equal(isSoundEnabled(), false);
  assert.equal(isHapticEnabled(), true);

  setSoundEnabled(true);
  setHapticEnabled(false);
  assert.equal(isSoundEnabled(), true);
  assert.equal(isHapticEnabled(), false);
});

test("the retired combined preference migrates lazily into both settings", () => {
  values.clear();
  values.set("fx-enabled", "0");
  assert.equal(isSoundEnabled(), false);
  assert.equal(isHapticEnabled(), false);
  assert.equal(values.get("sound-enabled"), "0");
  assert.equal(values.get("haptic-enabled"), "0");
});

test("a failed sound write keeps OFF effective until a later successful write", () => {
  values.clear();
  values.set("sound-enabled", "1");
  failSoundWrites = true;
  setSoundEnabled(false);
  assert.equal(isSoundEnabled(), false);

  failSoundWrites = false;
  setSoundEnabled(true);
  assert.equal(isSoundEnabled(), true);
});

test("legacy sound OFF survives a failed migration write", () => {
  values.clear();
  values.set("fx-enabled", "0");
  failSoundWrites = true;
  try {
    assert.equal(isSoundEnabled(), false);
  } finally {
    failSoundWrites = false;
    setSoundEnabled(true);
  }
});

test("startup sound obeys its setting and uses one non-blocking media timeline", () => {
  values.clear();
  resetFakeAudio();
  setSoundEnabled(false);
  playStartupFlourish().cancel();
  assert.equal(FakeAudio.instances.length, 0, "disabled sound must not create media");

  setSoundEnabled(true);
  let settlePlayback;
  FakeAudio.playImpl = () => new Promise((resolve) => (settlePlayback = resolve));
  const playback = playStartupFlourish();
  const audio = FakeAudio.instances[0];

  assert.ok(audio, "enabled startup sound should make one media element");
  assert.equal(audio.playCalls, 1);
  assert.equal(audio.src, "/audio/cues/startup-flourish.wav");
  assert.equal(audio.autoplay, false);
  assert.equal(audio.preload, "auto");
  assert.equal(audio.volume, 1);
  assert.equal(typeof settlePlayback, "function", "playback remains pending without blocking return");

  playback.cancel();
  settlePlayback();
});

test("a second startup request cancels the first instead of double-playing", () => {
  values.clear();
  resetFakeAudio();
  setSoundEnabled(true);

  playStartupFlourish();
  const first = FakeAudio.instances[0];
  const secondPlayback = playStartupFlourish();
  const second = FakeAudio.instances[1];

  assert.equal(first.pauseCalls, 1);
  assert.equal(first.loadCalls, 1);
  assert.equal(first.src, "");
  assert.equal(second.playCalls, 1);
  secondPlayback.cancel();
});

test("cancel aborts a pending autoplay attempt and is idempotent", () => {
  values.clear();
  resetFakeAudio();
  setSoundEnabled(true);
  FakeAudio.playImpl = () => new Promise(() => {});

  const playback = playStartupFlourish();
  const audio = FakeAudio.instances[0];
  playback.cancel();
  playback.cancel();

  assert.equal(audio.pauseCalls, 1);
  assert.equal(audio.loadCalls, 1);
  assert.equal(audio.src, "");
});

test("startup playback exposes loading, playing, and ended states", async () => {
  values.clear();
  resetFakeAudio();
  setSoundEnabled(true);
  const playback = playStartupFlourish();
  const states = [];
  playback.subscribe((state) => states.push(state));
  await Promise.resolve();

  assert.equal(playback.getState(), "playing");
  assert.deepEqual(states, ["loading", "playing"]);

  FakeAudio.instances[0].emit("ended");
  assert.equal(playback.getState(), "ended");
  assert.equal(states.at(-1), "ended");
  const playCalls = FakeAudio.instances[0].playCalls;
  playback.retry();
  assert.equal(FakeAudio.instances[0].playCalls, playCalls, "ended media cannot be retried in place");
});

test("blocked autoplay is observable and retries synchronously from a gesture", async () => {
  values.clear();
  resetFakeAudio();
  setSoundEnabled(true);
  FakeAudio.playImpl = () => Promise.reject(new DOMException("blocked", "NotAllowedError"));

  const playback = playStartupFlourish();
  const audio = FakeAudio.instances[0];
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(playback.getState(), "blocked");
  FakeAudio.playImpl = () => Promise.resolve();
  playback.retry();
  assert.equal(audio.playCalls, 2, "retry calls play while still in the gesture handler");
  await Promise.resolve();
  assert.equal(playback.getState(), "playing");
});

test("media failure is observable without reporting false playback success", () => {
  values.clear();
  resetFakeAudio();
  setSoundEnabled(true);

  const playback = playStartupFlourish();
  const audio = FakeAudio.instances[0];
  audio.emit("error");

  assert.equal(playback.getState(), "error");
  assert.equal(audio.pauseCalls, 1);
  assert.equal(audio.loadCalls, 1);
  const playCalls = audio.playCalls;
  playback.retry();
  assert.equal(audio.playCalls, playCalls, "failed media cannot be retried in place");
});

test("disabling sound cancels active startup playback and ignores stale promises", async () => {
  values.clear();
  resetFakeAudio();
  setSoundEnabled(true);
  let settlePlayback;
  FakeAudio.playImpl = () => new Promise((resolve) => (settlePlayback = resolve));

  const playback = playStartupFlourish();
  const audio = FakeAudio.instances[0];
  setSoundEnabled(false);
  settlePlayback();
  await Promise.resolve();

  assert.equal(playback.getState(), "cancelled");
  assert.equal(audio.pauseCalls, 1);
  assert.equal(audio.loadCalls, 1);
  assert.equal(audio.src, "");
});

test("a never-settling play attempt has a finite failure deadline", () => {
  values.clear();
  resetFakeAudio();
  setSoundEnabled(true);
  FakeAudio.playImpl = () => new Promise(() => {});
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (delay === 2000) {
      callback(...args);
      return 0;
    }
    return originalSetTimeout(callback, delay, ...args);
  };

  try {
    const playback = playStartupFlourish();
    const audio = FakeAudio.instances[0];
    assert.equal(playback.getState(), "error");
    assert.equal(audio.pauseCalls, 1);
    assert.equal(audio.loadCalls, 1);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("a cue that finishes loading after sound is disabled is not emitted", async () => {
  values.clear();
  setSoundEnabled(true);
  FakeAudioContext.starts = 0;
  const originalFetch = globalThis.fetch;
  const originalAudioContext = globalThis.AudioContext;
  const originalWindow = globalThis.window;
  let resolveClick;
  const fakeWindow = {
    listeners: new Map(),
    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (this.listeners.get(type) === listener) this.listeners.delete(type);
    },
    dispatch(type) {
      this.listeners.get(type)?.();
    },
  };

  globalThis.window = fakeWindow;
  globalThis.AudioContext = FakeAudioContext;
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/audio/ui/click_002.wav")) {
      return new Promise((resolve) => {
        resolveClick = resolve;
      });
    }
    return {
      status: 200,
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    };
  };

  try {
    primeAudioOnFirstGesture();
    fakeWindow.dispatch("pointerdown");
    playCue("tap");
    setSoundEnabled(false);
    resolveClick({
      status: 200,
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(FakeAudioContext.starts, 0);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.AudioContext = originalAudioContext;
    globalThis.window = originalWindow;
  }
});
