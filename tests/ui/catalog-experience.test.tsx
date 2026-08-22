import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { AppPortProvider } from '@/app/app-context'
import { CatalogExperience } from '@/features/catalog'

import { TestUiPort } from './test-port'

afterEach(cleanup)

function renderCatalog(port: TestUiPort) {
  render(
    <AppPortProvider port={port}>
      <CatalogExperience />
    </AppPortProvider>,
  )
}

describe('CatalogExperience', () => {
  it('lists only discovered specimens and opens one as a full record', () => {
    renderCatalog(
      new TestUiPort({
        catalogDiscoveries: [
          {
            firstDiscoveredAt: '2026-08-01T00:00:00.000Z',
            itemId: 'flora-00',
            lastDiscoveredAt: '2026-08-03T00:00:00.000Z',
            quantity: 2,
          },
        ],
      }),
    )

    expect(screen.getByRole('button', { name: /月白の露花/ })).toBeTruthy()
    // An undiscovered item leaves no empty slot behind (決定事項ログ M-10).
    expect(screen.queryByText('灯し胞子茸')).toBeNull()
    expect(screen.queryByText(/720/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /月白の露花/ }))
    const record = screen.getByRole('dialog', { name: '月白の露花' })
    expect(record).toBeTruthy()
    expect(screen.getByText(/夜明け前だけ花弁/)).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('says so plainly when nothing has been collected yet', () => {
    renderCatalog(new TestUiPort())

    expect(screen.getByText(/まだ何も収めていません/)).toBeTruthy()
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('keeps unobserved creature records as silhouettes without a total', () => {
    renderCatalog(
      new TestUiPort({
        creatureObservations: [
          { id: 'stage-egg', observedAt: '2026-08-02T00:00:00.000Z' },
          { id: 'gesture-yawn', observedAt: null },
        ],
      }),
    )

    fireEvent.click(screen.getByRole('tab', { name: 'グリモ' }))

    expect(screen.getByText('卵')).toBeTruthy()
    expect(screen.getByText(/氷とも水晶ともつかない/)).toBeTruthy()

    // Every other record is present but unnamed — the journal suggests there is
    // more animal, and never states how much is left (決定事項ログ M-11).
    expect(screen.queryByText('あくび')).toBeNull()
    expect(screen.getAllByText('未観察').length).toBeGreaterThan(1)
    expect(screen.queryByText(/\d+ *\/ *\d+/)).toBeNull()
  })
})
