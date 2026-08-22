'use client'

import {
  hashCompleteTaskOccurrenceCommand,
  hashCreateTaskCommand,
  hashDeleteTaskCommand,
  hashImportExternalTaskCommand,
  hashReopenTaskOccurrenceCommand,
  hashUpdateTaskCommand,
  TaskCommandService,
  type ExternalTaskProvider,
} from '@/application/commands'
import type { ExportCollections, ValidatedImport } from '@/application/import-export'
import type {
  Clock,
  ExternalScheduleItem,
  GoogleIntegrationPort,
  NotificationIntegrationPort,
  SettingRow,
} from '@/application/ports'
import {
  commandId,
  ianaTimeZone,
  isoInstant,
  localDate,
  localTime,
  seriesId,
  taskId,
  type TaskId,
} from '@/domain/primitives'
import { isTaskOccurrence, makeOccurrenceKey, nextOccurrenceDate } from '@/domain/recurrence'
import { StableWeightedRewardPolicy } from '@/domain/rewards'
import type { TaskRecord } from '@/domain/tasks'
import { CATALOG_DEFINITIONS, CATALOG_REWARD_POOL } from '@/features/catalog/definitions'
import { CREATURE_RECORDS, CREATURE_RECORDS_BY_ID } from '@/features/catalog/creature-records'
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
import { DEFAULT_AREA_ID, findArea } from '@/world/areas'

import type {
  AppReadModel,
  AppUiPort,
  CalendarEntryView,
  CreatureObservationView,
  ExternalImportResultView,
  GoogleLinkView,
  NotificationView,
  PreferenceView,
  RewardNoticeView,
  TaskDraft,
  TaskRowView,
} from './ui-port'
import { projectCatalogDiscoveries } from './catalog-projection'

export const SPLASH_PREFERENCE_CACHE_KEY = 'grimoire:preference:splash-mode'

/** The shape reminder building needs, and nothing more. */
export interface ReminderTaskView {
  readonly completed: boolean
  readonly id: string
  readonly scheduledTime: string | null
  readonly title: string
}

interface TodayTaskProjection {
  readonly occurrenceKey: ReturnType<typeof makeOccurrenceKey>
  readonly row: TaskRowView
}

/**
 * Both cached projections keep the occurrence key beside the view row and leave
 * `completed` at its neutral `false`, because completion is occurrence state,
 * not task state: it changes without the recurrence, date or title changing, so
 * it must not be baked into a cache that only a *task* edit invalidates.
 * `refresh()` applies the completed set to both on every pass.
 */
interface CalendarEntryProjection {
  readonly entry: CalendarEntryView
  readonly occurrenceKey: ReturnType<typeof makeOccurrenceKey>
}

export interface DurableUiPortDiagnostics {
  readonly onActiveTaskQuery?: () => void
  readonly onTaskProjectionRebuild?: (taskCount: number) => void
}

/**
 * Narrow integration ports the composition root may inject (決定事項ログ D-013/6,
 * T020's `src/integrations/**`). Left unset, `DurableUiPort` falls back to an
 * honest "unavailable" implementation — never a throw, never a faked success.
 */
export interface DurableUiPortIntegrations {
  readonly google?: GoogleIntegrationPort
  readonly notifications?: NotificationIntegrationPort
}

const DATABASE_NAME = 'GrimoireDB'
const LEGACY_DATABASE_NAME = 'TaskManagerDB'
const APP_VERSION = '0.1.0'
const ALL_DAY_SENTINEL = '00:00'
const MAX_IMPORT_BYTES = 50 * 1_024 * 1_024
const UNAVAILABLE_GOOGLE_REASON = 'Google連携は未設定です。'

const WORLD_AREA_SETTING_KEY = 'world:selected-area-id'
const OBSERVATIONS_READ_AT_SETTING_KEY = 'world:observations-read-at'
const NOTIFICATIONS_ENABLED_SETTING_KEY = 'preference:notifications-enabled'

const NULL_GOOGLE_INTEGRATION_PORT: GoogleIntegrationPort = Object.freeze({
  isConfigured: () => false,
  connect: async () => Object.freeze({ connected: false, reason: UNAVAILABLE_GOOGLE_REASON }),
  disconnect: async () => undefined,
  fetchCalendarEvents: async () => Object.freeze([]),
  fetchGmailItems: async () => Object.freeze([]),
})

const NULL_NOTIFICATION_PORT: NotificationIntegrationPort = Object.freeze({
  currentPermission: () => 'unsupported' as const,
  requestPermission: async () => 'unsupported' as const,
  scheduledCount: () => 0,
})

const DEFAULT_PREFERENCES: PreferenceView = Object.freeze({
  bgmEnabled: true,
  colorScheme: 'system',
  motion: 'system',
  sfxEnabled: true,
  splashMode: 'timed',
})

/**
 * Every defined observation record, unobserved. Unlike the item catalog,
 * silhouettes are the correct default — the whole roster is always present
 * (決定事項ログ M-11), just with `observedAt: null` until something records it.
 */
function projectCreatureObservations(
  rows: readonly Readonly<{ id: string; observedAt: string }>[],
): readonly CreatureObservationView[] {
  const observedById = new Map(rows.map((row) => [row.id, row.observedAt]))
  return Object.freeze(
    CREATURE_RECORDS.map((record) =>
      Object.freeze({ id: record.id, observedAt: observedById.get(record.id) ?? null }),
    ),
  )
}

const DEFAULT_MODEL: AppReadModel = Object.freeze({
  bootstrap: Object.freeze({ phase: '端末内データ', status: 'loading' }),
  calendarEntries: Object.freeze([]),
  catalogDiscoveries: Object.freeze([]),
  creatureObservations: projectCreatureObservations([]),
  googleLink: Object.freeze({
    calendarConnected: false,
    configured: false,
    gmailConnected: false,
    lastCalendarImportAt: null,
    lastGmailImportAt: null,
  }),
  migrationAvailable: false,
  migrationNoticeVisible: false,
  notifications: Object.freeze({ enabled: false, permission: 'unsupported', scheduledCount: 0 }),
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
  world: Object.freeze({ selectedAreaId: DEFAULT_AREA_ID, unreadObservationCount: 0 }),
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
  // `??` binds looser than `+`, so `day ?? 1 + days` parsed as `day ?? (1 + days)`
  // and applied the shift twice for a malformed date. Parenthesised, and the
  // shift stays where it belongs — on the line below.
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1))
  date.setUTCDate(date.getUTCDate() + days)
  return formatUtcDate(date)
}

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * The current month, plus one day either side. The Calendar screen replaces
 * this with its own visible grid as soon as it mounts; the padding is for
 * everything that reads the projection before then. Reminders need tomorrow,
 * and on the last day of a month a range that stopped at the month boundary
 * would silently have no "明日" entries to arm.
 */
function initialCalendarRange(): Readonly<{ from: string; to: string }> {
  const now = new Date()
  const first = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0))
  const last = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1))
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

function settingValue(rows: readonly SettingRow[], key: string): unknown {
  return rows.find((row) => row.key === key)?.value
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

interface GoogleSessionState {
  readonly calendarConnected: boolean
  readonly gmailConnected: boolean
  readonly lastCalendarImportAt: string | null
  readonly lastGmailImportAt: string | null
}

const EMPTY_GOOGLE_SESSION: GoogleSessionState = Object.freeze({
  calendarConnected: false,
  gmailConnected: false,
  lastCalendarImportAt: null,
  lastGmailImportAt: null,
})

export class DurableUiPort implements AppUiPort {
  private readonly listeners = new Set<() => void>()
  private readonly hasher = new WebCryptoCanonicalHasher()
  private readonly pendingImports = new Map<string, ValidatedImport>()
  private readonly google: GoogleIntegrationPort
  private readonly notificationPort: NotificationIntegrationPort
  private database: GrimoireDatabase | null = null
  private commands: TaskCommandService | null = null
  private initialization: Promise<void> | null = null
  private calendarRange = initialCalendarRange()
  private activeTasks: readonly TaskRecord[] | null = null
  private calendarProjection: readonly CalendarEntryProjection[] = Object.freeze([])
  private todayProjection: readonly TodayTaskProjection[] = Object.freeze([])
  private projectionDate: string | null = null
  private projectionDirty = true
  private model: AppReadModel = DEFAULT_MODEL
  private googleSession: GoogleSessionState = EMPTY_GOOGLE_SESSION

  constructor(
    private readonly databaseName = DATABASE_NAME,
    private readonly diagnostics: DurableUiPortDiagnostics = {},
    integrations: DurableUiPortIntegrations = {},
  ) {
    this.google = integrations.google ?? NULL_GOOGLE_INTEGRATION_PORT
    this.notificationPort = integrations.notifications ?? NULL_NOTIFICATION_PORT
  }

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

  async createTask(draft: TaskDraft): Promise<void> {
    const database = this.requireDatabase()
    const commands = this.requireCommands()
    const rawTaskId = taskId(randomId('task'))
    const rawSeriesId = seriesId(randomId('series'))
    const timeZone = ianaTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    const commandWithoutHash = {
      kind: 'createTask' as const,
      commandId: commandId(randomId('command')),
      payload: {
        taskId: rawTaskId,
        seriesId: rawSeriesId,
        title: draft.title,
        ...(draft.description === undefined ? {} : { description: draft.description }),
        categoryId: draft.categoryId,
        schedule: {
          localDate: localDate(draft.localDate),
          localTime: localTime(draft.scheduledTime ?? ALL_DAY_SENTINEL),
          timeZone,
        },
        recurrence: draft.recurrence,
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

  async updateTask({
    draft,
    taskId: rawTaskId,
  }: {
    readonly draft: TaskDraft
    readonly taskId: string
  }): Promise<void> {
    const database = this.requireDatabase()
    const commands = this.requireCommands()
    const timeZone = ianaTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    const commandWithoutHash = {
      kind: 'updateTask' as const,
      commandId: commandId(randomId('command')),
      payload: {
        taskId: taskId(rawTaskId),
        title: draft.title,
        ...(draft.description === undefined ? {} : { description: draft.description }),
        categoryId: draft.categoryId,
        schedule: {
          localDate: localDate(draft.localDate),
          localTime: localTime(draft.scheduledTime ?? ALL_DAY_SENTINEL),
          timeZone,
        },
        recurrence: draft.recurrence,
      },
    }
    await commands.updateTask({
      ...commandWithoutHash,
      payloadHash: await hashUpdateTaskCommand(commandWithoutHash, this.hasher),
    })
    const updatedTask = await database.tasks.get(commandWithoutHash.payload.taskId)
    if (updatedTask) this.replaceActiveTask(updatedTask)
    await this.recordLastWrite()
    await this.refresh()
  }

  async deleteTask({ taskId: rawTaskId }: { readonly taskId: string }): Promise<void> {
    const commands = this.requireCommands()
    const target = taskId(rawTaskId)
    const commandWithoutHash = {
      kind: 'deleteTask' as const,
      commandId: commandId(randomId('command')),
      payload: { taskId: target },
    }
    await commands.deleteTask({
      ...commandWithoutHash,
      payloadHash: await hashDeleteTaskCommand(commandWithoutHash, this.hasher),
    })
    this.removeActiveTask(target)
    await this.recordLastWrite()
    await this.refresh()
  }

  async setTaskCompleted({
    completed,
    localDate: rawLocalDate,
    taskId: rawTaskId,
  }: {
    readonly completed: boolean
    readonly localDate?: string
    readonly taskId: string
  }): Promise<void> {
    const database = this.requireDatabase()
    const commands = this.requireCommands()
    const task = await database.tasks.get(taskId(rawTaskId))
    if (!task) throw new Error('対象のタスクが見つかりません。')
    // The day the caller named, or today. A repeating task has one occurrence
    // per matching date and they complete independently, so this is the whole
    // difference between ticking off Thursday and ticking off today.
    const day = localDate(rawLocalDate ?? formatLocalDate(new Date()))
    if (!isTaskOccurrence(task, day)) {
      throw new Error('その日にこのタスクの予定はありません。')
    }
    const occurrenceKey = makeOccurrenceKey(task.seriesId, task.schedule, day)
    const commandIdValue = commandId(randomId('command'))
    const payload = { taskId: task.id, occurrenceKey, localDate: day }
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

  async markObservationsRead(): Promise<void> {
    const database = this.requireDatabase()
    const updatedAt = systemClock.now()
    await database.settings.put({
      schemaVersion: 1,
      key: OBSERVATIONS_READ_AT_SETTING_KEY,
      value: updatedAt,
      updatedAt,
    })
    await this.refresh()
  }

  async selectArea({ areaId }: { readonly areaId: string }): Promise<void> {
    const database = this.requireDatabase()
    const updatedAt = systemClock.now()
    await database.settings.put({
      schemaVersion: 1,
      key: WORLD_AREA_SETTING_KEY,
      value: findArea(areaId).id,
      updatedAt,
    })
    await this.refresh()
  }

  /**
   * Not part of `AppUiPort`: the Grimo screen that would trigger an
   * observation (決定事項ログ M-12) has no creature to render yet (D-014). This
   * is the durable persistence path a future screen wires up, exercised
   * directly by tests today the same way `setTaskCompleted` exercises commands.
   */
  async recordCreatureObservation(recordId: string): Promise<void> {
    if (!CREATURE_RECORDS_BY_ID.has(recordId)) {
      throw new Error('未定義の観察記録IDです。')
    }
    const database = this.requireDatabase()
    const existing = await database.creatureObservations.get(recordId)
    if (existing) return
    const observedAt = systemClock.now()
    await database.creatureObservations.put({ schemaVersion: 1, id: recordId, observedAt })
    await this.recordLastWrite()
    await this.refresh()
  }

  async requestNotificationPermission(): Promise<NotificationView['permission']> {
    const permission = await this.notificationPort.requestPermission()
    await this.refresh()
    return permission
  }

  async setNotificationsEnabled(enabled: boolean): Promise<void> {
    const database = this.requireDatabase()
    const updatedAt = systemClock.now()
    await database.settings.put({
      schemaVersion: 1,
      key: NOTIFICATIONS_ENABLED_SETTING_KEY,
      value: enabled,
      updatedAt,
    })
    await this.refresh()
  }

  /**
   * Not part of `AppUiPort`: every task occurring on one local date, read from
   * the store instead of from `calendarEntries`.
   *
   * Reminders need today and tomorrow. The calendar projection looks like it
   * would answer that, but the Calendar screen owns its extent — paging to
   * another month narrows it, the narrowed range outlives the visit, and
   * tomorrow's reminders silently become an empty list. A reminder that does
   * not fire leaves no trace, so this reads the source of truth directly.
   */
  async tasksOccurringOn(date: string): Promise<readonly ReminderTaskView[]> {
    if (this.database === null) return Object.freeze([])
    const database = this.database
    const day = localDate(date)
    const [tasks, occurrences] = await Promise.all([
      this.activeTasks !== null
        ? Promise.resolve(this.activeTasks)
        : database.tasks.where('status').equals('active').toArray(),
      database.taskOccurrences.where('localDate').equals(day).toArray(),
    ])
    const completed = new Set(
      occurrences
        .filter((occurrence) => occurrence.status === 'completed')
        .map((occurrence) => occurrence.occurrenceKey),
    )
    return Object.freeze(
      tasks
        .filter((task) => isTaskOccurrence(task, day))
        .map((task) =>
          Object.freeze({
            completed: completed.has(makeOccurrenceKey(task.seriesId, task.schedule, day)),
            id: task.id,
            scheduledTime:
              task.schedule.localTime === ALL_DAY_SENTINEL ? null : task.schedule.localTime,
            title: task.title,
          }),
        ),
    )
  }

  /**
   * Not part of `AppUiPort`: the composition root calls this after a reminder
   * sync so `scheduledCount` catches up. The count is read off the integration
   * while the model is rebuilt, and a sync is asynchronous and answers to
   * nobody, so without this 「予約中の通知」 stayed at the value it had before
   * the reminders were armed — until some unrelated write happened to refresh.
   */
  async refreshNotificationState(): Promise<void> {
    if (this.database === null) return
    await this.refresh()
  }

  async connectGoogle(scope: 'calendar' | 'gmail'): Promise<{
    readonly connected: boolean
    readonly reason?: string
  }> {
    const result = await this.google.connect(scope)
    if (result.connected) {
      this.googleSession = Object.freeze({
        ...this.googleSession,
        ...(scope === 'calendar' ? { calendarConnected: true } : { gmailConnected: true }),
      })
      // `refresh()`, not `emit()`: `googleLink` is derived while the model is
      // rebuilt, so emitting alone hands `useSyncExternalStore` the same frozen
      // object it already has and the row never leaves its disconnected state.
      await this.refresh()
    }
    return result
  }

  async disconnectGoogle(scope: 'calendar' | 'gmail'): Promise<void> {
    await this.google.disconnect(scope)
    this.googleSession = Object.freeze({
      ...this.googleSession,
      ...(scope === 'calendar' ? { calendarConnected: false } : { gmailConnected: false }),
    })
    await this.refresh()
  }

  async importFromGoogleCalendar({
    fromLocalDate,
    toLocalDate,
  }: {
    readonly fromLocalDate: string
    readonly toLocalDate: string
  }): Promise<ExternalImportResultView> {
    return this.importExternal('google-calendar', () =>
      this.google.fetchCalendarEvents({ fromLocalDate, toLocalDate }),
    )
  }

  async importFromGmail(): Promise<ExternalImportResultView> {
    return this.importExternal('gmail', () => this.google.fetchGmailItems())
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
        creatureObservations: await database.creatureObservations.toArray(),
        externalTaskLinks: await database.externalTaskLinks.toArray(),
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

  private async importExternal(
    provider: ExternalTaskProvider,
    fetchItems: () => Promise<readonly ExternalScheduleItem[]>,
  ): Promise<ExternalImportResultView> {
    if (!this.google.isConfigured()) {
      return { cancelled: false, imported: 0, reason: UNAVAILABLE_GOOGLE_REASON, skipped: 0 }
    }
    const commands = this.requireCommands()
    let items: readonly ExternalScheduleItem[]
    try {
      items = await fetchItems()
    } catch (cause) {
      return {
        cancelled: false,
        imported: 0,
        reason: cause instanceof Error ? cause.message : '取り込みに失敗しました。',
        skipped: 0,
      }
    }
    const timeZone = ianaTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    let imported = 0
    let skipped = 0
    for (const item of items) {
      try {
        const commandWithoutHash = {
          kind: 'importExternalTask' as const,
          commandId: commandId(randomId('command')),
          payload: {
            taskId: taskId(randomId('task')),
            seriesId: seriesId(randomId('series')),
            provider,
            externalId: item.externalId,
            title: item.title,
            ...(item.description === undefined ? {} : { description: item.description }),
            schedule: {
              localDate: localDate(item.localDate),
              localTime: localTime(item.scheduledTime ?? ALL_DAY_SENTINEL),
              timeZone,
            },
          },
        }
        const result = await commands.importExternalTask({
          ...commandWithoutHash,
          payloadHash: await hashImportExternalTaskCommand(commandWithoutHash, this.hasher),
        })
        if (result.deduplicated) skipped += 1
        else imported += 1
      } catch {
        // One malformed upstream item must not abort an otherwise-good import
        // batch (F-4/H-3): `imported`/`skipped` stay accurate for what
        // actually committed, instead of failing the whole run.
      }
    }
    const importedAt = systemClock.now()
    this.googleSession = Object.freeze({
      ...this.googleSession,
      ...(provider === 'google-calendar'
        ? { lastCalendarImportAt: importedAt }
        : { lastGmailImportAt: importedAt }),
    })
    if (imported > 0) {
      await this.recordLastWrite()
      this.activeTasks = null
      await this.refresh(false, true)
    } else {
      // Still a refresh: `lastCalendarImportAt` lives in the derived model, so
      // an all-duplicate import would otherwise never update 「最終取り込み」.
      await this.refresh()
    }
    return { cancelled: false, imported, skipped }
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
    const [
      tasks,
      todayOccurrences,
      rangeOccurrences,
      inventory,
      settings,
      observationRows,
      pendingOperations,
      storage,
      legacyExists,
    ] = await Promise.all([
      taskQuery,
      database.taskOccurrences.where('localDate').equals(today).toArray(),
      database.taskOccurrences
        .where('localDate')
        .between(this.calendarRange.from, this.calendarRange.to, true, true)
        .toArray(),
      database.inventory.toArray(),
      database.settings.toArray(),
      database.creatureObservations.toArray(),
      database.outbox.where('state').anyOf('pending', 'processing').count(),
      inspectStorageHealth(navigator.storage),
      legacyDatabaseExists(),
    ])
    if (reloadTasks || this.activeTasks === null) {
      this.activeTasks = Object.freeze(tasks)
      this.projectionDirty = true
    }
    const completedToday = new Set(
      todayOccurrences
        .filter((occurrence) => occurrence.status === 'completed')
        .map((occurrence) => occurrence.occurrenceKey),
    )
    const completedInRange = new Set(
      rangeOccurrences
        .filter((occurrence) => occurrence.status === 'completed')
        .map((occurrence) => occurrence.occurrenceKey),
    )
    if (this.projectionDate !== today) this.projectionDirty = true
    if (this.projectionDirty) {
      const calendarEntries: CalendarEntryProjection[] = []
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
      Object.freeze({ ...row, completed: completedToday.has(key) }))
    // Ticking a day off the calendar writes an occurrence, which leaves the
    // cached projection valid but its `completed` flags out of date, so they are
    // re-applied here rather than at build time. Baking them in meant a
    // completion made from the Calendar screen wrote to the store and then sat
    // invisible until something unrelated dirtied the projection.
    const calendarEntries = this.calendarProjection.map(({ entry, occurrenceKey: key }) =>
      completedInRange.has(key) ? Object.freeze({ ...entry, completed: true }) : entry)
    const preferences = preferencesFromRows(settings)
    const catalogDiscoveries = projectCatalogDiscoveries(inventory)
    const creatureObservations = projectCreatureObservations(observationRows)
    const noticeDismissed =
      settings.find((row) => row.key === 'migration:legacy-notice-dismissed')?.value === true
    const migrationCompleted =
      settings.find((row) => row.key === 'migration:legacy-completed')?.value === true
    const migrationAvailable = legacyExists && !migrationCompleted
    const storedAreaId = settingValue(settings, WORLD_AREA_SETTING_KEY)
    const selectedAreaId = typeof storedAreaId === 'string' ? findArea(storedAreaId).id : DEFAULT_AREA_ID
    const readAtValue = settingValue(settings, OBSERVATIONS_READ_AT_SETTING_KEY)
    const readAt = typeof readAtValue === 'string' ? readAtValue : ''
    const unreadObservationCount = observationRows.filter(
      (row) => (row.observedAt as string) > readAt,
    ).length
    const notificationsEnabled = settingValue(settings, NOTIFICATIONS_ENABLED_SETTING_KEY) === true
    const googleLink: GoogleLinkView = Object.freeze({
      calendarConnected: this.googleSession.calendarConnected,
      configured: this.google.isConfigured(),
      gmailConnected: this.googleSession.gmailConnected,
      lastCalendarImportAt: this.googleSession.lastCalendarImportAt,
      lastGmailImportAt: this.googleSession.lastGmailImportAt,
    })
    this.model = Object.freeze({
      bootstrap: markReady || this.model.bootstrap.status === 'ready'
        ? Object.freeze({ status: 'ready' as const })
        : this.model.bootstrap,
      calendarEntries: Object.freeze(calendarEntries),
      catalogDiscoveries: Object.freeze(catalogDiscoveries),
      creatureObservations,
      googleLink,
      migrationAvailable,
      migrationNoticeVisible: migrationAvailable && !noticeDismissed,
      notifications: Object.freeze({
        enabled: notificationsEnabled,
        permission: this.notificationPort.currentPermission(),
        scheduledCount: this.notificationPort.scheduledCount(),
      }),
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
      world: Object.freeze({ selectedAreaId, unreadObservationCount }),
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

  /**
   * Marks the cached projection dirty rather than re-deriving it in place:
   * an edit can move a task's date, time, or recurrence, so a targeted patch
   * of `calendarProjection`/`todayProjection` would need to re-derive the same
   * membership logic `refresh()` already has. The next `refresh()` rebuilds
   * from the in-memory `activeTasks` this method just replaced in — no extra
   * database query, same discipline as `appendActiveTask`.
   */
  private replaceActiveTask(task: TaskRecord): void {
    if (this.activeTasks === null) return
    const index = this.activeTasks.findIndex((existing) => existing.id === task.id)
    if (index === -1) return
    this.activeTasks = Object.freeze([
      ...this.activeTasks.slice(0, index),
      task,
      ...this.activeTasks.slice(index + 1),
    ])
    this.projectionDirty = true
  }

  private removeActiveTask(removedTaskId: TaskId): void {
    if (this.activeTasks === null) return
    this.activeTasks = Object.freeze(
      this.activeTasks.filter((existing) => existing.id !== removedTaskId),
    )
    this.projectionDirty = true
  }

  private projectTask(
    task: TaskRecord,
    today: string,
  ): Readonly<{
    calendarEntries: readonly CalendarEntryProjection[]
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
          categoryId: task.categoryId,
          completed: false,
          id: task.id,
          recurrence: task.recurrence,
          title: task.title,
          ...(task.description === undefined ? {} : { description: task.description }),
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

  private calendarEntry(task: TaskRecord, occurrenceDate: string): CalendarEntryProjection {
    const key = makeOccurrenceKey(task.seriesId, task.schedule, localDate(occurrenceDate))
    return Object.freeze({
      entry: Object.freeze({
        categoryId: task.categoryId,
        completed: false,
        id: `${task.id}:${occurrenceDate}`,
        localDate: occurrenceDate,
        taskId: task.id,
        recurrence: task.recurrence,
        title: task.title,
        ...(task.schedule.localTime === ALL_DAY_SENTINEL
          ? {}
          : { scheduledTime: task.schedule.localTime }),
      }),
      occurrenceKey: key,
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
