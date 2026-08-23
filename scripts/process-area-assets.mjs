import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const MASTER_DIR = path.join(ROOT, "public", "area-heroes", "master");
const EXPLORE_DIR = path.join(ROOT, "public", "area-heroes", "explore");
const PREVIEW_DIR = path.join(ROOT, "public", "area-heroes", "preview");
const AREA_IDS = ["frost", "aegis", "caravan", "canopy", "lantern", "grove", "savanna", "tide"];

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

  await Promise.all([
    sharp(source).webp({ quality: 82, effort: 5 }).toFile(path.join(EXPLORE_DIR, `${id}.webp`)),
    sharp(source).avif({ quality: 58, effort: 5 }).toFile(path.join(EXPLORE_DIR, `${id}.avif`)),
    sharp(source)
      .extract(crop)
      .resize({ width: 384, height: 768, fit: "cover" })
      .webp({ quality: 76, effort: 5 })
      .toFile(path.join(PREVIEW_DIR, `${id}.webp`)),
    sharp(source)
      .extract(crop)
      .resize({ width: 384, height: 768, fit: "cover" })
      .avif({ quality: 52, effort: 5 })
      .toFile(path.join(PREVIEW_DIR, `${id}.avif`)),
  ]);

  report.push(`${id}: ${width}×${height}, sha256 ${hash.slice(0, 12)}`);
}

console.log(report.join("\n"));
