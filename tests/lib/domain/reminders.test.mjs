import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReminders,
  nextPending,
  pruneDelivered,
  remindAtFor,
  selectDue,
} from "../../../src/lib/domain/reminders.ts";

const TODAY = "2026-08-16";

function fixture() {
  return buildReminders({
    dateKey: TODAY,
    todayTasks: [
      { id: "a", title: "A社 ES提出", dueTime: "14:00", completed: false },
      { id: "b", title: "済んだ用事", dueTime: null, completed: true },
    ],
    tomorrowTasks: [{ id: "c", title: "健康診断", dueTime: null, completed: false }],
  });
}

test("buildReminders covers today and tomorrow, skipping completed tasks", () => {
  const reminders = fixture();

  assert.equal(reminders.length, 2);
  assert.deepEqual(
    reminders.map((r) => r.id),
    [`notif-today-a-${TODAY}`, `notif-tomorrow-c-${TODAY}`]
  );
  assert.equal(reminders[0].title, "今日の締切");
  assert.equal(reminders[0].body, "今日: A社 ES提出（14:00）");
  assert.equal(reminders[1].title, "明日の締切リマインダー");
  // No dueTime means no time suffix.
  assert.equal(reminders[1].body, "明日: 健康診断");
});

test("reminder ids embed the date key so the same task re-notifies the next day", () => {
  const today = buildReminders({
    dateKey: TODAY,
    todayTasks: [{ id: "a", title: "T", completed: false }],
    tomorrowTasks: [],
  });
  const nextDay = buildReminders({
    dateKey: "2026-08-17",
    todayTasks: [{ id: "a", title: "T", completed: false }],
    tomorrowTasks: [],
  });

  assert.notEqual(today[0].id, nextDay[0].id);
});

test("reminders are due at 09:00 local time on their date", () => {
  const reminders = fixture();
  assert.equal(reminders[0].dueAt, new Date(`${TODAY}T09:00:00`).getTime());
  assert.equal(remindAtFor(TODAY), reminders[0].dueAt);
});

test("selectDue holds reminders before 09:00 and releases them after", () => {
  const reminders = fixture();
  const before = new Date(`${TODAY}T08:59:00`).getTime();

  assert.equal(selectDue(reminders, before, {}).length, 0);
  assert.equal(selectDue(reminders, reminders[0].dueAt, {}).length, 2);
});

test("selectDue still fires when the app is first opened long after 09:00", () => {
  // Regression guard for the bug this replaced: the old scheduler bailed out
  // entirely once 09:00 had passed, so opening the app at 22:00 delivered
  // nothing at all — not even the next day's reminder.
  const reminders = fixture();
  const lateEvening = new Date(`${TODAY}T22:00:00`).getTime();

  assert.equal(selectDue(reminders, lateEvening, {}).length, 2);
});

test("selectDue never repeats an already-delivered reminder", () => {
  const reminders = fixture();
  const now = new Date(`${TODAY}T10:00:00`).getTime();
  const delivered = { [reminders[0].id]: now - 1000 };

  const due = selectDue(reminders, now, delivered);
  assert.deepEqual(
    due.map((r) => r.id),
    [reminders[1].id]
  );
});

test("nextPending returns the earliest undelivered future reminder, else null", () => {
  const reminders = fixture();
  const before = new Date(`${TODAY}T07:00:00`).getTime();

  assert.equal(nextPending(reminders, before, {}).id, reminders[0].id);
  assert.equal(nextPending(reminders, reminders[0].dueAt, {}), null);
  assert.equal(
    nextPending(reminders, before, {
      [reminders[0].id]: before,
      [reminders[1].id]: before,
    }),
    null
  );
});

test("pruneDelivered keeps recent entries and drops expired ones", () => {
  const now = Date.parse("2026-08-16T12:00:00Z");
  const day = 24 * 60 * 60 * 1000;

  const kept = pruneDelivered({ fresh: now - day, stale: now - 8 * day }, now);

  assert.deepEqual(Object.keys(kept), ["fresh"]);
});
