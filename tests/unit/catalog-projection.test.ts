import { describe, expect, it } from 'vitest'

import { projectCatalogDiscoveries } from '@/app/catalog-projection'
import type { InventoryRow } from '@/application/ports'
import { isoInstant } from '@/domain/primitives'

describe('catalog projection', () => {
  it('reads materialized discovery bounds without scanning the reward ledger', () => {
    const inventory: InventoryRow[] = [
      {
        schemaVersion: 1,
        itemId: 'a',
        quantity: 3,
        firstDiscoveredAt: isoInstant('2026-08-19T01:00:00.000Z'),
        lastDiscoveredAt: isoInstant('2026-08-19T03:00:00.000Z'),
        updatedAt: isoInstant('2026-08-19T03:00:00.000Z'),
      },
      {
        schemaVersion: 1,
        itemId: 'b',
        quantity: 1,
        firstDiscoveredAt: isoInstant('2026-08-19T04:00:00.000Z'),
        lastDiscoveredAt: isoInstant('2026-08-19T04:00:00.000Z'),
        updatedAt: isoInstant('2026-08-19T04:00:00.000Z'),
      },
    ]

    expect(projectCatalogDiscoveries(inventory)).toEqual([
      expect.objectContaining({
        firstDiscoveredAt: '2026-08-19T01:00:00.000Z',
        itemId: 'a',
        lastDiscoveredAt: '2026-08-19T03:00:00.000Z',
        quantity: 3,
      }),
      expect.objectContaining({
        firstDiscoveredAt: '2026-08-19T04:00:00.000Z',
        itemId: 'b',
        lastDiscoveredAt: '2026-08-19T04:00:00.000Z',
        quantity: 1,
      }),
    ])
  })
})
