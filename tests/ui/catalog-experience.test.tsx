import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { AppPortProvider } from '@/app/app-context'
import { CatalogExperience } from '@/features/catalog'

import { TestUiPort } from './test-port'

afterEach(cleanup)

describe('CatalogExperience', () => {
  it('shows discovered specimens only and opens their record', () => {
    const port = new TestUiPort({
      catalogDiscoveries: [{
        firstDiscoveredAt: '2026-08-01T00:00:00.000Z',
        itemId: 'flora-00',
        lastDiscoveredAt: '2026-08-03T00:00:00.000Z',
        quantity: 2,
      }],
    })
    render(
      <AppPortProvider port={port}>
        <CatalogExperience />
      </AppPortProvider>,
    )

    expect(screen.getByText('水の仔、卵の姿')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'アイテム' }))
    expect(screen.getByRole('button', { name: /月白の露花/ })).toBeTruthy()
    expect(screen.queryByText('灯し胞子茸')).toBeNull()
    expect(screen.queryByText(/720/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /月白の露花/ }))
    expect(screen.getByRole('dialog', { name: '月白の露花' })).toBeTruthy()
    expect(screen.getByText(/夜明け前だけ花弁/)).toBeTruthy()
  })
})
