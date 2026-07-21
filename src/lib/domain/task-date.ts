type Category = "job" | "university" | "life";

interface TaskDateFields {
  dueDate: string;
  dueTime: string | null;
  category: Category;
  completed: boolean;
  completedAt: string | null;
  recurrence: "none" | "daily" | "weekly" | "monthly";
  recurrenceDayOfWeek?: number;
  recurrenceDayOfMonth?: number;
}

export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function todayDateString(): string {
  const date = new Date();
  return toDateStr(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatDateLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function doesTaskApplyToDate(task: TaskDateFields, dateStr: string): boolean {
  const date = new Date(`${dateStr}T00:00:00`);
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();

  if (task.recurrence === "none") return task.dueDate === dateStr;
  if (task.recurrence === "daily") return task.dueDate <= dateStr;
  if (task.recurrence === "weekly") {
    return task.dueDate <= dateStr && task.recurrenceDayOfWeek === dayOfWeek;
  }
  if (task.recurrence === "monthly") {
    return task.dueDate <= dateStr && task.recurrenceDayOfMonth === dayOfMonth;
  }
  return false;
}

export function taskForDisplayDate<T extends TaskDateFields>(task: T, dateStr: string): T {
  if (task.recurrence === "none") return task;
  return { ...task, completed: task.completedAt?.slice(0, 10) === dateStr };
}

export function sortTasksByDateTime<T extends TaskDateFields>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return compareDueTime(a, b);
  });
}

export function sortTasksByTime<T extends TaskDateFields>(tasks: T[]): T[] {
  return [...tasks].sort(compareDueTime);
}

export function getRecurrenceDetail(task: TaskDateFields): string {
  if (task.recurrence === "none") return "";
  if (task.recurrence === "daily") return "毎日";
  if (task.recurrence === "weekly" && task.recurrenceDayOfWeek !== undefined) {
    return `毎週${WEEKDAY_LABELS[task.recurrenceDayOfWeek]}曜`;
  }
  if (task.recurrence === "monthly" && task.recurrenceDayOfMonth !== undefined) {
    return `毎月${task.recurrenceDayOfMonth}日`;
  }
  return "";
}

/**
 * Per-day survey-log summary for the calendar heatmap.
 * `completed` counts quests finished ON that date (the day of effort — the
 * hunting-log semantics), so the calendar becomes a growing record of activity.
 * `pending` counts quests scheduled for that date that are not yet done, which
 * drives the "there is a quest here" marker for both upcoming and untouched days.
 */
export interface CalendarDaySummary {
  completed: number;
  pending: number;
}

export function buildCalendarSummary(
  tasks: TaskDateFields[],
  year: number,
  month: number
): Record<string, CalendarDaySummary> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const summary: Record<string, CalendarDaySummary> = {};

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = toDateStr(year, month, day);
    let completed = 0;
    let pending = 0;

    for (const task of tasks) {
      // Completed on this date = day of effort (matches taskForDisplayDate's
      // completedAt slice, so the heat and the day sheet always agree).
      if (task.completedAt && task.completedAt.slice(0, 10) === dateStr) {
        completed += 1;
      }
      if (doesTaskApplyToDate(task, dateStr) && !taskForDisplayDate(task, dateStr).completed) {
        pending += 1;
      }
    }

    if (completed > 0 || pending > 0) summary[dateStr] = { completed, pending };
  }

  return summary;
}

/** Aggregate a month's per-day summary into headline survey-log stats. */
export function summarizeCalendarMonth(
  summary: Record<string, CalendarDaySummary>
): { completed: number; activeDays: number; pending: number } {
  let completed = 0;
  let activeDays = 0;
  let pending = 0;

  for (const day of Object.values(summary)) {
    completed += day.completed;
    pending += day.pending;
    if (day.completed > 0) activeDays += 1;
  }

  return { completed, activeDays, pending };
}

/** Map a completion count to a 0-3 ember-heat tier for the calendar cell. */
export function completionHeatLevel(completed: number): 0 | 1 | 2 | 3 {
  if (completed <= 0) return 0;
  if (completed === 1) return 1;
  if (completed <= 3) return 2;
  return 3;
}

function compareDueTime(a: TaskDateFields, b: TaskDateFields): number {
  if (!a.dueTime && !b.dueTime) return 0;
  if (!a.dueTime) return 1;
  if (!b.dueTime) return -1;
  return a.dueTime.localeCompare(b.dueTime);
}
