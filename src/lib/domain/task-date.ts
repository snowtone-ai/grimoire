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

export function buildCategoryDotMap(
  tasks: TaskDateFields[],
  year: number,
  month: number
): Record<string, Set<Category>> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dotMap: Record<string, Set<Category>> = {};

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = toDateStr(year, month, day);
    const categories = tasks
      .filter((task) => doesTaskApplyToDate(task, dateStr))
      .map((task) => task.category);
    if (categories.length > 0) dotMap[dateStr] = new Set(categories);
  }

  return dotMap;
}

function compareDueTime(a: TaskDateFields, b: TaskDateFields): number {
  if (!a.dueTime && !b.dueTime) return 0;
  if (!a.dueTime) return 1;
  if (!b.dueTime) return -1;
  return a.dueTime.localeCompare(b.dueTime);
}
