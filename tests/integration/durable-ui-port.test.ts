import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DurableUiPort, type DurableUiPortDiagnostics } from '@/app/durable-ui-port'
import type { ExportCollections } from '@/application/import-export'
import { WebCryptoCanonicalHasher } from '@/infrastructure/canonical-json'
import { GrimoireDatabase } from '@/infrastructure/dexie/schema'
import { buildExportEnvelope } from '@/infrastructure/versioned-export'
import { ianaTimeZone, isoInstant } from '@/domain/primitives'

describe('durable UI composition', () => {
  let databaseName: string
  let databaseNames: Set<string>
  let ports: DurableUiPort[]

  beforeEach(() => {
    databaseName = `grimoire-ui-${crypto.randomUUID()}`
    databaseNames = new Set([databaseName])
    ports = []
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: async () => ({ quota: 1_000_000, usage: 2_000 }),
        persisted: async () => false,
        persist: async () => true,
      },
    })
  })

  afterEach(async () => {
    for (const port of ports) port.dispose()
    for (const name of databaseNames) {
      const database = new GrimoireDatabase(name)
      await database.delete()
    }
    window.localStorage.clear()
  })

  function port(name = databaseName, diagnostics?: DurableUiPortDiagnostics): DurableUiPort {
    databaseNames.add(name)
    const instance = new DurableUiPort(name, diagnostics)
    ports.push(instance)
    return instance
  }

  it('survives reload with task, completion, rewards, growth, inventory and preferences intact', async () => {
    const first = port()
    await first.initialize()
    expect(first.getSnapshot().bootstrap.status).toBe('ready')

    await first.createTodayTask({ title: '  水槽を観察する  ' })
    const created = first.getSnapshot().tasksToday[0]
    expect(created?.title).toBe('水槽を観察する')
    expect(created?.completed).toBe(false)
    expect(first.getSnapshot().rewardNotice).toEqual(expect.objectContaining({
      kind: 'created',
      presentation: 'mini',
    }))
    await first.dismissRewardNotice()
    expect(first.getSnapshot().rewardNotice).toBeNull()

    await first.setTaskCompleted({ completed: true, taskId: created!.id })
    const completionNotice = first.getSnapshot().rewardNotice
    expect(completionNotice).toEqual(expect.objectContaining({ kind: 'completed' }))
    expect(completionNotice?.presentation).toBe(
      completionNotice?.firstDiscovery ? 'sheet' : 'mini',
    )
    await first.updatePreferences({ colorScheme: 'dark', splashMode: 'off' })
    expect(first.getSnapshot().tasksToday[0]?.completed).toBe(true)
    expect(window.localStorage.getItem('grimoire:preference:splash-mode')).toBe('off')
    first.dispose()

    const second = port()
    await second.initialize()
    const restored = second.getSnapshot()
    expect(restored.tasksToday).toEqual([
      expect.objectContaining({ completed: true, title: '水槽を観察する' }),
    ])
    expect(restored.preferences).toEqual(
      expect.objectContaining({ colorScheme: 'dark', splashMode: 'off' }),
    )

    const database = new GrimoireDatabase(databaseName)
    await database.open()
    await expect(database.rewardLedger.count()).resolves.toBe(2)
    await expect(database.growthLedger.count()).resolves.toBe(1)
    const inventory = await database.inventory.toArray()
    expect(inventory.reduce((total, row) => total + row.quantity, 0)).toBe(2)
    database.close()
  })

  it('loads only the requested calendar window and accepts persistence by user gesture', async () => {
    const instance = port()
    await instance.initialize()
    await instance.createTodayTask({ title: '今日の記録' })

    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const fromLocalDate = `${year}-${month}-01`
    const toLocalDate = `${year}-${month}-${new Date(year, today.getMonth() + 1, 0).getDate()}`
    await instance.loadCalendarRange({ fromLocalDate, toLocalDate })

    expect(instance.getSnapshot().calendarEntries).toHaveLength(1)
    await expect(instance.requestPersistentStorage()).resolves.toBe(true)
    expect(instance.getSnapshot().storageHealth.persistence).toBe('not-granted')
  })

  it('does not repeat the active-task query or recurrence projection for routine refreshes', async () => {
    let taskQueries = 0
    let projectionRebuilds = 0
    const instance = port(databaseName, {
      onActiveTaskQuery: () => { taskQueries += 1 },
      onTaskProjectionRebuild: () => { projectionRebuilds += 1 },
    })

    await instance.initialize()
    await instance.createTodayTask({ title: '差分投影を確認する' })
    const created = instance.getSnapshot().tasksToday[0]
    await instance.setTaskCompleted({ completed: true, taskId: created!.id })
    await instance.updatePreferences({ motion: 'reduced' })
    await instance.requestPersistentStorage()

    expect({ projectionRebuilds, taskQueries }).toEqual({ projectionRebuilds: 1, taskQueries: 1 })
    expect(instance.getSnapshot().tasksToday).toEqual([
      expect.objectContaining({ completed: true, title: '差分投影を確認する' }),
    ])
  })

  it('previews and atomically restores an export while keeping the replaced data as a snapshot', async () => {
    const sourceName = `grimoire-source-${crypto.randomUUID()}`
    const source = port(sourceName)
    await source.initialize()
    await source.createTodayTask({ title: '復元する観察記録' })
    const sourceTask = source.getSnapshot().tasksToday[0]
    await source.setTaskCompleted({ completed: true, taskId: sourceTask!.id })

    const sourceDatabase = new GrimoireDatabase(sourceName)
    await sourceDatabase.open()
    const collections: ExportCollections = {
      tasks: await sourceDatabase.tasks.toArray(),
      taskOccurrences: await sourceDatabase.taskOccurrences.toArray(),
      commandReceipts: await sourceDatabase.commandReceipts.toArray(),
      domainEvents: await sourceDatabase.domainEvents.toArray(),
      outbox: await sourceDatabase.outbox.toArray(),
      rewardLedger: await sourceDatabase.rewardLedger.toArray(),
      growthLedger: await sourceDatabase.growthLedger.toArray(),
      inventory: await sourceDatabase.inventory.toArray(),
      settings: await sourceDatabase.settings.toArray(),
    }
    const envelope = await buildExportEnvelope(
      collections,
      {
        appVersion: 'test',
        exportedAt: isoInstant(new Date().toISOString()),
        timeZone: ianaTimeZone('Asia/Tokyo'),
      },
      new WebCryptoCanonicalHasher(),
    )
    sourceDatabase.close()

    const target = port()
    await target.initialize()
    await target.createTodayTask({ title: '置き換え前の記録' })
    const preview = await target.prepareImport(JSON.stringify(envelope))
    expect(preview).toEqual(expect.objectContaining({
      available: true,
      rewardCount: 2,
      taskCount: 1,
    }))

    const result = await target.activatePreparedImport(preview.runId!)
    expect(result).toEqual({ activated: true, importedTaskCount: 1 })
    expect(target.getSnapshot().tasksToday).toEqual([
      expect.objectContaining({ completed: true, title: '復元する観察記録' }),
    ])

    const targetDatabase = new GrimoireDatabase(databaseName)
    await targetDatabase.open()
    const snapshots = await targetDatabase.localSnapshots.toArray()
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.id).toMatch(/^pre-import:/)
    expect(snapshots[0]?.json).toContain('置き換え前の記録')
    targetDatabase.close()
  })
})
