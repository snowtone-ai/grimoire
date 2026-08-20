'use client'

import {
  hashCompleteTaskOccurrenceCommand,
  hashCreateTaskCommand,
  hashReopenTaskOccurrenceCommand,
  TaskCommandService,
} from '@/application/commands'
import type { ExportCollections, ValidatedImport } from '@/application/import-export'
import type { Clock, SettingRow } from '@/application/ports'
import {
  commandId,
  ianaTimeZone,
  isoInstant,
  localDate,
  localTime,
  seriesId,
  taskId,
} from '@/domain/primitives'
import { isTaskOccurrence, makeOccurrenceKey, nextOccurrenceDate } from '@/domain/recurrence'
import { StableWeightedRewardPolicy } from '@/domain/rewards'
import type { TaskRecord } from '@/domain/tasks'
import { CATALOG_DEFINITIONS, CATALOG_REWARD_POOL } from '@/features/catalog/definitions'
import { WebCryptoCanonicalHasher } from '@/infrastructure/canonical-json'
import {
  activateStagedImport,
  inspectImportReferences,
} from '@/infrastructure/dexie/import-activation'
import { DexieImportStagingStore } from '@/infrastructure/dexie/import-staging'
import { migrateLegacyDatabase } from '@/infrastructure/dexie/legacy-migration'
import { DATABASE_VERSION, GrimoireDatabase } from '@/infrastructure/dexie/schema'
import { DexieAtomicStore } from '@/infrastructure/dexie/store'
import {
  inspectStorageHealth,
  requestPersistentStorageFromUserGesture,
} from '@/infrastructure/storage-health'
import { buildExportEnvelope, validateImportEnvelope } from '@/infrastructure/versioned-export'

import type {
  AppReadModel,
  AppUiPort,
  CalendarEntryView,
  PreferenceView,
  RewardNoticeView,
  TaskRowView,
} from './ui-port'
import { projectCatalogDiscoveries } from './catalog-projection'

export const SPLASH_PREFERENCE_CACHE_KEY = 'grimoire:preference:splash-mode'

interface TodayTaskProjection {
  readonly occurrenceKey: ReturnType<typeof makeOccurrenceKey>
  readonly row: TaskRowView
}

export interface DurableUiPortDiagnostics {
  readonly onActiveTaskQuery?: () => void
  readonly onTaskProjectionRebuild?: (taskCount: number) => void
}

const DATABASE_NAME = 'GrimoireDB'
const LEGACY_DATABASE_NAME = 'TaskManagerDB'
const APP_VERSION = '0.1.0'
const ALL_DAY_SENTINEL = '00:00'
const MAX_IMPORT_BYTES = 50 * 1_024 * 1_024

const DEFAULT_PREFERENCES: PreferenceView = Object.freeze({
  bgmEnabled: true,
  colorScheme: 'system',
  motion: 'system',
  sfxEnabled: true,
  splashMode: 'timed',
})

const DEFAULT_MODEL: AppReadModel = Object.freeze({
  bootstrap: Object.freeze({ phase: '端末内データ', status: 'loading' }),
  calendarEntries: Object.freeze([]),
  catalogDiscoveries: Object.freeze([]),
  migrationAvailable: false,
  migrationNoticeVisible: false,
  preferences: DEFAULT_PREFERENCES,
  rewardNotice: null,
  storageHealth: Object.freeze({
    databaseVersion: '確認中',
    lastExportAt: null,
    lastWriteAt: null,
    pendingOperations: 0,
    persistence: 'unknown',
    usageBytes: null,
  }),
  tasksToday: Object.freeze([]),
})

const preferenceKeys = {
  bgmEnabled: 'preference:bgm-enabled',
  colorScheme: 'preference:color-scheme',
  motion: 'preference:motion',
  sfxEnabled: 'preference:sfx-enabled',
  splashMode: 'preference:splash-mode',
} as const satisfies Record<keyof PreferenceView, string>

const rewardPolicy = new StableWeightedRewardPolicy(CATALOG_REWARD_POOL)
const catalogDefinitionById = new Map(CATALOG_DEFINITIONS.map((definition) => [definition.id, definition]))

const systemClock: Clock = {
  now: () => isoInstant(new Date().toISOString()),
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftLocalDate(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1 + days))
  date.setUTCDate(date.getUTCDate() + days)
  return formatUtcDate(date)
}

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function initialCalendarRange(): Readonly<{ from: string; to: string }> {
  const now = new Date()
  const first = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  const last = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0))
  return Object.freeze({ from: formatUtcDate(first), to: formatUtcDate(last) })
}

function randomId(prefix: string): string {
  return `${prefix}:${globalThis.crypto.randomUUID()}`
}

function isPreferenceValue<Key extends keyof PreferenceView>(
  key: Key,
  value: unknown,
): value is PreferenceView[Key] {
  if (key === 'bgmEnabled' || key === 'sfxEnabled') return typeof value === 'boolean'
  if (key === 'colorScheme') return value === 'system' || value === 'light' || value === 'dark'
  if (key === 'motion') return value === 'system' || value === 'full' || value === 'reduced'
  return value === 'off' || value === 'timed' || value === 'always'
}

function preferencesFromRows(rows: readonly SettingRow[]): PreferenceView {
  const values = new Map(rows.map((row) => [row.key, row.value]))
  const result = { ...DEFAULT_PREFERENCES }
  for (const key of Object.keys(preferenceKeys) as (keyof PreferenceView)[]) {
    const value = values.get(preferenceKeys[key])
    if (isPreferenceValue(key, value)) {
      Object.assign(result, { [key]: value })
    }
  }
  return Object.freeze(result)
}

function optionalInstant(rows: readonly SettingRow[], key: string): string | null {
  const value = rows.find((row) => row.key === key)?.value
  if (typeof value !== 'string') return null
  try {
    return isoInstant(value)
  } catch {
    return null
  }
}

async function legacyDatabaseExists(): Promise<boolean> {
  if (typeof indexedDB.databases !== 'function') return false
  try {
    const databases = await indexedDB.databases()
    return databases.some(({ name }) => name === LEGACY_DATABASE_NAME)
  } catch {
    return false
  }
}

function downloadJson(envelope: unknown, exportedAt: string): void {
  const json = `${JSON.stringify(envelope, null, 2)}\n`
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `grimoire-backup-${exportedAt.slice(0, 10)}.json`
  anchor.rel = 'noopener'
  anchor.click()
  URL.revokeObjectURL(url)
}

export class DurableUiPort implements AppUiPort {
  private readonly listeners = new Set<() => void>()
  private readonly hasher = new WebCryptoCanonicalHasher()
  private readonly pendingImports = new Map<string, ValidatedImport>()
  private database: GrimoireDatabase | null = null
  private commands: TaskCommandService | null = null
  private initialization: Promise<void> | null = null
  private calendarRange = initialCalendarRange()
  private activeTasks: readonly TaskRecord[] | null = null
  private calendarProjection: readonly CalendarEntryView[] = Object.freeze([])
  private todayProjection: readonly TodayTaskProjection[] = Object.freeze([])
  private projectionDate: string | null = null
  private projectionDirty = true
  private model: AppReadModel = DEFAULT_MODEL

  constructor(
    private readonly databaseName = DATABASE_NAME,
    private readonly diagnostics: DurableUiPortDiagnostics = {},
  ) {}

  getSnapshot = (): AppReadModel => this.model

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  initialize(): Promise<void> {
    this.initialization ??= this.openDatabase()
    return this.initialization
  }

  dispose(): void {
    this.database?.close()
    this.database = null
    this.commands = null
    this.initialization = null
    this.activeTasks = null
    this.projectionDirty = true
  }

  async retryBootstrap(): Promise<void> {
    this.database?.close()
    this.database = null
    this.commands = null
    this.initialization = null
    this.activeTasks = null
    this.projectionDirty = true
    this.model = {
      ...this.model,
      bootstrap: { phase: '端末内データ', status: 'loading' },
    }
    this.emit()
    await this.initialize()
  }

  async createTodayTask({ title }: { readonly title: string }): Promise<void> {
    const database = this.requireDatabase()
    const commands = this.requireCommands()
    const now = new Date()
    const rawTaskId = taskId(randomId('task'))
    const rawSeriesId = seriesId(randomId('series'))
    const timeZone = ianaTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    const commandWithoutHash = {
      kind: 'createTask' as const,
      commandId: commandId(randomId('command')),
      payload: {
        taskId: rawTaskId,
        seriesId: rawSeriesId,
        title,
        schedule: {
          localDate: localDate(formatLocalDate(now)),
          localTime: localTime(ALL_DAY_SENTINEL),
          timeZone,
        },
        recurrence: null,
      },
    }
    const result = await commands.createTask({
      ...commandWithoutHash,
      payloadHash: await hashCreateTaskCommand(commandWithoutHash, this.hasher),
    })
    const rewardNotice = await this.rewardNoticeFor(
      database,
      result.rewardItemId,
      'created',
      result.eventId,
    )
    const createdTask = await database.tasks.get(result.taskId)
    if (createdTask) this.appendActiveTask(createdTask)
    await this.recordLastWrite()
    await this.refresh()
    this.presentReward(rewardNotice)
  }

  async setTaskCompleted({
    completed,
    taskId: rawTaskId,
  }: {
    readonly completed: boolean
    readonly taskId: string
  }): Promise<void> {
    const database = this.requireDatabase()
    const commands = this.requireCommands()
    const task = await database.tasks.get(taskId(rawTaskId))
    if (!task) throw new Error('対象のタスクが見つかりません。')
    const today = localDate(formatLocalDate(new Date()))
    const occurrenceKey = makeOccurrenceKey(task.seriesId, task.schedule, today)
    const commandIdValue = commandId(randomId('command'))
    const payload = { taskId: task.id, occurrenceKey, localDate: today }
    let rewardNotice: RewardNoticeView | null = null
    if (completed) {
      const commandWithoutHash = {
        kind: 'completeTaskOccurrence' as const,
        commandId: commandIdValue,
        payload,
      }
      const result = await commands.completeTaskOccurrence({
        ...commandWithoutHash,
        payloadHash: await hashCompleteTaskOccurrenceCommand(commandWithoutHash, this.hasher),
      })
      if (result.rewarded) {
        const reward = await database.rewardLedger
          .where('[taskId+kind]')
          .equals([task.id, 'completed'])
          .first()
        if (reward) {
          rewardNotice = await this.rewardNoticeFor(
            database,
            reward.itemId,
            'completed',
            reward.eventId,
          )
        }
      }
    } else {
      const commandWithoutHash = {
        kind: 'reopenTaskOccurrence' as const,
        commandId: commandIdValue,
        payload,
      }
      await commands.reopenTaskOccurrence({
        ...commandWithoutHash,
        payloadHash: await hashReopenTaskOccurrenceCommand(commandWithoutHash, this.hasher),
      })
    }
    await this.recordLastWrite()
    await this.refresh()
    if (rewardNotice) this.presentReward(rewardNotice)
  }

  async dismissRewardNotice(): Promise<void> {
    if (this.model.rewardNotice === null) return
    this.model = Object.freeze({ ...this.model, rewardNotice: null })
    this.emit()
  }

  async updatePreferences(patch: Partial<PreferenceView>): Promise<void> {
    const database = this.requireDatabase()
    const updatedAt = systemClock.now()
    const rows = (Object.keys(patch) as (keyof PreferenceView)[]).flatMap((key) => {
      const value = patch[key]
      return value === undefined
        ? []
        : [{ schemaVersion: 1 as const, key: preferenceKeys[key], value, updatedAt }]
    })
    if (rows.length === 0) return
    await database.transaction('rw', database.settings, async () => {
      await database.settings.bulkPut(rows)
      await database.settings.put({
        schemaVersion: 1,
        key: 'system:last-write-at',
        value: updatedAt,
        updatedAt,
      })
    })
    if (patch.splashMode !== undefined) {
      window.localStorage.setItem(SPLASH_PREFERENCE_CACHE_KEY, patch.splashMode)
    }
    await this.refresh()
  }

  async requestPersistentStorage(): Promise<boolean> {
    const granted = await requestPersistentStorageFromUserGesture(navigator.storage, {
      userConfirmed: true,
    })
    await this.refresh()
    return granted
  }

  async loadCalendarRange({
    fromLocalDate,
    toLocalDate,
  }: {
    readonly fromLocalDate: string
    readonly toLocalDate: string
  }): Promise<void> {
    const from = localDate(fromLocalDate)
    const to = localDate(toLocalDate)
    if (from > to) throw new RangeError('カレンダー範囲が逆転しています。')
    const maximum = shiftLocalDate(from, 62)
    if (to > maximum) throw new RangeError('一度に表示できる期間を超えています。')
    if (this.calendarRange.from === from && this.calendarRange.to === to) return
    this.calendarRange = Object.freeze({ from, to })
    this.projectionDirty = true
    if (this.database) await this.refresh()
  }

  async migrateLegacyData(): Promise<{
    readonly migrated: boolean
    readonly migratedTaskCount: number
    readonly reason?: string
  }> {
    const database = this.requireDatabase()
    try {
      const result = await migrateLegacyDatabase(database, this.hasher, {
        now: systemClock.now(),
        timeZone: ianaTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone),
      })
      await this.refresh(false, true)
      return { migrated: result.migrated, migratedTaskCount: result.migratedTaskCount }
    } catch (cause) {
      return {
        migrated: false,
        migratedTaskCount: 0,
        reason: cause instanceof Error ? cause.message : '移行を完了できませんでした。',
      }
    }
  }

  async exportData(): Promise<{ readonly available: boolean; readonly reason?: string }> {
    const database = this.database
    if (!database) return { available: false, reason: '端末内データをまだ確認しています。' }
    try {
      const collections: ExportCollections = {
        tasks: await database.tasks.toArray(),
        taskOccurrences: await database.taskOccurrences.toArray(),
        commandReceipts: await database.commandReceipts.toArray(),
        domainEvents: await database.domainEvents.toArray(),
        outbox: await database.outbox.toArray(),
        rewardLedger: await database.rewardLedger.toArray(),
        growthLedger: await database.growthLedger.toArray(),
        inventory: await database.inventory.toArray(),
        settings: await database.settings.toArray(),
      }
      const exportedAt = systemClock.now()
      const timeZone = ianaTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
      const envelope = await buildExportEnvelope(
        collections,
        { appVersion: APP_VERSION, exportedAt, timeZone },
        this.hasher,
      )
      downloadJson(envelope, exportedAt)
      await database.settings.put({
        schemaVersion: 1,
        key: 'system:last-export-at',
        value: exportedAt,
        updatedAt: exportedAt,
      })
      await this.refresh()
      return { available: true }
    } catch {
      return { available: false, reason: '書き出しに失敗しました。空き容量とブラウザ設定を確認してください。' }
    }
  }

  async prepareImport(serializedBackup: string): Promise<{
    readonly available: boolean
    readonly issue?: string
    readonly rewardCount: number
    readonly runId?: string
    readonly taskCount: number
  }> {
    const database = this.requireDatabase()
    if (new TextEncoder().encode(serializedBackup).byteLength > MAX_IMPORT_BYTES) {
      return {
        available: false,
        issue: 'バックアップが50MBを超えています。分割せず、元の端末から再度書き出してください。',
        rewardCount: 0,
        taskCount: 0,
      }
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(serializedBackup) as unknown
    } catch {
      return {
        available: false,
        issue: 'JSON形式を読み取れませんでした。ファイルを編集せずに選び直してください。',
        rewardCount: 0,
        taskCount: 0,
      }
    }
    const validation = await validateImportEnvelope(parsed, this.hasher)
    if (!validation.valid) {
      return {
        available: false,
        issue: validation.issues[0]?.message ?? 'バックアップの整合性を確認できません。',
        rewardCount: 0,
        taskCount: 0,
      }
    }
    const report = inspectImportReferences(validation.value.envelope.collections)
    if (!report.valid) {
      return {
        available: false,
        issue: report.issues[0]?.message ?? 'バックアップ内の参照を確認できません。',
        rewardCount: report.rewardCount,
        taskCount: report.taskCount,
      }
    }
    const now = systemClock.now()
    const staged = await new DexieImportStagingStore(database).stage(validation.value, {
      now,
      runId: randomId('import'),
    })
    this.pendingImports.set(staged.runId, validation.value)
    return {
      available: true,
      rewardCount: report.rewardCount,
      runId: staged.runId,
      taskCount: report.taskCount,
    }
  }

  async activatePreparedImport(runId: string): Promise<{
    readonly activated: boolean
    readonly importedTaskCount: number
    readonly reason?: string
  }> {
    const database = this.requireDatabase()
    const validated = this.pendingImports.get(runId)
    if (!validated) {
      return {
        activated: false,
        importedTaskCount: 0,
        reason: '確認済みの読み込みデータがありません。ファイルを選び直してください。',
      }
    }
    try {
      const result = await activateStagedImport(
        database,
        validated,
        {
          appVersion: APP_VERSION,
          now: systemClock.now(),
          runId,
          timeZone: ianaTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone),
        },
        this.hasher,
      )
      this.pendingImports.delete(runId)
      await this.recordLastWrite()
      await this.refresh(false, true)
      return { activated: true, importedTaskCount: result.importedTaskCount }
    } catch (cause) {
      this.pendingImports.delete(runId)
      return {
        activated: false,
        importedTaskCount: 0,
        reason: cause instanceof Error ? cause.message : '読み込みを完了できませんでした。',
      }
    }
  }

  async acknowledgeMigrationNotice(): Promise<void> {
    const database = this.requireDatabase()
    const updatedAt = systemClock.now()
    await database.settings.put({
      schemaVersion: 1,
      key: 'migration:legacy-notice-dismissed',
      value: true,
      updatedAt,
    })
    this.model = { ...this.model, migrationNoticeVisible: false }
    this.emit()
  }

  private async openDatabase(): Promise<void> {
    try {
      const database = new GrimoireDatabase(this.databaseName)
      await database.open()
      this.database = database
      this.commands = new TaskCommandService(
        new DexieAtomicStore(database),
        systemClock,
        this.hasher,
        rewardPolicy,
      )
      await this.refresh(true, true)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '不明な起動エラーです。'
      this.model = {
        ...this.model,
        bootstrap: {
          status: 'failed',
          message: `端末内データを開けませんでした。${message}`,
        },
      }
      this.emit()
    }
  }

  private async refresh(markReady = false, reloadTasks = false): Promise<void> {
    const database = this.requireDatabase()
    const today = formatLocalDate(new Date())
    const shouldQueryTasks = reloadTasks || this.activeTasks === null
    if (shouldQueryTasks) this.diagnostics.onActiveTaskQuery?.()
    const taskQuery = shouldQueryTasks
      ? database.tasks.where('status').equals('active').toArray()
      : Promise.resolve(this.activeTasks ?? Object.freeze([]))
    const [tasks, occurrences, inventory, settings, pendingOperations, storage, legacyExists] =
      await Promise.all([
        taskQuery,
        database.taskOccurrences.where('localDate').equals(today).toArray(),
        database.inventory.toArray(),
        database.settings.toArray(),
        database.outbox.where('state').anyOf('pending', 'processing').count(),
        inspectStorageHealth(navigator.storage),
        legacyDatabaseExists(),
      ])
    if (reloadTasks || this.activeTasks === null) {
      this.activeTasks = Object.freeze(tasks)
      this.projectionDirty = true
    }
    const completed = new Set(
      occurrences
        .filter((occurrence) => occurrence.status === 'completed')
        .map((occurrence) => occurrence.occurrenceKey),
    )
    if (this.projectionDate !== today) this.projectionDirty = true
    if (this.projectionDirty) {
      const calendarEntries: CalendarEntryView[] = []
      const todayTasks: TodayTaskProjection[] = []
      for (const task of tasks) {
        const projection = this.projectTask(task, today)
        calendarEntries.push(...projection.calendarEntries)
        if (projection.todayTask) todayTasks.push(projection.todayTask)
      }
      this.calendarProjection = Object.freeze(calendarEntries)
      this.todayProjection = Object.freeze(todayTasks)
      this.projectionDate = today
      this.projectionDirty = false
      this.diagnostics.onTaskProjectionRebuild?.(tasks.length)
    }
    const tasksToday = this.todayProjection.map(({ occurrenceKey: key, row }) =>
      Object.freeze({ ...row, completed: completed.has(key) }))
    const preferences = preferencesFromRows(settings)
    const catalogDiscoveries = projectCatalogDiscoveries(inventory)
    const noticeDismissed =
      settings.find((row) => row.key === 'migration:legacy-notice-dismissed')?.value === true
    const migrationCompleted =
      settings.find((row) => row.key === 'migration:legacy-completed')?.value === true
    const migrationAvailable = legacyExists && !migrationCompleted
    this.model = Object.freeze({
      bootstrap: markReady || this.model.bootstrap.status === 'ready'
        ? Object.freeze({ status: 'ready' as const })
        : this.model.bootstrap,
      calendarEntries: this.calendarProjection,
      catalogDiscoveries: Object.freeze(catalogDiscoveries),
      migrationAvailable,
      migrationNoticeVisible: migrationAvailable && !noticeDismissed,
      preferences,
      rewardNotice: this.model.rewardNotice,
      storageHealth: Object.freeze({
        databaseVersion: `v${DATABASE_VERSION}`,
        lastExportAt: optionalInstant(settings, 'system:last-export-at'),
        lastWriteAt: optionalInstant(settings, 'system:last-write-at'),
        pendingOperations,
        persistence:
          storage.durability === 'persistent'
            ? 'granted'
            : storage.durability === 'best-effort'
              ? 'not-granted'
              : 'unknown',
        usageBytes: storage.usageBytes ?? null,
      }),
      tasksToday: Object.freeze(tasksToday),
    })
    window.localStorage.setItem(SPLASH_PREFERENCE_CACHE_KEY, preferences.splashMode)
    this.emit()
  }

  private appendActiveTask(task: TaskRecord): void {
    if (this.activeTasks === null) return
    this.activeTasks = Object.freeze([...this.activeTasks, task])
    const today = formatLocalDate(new Date())
    if (this.projectionDirty || this.projectionDate !== today) {
      this.projectionDirty = true
      return
    }
    const projection = this.projectTask(task, today)
    this.calendarProjection = Object.freeze([
      ...this.calendarProjection,
      ...projection.calendarEntries,
    ])
    if (projection.todayTask) {
      this.todayProjection = Object.freeze([...this.todayProjection, projection.todayTask])
    }
  }

  private projectTask(task: TaskRecord, today: string): Readonly<{
    calendarEntries: readonly CalendarEntryView[]
    todayTask?: TodayTaskProjection
  }> {
    const calendarEntries = this.occurrencesInCalendarRange(task)
      .map((occurrenceDate) => this.calendarEntry(task, occurrenceDate))
    const todayValue = localDate(today)
    if (!isTaskOccurrence(task, todayValue)) return Object.freeze({ calendarEntries })
    const key = makeOccurrenceKey(task.seriesId, task.schedule, todayValue)
    return Object.freeze({
      calendarEntries,
      todayTask: Object.freeze({
        occurrenceKey: key,
        row: Object.freeze({
          id: task.id,
          title: task.title,
          completed: false,
          ...(task.schedule.localTime === ALL_DAY_SENTINEL
            ? {}
            : { scheduledTime: task.schedule.localTime }),
        }),
      }),
    })
  }

  private occurrencesInCalendarRange(task: TaskRecord): readonly string[] {
    const from = localDate(this.calendarRange.from)
    const to = localDate(this.calendarRange.to)
    if (task.recurrence === null) {
      return task.schedule.localDate >= from && task.schedule.localDate <= to
        ? [task.schedule.localDate]
        : []
    }
    const result: string[] = []
    let candidate = task.schedule.localDate >= from
      ? task.schedule.localDate
      : nextOccurrenceDate(
          task.schedule.localDate,
          task.recurrence,
          localDate(shiftLocalDate(from, -1)),
        )
    for (let guard = 0; candidate !== undefined && candidate <= to && guard < 100; guard += 1) {
      if (candidate >= from) result.push(candidate)
      candidate = nextOccurrenceDate(task.schedule.localDate, task.recurrence, candidate)
    }
    return result
  }

  private calendarEntry(task: TaskRecord, occurrenceDate: string): CalendarEntryView {
    return Object.freeze({
      id: `${task.id}:${occurrenceDate}`,
      localDate: occurrenceDate,
      title: task.title,
      ...(task.schedule.localTime === ALL_DAY_SENTINEL
        ? {}
        : { scheduledTime: task.schedule.localTime }),
    })
  }

  private async rewardNoticeFor(
    database: GrimoireDatabase,
    itemId: string,
    kind: RewardNoticeView['kind'],
    id: string,
  ): Promise<RewardNoticeView> {
    const definition = catalogDefinitionById.get(itemId)
    const inventory = await database.inventory.get(itemId)
    const firstDiscovery = inventory?.quantity === 1
    return Object.freeze({
      artAlt: definition?.art.alt ?? '未同定の標本印',
      artSrc: definition?.art.src ?? '/brand/grimoire-seal.svg',
      collapsedCount: 0,
      description: definition?.description ?? '標本の記録は保存されました。図鑑の定義を確認してください。',
      firstDiscovery,
      id,
      itemId,
      kind,
      name: definition?.name ?? '未同定の標本',
      presentation: kind === 'completed' && firstDiscovery ? 'sheet' : 'mini',
    })
  }

  private presentReward(notice: RewardNoticeView): void {
    const previous = this.model.rewardNotice
    this.model = Object.freeze({
      ...this.model,
      rewardNotice: Object.freeze({
        ...notice,
        collapsedCount: previous === null ? 0 : previous.collapsedCount + 1,
      }),
    })
    this.emit()
  }

  private async recordLastWrite(): Promise<void> {
    const database = this.requireDatabase()
    const updatedAt = systemClock.now()
    await database.settings.put({
      schemaVersion: 1,
      key: 'system:last-write-at',
      value: updatedAt,
      updatedAt,
    })
  }

  private requireDatabase(): GrimoireDatabase {
    if (!this.database) throw new Error('端末内データをまだ確認しています。')
    return this.database
  }

  private requireCommands(): TaskCommandService {
    if (!this.commands) throw new Error('端末内データをまだ確認しています。')
    return this.commands
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}
