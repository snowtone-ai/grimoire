'use client'

import { Check, ChevronDown, Plus, Settings } from 'lucide-react'
import Link from 'next/link'
import { type FormEvent, useMemo, useState } from 'react'

import { useAppPort, useAppReadModel } from '@/app/app-context'

import styles from './home-experience.module.css'

function formatToday(): { readonly day: string; readonly weekday: string } {
  const now = new Date()
  const day = new Intl.DateTimeFormat('ja-JP', {
    day: 'numeric',
    month: 'long',
  }).format(now)
  const weekday = new Intl.DateTimeFormat('ja-JP', { weekday: 'long' }).format(now)
  return { day, weekday }
}

export function HomeExperience() {
  const port = useAppPort()
  const { tasksToday } = useAppReadModel()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const today = useMemo(formatToday, [])
  const openTasks = tasksToday.filter((task) => !task.completed)
  const completedTasks = tasksToday.filter((task) => task.completed)

  async function addTask(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await port.createTodayTask({ title })
      setTitle('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'タスクを保存できませんでした。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>TODAY · {today.weekday}</p>
          <h1>{today.day}</h1>
        </div>
        <Link className={styles.settingsLink} href="/settings" prefetch={false} aria-label="設定を開く" title="設定">
          <Settings aria-hidden="true" size={20} strokeWidth={1.6} />
        </Link>
      </header>

      <section className={styles.workArea} aria-labelledby="today-heading">
        <div className={styles.sectionHeading}>
          <h2 id="today-heading">今日やること</h2>
          {openTasks.length > 0 ? <span>{openTasks.length}件</span> : null}
        </div>

        <form className={styles.quickAdd} onSubmit={(event) => void addTask(event)}>
          <label className="sr-only" htmlFor="quick-task">
            今日のタスク
          </label>
          <input
            id="quick-task"
            maxLength={160}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="今日のタスクを追加"
            autoComplete="off"
          />
          <button type="submit" disabled={saving || title.trim().length === 0} aria-label="タスクを追加">
            <Plus aria-hidden="true" size={20} />
          </button>
        </form>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        {openTasks.length === 0 ? (
          <div className={styles.emptyState}>
            <span aria-hidden="true" />
            <p>今日の余白は、まだそのままです。</p>
            <small>やることが決まったら、上から1件だけ追加できます。</small>
          </div>
        ) : (
          <ul className={styles.taskList} role="list">
            {openTasks.map((task) => (
              <li key={task.id} className={styles.taskRow}>
                <button
                  type="button"
                  className={styles.checkButton}
                  aria-label={`「${task.title}」を完了にする`}
                  onClick={() => void port.setTaskCompleted({ completed: true, taskId: task.id })}
                >
                  <Check aria-hidden="true" size={16} />
                </button>
                <span className={styles.taskTitle}>{task.title}</span>
                {task.scheduledTime ? <time>{task.scheduledTime}</time> : null}
              </li>
            ))}
          </ul>
        )}

        {completedTasks.length > 0 ? (
          <details className={styles.completed}>
            <summary>
              <ChevronDown aria-hidden="true" size={17} />
              完了したこと <span>{completedTasks.length}</span>
            </summary>
            <ul role="list">
              {completedTasks.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    aria-label={`「${task.title}」を未完了に戻す`}
                    onClick={() => void port.setTaskCompleted({ completed: false, taskId: task.id })}
                  >
                    <Check aria-hidden="true" size={15} />
                  </button>
                  <span>{task.title}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </main>
  )
}
