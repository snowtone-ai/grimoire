import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ianaTimeZone, isoInstant } from '@/domain/primitives'
import { WebCryptoCanonicalHasher } from '@/infrastructure/canonical-json'
import { migrateLegacyDatabase } from '@/infrastructure/dexie/legacy-migration'
import { GrimoireDatabase } from '@/infrastructure/dexie/schema'

const hasher = new WebCryptoCanonicalHasher()
const now = isoInstant('2026-08-19T12:34:56.000Z')

describe('legacy TaskManagerDB migration', () => {
  let legacy: Dexie
  let target: GrimoireDatabase

  beforeEach(async () => {
    await Dexie.delete('TaskManagerDB')
    legacy = new Dexie('TaskManagerDB')
    legacy.version(3).stores({
      tasks: 'id, dueDate, category, completed, recurrence',
      streaks: 'date',
      plantState: '++id',
      drops: '++id, taskId, dateKey, rarity, &[taskId+dateKey]',
    })
    await legacy.open()
    target = new GrimoireDatabase(`legacy-target-${crypto.randomUUID()}`)
    await target.open()
  })

  afterEach(async () => {
    legacy.close()
    await Dexie.delete('TaskManagerDB')
    target.close()
    await target.delete()
  })

  it('snapshots every old store, migrates tasks atomically, keeps old data and is idempotent', async () => {
    await legacy.table('tasks').add({
      id: 'old task/1',
      title: '以前の水やり',
      description: '旧版から残す',
      dueDate: '2026-08-19',
      dueTime: null,
      category: 'life',
      completed: true,
      completedAt: '2026-08-19T01:00:00.000Z',
      recurrence: 'none',
      createdAt: '2026-08-18T01:00:00.000Z',
    })
    await legacy.table('plantState').add({ lifetimeCompleted: 30, monthlyCompleted: 2 })
    await legacy.table('drops').add({
      taskId: 'old task/1',
      dateKey: '2026-08-19',
      dropId: 'old-drop',
      rarity: 1,
      at: '2026-08-19T01:00:00.000Z',
    })

    const result = await migrateLegacyDatabase(target, hasher, {
      now,
      timeZone: ianaTimeZone('Asia/Tokyo'),
    })

    expect(result).toEqual(expect.objectContaining({ migrated: true, migratedTaskCount: 1 }))
    await expect(target.tasks.count()).resolves.toBe(1)
    await expect(target.taskOccurrences.count()).resolves.toBe(1)
    await expect(target.rewardLedger.count()).resolves.toBe(0)
    await expect(target.growthLedger.count()).resolves.toBe(0)
    const snapshot = await target.localSnapshots.get(result.snapshotId)
    expect(JSON.parse(snapshot!.json).stores).toEqual(
      expect.objectContaining({ drops: expect.any(Array), plantState: expect.any(Array) }),
    )
    await expect(legacy.table('tasks').count()).resolves.toBe(1)

    const repeated = await migrateLegacyDatabase(target, hasher, {
      now,
      timeZone: ianaTimeZone('Asia/Tokyo'),
    })
    expect(repeated).toEqual(expect.objectContaining({ migrated: false, reused: true }))
    await expect(target.tasks.count()).resolves.toBe(1)
  })

  it('retains the pre-migration snapshot and rolls back every converted task on invalid input', async () => {
    await legacy.table('tasks').bulkAdd([
      {
        id: 'valid',
        title: '有効',
        dueDate: '2026-08-19',
        dueTime: '09:00',
        category: 'life',
        completed: false,
        completedAt: null,
        recurrence: 'none',
        createdAt: '2026-08-18T01:00:00.000Z',
      },
      {
        id: 'broken',
        title: '壊れた日付',
        dueDate: 'not-a-date',
        dueTime: null,
        category: 'life',
        completed: false,
        completedAt: null,
        recurrence: 'none',
        createdAt: '2026-08-18T01:00:00.000Z',
      },
    ])

    await expect(
      migrateLegacyDatabase(target, hasher, {
        now,
        timeZone: ianaTimeZone('Asia/Tokyo'),
      }),
    ).rejects.toThrow()

    await expect(target.tasks.count()).resolves.toBe(0)
    await expect(target.taskOccurrences.count()).resolves.toBe(0)
    await expect(target.localSnapshots.count()).resolves.toBe(1)
    await expect(legacy.table('tasks').count()).resolves.toBe(2)
  })
})
