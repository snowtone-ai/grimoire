/**
 * Local wall-clock helpers. Everything here works on 'YYYY-MM-DD' strings and
 * the device's own calendar — a task written "today" belongs to the day the
 * person is living in, not to a UTC day boundary.
 */

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const

export function toLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayLocalDate(): string {
  return toLocalDate(new Date())
}

/** Noon keeps the value clear of DST transitions in either direction. */
export function fromLocalDate(localDate: string): Date {
  const parts = localDate.split('-')
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12)
}

export function addLocalDays(localDate: string, days: number): string {
  const date = fromLocalDate(localDate)
  date.setDate(date.getDate() + days)
  return toLocalDate(date)
}

/** ISO weekday: Monday = 1 … Sunday = 7. */
export function isoWeekdayOf(localDate: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const day = fromLocalDate(localDate).getDay()
  return (day === 0 ? 7 : day) as 1 | 2 | 3 | 4 | 5 | 6 | 7
}

export function dayOfMonthOf(localDate: string): number {
  return fromLocalDate(localDate).getDate()
}

export function monthOf(localDate: string): number {
  return fromLocalDate(localDate).getMonth() + 1
}

export function weekdayLabel(localDate: string): string {
  return WEEKDAY_LABELS[fromLocalDate(localDate).getDay()] ?? ''
}

/** "8月22日 金" — the header voice: short, no year unless it differs from now. */
export function formatDayHeading(localDate: string): string {
  const date = fromLocalDate(localDate)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  const prefix = sameYear ? '' : `${date.getFullYear()}年`
  return `${prefix}${date.getMonth() + 1}月${date.getDate()}日 ${weekdayLabel(localDate)}`
}

export function formatMonthHeading(localDate: string): string {
  const date = fromLocalDate(localDate)
  return `${date.getFullYear()}年 ${date.getMonth() + 1}月`
}

export function isoWeekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday === 7 ? 0 : weekday] ?? ''
}

export const ISO_WEEKDAYS: readonly (1 | 2 | 3 | 4 | 5 | 6 | 7)[] = Object.freeze([
  1, 2, 3, 4, 5, 6, 7,
])
