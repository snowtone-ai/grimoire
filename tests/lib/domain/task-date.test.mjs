import test from "node:test";
import assert from "node:assert/strict";
import {
  doesTaskApplyToDate,
  sortTasksByDateTime,
  taskForDisplayDate,
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
