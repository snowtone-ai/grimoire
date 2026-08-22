import {
  localDate,
  occurrenceKey,
  type LocalDate,
  type OccurrenceKey,
  type SeriesId,
} from "./primitives";
import type { InvalidDatePolicy, RecurrenceRule, TaskRecord, TaskSchedule, Weekday } from "./tasks";

const DAY_MS = 86_400_000;

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function parseDate(value: LocalDate): DateParts {
  const [yearText, monthText, dayText] = value.split("-");
  if (yearText === undefined || monthText === undefined || dayText === undefined) {
    throw new RangeError("Local date is malformed");
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  return { year, month, day };
}

function formatDate(year: number, month: number, day: number): LocalDate {
  return localDate(
    `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}`,
  );
}

function utcDay(value: LocalDate): number {
  const { year, month, day } = parseDate(value);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function daysBetween(from: LocalDate, to: LocalDate): number {
  return utcDay(to) - utcDay(from);
}

function addDays(value: LocalDate, amount: number): LocalDate {
  const date = new Date((utcDay(value) + amount) * DAY_MS);
  return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function monthsBetween(from: LocalDate, to: LocalDate): number {
  const start = parseDate(from);
  const end = parseDate(to);
  return (end.year - start.year) * 12 + end.month - start.month;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function resolveMonthDay(
  year: number,
  month: number,
  dayOfMonth: number,
  policy: InvalidDatePolicy,
): LocalDate | undefined {
  const maximum = daysInMonth(year, month);
  if (dayOfMonth > maximum && policy === "skip") return undefined;
  return formatDate(year, month, Math.min(dayOfMonth, maximum));
}

function monthAt(start: LocalDate, monthOffset: number): Readonly<{ year: number; month: number }> {
  const parts = parseDate(start);
  const zeroBased = parts.year * 12 + (parts.month - 1) + monthOffset;
  return Object.freeze({ year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 });
}

export function isoWeekday(value: LocalDate): Weekday {
  const weekday = new Date(utcDay(value) * DAY_MS).getUTCDay();
  return (weekday === 0 ? 7 : weekday) as Weekday;
}

export function monthlyRecurrence(
  dayOfMonth: number,
  interval = 1,
  invalidDatePolicy: InvalidDatePolicy = "clamp",
): Extract<RecurrenceRule, { frequency: "monthly" }> {
  return Object.freeze({ frequency: "monthly", interval, dayOfMonth, invalidDatePolicy });
}

export function yearlyRecurrence(
  month: number,
  dayOfMonth: number,
  interval = 1,
  invalidDatePolicy: InvalidDatePolicy = "clamp",
): Extract<RecurrenceRule, { frequency: "yearly" }> {
  return Object.freeze({ frequency: "yearly", interval, month, dayOfMonth, invalidDatePolicy });
}

export function isOccurrenceDate(
  start: LocalDate,
  recurrence: RecurrenceRule | null,
  candidate: LocalDate,
): boolean {
  if (candidate < start) return false;
  if (recurrence === null) return candidate === start;
  const dayDifference = daysBetween(start, candidate);
  if (recurrence.frequency === "daily") return dayDifference % recurrence.interval === 0;
  if (recurrence.frequency === "weekly") {
    const weekAnchor = addDays(start, -(isoWeekday(start) - 1));
    const weekIndex = Math.floor(daysBetween(weekAnchor, candidate) / 7);
    return weekIndex % recurrence.interval === 0 && recurrence.weekdays.includes(isoWeekday(candidate));
  }
  if (recurrence.frequency === "monthly") {
    const monthDifference = monthsBetween(start, candidate);
    if (monthDifference < 0 || monthDifference % recurrence.interval !== 0) return false;
    const { year, month } = parseDate(candidate);
    return (
      resolveMonthDay(year, month, recurrence.dayOfMonth, recurrence.invalidDatePolicy) === candidate
    );
  }
  const startParts = parseDate(start);
  const candidateParts = parseDate(candidate);
  const yearDifference = candidateParts.year - startParts.year;
  if (yearDifference < 0 || yearDifference % recurrence.interval !== 0) return false;
  return (
    resolveMonthDay(
      candidateParts.year,
      recurrence.month,
      recurrence.dayOfMonth,
      recurrence.invalidDatePolicy,
    ) === candidate
  );
}

export function assertRecurrenceStart(schedule: TaskSchedule, recurrence: RecurrenceRule | null): void {
  if (!isOccurrenceDate(schedule.localDate, recurrence, schedule.localDate)) {
    throw new RangeError("Task start does not match its recurrence rule");
  }
  if (recurrence?.frequency === "weekly" && !recurrence.weekdays.includes(isoWeekday(schedule.localDate))) {
    throw new RangeError("Task start weekday is absent from its weekly recurrence rule");
  }
  if (recurrence?.frequency === "monthly") {
    const parts = parseDate(schedule.localDate);
    if (
      resolveMonthDay(parts.year, parts.month, recurrence.dayOfMonth, recurrence.invalidDatePolicy) !==
      schedule.localDate
    ) {
      throw new RangeError("Task start does not match its monthly recurrence day");
    }
  }
  if (recurrence?.frequency === "yearly") {
    const parts = parseDate(schedule.localDate);
    if (
      resolveMonthDay(
        parts.year,
        recurrence.month,
        recurrence.dayOfMonth,
        recurrence.invalidDatePolicy,
      ) !== schedule.localDate
    ) {
      throw new RangeError("Task start does not match its yearly recurrence date");
    }
  }
}

export function nextOccurrenceDate(
  start: LocalDate,
  recurrence: RecurrenceRule | null,
  after: LocalDate,
): LocalDate | undefined {
  if (recurrence === null) return after < start ? start : undefined;
  if (after < start) return start;
  if (recurrence.frequency === "daily") {
    const elapsedDays = daysBetween(start, after);
    const nextPeriod = Math.floor(elapsedDays / recurrence.interval) + 1;
    return addDays(start, nextPeriod * recurrence.interval);
  }
  if (recurrence.frequency === "weekly") {
    const searchLimit = recurrence.interval * 7 + 7;
    for (let dayOffset = 1; dayOffset <= searchLimit; dayOffset += 1) {
      const candidate = addDays(after, dayOffset);
      if (isOccurrenceDate(start, recurrence, candidate)) return candidate;
    }
    throw new RangeError("Unable to resolve next weekly occurrence");
  }
  if (recurrence.frequency === "monthly") {
    let period = Math.max(0, Math.floor(monthsBetween(start, after) / recurrence.interval));
    for (let attempt = 0; attempt < 1_200; attempt += 1) {
      const { year, month } = monthAt(start, period * recurrence.interval);
      const candidate = resolveMonthDay(
        year,
        month,
        recurrence.dayOfMonth,
        recurrence.invalidDatePolicy,
      );
      if (candidate !== undefined && candidate > after) return candidate;
      period += 1;
    }
    throw new RangeError("Unable to resolve next monthly occurrence");
  }
  const startYear = parseDate(start).year;
  const afterYear = parseDate(after).year;
  let period = Math.max(0, Math.floor((afterYear - startYear) / recurrence.interval));
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const year = startYear + period * recurrence.interval;
    const candidate = resolveMonthDay(
      year,
      recurrence.month,
      recurrence.dayOfMonth,
      recurrence.invalidDatePolicy,
    );
    if (candidate !== undefined && candidate > after) return candidate;
    period += 1;
  }
  throw new RangeError("Unable to resolve next yearly occurrence");
}

export function occurrenceDates(
  start: LocalDate,
  recurrence: RecurrenceRule | null,
  count: number,
): readonly LocalDate[] {
  if (!Number.isSafeInteger(count) || count < 0 || count > 10_000) {
    throw new RangeError("Occurrence count is invalid");
  }
  if (count === 0) return Object.freeze([]);
  const result: LocalDate[] = [start];
  while (result.length < count) {
    const next = nextOccurrenceDate(start, recurrence, result[result.length - 1]!);
    if (next === undefined) break;
    result.push(next);
  }
  return Object.freeze(result);
}

export function makeOccurrenceKey(
  series: SeriesId,
  schedule: Pick<TaskSchedule, "localTime" | "timeZone">,
  date: LocalDate,
): OccurrenceKey {
  return occurrenceKey(`${series}@${date}T${schedule.localTime}[${schedule.timeZone}]`);
}

export function isTaskOccurrence(task: TaskRecord, date: LocalDate): boolean {
  return isOccurrenceDate(task.schedule.localDate, task.recurrence, date);
}
