import type { RecurrenceView } from '@/app/ui-port'

import { dayOfMonthOf, isoWeekdayOf } from './local-date'

/**
 * The repeat options the editor offers.
 *
 * Deliberately v1's exact set — none / daily / weekly / monthly — with an
 * interval of 1. The domain accepts yearly rules and intervals up to 999, but
 * 決定事項ログ F-4 says not to introduce calendar behaviour v1 did not have until
 * it has been reconciled against v1. Widening this list is a product decision,
 * not a form detail, so it stays here rather than being hidden in a component.
 */
export type RepeatChoice = 'daily' | 'monthly' | 'none' | 'weekly'

export const REPEAT_CHOICES: readonly {
  readonly label: string
  readonly value: RepeatChoice
}[] = Object.freeze([
  { value: 'none', label: 'なし' },
  { value: 'daily', label: '毎日' },
  { value: 'weekly', label: '毎週' },
  { value: 'monthly', label: '毎月' },
])

export function repeatChoiceOf(recurrence: RecurrenceView | null): RepeatChoice {
  if (recurrence === null) return 'none'
  // A yearly rule can only reach the form through imported or migrated data.
  // It is shown as "none" rather than silently rewritten, and is preserved
  // unless the user actually changes the field (see `buildRecurrence`).
  return recurrence.frequency === 'yearly' ? 'none' : recurrence.frequency
}

/**
 * Builds the rule for a choice. `weekday` is only consulted for weekly rules and
 * `localDate` supplies the day-of-month for monthly ones, so the rule always
 * agrees with the date the task is being scheduled for.
 */
export function buildRecurrence(
  choice: RepeatChoice,
  localDate: string,
  weekday: number,
): RecurrenceView | null {
  switch (choice) {
    case 'none':
      return null
    case 'daily':
      return { frequency: 'daily', interval: 1 }
    case 'weekly':
      return {
        frequency: 'weekly',
        interval: 1,
        weekdays: [(weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7) || isoWeekdayOf(localDate)],
      }
    case 'monthly':
      return {
        frequency: 'monthly',
        interval: 1,
        dayOfMonth: dayOfMonthOf(localDate),
        invalidDatePolicy: 'clamp',
      }
  }
}

/** Human-readable summary used in list rows, so a repeating task is obvious. */
export function describeRecurrence(
  recurrence: RecurrenceView | null,
  weekdayLabelOf: (weekday: number) => string,
): string | null {
  if (recurrence === null) return null
  switch (recurrence.frequency) {
    case 'daily':
      return '毎日'
    case 'weekly':
      return `毎週${recurrence.weekdays.map(weekdayLabelOf).join('・')}`
    case 'monthly':
      return `毎月${recurrence.dayOfMonth}日`
    case 'yearly':
      return `毎年${recurrence.month}月${recurrence.dayOfMonth}日`
  }
}

export function initialWeekday(
  recurrence: RecurrenceView | null,
  localDate: string,
): number {
  if (recurrence?.frequency === 'weekly') {
    return recurrence.weekdays[0] ?? isoWeekdayOf(localDate)
  }
  return isoWeekdayOf(localDate)
}
