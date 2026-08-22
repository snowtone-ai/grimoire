import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  DurableUiPort,
  type DurableUiPortDiagnostics,
  type DurableUiPortIntegrations,
} from '@/app/durable-ui-port'
import type { ExportCollections } from '@/application/import-export'
import type { GoogleIntegrationPort } from '@/application/ports'
import { WebCryptoCanonicalHasher } from '@/infrastructure/canonical-json'
import { GrimoireDatabase } from '@/infrastructure/dexie/schema'
import { buildExportEnvelope } from '@/infrastructure/versioned-export'
import { ianaTimeZone, isoInstant } from '@/domain/primitives'
import { DEFAULT_AREA_ID } from '@/world/areas'

function todayLocalDate(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

  function port(
    name = databaseName,
    diagnostics?: DurableUiPortDiagnostics,
    integrations?: DurableUiPortIntegrations,
  ): DurableUiPort {
    databaseNames.add(name)
    const instance = new DurableUiPort(name, diagnostics, integrations)
    ports.push(instance)
    return instance
  }

  it('survives reload with task, completion, rewards, growth, inventory and preferences intact', async () => {
    const first = port()
    await first.initialize()
    expect(first.getSnapshot().bootstrap.status).toBe('ready')

    await first.createTask({
      categoryId: null,
      localDate: todayLocalDate(),
      recurrence: null,
      title: '  水槽を観察する  ',
    })
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
    await instance.createTask({
      categoryId: null,
      localDate: todayLocalDate(),
      recurrence: null,
      title: '今日の記録',
    })

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
    await instance.createTask({
      categoryId: null,
      localDate: todayLocalDate(),
      recurrence: null,
      title: '差分投影を確認する',
    })
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
    await source.createTask({
      categoryId: null,
      localDate: todayLocalDate(),
      recurrence: null,
      title: '復元する観察記録',
    })
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
      creatureObservations: await sourceDatabase.creatureObservations.toArray(),
      externalTaskLinks: await sourceDatabase.externalTaskLinks.toArray(),
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
    await target.createTask({
      categoryId: null,
      localDate: todayLocalDate(),
      recurrence: null,
      title: '置き換え前の記録',
    })
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

  it('edits a task in place, updating both today and the calendar projection, and clears an omitted description', async () => {
    const instance = port()
    await instance.initialize()
    await instance.createTask({
      categoryId: 'job',
      description: '朝のメモ',
      localDate: todayLocalDate(),
      recurrence: { frequency: 'daily', interval: 1 },
      scheduledTime: '08:30',
      title: '編集前のタスク',
    })
    const created = instance.getSnapshot().tasksToday[0]!
    expect(created).toMatchObject({
      categoryId: 'job',
      description: '朝のメモ',
      scheduledTime: '08:30',
    })

    await instance.updateTask({
      draft: {
        categoryId: 'life',
        localDate: todayLocalDate(),
        recurrence: null,
        scheduledTime: '21:00',
        title: '編集後のタスク',
      },
      taskId: created.id,
    })

    const updated = instance.getSnapshot().tasksToday[0]
    expect(updated).toMatchObject({
      categoryId: 'life',
      id: created.id,
      recurrence: null,
      scheduledTime: '21:00',
      title: '編集後のタスク',
    })
    expect(updated?.description).toBeUndefined()
    expect(instance.getSnapshot().calendarEntries).toEqual([
      expect.objectContaining({ categoryId: 'life', title: '編集後のタスク' }),
    ])
  })

  it('reflects a completion and a reopen in the calendar projection without rebuilding it', async () => {
    let projectionRebuilds = 0
    const instance = port(databaseName, {
      onTaskProjectionRebuild: () => { projectionRebuilds += 1 },
    })
    await instance.initialize()
    const today = todayLocalDate()
    await instance.createTask({
      categoryId: null,
      localDate: today,
      recurrence: null,
      title: 'カレンダーから完了する',
    })
    const entry = instance.getSnapshot().calendarEntries[0]!
    expect(entry).toMatchObject({ completed: false, localDate: today })

    await instance.setTaskCompleted({ completed: true, localDate: today, taskId: entry.taskId })
    expect(instance.getSnapshot().calendarEntries).toEqual([
      expect.objectContaining({ completed: true, title: 'カレンダーから完了する' }),
    ])

    await instance.setTaskCompleted({ completed: false, localDate: today, taskId: entry.taskId })
    expect(instance.getSnapshot().calendarEntries).toEqual([
      expect.objectContaining({ completed: false, title: 'カレンダーから完了する' }),
    ])
    // Completion is occurrence state, not task state: it must reach the view
    // through the cached projection rather than by re-deriving recurrence.
    expect(projectionRebuilds).toBe(1)
  })

  it('deletes a task, removing it from today and the calendar while leaving other tasks intact', async () => {
    const instance = port()
    await instance.initialize()
    await instance.createTask({
      categoryId: null,
      localDate: todayLocalDate(),
      recurrence: null,
      title: '残すタスク',
    })
    await instance.createTask({
      categoryId: null,
      localDate: todayLocalDate(),
      recurrence: null,
      title: '消すタスク',
    })
    const toRemove = instance.getSnapshot().tasksToday.find((task) => task.title === '消すタスク')!

    await instance.deleteTask({ taskId: toRemove.id })

    expect(instance.getSnapshot().tasksToday).toEqual([
      expect.objectContaining({ title: '残すタスク' }),
    ])
    expect(instance.getSnapshot().calendarEntries).toEqual([
      expect.objectContaining({ title: '残すタスク' }),
    ])
    await expect(instance.deleteTask({ taskId: 'task:does-not-exist' })).rejects.toThrow()
  })

  it('persists the selected area across reload and falls back to the default for an unknown stored ID', async () => {
    const first = port()
    await first.initialize()
    expect(first.getSnapshot().world.selectedAreaId).toBe(DEFAULT_AREA_ID)
    await first.selectArea({ areaId: DEFAULT_AREA_ID })
    expect(first.getSnapshot().world.selectedAreaId).toBe(DEFAULT_AREA_ID)
    first.dispose()

    const database = new GrimoireDatabase(databaseName)
    await database.open()
    await database.settings.put({
      schemaVersion: 1,
      key: 'world:selected-area-id',
      value: 'area-that-no-longer-exists',
      updatedAt: isoInstant(new Date().toISOString()),
    })
    database.close()

    const second = port()
    await second.initialize()
    expect(second.getSnapshot().world.selectedAreaId).toBe(DEFAULT_AREA_ID)
  })

  it('tracks the creature observation journal: full unobserved roster, unread count, idempotent recording, and read-clearing', async () => {
    const instance = port()
    await instance.initialize()
    const initial = instance.getSnapshot()
    expect(initial.creatureObservations).toHaveLength(9)
    expect(initial.creatureObservations.every((record) => record.observedAt === null)).toBe(true)
    expect(initial.world.unreadObservationCount).toBe(0)

    await instance.recordCreatureObservation('stage-egg')
    expect(instance.getSnapshot().world.unreadObservationCount).toBe(1)
    const firstObservedAt = instance
      .getSnapshot()
      .creatureObservations.find((record) => record.id === 'stage-egg')?.observedAt
    expect(firstObservedAt).not.toBeNull()

    await instance.recordCreatureObservation('stage-egg')
    expect(instance.getSnapshot().world.unreadObservationCount).toBe(1)
    expect(
      instance.getSnapshot().creatureObservations.find((record) => record.id === 'stage-egg')
        ?.observedAt,
    ).toBe(firstObservedAt)

    await instance.recordCreatureObservation('gesture-breath')
    expect(instance.getSnapshot().world.unreadObservationCount).toBe(2)
    expect(instance.getSnapshot().creatureObservations).toHaveLength(9)

    await instance.markObservationsRead()
    expect(instance.getSnapshot().world.unreadObservationCount).toBe(0)
    expect(
      instance.getSnapshot().creatureObservations.find((record) => record.id === 'stage-egg')
        ?.observedAt,
    ).not.toBeNull()

    await expect(instance.recordCreatureObservation('not-a-real-record')).rejects.toThrow()
  })

  it('answers Google and notification integrations honestly as unavailable when none are injected', async () => {
    const instance = port()
    await instance.initialize()

    expect(instance.getSnapshot().googleLink).toEqual({
      calendarConnected: false,
      configured: false,
      gmailConnected: false,
      lastCalendarImportAt: null,
      lastGmailImportAt: null,
    })
    expect(instance.getSnapshot().notifications).toEqual({
      enabled: false,
      permission: 'unsupported',
      scheduledCount: 0,
    })

    await expect(instance.connectGoogle('calendar')).resolves.toEqual({
      connected: false,
      reason: expect.any(String),
    })
    expect(instance.getSnapshot().googleLink.calendarConnected).toBe(false)

    const today = todayLocalDate()
    await expect(
      instance.importFromGoogleCalendar({ fromLocalDate: today, toLocalDate: today }),
    ).resolves.toEqual({
      cancelled: false,
      imported: 0,
      reason: expect.any(String),
      skipped: 0,
    })
    await expect(instance.importFromGmail()).resolves.toEqual({
      cancelled: false,
      imported: 0,
      reason: expect.any(String),
      skipped: 0,
    })
    await expect(instance.requestNotificationPermission()).resolves.toBe('unsupported')

    await instance.setNotificationsEnabled(true)
    expect(instance.getSnapshot().notifications.enabled).toBe(true)
  })

  it('imports external calendar items once each, skipping already-imported items on a repeat import', async () => {
    const today = todayLocalDate()
    let fetchCount = 0
    const fakeGoogle: GoogleIntegrationPort = {
      isConfigured: () => true,
      connect: async () => ({ connected: true }),
      disconnect: async () => undefined,
      fetchCalendarEvents: async () => {
        fetchCount += 1
        return [
          { externalId: 'evt-1', localDate: today, scheduledTime: '10:00', title: '会議' },
          { externalId: 'evt-2', localDate: today, title: '面談' },
        ]
      },
      fetchGmailItems: async () => [],
    }
    const instance = port(databaseName, undefined, { google: fakeGoogle })
    await instance.initialize()

    const first = await instance.importFromGoogleCalendar({
      fromLocalDate: today,
      toLocalDate: today,
    })
    expect(first).toEqual({ cancelled: false, imported: 2, skipped: 0 })
    expect(instance.getSnapshot().tasksToday).toHaveLength(2)
    expect(instance.getSnapshot().googleLink.lastCalendarImportAt).not.toBeNull()

    const second = await instance.importFromGoogleCalendar({
      fromLocalDate: today,
      toLocalDate: today,
    })
    expect(second).toEqual({ cancelled: false, imported: 0, skipped: 2 })
    expect(instance.getSnapshot().tasksToday).toHaveLength(2)
    expect(fetchCount).toBe(2)
  })

  it('converges two independent port instances on the same durable store across create, update and delete', async () => {
    const tabB = port(databaseName)
    await tabB.initialize()
    expect(tabB.getSnapshot().tasksToday).toHaveLength(0)

    const tabA = port(databaseName)
    await tabA.initialize()
    await tabA.createTask({
      categoryId: null,
      localDate: todayLocalDate(),
      recurrence: null,
      title: 'Aタブが作成',
    })
    expect(tabA.getSnapshot().tasksToday).toHaveLength(1)
    expect(tabB.getSnapshot().tasksToday).toHaveLength(0)

    await tabB.retryBootstrap()
    expect(tabB.getSnapshot().tasksToday).toEqual([
      expect.objectContaining({ title: 'Aタブが作成' }),
    ])

    const sharedTaskId = tabB.getSnapshot().tasksToday[0]!.id
    await tabB.updateTask({
      draft: {
        categoryId: null,
        localDate: todayLocalDate(),
        recurrence: null,
        title: 'Bタブが更新',
      },
      taskId: sharedTaskId,
    })
    await tabA.retryBootstrap()
    expect(tabA.getSnapshot().tasksToday).toEqual([
      expect.objectContaining({ title: 'Bタブが更新' }),
    ])

    await tabA.deleteTask({ taskId: sharedTaskId })
    await tabB.retryBootstrap()
    expect(tabB.getSnapshot().tasksToday).toHaveLength(0)
  })
})
