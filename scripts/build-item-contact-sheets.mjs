import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { DROP_CATALOG } from "../src/lib/domain/drops.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.resolve(projectRoot, process.argv[2] ?? "tmp-item-audit");
const columns = 8;
const tileWidth = 240;
const tileHeight = 264;
const imageSize = 224;

await mkdir(outputRoot, { recursive: true });

for (let rarity = 1; rarity <= 7; rarity += 1) {
  const drops = DROP_CATALOG.filter((drop) => drop.rarity === rarity);
  const rows = Math.ceil(drops.length / columns);
  const composites = [];

  for (const [index, drop] of drops.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = column * tileWidth + 8;
    const top = row * tileHeight + 8;
    composites.push({
      input: path.join(projectRoot, "public", "item-rewards", "thumb", `${drop.id}.webp`),
      left,
      top,
    });
    const label = `${String(index + 1).padStart(2, "0")} ${drop.id.slice(0, 20)}`;
    composites.push({
      input: Buffer.from(
        `<svg width="${imageSize}" height="24" xmlns="http://www.w3.org/2000/svg"><text x="0" y="14" fill="#d9e4ea" font-family="Arial,sans-serif" font-size="9">${label}</text></svg>`
      ),
      left,
      top: top + imageSize + 4,
    });
  }

  await sharp({
    create: {
      width: columns * tileWidth,
      height: rows * tileHeight,
      channels: 3,
      background: "#071016",
    },
  })
    .composite(composites)
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toFile(path.join(outputRoot, `rarity-${rarity}.jpg`));
}

console.log(`built seven item contact sheets in ${path.relative(projectRoot, outputRoot)}`);
