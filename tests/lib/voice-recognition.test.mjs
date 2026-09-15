import assert from "node:assert/strict";
import test from "node:test";
import { startVoiceRecognitionWatchdog } from "../../src/lib/voice-recognition.ts";

function createFakeTimer() {
  let nextId = 1;
  const callbacks = new Map();

  return {
    setTimeout(callback, delayMs) {
      const id = nextId++;
      callbacks.set(id, { callback, delayMs });
      return id;
    },
    clearTimeout(id) {
      callbacks.delete(id);
    },
    fire(id) {
      const entry = callbacks.get(id);
      if (!entry) return;
      callbacks.delete(id);
      entry.callback();
    },
    firstId() {
      return callbacks.keys().next().value;
    },
    pendingCount() {
      return callbacks.size;
    },
  };
}

test("a recognizer with no terminal event is released before watchdog abort", () => {
  const timer = createFakeTimer();
  const recognizer = { abortCalls: 0, abort() { this.abortCalls += 1; } };
  const events = [];
  const watchdog = startVoiceRecognitionWatchdog(
    recognizer,
    timer,
    20_000,
    () => events.push(`release-before-abort-${recognizer.abortCalls}`),
  );

  assert.equal(timer.pendingCount(), 1);
  assert.equal(timer.firstId(), 1);
  timer.fire(1);

  assert.deepEqual(events, ["release-before-abort-0"]);
  assert.equal(recognizer.abortCalls, 1);
  assert.equal(timer.pendingCount(), 0);
  watchdog.finish();
  assert.equal(recognizer.abortCalls, 1);
});

test("a terminal event cancels the watchdog and ignores a late timer callback", () => {
  const timer = createFakeTimer();
  const recognizer = { abortCalls: 0, abort() { this.abortCalls += 1; } };
  let expired = 0;
  const watchdog = startVoiceRecognitionWatchdog(
    recognizer,
    timer,
    20_000,
    () => { expired += 1; },
  );

  watchdog.finish();
  assert.equal(timer.pendingCount(), 0);
  timer.fire(1);

  assert.equal(expired, 0);
  assert.equal(recognizer.abortCalls, 0);
});
