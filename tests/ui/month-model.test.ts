import { describe, expect, it } from 'vitest'

import { buildMonthGrid, getEntriesForDate } from '@/features/calendar/month-model'

describe('calendar month model', () => {
  it('builds a stable six-week Sunday-first grid across a month boundary', () => {
    const cells = buildMonthGrid(new Date(2026, 7, 1, 12))

    expect(cells).toHaveLength(42)
    expect(cells[0]?.date.getDay()).toBe(0)
    expect(cells.at(-1)?.date.getDay()).toBe(6)
    expect(cells.some((cell) => !cell.inCurrentMonth)).toBe(true)
  })

  it('selects one local day and orders timed entries before untimed entries', () => {
    const entries = getEntriesForDate([
      { id: 'late', localDate: '2026-08-19', scheduledTime: '18:00', title: '夜' },
      { id: 'other', localDate: '2026-08-20', title: '別日' },
      { id: 'free', localDate: '2026-08-19', title: '時間なし' },
      { id: 'early', localDate: '2026-08-19', scheduledTime: '08:30', title: '朝' },
    ], '2026-08-19')

    expect(entries.map((entry) => entry.id)).toEqual(['free', 'early', 'late'])
  })
})
