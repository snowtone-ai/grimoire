import { createHash } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { DROP_CATALOG } from "../src/lib/domain/drops.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rewardRoot = path.join(projectRoot, "public", "item-rewards");
const pilotSources = new Map([
  ["frost-1-yukinoshita", "rare-1-frost-yukinoshita.png"],
  ["lantern-2-origami-tsuru", "rare-2-lantern-origami-tsuru.png"],
  ["tide-3-chouryuu-ishi", "rare-3-tide-chouryuu-ishi.png"],
  ["r-hydrangea-dried", "rare-4-hydrangea-dried.png"],
  ["canopy-5-jaguar-tamashii", "rare-5-canopy-jaguar-soul.png"],
  ["savanna-6-hoshiyomishi-tsue", "rare-6-savanna-star-reader-staff-tip.png"],
  ["caravan-7-negai-mahoubin", "rare-7-caravan-wish-bottle.png"],
]);

const targets = DROP_CATALOG.filter((drop) => drop.rarity >= 1 && drop.rarity <= 7);
if (targets.length !== 424) throw new Error(`expected 424 RARE 1-7 catalog entries, got ${targets.length}`);
const expectedIds = new Set(targets.map((drop) => drop.id));
const masterFiles = (await readdir(path.join(rewardRoot, "master"))).filter((name) => name.endsWith(".png"));
for (const name of masterFiles) {
  const id = path.basename(name, ".png");
  if (!expectedIds.has(id)) throw new Error(`unexpected working master: ${name}`);
}

const hashes = new Map();
const rarityCounts = new Map();
const derivativeCounts = {};
let thumbBytes = 0;
let inspectBytes = 0;

for (const variant of ["thumb", "inspect"]) {
  for (const format of ["avif", "webp"]) {
    const suffix = `.${format}`;
    const files = (await readdir(path.join(rewardRoot, variant))).filter((name) => name.endsWith(suffix));
    const ids = new Set(files.map((name) => name.slice(0, -suffix.length)));
    if (files.length !== targets.length || ids.size !== targets.length) {
      throw new Error(`${variant}.${format}: expected exactly 424 unique derivatives, got ${files.length}`);
    }
    for (const id of expectedIds) {
      if (!ids.has(id)) throw new Error(`${variant}.${format}: missing ${id}`);
    }
    for (const id of ids) {
      if (!expectedIds.has(id)) throw new Error(`${variant}.${format}: unexpected ${id}`);
    }
    derivativeCounts[`${variant}.${format}`] = files.length;
  }
}

for (const drop of targets) {
  const source = pilotSources.has(drop.id)
    ? path.join(rewardRoot, "pilot", pilotSources.get(drop.id))
    : path.join(rewardRoot, "master", `${drop.id}.png`);
  const bytes = await readFile(source);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hashes.has(hash)) throw new Error(`byte-identical masters: ${hashes.get(hash)} and ${drop.id}`);
  hashes.set(hash, drop.id);
  const master = await sharp(bytes).metadata();
  if (!master.width || !master.height || master.width < 1000 || master.height < 1000) {
    throw new Error(`${drop.id}: invalid working master ${master.width}x${master.height}`);
  }
  if (Math.abs(master.width / master.height - 1) > 0.02) {
    throw new Error(`${drop.id}: working master is not square (${master.width}x${master.height})`);
  }

  for (const [variant, size] of [["thumb", 224], ["inspect", 960]]) {
    for (const format of ["avif", "webp"]) {
      const output = path.join(rewardRoot, variant, `${drop.id}.${format}`);
      await access(output);
      const metadata = await sharp(output).metadata();
      // sharp/libheif reports AVIF containers as format "heif", not "avif".
      const expectedFormats = format === "avif" ? ["avif", "heif"] : [format];
      if (metadata.width !== size || metadata.height !== size || !expectedFormats.includes(metadata.format)) {
        throw new Error(`${drop.id}: invalid ${variant}.${format} derivative`);
      }
      const bytes = (await stat(output)).size;
      if (variant === "thumb") thumbBytes += bytes;
      else inspectBytes += bytes;
    }
  }
  rarityCounts.set(drop.rarity, (rarityCounts.get(drop.rarity) ?? 0) + 1);
}

const manifest = JSON.parse(await readFile(path.join(rewardRoot, "manifest.json"), "utf8"));
if (manifest.count !== targets.length) throw new Error(`manifest count ${manifest.count} !== 424`);
const manifestIds = new Set(manifest.assets.map((asset) => asset.id));
if (manifestIds.size !== targets.length) {
  throw new Error("manifest IDs are missing or duplicated");
}
for (const id of expectedIds) {
  if (!manifestIds.has(id)) throw new Error(`manifest is missing ${id}`);
}
for (const id of manifestIds) {
  if (!expectedIds.has(id)) throw new Error(`manifest contains unexpected ${id}`);
}

console.log(JSON.stringify({
  accepted: targets.length,
  byRarity: Object.fromEntries([...rarityCounts].sort(([a], [b]) => a - b)),
  uniqueMasterHashes: hashes.size,
  derivativeCounts,
  shippingBytes: { thumb: thumbBytes, inspect: inspectBytes },
}, null, 2));
