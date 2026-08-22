'use client'

import { Plus, Settings } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useAppPort, useAppReadModel } from '@/app/app-context'
import type { TaskDraft, TaskRowView } from '@/app/ui-port'
import { useSound } from '@/audio'
import { formatDayHeading, todayLocalDate } from '@/features/tasks/local-date'
import { TaskEditor } from '@/features/tasks/TaskEditor'
import { TaskRow } from '@/features/tasks/TaskRow'
import { IconLink } from '@/ui/components/icon-button'

import styles from './home-experience.module.css'

type EditorState =
  | { readonly mode: 'closed' }
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly task: TaskRowView }

/**
 * 決定事項ログ F-8 — Home is only today's task management.
 *
 * What is deliberately absent: progress rings, counts, streaks, the creature,
 * and any card whose job is decoration. The date, the list, and one small way to
 * add a line. Everything else the app can do lives one tap away in the nav.
 */
export function HomeExperience() {
  const port = useAppPort()
  const { tasksToday } = useAppReadModel()
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [completedOpen, setCompletedOpen] = useState(false)
  const play = useSound()
  const today = todayLocalDate()

  const { open, completed } = useMemo(
    () => ({
      open: tasksToday.filter((task) => !task.completed),
      completed: tasksToday.filter((task) => task.completed),
    }),
    [tasksToday],
  )

  async function submitDraft(draft: TaskDraft) {
    if (editor.mode === 'edit') {
      await port.updateTask({ draft, taskId: editor.task.id })
    } else {
      await port.createTask(draft)
    }
    setEditor({ mode: 'closed' })
  }

  async function deleteTask(taskId: string) {
    await port.deleteTask({ taskId })
    setEditor({ mode: 'closed' })
  }

  return (
    <main id="main-content" className={styles.screen}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>今日</p>
          <h1 className={styles.date}>{formatDayHeading(today)}</h1>
        </div>
        <IconLink
          href="/settings"
          label="設定"
          icon={<Settings aria-hidden="true" strokeWidth={1.65} />}
        />
      </header>

      <section className={styles.list} aria-labelledby="today-heading">
        <h2 id="today-heading" className="sr-only">
          今日のタスク
        </h2>
        {open.length === 0 ? (
          <p className={styles.empty}>
            {completed.length === 0
              ? '今日の欄はまだ白紙です。ひとつ書き留めると、ここに並びます。'
              : '今日の分はすべて終えました。'}
          </p>
        ) : (
          <ul role="list" className={styles.rows}>
            {open.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onEdit={(target) => setEditor({ mode: 'edit', task: target })}
                onToggle={(target, isCompleted) =>
                  port.setTaskCompleted({ completed: isCompleted, taskId: target.id })
                }
              />
            ))}
          </ul>
        )}
      </section>

      {completed.length === 0 ? null : (
        <section className={styles.completed}>
          <button
            type="button"
            className={styles.completedToggle}
            aria-expanded={completedOpen}
            aria-controls="completed-rows"
            onClick={() => {
              setCompletedOpen((value) => !value)
              play('press')
            }}
          >
            <span className={styles.completedRule} aria-hidden="true" />
            <span className={styles.completedLabel}>完了 {completed.length}</span>
            <svg
              className={styles.completedChevron}
              data-open={completedOpen ? '' : undefined}
              viewBox="0 0 20 20"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M6 8l4 4 4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <ul
            role="list"
            id="completed-rows"
            className={styles.rows}
            hidden={!completedOpen}
          >
            {completed.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onEdit={(target) => setEditor({ mode: 'edit', task: target })}
                onToggle={(target, isCompleted) =>
                  port.setTaskCompleted({ completed: isCompleted, taskId: target.id })
                }
              />
            ))}
          </ul>
        </section>
      )}

      <div className={styles.addBar}>
        <button
          type="button"
          className={styles.add}
          onClick={() => {
            setEditor({ mode: 'create' })
            play('sheetOpen')
          }}
        >
          <Plus aria-hidden="true" size={18} strokeWidth={1.8} />
          今日のタスクを書く
        </button>
      </div>

      {editor.mode === 'closed' ? null : (
        <TaskEditor
          key={editor.mode === 'edit' ? editor.task.id : 'create'}
          open
          task={editor.mode === 'edit' ? editor.task : undefined}
          defaultLocalDate={today}
          onCancel={() => {
            setEditor({ mode: 'closed' })
            play('sheetClose')
          }}
          onSubmit={submitDraft}
          onDelete={editor.mode === 'edit' ? deleteTask : undefined}
        />
      )}
    </main>
  )
}
