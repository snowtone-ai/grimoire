import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE_THEMES,
  DEFAULT_BASE_THEME,
  applyBaseTheme,
  getStoredBaseTheme,
  parseBaseTheme,
  setBaseTheme,
} from "../../src/lib/base-theme.ts";

test("the base atmosphere offers ten stable, unique choices", () => {
  assert.equal(BASE_THEMES.length, 10);
  assert.equal(new Set(BASE_THEMES.map((theme) => theme.id)).size, 10);
  assert.equal(new Set(BASE_THEMES.map((theme) => theme.label)).size, 10);
  assert.ok(BASE_THEMES.some((theme) => theme.id === DEFAULT_BASE_THEME));
});

test("unknown or unavailable stored values fall back safely", () => {
  assert.equal(parseBaseTheme("unknown"), DEFAULT_BASE_THEME);
  assert.equal(parseBaseTheme(null), DEFAULT_BASE_THEME);
  assert.equal(
    getStoredBaseTheme({ getItem: () => "blossom" }),
    "blossom",
  );
  assert.equal(
    getStoredBaseTheme({
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    }),
    DEFAULT_BASE_THEME,
  );
});

test("selecting an atmosphere persists it and applies it immediately", () => {
  const saved = new Map();
  const root = { dataset: {} };

  setBaseTheme(
    "moonlit",
    { setItem: (key, value) => saved.set(key, value) },
    root,
  );

  assert.equal(saved.get("grimoire-base-theme"), "moonlit");
  assert.equal(root.dataset.baseTheme, "moonlit");

  applyBaseTheme("hearth", root);
  assert.equal(root.dataset.baseTheme, "hearth");
});
