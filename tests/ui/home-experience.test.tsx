import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppPortProvider } from '@/app/app-context'
import { HomeExperience } from '@/features/home'
import { todayLocalDate } from '@/features/tasks/local-date'

import { TestUiPort } from './test-port'

afterEach(cleanup)

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
})

afterEach(() => vi.unstubAllGlobals())

function renderHome(port: TestUiPort) {
  render(
    <AppPortProvider port={port}>
      <HomeExperience />
    </AppPortProvider>,
  )
}

async function writeTask(title: string) {
  fireEvent.click(screen.getByRole('button', { name: '今日のタスクを書く' }))
  fireEvent.change(screen.getByLabelText('タイトル'), { target: { value: title } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '書き留める' }))
  })
}

describe('HomeExperience', () => {
  it('writes a task dated today and lists it', async () => {
    const port = new TestUiPort()
    const createTask = vi.spyOn(port, 'createTask')
    renderHome(port)

    expect(screen.getByText(/今日の欄はまだ白紙です/)).toBeTruthy()

    await writeTask('水槽を観察する')

    expect(screen.getByText('水槽を観察する')).toBeTruthy()
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({ localDate: todayLocalDate(), title: '水槽を観察する' }),
    )
    // An untouched optional field is absent, not present-and-undefined.
    expect(createTask.mock.calls[0]?.[0]).not.toHaveProperty('scheduledTime')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('refuses an empty title without closing the sheet or writing anything', async () => {
    const port = new TestUiPort()
    renderHome(port)

    fireEvent.click(screen.getByRole('button', { name: '今日のタスクを書く' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '書き留める' }))
    })

    expect(screen.getByText('タイトルを入力してください。')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(port.getSnapshot().tasksToday).toHaveLength(0)
  })

  it('moves a completed task into the collapsed section', async () => {
    const port = new TestUiPort()
    renderHome(port)
    await writeTask('郵便を出す')

    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: '郵便を出すを完了にする' }))
    })

    const toggle = screen.getByRole('button', { name: /完了 1/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByText(/今日の分はすべて終えました/)).toBeTruthy()

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })

  it('asks before deleting, and never stacks the confirmation on the editor', async () => {
    const port = new TestUiPort()
    renderHome(port)
    await writeTask('古い予定')

    fireEvent.click(screen.getByRole('button', { name: /古い予定/ }))
    fireEvent.click(screen.getByRole('button', { name: '削除' }))

    // DESIGN.md §6.3: a sheet never stacks another sheet — the editor is gone,
    // replaced by the confirmation, so exactly one dialog is present.
    const dialogs = screen.getAllByRole('dialog')
    expect(dialogs).toHaveLength(1)
    expect(screen.getByText('このタスクを削除しますか')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '削除する' }))
    })

    expect(port.getSnapshot().tasksToday).toHaveLength(0)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
