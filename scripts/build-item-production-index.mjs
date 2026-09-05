import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DROP_CATALOG } from "../src/lib/domain/drops.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(path.join(projectRoot, "public", "item-rewards", "manifest.json"), "utf8")
);
const assetById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
const pilotIds = new Set([
  "frost-1-yukinoshita",
  "lantern-2-origami-tsuru",
  "tide-3-chouryuu-ishi",
  "r-hydrangea-dried",
  "canopy-5-jaguar-tamashii",
  "savanna-6-hoshiyomishi-tsue",
  "caravan-7-negai-mahoubin",
]);

const REGION_LIGHT = {
  frost: "polar blue ice, snow and aurora light with restrained shelter warmth",
  aegis: "sunlit limestone, lapis sea, olive green and warm Mediterranean gold",
  caravan: "ochre desert stone, indigo textile, aged copper and lamp amber",
  canopy: "wet jade vegetation, black temple stone, orchids and mist shafts",
  lantern: "rain-dark cedar, paper ivory, lacquer red, moss and lantern warmth",
  grove: "desaturated pine, peat black, rune silver and cold moonlit fog",
  savanna: "dry gold grass, ebony, aged brass and a storm-violet horizon",
  tide: "deep cyan water, coral limestone, volcanic black and moon silver",
  petal: "muted blush, cream and pistachio porcelain with sugared flowers and soft window light",
  lullaby: "moonlit lavender, periwinkle, cloud white and silver with quiet observatory light",
  garden: "seasonal botanical archive light",
};
const RARITY_LANGUAGE = {
  1: "humble field-gathered material, simple irregular silhouette, diffuse natural light",
  2: "selected or carefully prepared material, refined surface and one controlled highlight",
  3: "unusual material or skilled workmanship with one precise secondary feature",
  4: "mature rare botanical specimen, richly preserved but ecologically plausible",
  5: "exceptional object with a memorable silhouette and focused supernatural behavior",
  6: "legendary surviving fragment with authoritative mass, age and quiet radiance",
  7: "world-significant icon with a singular impossible-but-coherent material phenomenon",
};
const ASSIGNMENT = {
  1: "Luna/high",
  2: "Luna/high",
  3: "Terra/high-max",
  4: "Terra/high-max",
  5: "Terra/max (Sol review when flagged)",
  6: "Sol/xhigh-max",
  7: "Sol/max",
};

const entries = DROP_CATALOG.filter((drop) => drop.rarity <= 7).map((drop) => {
  const asset = assetById.get(drop.id);
  if (!asset) throw new Error(`missing processed asset for ${drop.id}`);
  return {
    id: drop.id,
    name: drop.name,
    flavor: drop.flavor,
    region: drop.region,
    rarity: drop.rarity,
    assignment: ASSIGNMENT[drop.rarity],
    source: pilotIds.has(drop.id)
      ? "public/item-rewards/pilot (mapped by scripts/process-item-assets.mjs)"
      : `public/item-rewards/master/${drop.id}.png`,
    outputs: {
      thumb: [`public/item-rewards/thumb/${drop.id}.avif`, `public/item-rewards/thumb/${drop.id}.webp`],
      inspect: [`public/item-rewards/inspect/${drop.id}.avif`, `public/item-rewards/inspect/${drop.id}.webp`],
    },
    dimensions: [asset.width, asset.height],
    sha256: asset.sha256,
    canonicalPrompt: `Realistic natural-fantasy expedition archive portrait of ${drop.name}. Story trace: ${drop.flavor}. ${RARITY_LANGUAGE[drop.rarity]}. Region language: ${REGION_LIGHT[drop.region]}. Near-square macro/product camera, intact silhouette with 8-12% breathing room, believable material wear and motivated light, quiet origin-specific surface, readable at 112px. No people, mascot pose, readable text, logo, watermark, baked UI frame, generic neon aura, excessive bloom, cartoon or copied franchise motifs.`,
  };
});

const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  artBible: "docs/asset-art-bible.md",
  count: entries.length,
  entries,
};
await writeFile(
  path.join(projectRoot, "data", "item-asset-index.json"),
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8"
);
console.log(`indexed ${entries.length} item assets`);
