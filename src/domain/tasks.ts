import type {
  IanaTimeZone,
  IsoInstant,
  LocalDate,
  LocalTime,
  SeriesId,
  TaskId,
} from "./primitives";

export type InvalidDatePolicy = "clamp" | "skip";

export type RecurrenceRule =
  | Readonly<{ frequency: "daily"; interval: number }>
  | Readonly<{ frequency: "weekly"; interval: number; weekdays: readonly Weekday[] }>
  | Readonly<{
      frequency: "monthly";
      interval: number;
      dayOfMonth: number;
      invalidDatePolicy: InvalidDatePolicy;
    }>
  | Readonly<{
      frequency: "yearly";
      interval: number;
      month: number;
      dayOfMonth: number;
      invalidDatePolicy: InvalidDatePolicy;
    }>;

/** ISO weekday, Monday = 1 and Sunday = 7. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface TaskSchedule {
  readonly localDate: LocalDate;
  readonly localTime: LocalTime;
  readonly timeZone: IanaTimeZone;
}

export interface TaskRecord {
  readonly schemaVersion: 1;
  readonly id: TaskId;
  readonly seriesId: SeriesId;
  readonly title: string;
  readonly description?: string;
  readonly schedule: TaskSchedule;
  readonly recurrence: RecurrenceRule | null;
  readonly status: "active" | "tombstone";
  readonly firstCompletedAt?: IsoInstant;
  readonly createdAt: IsoInstant;
  readonly updatedAt: IsoInstant;
  readonly origin: "native" | "migration" | "import";
}

export function normalizeTaskTitle(value: string): string {
  const title = value.trim().replace(/\s+/gu, " ");
  if (title.length === 0 || title.length > 240) {
    throw new RangeError("Task title must contain 1 to 240 characters");
  }
  return title;
}

export function normalizeTaskDescription(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const description = value.trim();
  if (description.length > 10_000) throw new RangeError("Task description is too long");
  return description.length === 0 ? undefined : description;
}

export function validateRecurrenceRule(rule: RecurrenceRule | null): RecurrenceRule | null {
  if (rule === null) return null;
  if (!Number.isSafeInteger(rule.interval) || rule.interval < 1 || rule.interval > 999) {
    throw new RangeError("Recurrence interval is invalid");
  }
  if (rule.frequency === "weekly") {
    const unique = new Set(rule.weekdays);
    if (unique.size === 0 || unique.size !== rule.weekdays.length) {
      throw new RangeError("Weekly recurrence weekdays must be non-empty and unique");
    }
    for (const weekday of unique) {
      if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
        throw new RangeError("Weekly recurrence weekday is invalid");
      }
    }
  }
  if (rule.frequency === "monthly") {
    if (!Number.isSafeInteger(rule.dayOfMonth) || rule.dayOfMonth < 1 || rule.dayOfMonth > 31) {
      throw new RangeError("Monthly recurrence day is invalid");
    }
    if (rule.invalidDatePolicy !== "clamp" && rule.invalidDatePolicy !== "skip") {
      throw new RangeError("Monthly recurrence invalid-date policy is invalid");
    }
  }
  if (rule.frequency === "yearly") {
    if (!Number.isSafeInteger(rule.month) || rule.month < 1 || rule.month > 12) {
      throw new RangeError("Yearly recurrence month is invalid");
    }
    if (!Number.isSafeInteger(rule.dayOfMonth) || rule.dayOfMonth < 1 || rule.dayOfMonth > 31) {
      throw new RangeError("Yearly recurrence day is invalid");
    }
    if (rule.invalidDatePolicy !== "clamp" && rule.invalidDatePolicy !== "skip") {
      throw new RangeError("Yearly recurrence invalid-date policy is invalid");
    }
  }
  return Object.freeze(rule);
}
