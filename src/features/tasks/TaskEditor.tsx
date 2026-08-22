'use client'

import { useState, type FormEvent } from 'react'

import type { TaskDraft, TaskRowView } from '@/app/ui-port'
import { useSound } from '@/audio'
import { Button } from '@/ui/components/button'
import { Chip } from '@/ui/components/chip'
import { SelectInput, TextArea, TextInput } from '@/ui/components/field'
import { Sheet } from '@/ui/components/sheet'

import { TASK_CATEGORIES } from './category'
import { ISO_WEEKDAYS, isoWeekdayLabel, isoWeekdayOf } from './local-date'
import {
  buildRecurrence,
  initialWeekday,
  REPEAT_CHOICES,
  repeatChoiceOf,
  type RepeatChoice,
} from './recurrence-form'
import styles from './task-editor.module.css'

const TITLE_LIMIT = 240

export interface TaskEditorProps {
  /** Present when editing; absent when writing a new task. */
  readonly task?: TaskRowView | undefined
  readonly defaultLocalDate: string
  readonly onCancel: () => void
  readonly onDelete?: ((taskId: string) => Promise<void>) | undefined
  readonly onSubmit: (draft: TaskDraft) => Promise<void>
  readonly open: boolean
}

export function TaskEditor({
  defaultLocalDate,
  onCancel,
  onDelete,
  onSubmit,
  open,
  task,
}: TaskEditorProps) {
  const editing = task !== undefined
  const initialDate = defaultLocalDate

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [localDate, setLocalDate] = useState(initialDate)
  const [scheduledTime, setScheduledTime] = useState(task?.scheduledTime ?? '')
  const [categoryId, setCategoryId] = useState(task?.categoryId ?? null)
  const [repeat, setRepeat] = useState<RepeatChoice>(repeatChoiceOf(task?.recurrence ?? null))
  const [weekday, setWeekday] = useState(
    initialWeekday(task?.recurrence ?? null, initialDate),
  )
  const [titleError, setTitleError] = useState<string | undefined>(undefined)
  const [formError, setFormError] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const play = useSound()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    setTitleError(undefined)
    setFormError(undefined)

    if (trimmed.length === 0) {
      setTitleError('タイトルを入力してください。')
      play('error')
      return
    }
    if (trimmed.length > TITLE_LIMIT) {
      setTitleError(`タイトルは${TITLE_LIMIT}文字までです。`)
      play('error')
      return
    }
    if (localDate.length === 0) {
      setFormError('日付を選んでください。')
      play('error')
      return
    }

    setBusy(true)
    try {
      // An empty optional field is *absent* from the draft, never present as
      // undefined: the data layer treats the two differently when patching.
      await onSubmit({
        categoryId,
        localDate,
        recurrence: buildRecurrence(repeat, localDate, weekday),
        title: trimmed,
        ...(description.trim() === '' ? {} : { description: description.trim() }),
        ...(scheduledTime === '' ? {} : { scheduledTime }),
      })
    } catch {
      // The save failed, so nothing may look as if it succeeded (docs/vision.md's
      // trust promise). The sheet stays open with the user's input intact.
      setFormError('保存できませんでした。もう一度お試しください。')
      play('error')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (task === undefined || onDelete === undefined) return
    setBusy(true)
    try {
      await onDelete(task.id)
    } catch {
      setFormError('削除できませんでした。もう一度お試しください。')
      play('error')
    } finally {
      setBusy(false)
      setConfirmingDelete(false)
    }
  }

  return (
    <>
      <Sheet
        open={open && !confirmingDelete}
        onClose={onCancel}
        title={editing ? 'タスクを直す' : '今日のタスクを書く'}
        description={
          editing ? undefined : '日付を変えれば、先の予定としても書き留められます。'
        }
        footer={
          <>
            {editing && onDelete !== undefined ? (
              <Button
                tone="danger"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
              >
                削除
              </Button>
            ) : null}
            <Button tone="quiet" onClick={onCancel} disabled={busy}>
              やめる
            </Button>
            <Button tone="solid" type="submit" form="task-editor" disabled={busy}>
              {editing ? '直す' : '書き留める'}
            </Button>
          </>
        }
      >
        <form id="task-editor" className={styles.form} onSubmit={handleSubmit} noValidate>
          {formError === undefined ? null : (
            <p className={styles.formError} role="alert">
              {formError}
            </p>
          )}
          <TextInput
            label="タイトル"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={TITLE_LIMIT}
            autoComplete="off"
            enterKeyHint="done"
            error={titleError}
            required
          />

          <div className={styles.pair}>
            <TextInput
              label="日付"
              type="date"
              value={localDate}
              onChange={(event) => {
                setLocalDate(event.target.value)
                if (event.target.value !== '') {
                  setWeekday(isoWeekdayOf(event.target.value))
                }
              }}
              required
            />
            <TextInput
              label="時刻"
              type="time"
              value={scheduledTime}
              onChange={(event) => setScheduledTime(event.target.value)}
              hint="未入力なら終日"
            />
          </div>

          <fieldset className={styles.group}>
            <legend className={styles.legend}>分類</legend>
            <div className={styles.chips}>
              <Chip pressed={categoryId === null} onClick={() => setCategoryId(null)}>
                なし
              </Chip>
              {TASK_CATEGORIES.map((category) => (
                <Chip
                  key={category.id}
                  pressed={categoryId === category.id}
                  swatch={category.swatch}
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.label}
                </Chip>
              ))}
            </div>
          </fieldset>

          <div className={styles.pair}>
            <SelectInput
              label="繰り返し"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value as RepeatChoice)}
            >
              {REPEAT_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </SelectInput>
            {repeat === 'weekly' ? (
              <SelectInput
                label="曜日"
                value={String(weekday)}
                onChange={(event) => setWeekday(Number(event.target.value))}
              >
                {ISO_WEEKDAYS.map((day) => (
                  <option key={day} value={day}>
                    {isoWeekdayLabel(day)}曜日
                  </option>
                ))}
              </SelectInput>
            ) : null}
          </div>

          <TextArea
            label="メモ"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            hint="任意。あとから読み返すための覚え書き。"
          />
        </form>
      </Sheet>

      <Sheet
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        placement="center"
        title="このタスクを削除しますか"
        description="受け取った標本とグリモの成長は、削除しても取り消されません。"
        footer={
          <>
            <Button tone="quiet" onClick={() => setConfirmingDelete(false)} disabled={busy}>
              やめる
            </Button>
            <Button tone="danger" onClick={() => void handleDelete()} disabled={busy}>
              削除する
            </Button>
          </>
        }
      >
        <p className={styles.confirmBody}>{task?.title}</p>
      </Sheet>
    </>
  )
}
