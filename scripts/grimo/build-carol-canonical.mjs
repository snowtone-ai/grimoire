import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "assets/grimo/source/carol-pino-jill-shushu-canonical.jpg");
const TRANSPARENT_SOURCE = path.join(ROOT, "assets/grimo/source/carol-transparent.png");
const OUTPUT = path.join(ROOT, "assets/grimo/derived/carol");
const PUBLIC_OUTPUT = path.join(ROOT, "public/grimo/carol-transparent.png");
const MANIFEST = path.join(ROOT, "data/grimo/character-manifest.json");
const EXPECTED_SOURCE_HASH = "4bef79470608bc81482afef48f124279fdaa57b41f0cc043453ec98ee79ade1b";
const EXPECTED_TRANSPARENT_SOURCE_HASH = "a1a2ec59f62d4a799a7e891d44990489519ad38b03cfed125d1dff137c75fb81";
const CROP = { left: 0, top: 0, width: 768, height: 493 };
const FOREGROUND_THRESHOLD = 18;
const MIN_AMBIENT_COMPONENT = 12;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isForeground(data, pixel) {
  const offset = pixel * 3;
  return Math.max(data[offset], data[offset + 1], data[offset + 2]) > FOREGROUND_THRESHOLD;
}

function findComponents(data, width, height) {
  const count = width * height;
  const labels = new Int32Array(count);
  labels.fill(-1);
  const queue = new Int32Array(count);
  const components = [];

  for (let start = 0; start < count; start += 1) {
    if (labels[start] !== -1 || !isForeground(data, start)) continue;
    const id = components.length;
    let head = 0;
    let tail = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    labels[start] = id;
    queue[tail++] = start;

    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      for (let nextY = Math.max(0, y - 1); nextY <= Math.min(height - 1, y + 1); nextY += 1) {
        for (let nextX = Math.max(0, x - 1); nextX <= Math.min(width - 1, x + 1); nextX += 1) {
          const next = nextY * width + nextX;
          if (labels[next] === -1 && isForeground(data, next)) {
            labels[next] = id;
            queue[tail++] = next;
          }
        }
      }
    }

    components.push({
      id,
      pixels: tail,
      bounds: { left: minX, top: minY, right: maxX, bottom: maxY },
    });
  }

  return { labels, components };
}

function makeLayer(rgb, labels, componentKinds, kind) {
  const rgba = Buffer.alloc(labels.length * 4);
  for (let pixel = 0; pixel < labels.length; pixel += 1) {
    const sourceOffset = pixel * 3;
    const targetOffset = pixel * 4;
    const component = labels[pixel];
    const pixelKind = component === -1 ? "background" : componentKinds.get(component);
    rgba[targetOffset] = rgb[sourceOffset];
    rgba[targetOffset + 1] = rgb[sourceOffset + 1];
    rgba[targetOffset + 2] = rgb[sourceOffset + 2];
    rgba[targetOffset + 3] = pixelKind === kind ? 255 : 0;
  }
  return rgba;
}

await mkdir(OUTPUT, { recursive: true });
await mkdir(path.dirname(PUBLIC_OUTPUT), { recursive: true });
const sourceBytes = await readFile(SOURCE);
const sourceHash = sha256(sourceBytes);
if (sourceHash !== EXPECTED_SOURCE_HASH) {
  throw new Error(`Carol source hash changed: expected ${EXPECTED_SOURCE_HASH}, received ${sourceHash}`);
}

const transparentSourceBytes = await readFile(TRANSPARENT_SOURCE);
const transparentSourceHash = sha256(transparentSourceBytes);
if (transparentSourceHash !== EXPECTED_TRANSPARENT_SOURCE_HASH) {
  throw new Error(`Carol transparent source hash changed: expected ${EXPECTED_TRANSPARENT_SOURCE_HASH}, received ${transparentSourceHash}`);
}
const { data: transparentRgba, info: transparentInfo } = await sharp(transparentSourceBytes)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
let transparentPixels = 0;
let semiTransparentPixels = 0;
for (let offset = 3; offset < transparentRgba.length; offset += 4) {
  if (transparentRgba[offset] === 0) transparentPixels += 1;
  else if (transparentRgba[offset] < 255) semiTransparentPixels += 1;
}
if (transparentPixels === 0 || semiTransparentPixels === 0) {
  throw new Error("Carol transparent source must retain transparent and anti-aliased edge pixels");
}
const transparentRawOptions = {
  width: transparentInfo.width,
  height: transparentInfo.height,
  channels: 4,
};
await Promise.all([
  sharp(transparentRgba, { raw: transparentRawOptions }).png().toFile(path.join(OUTPUT, "transparent.png")),
  sharp(transparentRgba, { raw: transparentRawOptions }).png().toFile(PUBLIC_OUTPUT),
]);
const transparentDerivedRgba = await sharp(path.join(OUTPUT, "transparent.png"))
  .ensureAlpha()
  .raw()
  .toBuffer();
if (Buffer.compare(transparentRgba, transparentDerivedRgba) !== 0) {
  throw new Error("Carol transparent derivative differs from the source RGBA pixels");
}

const { data: rgb, info } = await sharp(sourceBytes)
  .extract(CROP)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { labels, components } = findComponents(rgb, info.width, info.height);
const identity = components.reduce((largest, component) =>
  component.pixels > largest.pixels ? component : largest,
);
const componentKinds = new Map(
  components.map((component) => [
    component.id,
    component.id === identity.id
      ? "identity"
      : component.pixels >= MIN_AMBIENT_COMPONENT
        ? "ambient"
        : "background",
  ]),
);

const layerBuffers = {
  background: makeLayer(rgb, labels, componentKinds, "background"),
  ambient: makeLayer(rgb, labels, componentKinds, "ambient"),
  identity: makeLayer(rgb, labels, componentKinds, "identity"),
};
const rawOptions = { width: info.width, height: info.height, channels: 4 };

await Promise.all([
  sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } })
    .png()
    .toFile(path.join(OUTPUT, "canonical-crop.png")),
  ...Object.entries(layerBuffers).map(([name, buffer]) =>
    sharp(buffer, { raw: rawOptions }).png().toFile(path.join(OUTPUT, `${name}.png`)),
  ),
]);

await sharp(layerBuffers.background, { raw: rawOptions })
  .composite([
    { input: layerBuffers.ambient, raw: rawOptions },
    { input: layerBuffers.identity, raw: rawOptions },
  ])
  .png()
  .toFile(path.join(OUTPUT, "static-recomposite.png"));

const recomposite = await sharp(path.join(OUTPUT, "static-recomposite.png"))
  .removeAlpha()
  .raw()
  .toBuffer();
const validation = {
  sourceSha256: sourceHash,
  crop: CROP,
  decodedPixelSha256: sha256(rgb),
  recompositePixelSha256: sha256(recomposite),
  pixelMatch: Buffer.compare(rgb, recomposite) === 0,
  foregroundThreshold: FOREGROUND_THRESHOLD,
  identityComponent: identity,
  ambientComponents: components.filter((component) => componentKinds.get(component.id) === "ambient").length,
};
await writeFile(path.join(OUTPUT, "validation.json"), `${JSON.stringify(validation, null, 2)}\n`);

if (!validation.pixelMatch) {
  throw new Error("Carol static recomposite differs from the decoded canonical crop");
}

const derivedFiles = {};
for (const name of ["canonical-crop.png", "background.png", "ambient.png", "identity.png", "static-recomposite.png"]) {
  const bytes = await readFile(path.join(OUTPUT, name));
  derivedFiles[name] = { sha256: sha256(bytes), bytes: bytes.length };
}
const transparentDerivedBytes = await readFile(path.join(OUTPUT, "transparent.png"));
const manifest = {
  schemaVersion: 1,
  generatedBy: "scripts/grimo/build-carol-canonical.mjs",
  sources: {
    fourCharacterSheet: {
      path: "assets/grimo/source/carol-pino-jill-shushu-canonical.jpg",
      sha256: sourceHash,
      dimensions: [1536, 1024],
      format: "jpeg",
      alpha: false,
      provenance: "user-created original via AI image generation",
      distributionRights: "user confirms full rights for project and publication",
    },
    muu: {
      path: "assets/grimo/source/muu-canonical.png",
      sha256: "d4d6fa9cea3364fbb8a3e5f8a22a814955c02592246a0f7c39d785baa1d890a6",
      dimensions: [1792, 2400],
      format: "png",
      alpha: "present but fully opaque",
      provenance: "user-created original via AI image generation",
      distributionRights: "user confirms full rights for project and publication",
    },
    carolTransparent: {
      path: "assets/grimo/source/carol-transparent.png",
      sha256: transparentSourceHash,
      dimensions: [transparentInfo.width, transparentInfo.height],
      format: "png",
      alpha: "transparent with anti-aliased edge",
      provenance: "user-created original via AI image generation",
      distributionRights: "user confirms full rights for project and publication",
    },
  },
  characters: {
    carol: {
      source: "fourCharacterSheet",
      sourceCrop: CROP,
      visibleBounds: identity.bounds,
      world: "星眠りの雲床",
      canonicalTraits: ["purple-and-white cloud fleece", "original face and proportions", "brown ears and feet", "crescent moon", "yellow stars"],
      transparentAsset: {
        source: "carolTransparent",
        derivedFile: "transparent.png",
        publicFile: "public/grimo/carol-transparent.png",
        decodedPixelMatch: true,
        alpha: {
          transparentPixels,
          semiTransparentPixels,
        },
        use: "world composition and renderer depth comparison; preserve without ML re-segmentation",
      },
      layers: [
        { id: "background", file: "background.png", zOrder: 0, purpose: "exact source matte", movable: false },
        { id: "ambient", file: "ambient.png", zOrder: 10, purpose: "detached source pixels", movable: true, maxTranslationPx: 4, maxRotationDeg: 2 },
        { id: "identity", file: "identity.png", zOrder: 20, purpose: "canonical visible surface", movable: "rigid translation only", maxTranslationPx: 3, maxRotationDeg: 0 },
      ],
      parts: [
        { id: "fleece-and-body", bounds: [96, 5, 638, 485], anchor: [414, 300], zOrder: 20, sourceStatus: "flattened-visible-surface", motion: { translatePx: 3, rotateDeg: 0, localDeformPx: 2, condition: "face lock and browser comparison required" } },
        { id: "face", bounds: [382, 210, 260, 188], anchor: [517, 307], zOrder: 24, sourceStatus: "flattened-identity-lock", motion: { translatePx: 0, rotateDeg: 0, localDeformPx: 0 } },
        { id: "left-eye", bounds: [430, 273, 58, 80], anchor: [459, 313], zOrder: 25, sourceStatus: "open-eye-only", motion: { translatePx: 0, rotateDeg: 0 }, missing: ["closed eyelid", "separate pupil"] },
        { id: "right-eye", bounds: [552, 235, 61, 82], anchor: [582, 276], zOrder: 25, sourceStatus: "open-eye-only", motion: { translatePx: 0, rotateDeg: 0 }, missing: ["closed eyelid", "separate pupil"] },
        { id: "left-ear", bounds: [280, 286, 132, 84], anchor: [393, 303], zOrder: 18, sourceStatus: "flattened-with-hidden-root", motion: { translatePx: 0, rotateDeg: 0 }, missing: ["fur-hidden root contour", "back surface"] },
        { id: "right-ear", bounds: [612, 207, 99, 88], anchor: [619, 253], zOrder: 18, sourceStatus: "flattened-with-hidden-root", motion: { translatePx: 0, rotateDeg: 0 }, missing: ["fur-hidden root contour", "back surface"] },
        { id: "feet", bounds: [277, 429, 322, 63], anchor: [438, 462], zOrder: 17, sourceStatus: "partly-occluded-flattened", motion: { translatePx: 0, rotateDeg: 0 }, missing: ["body-hidden contours"] },
        { id: "moon-and-attached-stars", bounds: [185, 82, 377, 318], anchor: [334, 237], zOrder: 21, sourceStatus: "merged-with-fleece", motion: { translatePx: 0, rotateDeg: 0 } },
        { id: "detached-ambient", bounds: [96, 50, 623, 440], anchor: [407, 250], zOrder: 10, sourceStatus: "component-separated", motion: { translatePx: 4, rotateDeg: 2 } },
      ],
      derivedFiles: {
        ...derivedFiles,
        "transparent.png": {
          sha256: sha256(transparentDerivedBytes),
          bytes: transparentDerivedBytes.length,
        },
      },
      staticRecomposition: validation,
      limitations: [
        "JPEG has no alpha and uses a black matte; a clean arbitrary-background cutout is not proven.",
        "Hidden anatomy and a canonical closed-eye drawing do not exist in the source.",
        "Semantic body parts are coordinates on one flattened visible surface, not independently movable art.",
      ],
    },
    pino: { source: "fourCharacterSheet", sourceCrop: { left: 768, top: 0, width: 768, height: 512 }, status: "held for post-Carol approval" },
    jill: { source: "fourCharacterSheet", sourceCrop: { left: 0, top: 512, width: 768, height: 512 }, status: "held for post-Carol approval" },
    shushu: { source: "fourCharacterSheet", sourceCrop: { left: 768, top: 512, width: 768, height: 512 }, status: "held for post-Carol approval" },
    muu: { source: "muu", sourceCrop: { left: 0, top: 0, width: 1792, height: 2400 }, status: "held for post-Carol approval" },
  },
};
await mkdir(path.dirname(MANIFEST), { recursive: true });
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(validation, null, 2));
