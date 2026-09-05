import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const masterDir = path.join(projectRoot, "public", "item-rewards", "master");
const pilotDir = path.join(projectRoot, "public", "item-rewards", "pilot");
const thumbDir = path.join(projectRoot, "public", "item-rewards", "thumb");
const inspectDir = path.join(projectRoot, "public", "item-rewards", "inspect");
const manifestPath = path.join(projectRoot, "public", "item-rewards", "manifest.json");

const pilotSources = new Map([
  ["frost-1-yukinoshita", "rare-1-frost-yukinoshita.png"],
  ["lantern-2-origami-tsuru", "rare-2-lantern-origami-tsuru.png"],
  ["tide-3-chouryuu-ishi", "rare-3-tide-chouryuu-ishi.png"],
  ["r-hydrangea-dried", "rare-4-hydrangea-dried.png"],
  ["canopy-5-jaguar-tamashii", "rare-5-canopy-jaguar-soul.png"],
  ["savanna-6-hoshiyomishi-tsue", "rare-6-savanna-star-reader-staff-tip.png"],
  ["caravan-7-negai-mahoubin", "rare-7-caravan-wish-bottle.png"],
]);

async function pngFiles(directory) {
  try {
    return (await readdir(directory)).filter((name) => name.endsWith(".png")).sort();
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function buildSourceMap() {
  const sources = new Map();
  for (const [id, filename] of pilotSources) {
    sources.set(id, path.join(pilotDir, filename));
  }
  for (const filename of await pngFiles(masterDir)) {
    sources.set(path.basename(filename, ".png"), path.join(masterDir, filename));
  }
  return sources;
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function render(source, output, size, format) {
  const pipeline = sharp(source)
    .rotate()
    .resize(size, size, { fit: "cover", position: "centre", withoutEnlargement: true });
  if (format === "avif") await pipeline.avif({ quality: size < 300 ? 48 : 62, effort: 4 }).toFile(output);
  else await pipeline.webp({ quality: size < 300 ? 72 : 84, effort: 4 }).toFile(output);
}

await Promise.all([mkdir(thumbDir, { recursive: true }), mkdir(inspectDir, { recursive: true })]);

const sources = await buildSourceMap();
const seenHashes = new Map();
const assets = [];
const renderQueue = [];

for (const [id, source] of [...sources].sort(([a], [b]) => a.localeCompare(b))) {
  const bytes = await readFile(source);
  const hash = digest(bytes);
  const duplicate = seenHashes.get(hash);
  if (duplicate) throw new Error(`byte-identical masters: ${duplicate} and ${id}`);
  seenHashes.set(hash, id);

  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height || metadata.width < 1000 || metadata.height < 1000) {
    throw new Error(`${id}: expected a >=1000px working master, got ${metadata.width}x${metadata.height}`);
  }
  if (Math.abs(metadata.width / metadata.height - 1) > 0.02) {
    throw new Error(`${id}: expected a square working master, got ${metadata.width}x${metadata.height}`);
  }

  assets.push({ id, width: metadata.width, height: metadata.height, sha256: hash });
  renderQueue.push({ id, source });
}

// AVIF encoding is CPU-heavy. Three item workers keep libvips busy without
// allowing all 518 masters to inflate in memory at once; manifest ordering is
// still deterministic because validation populated `assets` synchronously.
let nextRender = 0;
async function renderWorker() {
  while (nextRender < renderQueue.length) {
    const { id, source } = renderQueue[nextRender++];
    await Promise.all([
      render(source, path.join(thumbDir, `${id}.avif`), 224, "avif"),
      render(source, path.join(thumbDir, `${id}.webp`), 224, "webp"),
      render(source, path.join(inspectDir, `${id}.avif`), 960, "avif"),
      render(source, path.join(inspectDir, `${id}.webp`), 960, "webp"),
    ]);
  }
}

await Promise.all(Array.from({ length: 3 }, () => renderWorker()));

await writeFile(
  manifestPath,
  `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), count: assets.length, assets }, null, 2)}\n`,
  "utf8"
);

console.log(`processed ${assets.length} item masters`);
