// Ported from v1 (main branch) tests/lib/domain/reminders.test.mjs — see D-013.
// Converted from node:test/node:assert to vitest; cases are equivalent to v1's.
import { describe, expect, it } from "vitest";
import {
  buildReminders,
  nextPending,
  pruneDelivered,
  remindAtFor,
  selectDue,
} from "../../../../src/integrations/notifications/reminders";

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

describe("reminders", () => {
  it("buildReminders covers today and tomorrow, skipping completed tasks", () => {
    const reminders = fixture();

    expect(reminders.length).toBe(2);
    expect(reminders.map((r) => r.id)).toEqual([
      `notif-today-a-${TODAY}`,
      `notif-tomorrow-c-${TODAY}`,
    ]);
    expect(reminders[0]?.title).toBe("今日の締切");
    expect(reminders[0]?.body).toBe("今日: A社 ES提出（14:00）");
    expect(reminders[1]?.title).toBe("明日の締切リマインダー");
    // No dueTime means no time suffix.
    expect(reminders[1]?.body).toBe("明日: 健康診断");
  });

  it("reminder ids embed the date key so the same task re-notifies the next day", () => {
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

    expect(today[0]?.id).not.toBe(nextDay[0]?.id);
  });

  it("reminders are due at 09:00 local time on their date", () => {
    const reminders = fixture();
    expect(reminders[0]?.dueAt).toBe(new Date(`${TODAY}T09:00:00`).getTime());
    expect(remindAtFor(TODAY)).toBe(reminders[0]?.dueAt);
  });

  it("selectDue holds reminders before 09:00 and releases them after", () => {
    const reminders = fixture();
    const before = new Date(`${TODAY}T08:59:00`).getTime();

    expect(selectDue(reminders, before, {}).length).toBe(0);
    expect(selectDue(reminders, reminders[0]!.dueAt, {}).length).toBe(2);
  });

  it("selectDue still fires when the app is first opened long after 09:00", () => {
    // Regression guard for the bug this replaced: the old scheduler bailed out
    // entirely once 09:00 had passed, so opening the app at 22:00 delivered
    // nothing at all — not even the next day's reminder.
    const reminders = fixture();
    const lateEvening = new Date(`${TODAY}T22:00:00`).getTime();

    expect(selectDue(reminders, lateEvening, {}).length).toBe(2);
  });

  it("selectDue never repeats an already-delivered reminder", () => {
    const reminders = fixture();
    const now = new Date(`${TODAY}T10:00:00`).getTime();
    const delivered = { [reminders[0]!.id]: now - 1000 };

    const due = selectDue(reminders, now, delivered);
    expect(due.map((r) => r.id)).toEqual([reminders[1]!.id]);
  });

  it("nextPending returns the earliest undelivered future reminder, else null", () => {
    const reminders = fixture();
    const before = new Date(`${TODAY}T07:00:00`).getTime();

    expect(nextPending(reminders, before, {})?.id).toBe(reminders[0]?.id);
    expect(nextPending(reminders, reminders[0]!.dueAt, {})).toBeNull();
    expect(
      nextPending(reminders, before, {
        [reminders[0]!.id]: before,
        [reminders[1]!.id]: before,
      }),
    ).toBeNull();
  });

  it("pruneDelivered keeps recent entries and drops expired ones", () => {
    const now = Date.parse("2026-08-16T12:00:00Z");
    const day = 24 * 60 * 60 * 1000;

    const kept = pruneDelivered({ fresh: now - day, stale: now - 8 * day }, now);

    expect(Object.keys(kept)).toEqual(["fresh"]);
  });
});
