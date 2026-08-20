import type { InventoryRow } from '@/application/ports'

import type { CatalogDiscoveryView } from './ui-port'

/**
 * Builds the catalog projection in O(inventory). Discovery bounds are a
 * committed inventory projection, so refresh never rescans the append-only
 * reward ledger as years of task history accumulate.
 */
export function projectCatalogDiscoveries(
  inventory: readonly InventoryRow[],
): readonly CatalogDiscoveryView[] {
  return Object.freeze(inventory.map((item) => {
    return Object.freeze({
      firstDiscoveredAt: item.firstDiscoveredAt,
      itemId: item.itemId,
      lastDiscoveredAt: item.lastDiscoveredAt,
      quantity: item.quantity,
    })
  }))
}
