import { cleanup, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppPortProvider } from '@/app/app-context'
import { CalendarExperience } from '@/features/calendar'
import { CatalogExperience } from '@/features/catalog'
import { GrimoExperience } from '@/features/grimo'
import { HomeExperience } from '@/features/home'
import { SettingsExperience } from '@/features/settings'

import { TestUiPort } from './test-port'

/**
 * The contract every screen owes the app shell, checked in one place so a new
 * screen cannot quietly skip it. The wordless-control rule is the important
 * one here: this interface is icons and glyphs almost everywhere, so a control
 * that reaches assistive technology with no name is not a small omission — it
 * is an unusable button (DESIGN.md §6.1, 決定事項ログ F-12).
 */
const SCREENS: readonly (readonly [string, ReactElement])[] = [
  ['ホーム', <HomeExperience key="home" />],
  ['カレンダー', <CalendarExperience key="calendar" />],
  ['グリモ', <GrimoExperience key="grimo" />],
  ['図鑑', <CatalogExperience key="catalog" />],
  ['設定', <SettingsExperience key="settings" />],
]

afterEach(cleanup)

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
})

afterEach(() => vi.unstubAllGlobals())

describe.each(SCREENS)('%s', (_label, element) => {
  function renderScreen() {
    render(<AppPortProvider port={new TestUiPort()}>{element}</AppPortProvider>)
  }

  it('offers the skip link exactly one landmark to land on', () => {
    renderScreen()

    const main = document.querySelectorAll('main#main-content')
    expect(main).toHaveLength(1)
  })

  it('has exactly one first-level heading', () => {
    renderScreen()

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('names every control it renders', () => {
    renderScreen()

    expect(screen.queryAllByRole('button', { name: '' })).toHaveLength(0)
    expect(screen.queryAllByRole('link', { name: '' })).toHaveLength(0)
    expect(screen.queryAllByRole('checkbox', { name: '' })).toHaveLength(0)
    expect(screen.queryAllByRole('switch', { name: '' })).toHaveLength(0)
  })
})
