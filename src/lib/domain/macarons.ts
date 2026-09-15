/** Pure policy and identity helpers for the Grimo macaron reward. */

export const MACARON_ITEM_ID = "macaron" as const;
export const MACARON_AWARD_AMOUNT = 1;
export const DAILY_COMPLETION_MACARON_LIMIT = 3;

export type MacaronAwardSource = "login" | "task-add" | "task-completion";
export type TaskRecurrence = "none" | "daily" | "weekly" | "monthly";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Convert a Date to a local YYYY-MM-DD key. */
export function localDateKey(date: Date): string {
  assertValidDate(date);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Reject malformed date keys before they become permanent ledger identities. */
export function assertDateKey(dateKey: string): string {
  if (!DATE_KEY_RE.test(dateKey)) throw new Error("Invalid macaron date key");
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error("Invalid macaron date key");
  }
  return dateKey;
}

export function assertValidDate(date: Date): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("Invalid macaron timestamp");
  }
}

/** One login grant per local calendar date. */
export function loginMacaronEventKey(dateKey: string): string {
  return `login:${assertDateKey(dateKey)}`;
}

/** One manual task-addition grant per local calendar date. */
export function taskAdditionMacaronEventKey(dateKey: string): string {
  return `task-add:${assertDateKey(dateKey)}`;
}

/**
 * Normal tasks are rewardable once for their lifetime. A recurring task is a
 * fresh effort on each local date, so its date is part of the identity.
 */
export function taskCompletionMacaronEventKey(
  taskId: string,
  dateKey: string,
  recurrence: TaskRecurrence = "none"
): string {
  if (typeof taskId !== "string" || taskId.length === 0) {
    throw new Error("Invalid macaron task id");
  }
  const encodedTaskId = encodeURIComponent(taskId);
  if (recurrence === "none") return `task-completion:once:${encodedTaskId}`;
  if (!["daily", "weekly", "monthly"].includes(recurrence)) {
    throw new Error("Invalid macaron task recurrence");
  }
  return `task-completion:recurring:${encodedTaskId}:${assertDateKey(dateKey)}`;
}

/** Whether another task-completion grant may be recorded today. */
export function canGrantDailyCompletionMacaron(completedGrantsToday: number): boolean {
  return Number.isInteger(completedGrantsToday) &&
    completedGrantsToday >= 0 &&
    completedGrantsToday < DAILY_COMPLETION_MACARON_LIMIT;
}

