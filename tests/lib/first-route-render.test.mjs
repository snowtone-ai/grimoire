import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readProjectFile = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("top-level routes use static screen imports so Next can prefetch them", () => {
  for (const route of ["", "all/", "book/", "plant/", "settings/"]) {
    const source = readProjectFile(`src/app/${route}page.tsx`);
    assert.doesNotMatch(source, /next\/dynamic/);
    assert.doesNotMatch(source, /ssr:\s*false/);
  }
});

test("IndexedDB hydration does not replace the first screen with a loading placeholder", () => {
  for (const path of [
    "src/components/home/home-screen.tsx",
    "src/components/all/all-screen.tsx",
  ]) {
    const source = readProjectFile(path);
    assert.doesNotMatch(source, /<LoadingState\s*\/>/);
    assert.doesNotMatch(source, /読み込み中/);
  }
});

test("the survey chronicle reserves its finished first-frame structure", () => {
  const source = readProjectFile("src/components/book/book-screen.tsx");
  assert.doesNotMatch(source, /chronicle\.length === 0\) return null/);
  assert.match(source, /CurrentMonthPlaceholder/);
  assert.match(source, /contentVisibility:\s*"auto"/);
  assert.match(source, /containIntrinsicSize/);
});
