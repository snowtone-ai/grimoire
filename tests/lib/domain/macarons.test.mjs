import test from "node:test";
import assert from "node:assert/strict";
import {
  assertDateKey,
  canGrantDailyCompletionMacaron,
  localDateKey,
  loginMacaronEventKey,
  taskAdditionMacaronEventKey,
  taskCompletionMacaronEventKey,
} from "../../../src/lib/domain/macarons.ts";

test("macaron event identities are stable and separate", () => {
  assert.equal(loginMacaronEventKey("2026-09-10"), "login:2026-09-10");
  assert.equal(taskAdditionMacaronEventKey("2026-09-10"), "task-add:2026-09-10");
  assert.equal(
    taskCompletionMacaronEventKey("task:1", "2026-09-10", "none"),
    "task-completion:once:task%3A1"
  );
  assert.equal(
    taskCompletionMacaronEventKey("task:1", "2026-09-10", "daily"),
    "task-completion:recurring:task%3A1:2026-09-10"
  );
  assert.notEqual(
    taskCompletionMacaronEventKey("task-1", "2026-09-10", "daily"),
    taskCompletionMacaronEventKey("task-1", "2026-09-11", "daily")
  );
});

test("localDateKey uses the local calendar date", () => {
  const date = new Date(2026, 8, 10, 23, 59, 0);
  assert.equal(localDateKey(date), "2026-09-10");
});

test("date keys and completion cap are validated", () => {
  assert.equal(assertDateKey("2024-02-29"), "2024-02-29");
  assert.throws(() => assertDateKey("2026-02-29"), /Invalid macaron date key/);
  assert.throws(() => assertDateKey("2026-9-10"), /Invalid macaron date key/);
  assert.equal(canGrantDailyCompletionMacaron(0), true);
  assert.equal(canGrantDailyCompletionMacaron(2), true);
  assert.equal(canGrantDailyCompletionMacaron(3), false);
  assert.equal(canGrantDailyCompletionMacaron(-1), false);
});

