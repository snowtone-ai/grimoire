import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppPortProvider } from '@/app/app-context'
import { SettingsExperience } from '@/features/settings'

import { TestUiPort } from './test-port'

afterEach(cleanup)

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
})

afterEach(() => vi.unstubAllGlobals())

function renderSettings(port: TestUiPort) {
  render(
    <AppPortProvider port={port}>
      <SettingsExperience />
    </AppPortProvider>,
  )
}

describe('SettingsExperience', () => {
  it('records a display preference as one exclusive radio group', () => {
    const port = new TestUiPort()
    renderSettings(port)

    const scheme = within(screen.getByRole('group', { name: '配色' }))
    const dark = scheme.getByRole('radio', { name: '暗い' }) as HTMLInputElement
    expect(dark.checked).toBe(false)

    fireEvent.click(dark)

    expect(port.getSnapshot().preferences.colorScheme).toBe('dark')
    expect((scheme.getByRole('radio', { name: 'システム' }) as HTMLInputElement).checked).toBe(
      false,
    )
    // The other groups are separate preferences and must not have moved.
    expect(port.getSnapshot().preferences.motion).toBe('full')
    const motion = within(screen.getByRole('group', { name: '動き' }))
    expect((motion.getByRole('radio', { name: '標準' }) as HTMLInputElement).checked).toBe(true)
  })

  it('keeps BGM and effects independently switchable (決定事項ログ F-3)', () => {
    const port = new TestUiPort()
    renderSettings(port)

    fireEvent.click(screen.getByRole('switch', { name: /効果音/ }))

    expect(port.getSnapshot().preferences.sfxEnabled).toBe(false)
    expect(port.getSnapshot().preferences.bgmEnabled).toBe(true)
  })

  it('explains a refused notification permission instead of showing it as on', async () => {
    const port = new TestUiPort()
    renderSettings(port)

    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: /時刻付きタスクの通知/ }))
    })

    expect(port.getSnapshot().notifications.enabled).toBe(false)
    expect(
      (screen.getByRole('switch', { name: /時刻付きタスクの通知/ }) as HTMLButtonElement)
        .getAttribute('aria-checked'),
    ).toBe('false')
    expect(screen.getByRole('status').textContent).toMatch(/ブロックされています/)
  })

  it('reports an unavailable export honestly rather than claiming success', async () => {
    renderSettings(new TestUiPort())

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '書き出す' }))
    })

    expect(screen.getByRole('status').textContent).toBe('test unavailable')
  })

  it('says when Google is not configured, and offers nothing to connect', () => {
    renderSettings(new TestUiPort())

    expect(screen.getByText(/Google 連携が構成されていません/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: '接続する' })).toBeNull()
  })

  it('disables the migration action while there is nothing to migrate', () => {
    renderSettings(new TestUiPort())

    const migrate = screen.getByRole('button', { name: '移行する' }) as HTMLButtonElement
    expect(migrate.disabled).toBe(true)
    expect(screen.getByText(/以前のバージョンから移せるデータはありません/)).toBeTruthy()
  })
})
