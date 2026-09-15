import test from "node:test";
import assert from "node:assert/strict";
import { calcStreakCount } from "../../../src/lib/domain/streak.ts";

const done = (date) => ({ date, allCompleted: true });
const failed = (date) => ({ date, allCompleted: false });

test("counts consecutive completed days ending today", () => {
  const records = [done("2026-07-18"), done("2026-07-19"), done("2026-07-20")];
  assert.equal(calcStreakCount(records, "2026-07-20"), 3);
});

test("an unfinished today is grace, not a break and not a freeze", () => {
  const records = [done("2026-07-18"), done("2026-07-19")];
  // Today (2026-07-20) has no record yet -> streak still shows 2.
  assert.equal(calcStreakCount(records, "2026-07-20"), 2);
  // Even with an explicit false record for today (unchecked a task).
  assert.equal(calcStreakCount([...records, failed("2026-07-20")], "2026-07-20"), 2);
});

test("one missed day is absorbed by the freeze", () => {
  const records = [done("2026-07-17"), done("2026-07-20")]; // 18th+19th... only one gap allowed
  assert.equal(calcStreakCount(records, "2026-07-20"), 1); // 19th freeze, 18th missing -> stop after 20th+freeze
  const oneGap = [done("2026-07-18"), done("2026-07-20")];
  assert.equal(calcStreakCount(oneGap, "2026-07-20"), 2); // 19th frozen, 18th counts
});

test("a failed day consumes the freeze the same as a missing day", () => {
  const records = [done("2026-07-18"), failed("2026-07-19"), done("2026-07-20")];
  assert.equal(calcStreakCount(records, "2026-07-20"), 2);
});

test("two gaps break the chain", () => {
  const records = [done("2026-07-16"), done("2026-07-17"), done("2026-07-20")];
  assert.equal(calcStreakCount(records, "2026-07-20"), 1);
});

test("no records means zero", () => {
  assert.equal(calcStreakCount([], "2026-07-20"), 0);
});

test("crosses month boundaries correctly", () => {
  const records = [done("2026-06-30"), done("2026-07-01")];
  assert.equal(calcStreakCount(records, "2026-07-01"), 2);
});
