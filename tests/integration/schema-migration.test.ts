import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import { DATABASE_V1_STORES, GrimoireDatabase } from '@/infrastructure/dexie/schema'

describe('database schema migration', () => {
  const databaseNames = new Set<string>()

  afterEach(async () => {
    await Promise.all([...databaseNames].map((name) => Dexie.delete(name)))
    databaseNames.clear()
  })

  it('materializes discovery bounds from the ledger in one v1 to v2 upgrade', async () => {
    const name = `grimoire-v1-${crypto.randomUUID()}`
    databaseNames.add(name)
    const oldDatabase = new Dexie(name)
    oldDatabase.version(1).stores(DATABASE_V1_STORES)
    await oldDatabase.open()
    await oldDatabase.table('inventory').add({
      schemaVersion: 1,
      itemId: 'item:a',
      quantity: 3,
      updatedAt: '2026-08-19T03:00:00.000Z',
    })
    await oldDatabase.table('rewardLedger').bulkAdd([
      reward('event:3', '2026-08-19T03:00:00.000Z'),
      reward('event:1', '2026-08-19T01:00:00.000Z'),
      reward('event:2', '2026-08-19T02:00:00.000Z'),
    ])
    oldDatabase.close()

    const upgraded = new GrimoireDatabase(name)
    await upgraded.open()

    await expect(upgraded.inventory.get('item:a')).resolves.toMatchObject({
      firstDiscoveredAt: '2026-08-19T01:00:00.000Z',
      lastDiscoveredAt: '2026-08-19T03:00:00.000Z',
      quantity: 3,
    })
    expect(upgraded.verno).toBe(3)
    upgraded.close()
  })

  it('backfills categoryId to null and adds the observation/external-link tables in the v3 upgrade', async () => {
    const name = `grimoire-v1-category-${crypto.randomUUID()}`
    databaseNames.add(name)
    const oldDatabase = new Dexie(name)
    oldDatabase.version(1).stores(DATABASE_V1_STORES)
    await oldDatabase.open()
    await oldDatabase.table('tasks').add({
      schemaVersion: 1,
      id: 'task-pre-category',
      seriesId: 'series-pre-category',
      title: 'カテゴリ導入前のタスク',
      schedule: {
        localDate: '2026-08-19',
        localTime: '09:00',
        timeZone: 'Asia/Tokyo',
      },
      recurrence: null,
      status: 'active',
      createdAt: '2026-08-19T00:00:00.000Z',
      updatedAt: '2026-08-19T00:00:00.000Z',
      origin: 'native',
    })
    oldDatabase.close()

    const upgraded = new GrimoireDatabase(name)
    await upgraded.open()

    expect(upgraded.verno).toBe(3)
    await expect(upgraded.tasks.get('task-pre-category' as never)).resolves.toMatchObject({
      categoryId: null,
      title: 'カテゴリ導入前のタスク',
    })
    await expect(upgraded.creatureObservations.count()).resolves.toBe(0)
    await expect(upgraded.externalTaskLinks.count()).resolves.toBe(0)

    await upgraded.creatureObservations.add({
      schemaVersion: 1,
      id: 'creature:sample',
      observedAt: '2026-08-19T00:00:00.000Z',
    } as never)
    await upgraded.externalTaskLinks.add({
      schemaVersion: 1,
      id: 'google-calendar:external-1',
      provider: 'google-calendar',
      externalId: 'external-1',
      taskId: 'task-pre-category',
      importedAt: '2026-08-19T00:00:00.000Z',
    } as never)
    await expect(upgraded.creatureObservations.count()).resolves.toBe(1)
    await expect(upgraded.externalTaskLinks.count()).resolves.toBe(1)

    upgraded.close()
  })
})

function reward(eventId: string, committedAt: string) {
  return {
    schemaVersion: 1,
    id: eventId,
    taskId: `task:${eventId}`,
    eventId,
    kind: 'created',
    itemId: 'item:a',
    committedAt,
  }
}
