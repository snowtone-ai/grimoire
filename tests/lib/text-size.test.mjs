import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTextSize,
  getStoredTextSize,
  parseTextSize,
  setTextSize,
  TEXT_SIZE_STORAGE_KEY,
} from "../../src/lib/text-size.ts";

test("text size values default safely to normal", () => {
  assert.equal(parseTextSize("normal"), "normal");
  assert.equal(parseTextSize("large"), "large");
  assert.equal(parseTextSize("unexpected"), "normal");
  assert.equal(parseTextSize(null), "normal");
});

test("stored text size tolerates unavailable or corrupt storage", () => {
  assert.equal(getStoredTextSize({ getItem: () => "large" }), "large");
  assert.equal(getStoredTextSize({ getItem: () => "huge" }), "normal");
  assert.equal(
    getStoredTextSize({
      getItem: () => {
        throw new Error("blocked");
      },
    }),
    "normal",
  );
});

test("setting a text size persists and applies it immediately", () => {
  const written = new Map();
  const root = { dataset: {} };

  setTextSize(
    "large",
    { setItem: (key, value) => written.set(key, value) },
    root,
  );

  assert.equal(written.get(TEXT_SIZE_STORAGE_KEY), "large");
  assert.equal(root.dataset.textSize, "large");

  applyTextSize("normal", root);
  assert.equal(root.dataset.textSize, "normal");
});
