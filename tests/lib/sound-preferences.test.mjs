import test from "node:test";
import assert from "node:assert/strict";
import {
  isHapticEnabled,
  isSoundEnabled,
  playStartupFlourish,
  setHapticEnabled,
  setSoundEnabled,
} from "../../src/lib/sound.ts";

const values = new Map();
globalThis.localStorage = {
  getItem(key) {
    return values.get(key) ?? null;
  },
  setItem(key, value) {
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
  assert.equal(audio.autoplay, true);
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

test("blocked autoplay is discarded rather than replayed after a later gesture", async () => {
  values.clear();
  resetFakeAudio();
  setSoundEnabled(true);
  FakeAudio.playImpl = () => Promise.reject(new DOMException("blocked", "NotAllowedError"));

  playStartupFlourish();
  const audio = FakeAudio.instances[0];
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(audio.pauseCalls, 1);
  assert.equal(audio.loadCalls, 1);
  assert.equal(audio.src, "");
});
