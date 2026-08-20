'use client'

import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { useAppPort, useAppReadModel } from '@/app/app-context'

import styles from './calendar-experience.module.css'
import { buildMonthGrid, formatLocalDate, getEntriesForDate } from './month-model'

const weekdays = ['日', '月', '火', '水', '木', '金', '土'] as const

function monthTitle(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', { month: 'long', year: 'numeric' }).format(date)
}

function selectedTitle(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    day: 'numeric',
    month: 'long',
    weekday: 'short',
  }).format(date)
}

export function CalendarExperience() {
  const port = useAppPort()
  const { calendarEntries } = useAppReadModel()
  const today = useMemo(() => new Date(), [])
  const [anchor, setAnchor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1, 12))
  const [selected, setSelected] = useState(today)
  const [detailOpen, setDetailOpen] = useState(true)
  const cells = useMemo(() => buildMonthGrid(anchor), [anchor])
  const selectedEntries = getEntriesForDate(calendarEntries, formatLocalDate(selected))

  useEffect(() => {
    const first = cells[0]
    const last = cells[cells.length - 1]
    if (!first || !last) return
    void port.loadCalendarRange({ fromLocalDate: first.key, toLocalDate: last.key })
  }, [cells, port])

  function changeMonth(offset: number): void {
    const next = new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1, 12)
    setAnchor(next)
    setSelected(next)
    setDetailOpen(true)
  }

  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.calendarColumn} aria-labelledby="calendar-heading">
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>CALENDAR</p>
            <h1 id="calendar-heading">{monthTitle(anchor)}</h1>
          </div>
          <div className={styles.monthActions}>
            <button type="button" onClick={() => changeMonth(-1)} aria-label="前の月">
              <ChevronLeft aria-hidden="true" size={19} />
            </button>
            <button type="button" onClick={() => changeMonth(1)} aria-label="次の月">
              <ChevronRight aria-hidden="true" size={19} />
            </button>
          </div>
        </header>

        <div className={styles.weekdays} aria-hidden="true">
          {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>
        <div className={styles.monthGrid} role="group" aria-label={monthTitle(anchor)}>
          {cells.map((cell) => {
            const entries = getEntriesForDate(calendarEntries, cell.key)
            const isSelected = cell.key === formatLocalDate(selected)
            const isToday = cell.key === formatLocalDate(today)
            return (
              <button
                type="button"
                key={cell.key}
                className={styles.dayCell}
                data-outside={cell.inCurrentMonth ? undefined : ''}
                data-selected={isSelected ? '' : undefined}
                aria-pressed={isSelected}
                aria-label={`${selectedTitle(cell.date)}${entries.length > 0 ? `、${entries.length}件` : '、予定なし'}`}
                onClick={() => {
                  setSelected(cell.date)
                  setDetailOpen(true)
                }}
              >
                <time dateTime={cell.key} data-today={isToday ? '' : undefined}>
                  {cell.date.getDate()}
                </time>
                <span className={styles.cellEntries} aria-hidden="true">
                  {entries.slice(0, 2).map((entry) => (
                    <span key={entry.id}>{entry.title}</span>
                  ))}
                  {entries.length > 2 ? <small>+{entries.length - 2}</small> : null}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <aside className={styles.detail} data-open={detailOpen ? '' : undefined} aria-labelledby="selected-day-heading">
        <header>
          <div>
            <p className={styles.eyebrow}>SELECTED DAY</p>
            <h2 id="selected-day-heading">{selectedTitle(selected)}</h2>
          </div>
          <button className={styles.closeDetail} type="button" onClick={() => setDetailOpen(false)} aria-label="詳細を閉じる">
            <X aria-hidden="true" size={19} />
          </button>
        </header>
        {selectedEntries.length === 0 ? (
          <div className={styles.detailEmpty}>
            <p>この日の予定はありません。</p>
            <Link href="/" prefetch={false}>
              ホームで追加 <ExternalLink aria-hidden="true" size={15} />
            </Link>
          </div>
        ) : (
          <ul className={styles.detailList} role="list">
            {selectedEntries.map((entry) => (
              <li key={entry.id}>
                <time>{entry.scheduledTime ?? '時間指定なし'}</time>
                <span>{entry.title}</span>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.unavailableNotice}>
          編集は端末内データストアの接続後に利用できます。
        </p>
      </aside>
    </main>
  )
}
