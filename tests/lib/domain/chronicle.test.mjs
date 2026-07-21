import test from "node:test";
import assert from "node:assert/strict";
import { buildChronicle } from "../../../src/lib/domain/chronicle.ts";

test("buildChronicle groups drops by month with rare and active-day counts", () => {
  const drops = [
    { dateKey: "2026-05-03", rarity: 1 },
    { dateKey: "2026-05-03", rarity: 4 },
    { dateKey: "2026-05-10", rarity: 8 },
    { dateKey: "2026-04-20", rarity: 1 },
  ];

  const months = buildChronicle(drops, new Date(2026, 4, 15)); // May 2026

  const may = months.find((m) => m.monthKey === "2026-05");
  assert.equal(may.totalDrops, 3);
  assert.equal(may.rareDrops, 2); // rarity 4 and 8
  assert.equal(may.activeDays, 2); // 05-03 (x2) and 05-10
  assert.equal(may.month, 5);
  assert.equal(may.species.name, "バラ");
  assert.equal(may.isCurrent, true);

  const apr = months.find((m) => m.monthKey === "2026-04");
  assert.equal(apr.totalDrops, 1);
  assert.equal(apr.rareDrops, 0);
  assert.equal(apr.isCurrent, false);
});

test("buildChronicle always includes an empty live page for the current month", () => {
  const months = buildChronicle([], new Date(2026, 6, 1)); // July 2026

  assert.equal(months.length, 1);
  assert.equal(months[0].monthKey, "2026-07");
  assert.equal(months[0].totalDrops, 0);
  assert.equal(months[0].activeDays, 0);
  assert.equal(months[0].isCurrent, true);
  assert.equal(months[0].species.name, "ひまわり");
});

test("buildChronicle sorts months newest first", () => {
  const drops = [
    { dateKey: "2026-01-05", rarity: 1 },
    { dateKey: "2026-03-05", rarity: 1 },
  ];

  const months = buildChronicle(drops, new Date(2026, 2, 10)); // March 2026

  assert.deepEqual(months.map((m) => m.monthKey), ["2026-03", "2026-01"]);
});

test("buildChronicle ignores malformed dateKeys", () => {
  const drops = [
    { dateKey: "", rarity: 1 },
    { dateKey: "bad", rarity: 4 },
    { dateKey: "2026-06-01", rarity: 4 },
  ];

  const months = buildChronicle(drops, new Date(2026, 5, 2)); // June 2026
  const june = months.find((m) => m.monthKey === "2026-06");

  assert.equal(june.totalDrops, 1);
  assert.equal(june.rareDrops, 1);
});
