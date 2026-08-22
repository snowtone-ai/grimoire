'use client'

import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useAppPort, useAppReadModel } from '@/app/app-context'
import type { CalendarEntryView, TaskDraft, TaskRowView } from '@/app/ui-port'
import { useSound } from '@/audio'
import { categorySwatch } from '@/features/tasks/category'
import {
  formatDayHeading,
  formatMonthHeading,
  fromLocalDate,
  todayLocalDate,
  toLocalDate,
} from '@/features/tasks/local-date'
import { TaskEditor } from '@/features/tasks/TaskEditor'
import { TaskRow } from '@/features/tasks/TaskRow'
import { Button } from '@/ui/components/button'
import { IconButton } from '@/ui/components/icon-button'
import { Sheet } from '@/ui/components/sheet'
import { useMediaQuery } from '@/ui/hooks/use-media-query'

import { buildMonthGrid, getEntriesForDate } from './month-model'
import styles from './calendar-experience.module.css'

const WEEKDAY_HEADINGS = ['日', '月', '火', '水', '木', '金', '土'] as const
/** 決定事項ログ F-7: a cell shows at most two titles, then a remainder count. */
const CELL_TITLE_LIMIT = 2

type EditorState =
  | { readonly mode: 'closed' }
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly task: TaskRowView }

function toTaskRow(entry: CalendarEntryView): TaskRowView {
  return {
    categoryId: entry.categoryId,
    completed: entry.completed,
    id: entry.id,
    recurrence: entry.recurrence,
    title: entry.title,
    ...(entry.scheduledTime === undefined ? {} : { scheduledTime: entry.scheduledTime }),
  }
}

/**
 * 決定事項ログ F-7 / F-9 — the month stays on screen at every width. Selecting a
 * day never navigates away: on a narrow screen the day opens as a sheet over the
 * month, on a wide one as a panel beside it. Entries carry no origin label, so
 * an imported event and a written task are indistinguishable by design (F-4).
 */
export function CalendarExperience() {
  const port = useAppPort()
  const { calendarEntries } = useAppReadModel()
  const today = todayLocalDate()
  const [anchor, setAnchor] = useState(() => fromLocalDate(today))
  const [selected, setSelected] = useState(today)
  const [dayOpen, setDayOpen] = useState(false)
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const splitView = useMediaQuery('(min-width: 800px)')
  const play = useSound()

  const grid = useMemo(() => buildMonthGrid(anchor), [anchor])

  useEffect(() => {
    const from = grid[0]?.key
    const to = grid.at(-1)?.key
    if (from === undefined || to === undefined) return
    void port.loadCalendarRange({ fromLocalDate: from, toLocalDate: to })
  }, [grid, port])

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEntryView[]>()
    for (const entry of calendarEntries) {
      const bucket = map.get(entry.localDate)
      if (bucket === undefined) map.set(entry.localDate, [entry])
      else bucket.push(entry)
    }
    return map
  }, [calendarEntries])

  const selectedEntries = useMemo(
    () => getEntriesForDate(calendarEntries, selected),
    [calendarEntries, selected],
  )

  function shiftMonth(delta: number) {
    setAnchor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12))
    play('press')
  }

  function selectDay(localDate: string) {
    setSelected(localDate)
    if (!splitView) setDayOpen(true)
    play('press')
  }

  async function submitDraft(draft: TaskDraft) {
    if (editor.mode === 'edit') {
      await port.updateTask({ draft, taskId: editor.task.id })
    } else {
      await port.createTask(draft)
    }
    setEditor({ mode: 'closed' })
  }

  // The sheet variant already names the day in its own header, so the panel
  // heading would repeat it there.
  const dayDetail = (showTitle: boolean) => (
    <div className={styles.day}>
      <div className={styles.dayHeader}>
        {showTitle ? (
          <h2 className={styles.dayTitle}>{formatDayHeading(selected)}</h2>
        ) : (
          <span />
        )}
        <Button
          tone="quiet"
          icon={<Plus aria-hidden="true" size={18} strokeWidth={1.8} />}
          onClick={() => {
            setEditor({ mode: 'create' })
            play('sheetOpen')
          }}
        >
          書き足す
        </Button>
      </div>
      {selectedEntries.length === 0 ? (
        <p className={styles.dayEmpty}>この日の記録はまだありません。</p>
      ) : (
        <ul role="list" className={styles.dayRows}>
          {selectedEntries.map((entry) => (
            <TaskRow
              key={entry.id}
              task={toTaskRow(entry)}
              onEdit={(target) => setEditor({ mode: 'edit', task: target })}
              onToggle={(target, completed) =>
                port.setTaskCompleted({ completed, taskId: target.id })
              }
            />
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <main id="main-content" className={styles.screen} data-split={splitView ? '' : undefined}>
      <section className={styles.month} aria-label="月表示">
        <header className={styles.monthHeader}>
          <IconButton
            label="前の月"
            icon={<ChevronLeft aria-hidden="true" strokeWidth={1.65} />}
            onClick={() => shiftMonth(-1)}
          />
          <h1 className={styles.monthTitle} aria-live="polite">
            {formatMonthHeading(toLocalDate(anchor))}
          </h1>
          <IconButton
            label="次の月"
            icon={<ChevronRight aria-hidden="true" strokeWidth={1.65} />}
            onClick={() => shiftMonth(1)}
          />
        </header>

        <div className={styles.weekdays} aria-hidden="true">
          {WEEKDAY_HEADINGS.map((heading) => (
            <span key={heading}>{heading}</span>
          ))}
        </div>

        <div className={styles.grid} role="grid" aria-label="月のカレンダー">
          {grid.map((cell) => {
            const entries = byDate.get(cell.key) ?? []
            const shown = entries.slice(0, CELL_TITLE_LIMIT)
            const remaining = entries.length - shown.length
            return (
              <button
                key={cell.key}
                type="button"
                role="gridcell"
                className={styles.cell}
                data-outside={cell.inCurrentMonth ? undefined : ''}
                data-today={cell.key === today ? '' : undefined}
                data-selected={cell.key === selected ? '' : undefined}
                aria-selected={cell.key === selected}
                aria-label={`${formatDayHeading(cell.key)} 予定${entries.length}件`}
                onClick={() => selectDay(cell.key)}
              >
                <span className={styles.cellDate}>{cell.date.getDate()}</span>
                <span className={styles.cellEntries}>
                  {shown.map((entry) => (
                    <span key={entry.id} className={styles.cellEntry}>
                      <span
                        className={styles.cellSwatch}
                        style={{ background: categorySwatch(entry.categoryId) }}
                        aria-hidden="true"
                      />
                      <span className={styles.cellEntryTitle}>{entry.title}</span>
                    </span>
                  ))}
                  {remaining > 0 ? (
                    <span className={styles.cellMore}>ほか {remaining}</span>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {splitView ? <aside className={styles.panel}>{dayDetail(true)}</aside> : null}

      {splitView ? null : (
        <Sheet
          /* Two sheets never stack (DESIGN.md §6.3): while the editor is open the
             day sheet steps aside, and reappears when the editor closes. */
          open={dayOpen && editor.mode === 'closed'}
          onClose={() => {
            setDayOpen(false)
            play('sheetClose')
          }}
          title={formatDayHeading(selected)}
        >
          {dayDetail(false)}
        </Sheet>
      )}

      {editor.mode === 'closed' ? null : (
        <TaskEditor
          key={editor.mode === 'edit' ? editor.task.id : 'create'}
          open
          task={editor.mode === 'edit' ? editor.task : undefined}
          defaultLocalDate={selected}
          onCancel={() => {
            setEditor({ mode: 'closed' })
            play('sheetClose')
          }}
          onSubmit={submitDraft}
          onDelete={
            editor.mode === 'edit'
              ? async (taskId) => {
                  await port.deleteTask({ taskId })
                  setEditor({ mode: 'closed' })
                }
              : undefined
          }
        />
      )}
    </main>
  )
}
