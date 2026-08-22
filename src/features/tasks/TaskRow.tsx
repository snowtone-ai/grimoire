'use client'

import { useEffect, useRef, useState } from 'react'

import type { TaskRowView } from '@/app/ui-port'
import { useSound } from '@/audio'
import { useReducedMotion } from '@/ui/hooks/use-reduced-motion'

import { categoryLabel, categorySwatch } from './category'
import { isoWeekdayLabel } from './local-date'
import { describeRecurrence } from './recurrence-form'
import styles from './task-row.module.css'

export interface TaskRowProps {
  readonly onEdit: (task: TaskRowView) => void
  readonly onToggle: (task: TaskRowView, completed: boolean) => Promise<void>
  readonly task: TaskRowView
}

/**
 * One line in a day's list. Not a card: DESIGN.md §6.2 forbids a screen made of
 * identical rounded panels, and a task list is exactly where that habit starts.
 * A row is a hairline-separated line of text with one control on each side.
 *
 * The Mist glow fires only after the write has actually committed — the trust
 * promise in docs/vision.md is that nothing celebrates before it is saved.
 */
export function TaskRow({ onEdit, onToggle, task }: TaskRowProps) {
  const [busy, setBusy] = useState(false)
  const [committed, setCommitted] = useState(false)
  const reducedMotion = useReducedMotion()
  const play = useSound()
  const timer = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current)
    },
    [],
  )

  async function handleToggle() {
    if (busy) return
    const next = !task.completed
    setBusy(true)
    try {
      await onToggle(task, next)
      play(next ? 'taskComplete' : 'taskReopen')
      if (next && !reducedMotion) {
        setCommitted(true)
        timer.current = window.setTimeout(() => setCommitted(false), 900)
      }
    } catch {
      play('error')
    } finally {
      setBusy(false)
    }
  }

  const repeat = describeRecurrence(task.recurrence, isoWeekdayLabel)
  const meta = [
    task.scheduledTime,
    task.categoryId === null ? null : categoryLabel(task.categoryId),
    repeat,
  ].filter((value): value is string => value != null && value !== '')

  return (
    <li className={styles.row} data-completed={task.completed ? '' : undefined}>
      {committed ? <span className={styles.commitGlow} aria-hidden="true" /> : null}
      <button
        type="button"
        role="checkbox"
        className={styles.check}
        aria-checked={task.completed}
        aria-label={`${task.title}を${task.completed ? '未完了に戻す' : '完了にする'}`}
        disabled={busy}
        onClick={() => void handleToggle()}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path
            d="M5 10.5l3.4 3.2L15 6.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <button type="button" className={styles.body} onClick={() => onEdit(task)}>
        <span className={styles.title}>{task.title}</span>
        {meta.length === 0 ? null : (
          <span className={styles.meta}>
            {task.categoryId === null ? null : (
              <span
                className={styles.swatch}
                style={{ background: categorySwatch(task.categoryId) }}
                aria-hidden="true"
              />
            )}
            {meta.join(' · ')}
          </span>
        )}
      </button>
    </li>
  )
}
