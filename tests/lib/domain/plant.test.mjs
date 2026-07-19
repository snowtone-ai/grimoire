import test from "node:test";
import assert from "node:assert/strict";
import {
  calcProgress,
  calcGrowthStage,
  countMonthlyCompletedTasks,
  monthKeyLocal,
  getSpeciesForMonth,
  getStageLabel,
  PLANT_SPECIES,
  toLocalDateString,
} from "../../../src/lib/domain/plant.ts";

test("calcGrowthStage maps monthly completed count to stages", () => {
  assert.equal(calcGrowthStage(-1), 0);
  assert.equal(calcGrowthStage(0), 0);
  assert.equal(calcGrowthStage(1), 1);
  assert.equal(calcGrowthStage(2), 2);
  assert.equal(calcGrowthStage(3), 2);
  assert.equal(calcGrowthStage(4), 3);
  assert.equal(calcGrowthStage(6), 3);
  assert.equal(calcGrowthStage(7), 4);
  assert.equal(calcGrowthStage(10), 4);
  assert.equal(calcGrowthStage(11), 5);
});

test("calcProgress maps current stage progress including final stage", () => {
  assert.equal(calcProgress(0, 0), 0);
  assert.equal(calcProgress(1, 1), 100);
  assert.equal(calcProgress(2, 2), 50);
  assert.equal(calcProgress(4, 3), 33);
  assert.equal(calcProgress(-1, 1), 0);
  assert.equal(calcProgress(99, 4), 100);
  assert.equal(calcProgress(11, 5), 100);
});

test("plant species covers all months and required archetypes", () => {
  assert.equal(PLANT_SPECIES.length, 12);
  assert.equal(PLANT_SPECIES.every((plant) => plant.rewardImage.startsWith("/plant-rewards/final/")), true);
  assert.deepEqual(new Set(PLANT_SPECIES.map((plant) => plant.archetype)), new Set([
    "upright",
    "cherry",
    "hanging",
    "delicate",
  ]));
  assert.equal(getStageLabel(5), "満開");
});

test("getSpeciesForMonth rejects invalid months instead of returning blank UI data", () => {
  assert.equal(getSpeciesForMonth(5).name, "バラ");
  assert.throws(() => getSpeciesForMonth(0), /Invalid plant month/);
});

test("countMonthlyCompletedTasks only includes completed tasks in the current month", () => {
  const now = new Date("2026-05-15T12:00:00");
  const tasks = [
    { completed: true, completedAt: "2026-05-12T10:00:00" },
    { completed: true, completedAt: "2026-05-02T09:00:00" },
    { completed: true, completedAt: "2026-04-28T23:59:59" },
    { completed: true, completedAt: "2026-05-20T10:00:00" },
    { completed: false, completedAt: "2026-05-14T10:00:00" },
    { completed: true, completedAt: null },
  ];

  assert.equal(countMonthlyCompletedTasks(tasks, now), 2);
});

test("monthKeyLocal formats the local year-month", () => {
  assert.equal(monthKeyLocal(new Date("2026-05-01T00:30:00")), "2026-05");
  assert.equal(monthKeyLocal(new Date("2026-12-31T23:59:00")), "2026-12");
});

test("toLocalDateString is timezone-safe for local date extraction", () => {
  const localEarlyMorning = new Date("2026-05-18T00:30:00+09:00");
  assert.equal(toLocalDateString(localEarlyMorning), "2026-05-18");
});
