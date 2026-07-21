import test from "node:test";
import assert from "node:assert/strict";
import {
  doesTaskApplyToDate,
  sortTasksByDateTime,
  taskForDisplayDate,
  buildCalendarSummary,
  summarizeCalendarMonth,
  completionHeatLevel,
} from "../../../src/lib/domain/task-date.ts";

test("doesTaskApplyToDate handles weekly recurrence", () => {
  const task = makeTask({
    dueDate: "2026-05-01",
    recurrence: "weekly",
    recurrenceDayOfWeek: 1,
  });

  assert.equal(doesTaskApplyToDate(task, "2026-05-04"), true);
  assert.equal(doesTaskApplyToDate(task, "2026-05-05"), false);
});

test("taskForDisplayDate scopes recurring completion to the selected date", () => {
  const task = makeTask({
    recurrence: "daily",
    completed: true,
    completedAt: "2026-05-09T10:00:00.000Z",
  });

  assert.equal(taskForDisplayDate(task, "2026-05-09").completed, true);
  assert.equal(taskForDisplayDate(task, "2026-05-10").completed, false);
});

test("sortTasksByDateTime orders date first, then due time with all-day last", () => {
  const tasks = [
    makeTask({ id: "b", dueDate: "2026-05-10", dueTime: null }),
    makeTask({ id: "c", dueDate: "2026-05-09", dueTime: "18:00" }),
    makeTask({ id: "a", dueDate: "2026-05-10", dueTime: "09:00" }),
  ];

  assert.deepEqual(sortTasksByDateTime(tasks).map((task) => task.id), ["c", "a", "b"]);
});

test("buildCalendarSummary counts completions on the day of effort", () => {
  const tasks = [
    // Completed on 05-09 (due same day).
    makeTask({ id: "a", dueDate: "2026-05-09", completed: true, completedAt: "2026-05-09T10:00:00.000Z" }),
    // Due 05-10 but completed on 05-09 -> effort counts on 05-09, not pending on 05-10.
    makeTask({ id: "b", dueDate: "2026-05-10", completed: true, completedAt: "2026-05-09T12:00:00.000Z" }),
    // Pending, due 05-10.
    makeTask({ id: "c", dueDate: "2026-05-10", completed: false, completedAt: null }),
  ];

  const summary = buildCalendarSummary(tasks, 2026, 4); // month index 4 = May

  assert.deepEqual(summary["2026-05-09"], { completed: 2, pending: 0 });
  assert.deepEqual(summary["2026-05-10"], { completed: 0, pending: 1 });
  assert.equal(summary["2026-05-11"], undefined);
});

test("buildCalendarSummary treats daily recurrence as pending on every applicable day", () => {
  const task = makeTask({
    id: "r",
    dueDate: "2026-05-01",
    recurrence: "daily",
    completed: false,
    completedAt: null,
  });

  const summary = buildCalendarSummary([task], 2026, 4);

  assert.equal(summary["2026-05-01"].pending, 1);
  assert.equal(summary["2026-05-31"].pending, 1);
});

test("summarizeCalendarMonth aggregates completions, active days, and pending", () => {
  const summary = {
    "2026-05-09": { completed: 2, pending: 0 },
    "2026-05-10": { completed: 0, pending: 1 },
    "2026-05-11": { completed: 3, pending: 2 },
  };

  assert.deepEqual(summarizeCalendarMonth(summary), {
    completed: 5,
    activeDays: 2,
    pending: 3,
  });
});

test("completionHeatLevel maps counts to 0-3 ember tiers", () => {
  assert.equal(completionHeatLevel(0), 0);
  assert.equal(completionHeatLevel(1), 1);
  assert.equal(completionHeatLevel(3), 2);
  assert.equal(completionHeatLevel(4), 3);
  assert.equal(completionHeatLevel(99), 3);
});

function makeTask(overrides = {}) {
  return {
    id: "task",
    title: "Task",
    dueDate: "2026-05-09",
    dueTime: "09:00",
    category: "life",
    completed: false,
    completedAt: null,
    recurrence: "none",
    createdAt: "2026-05-09T00:00:00.000Z",
    ...overrides,
  };
}
