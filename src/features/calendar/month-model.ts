import type { CalendarEntryView } from '@/app/ui-port'

export interface CalendarCell {
  readonly date: Date
  readonly inCurrentMonth: boolean
  readonly key: string
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function buildMonthGrid(anchor: Date): readonly CalendarCell[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      date,
      inCurrentMonth: date.getMonth() === anchor.getMonth(),
      key: formatLocalDate(date),
    }
  })
}

export function getEntriesForDate(
  entries: readonly CalendarEntryView[],
  localDate: string,
): readonly CalendarEntryView[] {
  return entries
    .filter((entry) => entry.localDate === localDate)
    .toSorted((left, right) => (left.scheduledTime ?? '').localeCompare(right.scheduledTime ?? ''))
}
