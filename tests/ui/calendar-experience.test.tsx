import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppPortProvider } from '@/app/app-context'
import type { CalendarEntryView } from '@/app/ui-port'
import { CalendarExperience } from '@/features/calendar'

import { TestUiPort } from './test-port'

const TODAY = new Date('2026-08-22T09:00:00')

let port: TestUiPort

function entry(overrides: Partial<CalendarEntryView> = {}): CalendarEntryView {
  return {
    categoryId: null,
    completed: false,
    id: 'task-1:2026-08-25',
    localDate: '2026-08-25',
    recurrence: null,
    taskId: 'task-1',
    title: 'ゼミの発表資料',
    ...overrides,
  }
}

function mount(): void {
  render(
    <AppPortProvider port={port}>
      <CalendarExperience />
    </AppPortProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(TODAY)
  port = new TestUiPort()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/**
 * 決定事項ログ F-7 / F-9. These exercise the one thing the month grid exists
 * for: reaching a task on a day that is not today.
 */
describe('CalendarExperience', () => {
  it('completes the task the entry belongs to, on the day it was opened', async () => {
    // Regression: `CalendarEntryView.id` is a composite of task id and
    // occurrence date, and the screen fed it straight back as a task id. The
    // store has no such row, so every completion from the calendar failed with
    // 「対象のタスクが見つかりません。」 — swallowed into an error sound, with
    // the checkbox snapping back and nothing saved.
    port.setCalendarEntries([entry()])
    const setTaskCompleted = vi.spyOn(port, 'setTaskCompleted')
    mount()

    await userEvent.click(await screen.findByRole('gridcell', { name: /8月25日/u }))
    await userEvent.click(
      await screen.findByRole('checkbox', { name: 'ゼミの発表資料を完了にする' }),
    )

    await waitFor(() =>
      expect(setTaskCompleted).toHaveBeenCalledWith({
        completed: true,
        localDate: '2026-08-25',
        taskId: 'task-1',
      }),
    )
  })

  it('edits the task the entry belongs to, not a row named after the occurrence', async () => {
    port.setCalendarEntries([entry()])
    const updateTask = vi.spyOn(port, 'updateTask')
    mount()

    await userEvent.click(await screen.findByRole('gridcell', { name: /8月25日/u }))
    await userEvent.click(await screen.findByRole('button', { name: 'ゼミの発表資料' }))
    await userEvent.click(screen.getByRole('button', { name: '直す' }))

    await waitFor(() => expect(updateTask).toHaveBeenCalled())
    expect(updateTask.mock.calls[0]?.[0].taskId).toBe('task-1')
  })
})
