import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Anchored to this file, not to cwd, so the script works from any directory —
// matching the four sibling asset scripts.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MASTER_DIR = path.join(ROOT, "public", "area-heroes", "master");
const EXPLORE_DIR = path.join(ROOT, "public", "area-heroes", "explore");
const PREVIEW_DIR = path.join(ROOT, "public", "area-heroes", "preview");
const AREA_IDS = ["frost", "aegis", "caravan", "canopy", "lantern", "grove", "savanna", "tide", "petal", "lullaby"];

await Promise.all([
  mkdir(EXPLORE_DIR, { recursive: true }),
  mkdir(PREVIEW_DIR, { recursive: true }),
]);

const hashes = new Map();
const report = [];

for (const id of AREA_IDS) {
  const source = path.join(MASTER_DIR, `${id}.png`);
  const input = sharp(source, { failOn: "error" });
  const metadata = await input.metadata();
  const { width, height } = metadata;

  if (!width || !height || width < 800 || height < 1600) {
    throw new Error(`${id}: exploration master is too small (${width}×${height})`);
  }

  const bytes = await readFile(source);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const duplicate = hashes.get(hash);
  if (duplicate) throw new Error(`${id}: byte-identical to ${duplicate}`);
  hashes.set(hash, id);

  const cropWidth = Math.floor(width / 2);
  const cropHeight = Math.floor(height / 2);
  const crop = {
    left: Math.floor((width - cropWidth) / 2),
    top: Math.floor((height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight,
  };

  // 384×480 is 4:5 because the Record grid card is `aspect-[4/5] object-cover`.
  // The previous 384×768 shipped a 1:2 image the browser then cropped back to
  // 4:5 — 37% of every preview's bytes decoded and thrown away. `fit: "cover"`
  // takes the centre of the extracted region, so the composition the crop was
  // chosen for is what survives.
  const preview = { width: 384, height: 480, fit: "cover" };

  await Promise.all([
    sharp(source).webp({ quality: 82, effort: 5 }).toFile(path.join(EXPLORE_DIR, `${id}.webp`)),
    sharp(source).avif({ quality: 58, effort: 5 }).toFile(path.join(EXPLORE_DIR, `${id}.avif`)),
    sharp(source)
      .extract(crop)
      .resize(preview)
      .webp({ quality: 76, effort: 5 })
      .toFile(path.join(PREVIEW_DIR, `${id}.webp`)),
    sharp(source)
      .extract(crop)
      .resize(preview)
      .avif({ quality: 52, effort: 5 })
      .toFile(path.join(PREVIEW_DIR, `${id}.avif`)),
  ]);

  report.push(`${id}: ${width}×${height}, sha256 ${hash.slice(0, 12)}`);
}

console.log(report.join("\n"));
