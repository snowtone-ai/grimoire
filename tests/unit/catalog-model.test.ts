import { describe, expect, it } from 'vitest'

import {
  CATALOG_CATEGORIES,
  CATALOG_TOTAL_CAPACITY,
  normalizeCatalogDefinitions,
  resolveDiscoveredCatalog,
} from '@/features/catalog'

function completeDefinitions() {
  return CATALOG_CATEGORIES.flatMap((category) => Array.from({ length: 60 }, (_, sortOrder) => ({
    schema: 1,
    id: `${category.id}-${sortOrder}`,
    name: `${category.label} ${sortOrder}`,
    categoryId: category.id,
    description: `${category.label}の検証用標本`,
    sortOrder,
    art: {
      src: '/brand/grimoire-seal.svg',
      alt: `${category.label}の標本`,
      width: 512,
      height: 512,
    },
  })))
}

describe('catalog contracts', () => {
  it('accepts exactly 12 categories by 60 stable slots as a complete corpus', () => {
    const definitions = normalizeCatalogDefinitions(completeDefinitions(), { requireComplete: true })
    expect(definitions).toHaveLength(CATALOG_TOTAL_CAPACITY)
    expect(new Set(definitions.map(({ id }) => id)).size).toBe(CATALOG_TOTAL_CAPACITY)
  })

  it('rejects an incomplete corpus when completeness is claimed', () => {
    expect(() => normalizeCatalogDefinitions(completeDefinitions().slice(1), { requireComplete: true }))
      .toThrow(/720/)
  })

  it('returns only discovered definitions and reports retained orphan discoveries', () => {
    const definitions = completeDefinitions().slice(0, 2)
    const result = resolveDiscoveredCatalog(definitions, [
      {
        schema: 1,
        itemId: definitions[1]!.id,
        quantity: 2,
        firstDiscoveredAt: '2026-08-01T00:00:00.000Z',
        lastDiscoveredAt: '2026-08-03T00:00:00.000Z',
      },
      {
        schema: 1,
        itemId: 'definition-not-installed',
        quantity: 1,
        firstDiscoveredAt: '2026-08-02T00:00:00.000Z',
        lastDiscoveredAt: '2026-08-02T00:00:00.000Z',
      },
    ])

    expect(result.entries.map(({ definition }) => definition.id)).toEqual([definitions[1]!.id])
    expect(result.orphanedItemIds).toEqual(['definition-not-installed'])
  })
})
