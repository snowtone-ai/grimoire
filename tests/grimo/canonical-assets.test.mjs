import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../../", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("data/grimo/character-manifest.json", root), "utf8"),
);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("Carol canonical source and published crop retain their recorded identity", async () => {
  const source = await readFile(new URL(manifest.sources.fourCharacterSheet.path, root));
  assert.equal(sha256(source), manifest.sources.fourCharacterSheet.sha256);

  const published = await readFile(new URL("public/grimo/carol-canonical.png", root));
  assert.equal(
    sha256(published),
    manifest.characters.carol.derivedFiles["canonical-crop.png"].sha256,
  );
});

test("Carol static layer recomposition is pixel-identical to the canonical crop", async () => {
  const canonical = await sharp(
    fileURLToPath(new URL("assets/grimo/derived/carol/canonical-crop.png", root)),
  ).removeAlpha().raw().toBuffer();
  const recomposite = await sharp(
    fileURLToPath(new URL("assets/grimo/derived/carol/static-recomposite.png", root)),
  ).removeAlpha().raw().toBuffer();

  assert.deepEqual(recomposite, canonical);
  assert.equal(
    sha256(canonical),
    manifest.characters.carol.staticRecomposition.decodedPixelSha256,
  );
});

test("Carol transparent asset retains its verified alpha edge in the published PNG", async () => {
  const source = await readFile(new URL(manifest.sources.carolTransparent.path, root));
  assert.equal(sha256(source), manifest.sources.carolTransparent.sha256);

  const sourceRgba = await sharp(source).ensureAlpha().raw().toBuffer();
  const publishedRgba = await sharp(
    fileURLToPath(new URL("public/grimo/carol-transparent.png", root)),
  ).ensureAlpha().raw().toBuffer();
  assert.deepEqual(publishedRgba, sourceRgba);

  let transparent = 0;
  let semiTransparent = 0;
  for (let offset = 3; offset < publishedRgba.length; offset += 4) {
    if (publishedRgba[offset] === 0) transparent += 1;
    else if (publishedRgba[offset] < 255) semiTransparent += 1;
  }
  assert.equal(transparent, manifest.characters.carol.transparentAsset.alpha.transparentPixels);
  assert.equal(semiTransparent, manifest.characters.carol.transparentAsset.alpha.semiTransparentPixels);
});

test("parts without source-backed hidden contours stay immovable", () => {
  const parts = new Map(
    manifest.characters.carol.parts.map((part) => [part.id, part]),
  );
  for (const id of ["face", "left-eye", "right-eye", "left-ear", "right-ear", "feet"]) {
    assert.equal(parts.get(id).motion.translatePx, 0, `${id} must not translate`);
    assert.equal(parts.get(id).motion.rotateDeg, 0, `${id} must not rotate`);
  }
});
