import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const markSource = readFileSync(new URL("../../src/components/grimo/grimo-emotion-mark.tsx", import.meta.url), "utf8");
const screenSource = readFileSync(new URL("../../src/components/grimo/carol-3d-screen.tsx", import.meta.url), "utf8");

test("shared emotion marks keep the heart and authored exclamation in one contract", () => {
  assert.match(markSource, /export type GrimoEmotionMarkKind = "heart" \| "exclamation"/);
  assert.match(markSource, /kind === "heart"/);
  assert.match(markSource, /viewBox="0 0 48 72"/);
  assert.doesNotMatch(markSource, /CircleAlert|TriangleAlert|BadgeAlert/);
  assert.match(screenSource, /kind="exclamation"/);
  assert.match(screenSource, /className="carol3d-tail-startle"/);
});
