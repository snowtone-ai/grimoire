import type { ColorScheme, SplashDisplayMode } from '@/ui/tokens'

/**
 * Read models shaped for the interface. They deliberately contain no reward,
 * recurrence, persistence, or sync *rules* — only the values a screen renders.
 * The bootstrap adapter maps the durable application core to this boundary.
 *
 * Recurrence and category appear here as their own UI-facing value types rather
 * than re-exported domain types: two teams implement against this file, and a
 * domain refactor must not silently change what a form is allowed to submit.
 */

/**
 * Task classification carried over from v1 unchanged (決定事項ログ F-4: v1's
 * data behaviour is preserved, only the front end is rebuilt). The stored value
 * is this id; the colour and label are chosen by the UI and never persisted.
 */
export type TaskCategoryId = 'job' | 'life' | 'university'

export const TASK_CATEGORY_IDS: readonly TaskCategoryId[] = Object.freeze([
  'job',
  'university',
  'life',
])

export const TASK_CATEGORY_LABELS: Readonly<Record<TaskCategoryId, string>> =
  Object.freeze({
    job: '就活',
    university: '大学',
    life: '生活',
  })

/** ISO weekday, Monday = 1 and Sunday = 7. */
export type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** What a user may express in the repeat editor. Mirrors, but does not import, the domain rule. */
export type RecurrenceView =
  | { readonly frequency: 'daily'; readonly interval: number }
  | {
      readonly frequency: 'weekly'
      readonly interval: number
      readonly weekdays: readonly WeekdayNumber[]
    }
  | {
      readonly frequency: 'monthly'
      readonly interval: number
      readonly dayOfMonth: number
      readonly invalidDatePolicy: 'clamp' | 'skip'
    }
  | {
      readonly frequency: 'yearly'
      readonly interval: number
      readonly month: number
      readonly dayOfMonth: number
      readonly invalidDatePolicy: 'clamp' | 'skip'
    }

export interface TaskRowView {
  readonly categoryId: TaskCategoryId | null
  readonly completed: boolean
  readonly description?: string
  readonly id: string
  /** Present when the row belongs to a repeating series. */
  readonly recurrence: RecurrenceView | null
  /** Local wall-clock 'HH:mm'. Absent means the task is undated within its day. */
  readonly scheduledTime?: string
  readonly title: string
}

/** Everything a create/edit form can submit. `localDate` is 'YYYY-MM-DD'. */
export interface TaskDraft {
  readonly categoryId: TaskCategoryId | null
  readonly description?: string
  readonly localDate: string
  readonly recurrence: RecurrenceView | null
  readonly scheduledTime?: string
  readonly title: string
}

export interface CalendarEntryView {
  readonly categoryId: TaskCategoryId | null
  readonly completed: boolean
  /**
   * Unique per occurrence, so a repeating task can appear on many days. It is
   * NOT a task id — pass `taskId` to any command. The two were conflated once
   * and every write from the calendar failed against a row that never existed.
   */
  readonly id: string
  readonly localDate: string
  readonly recurrence: RecurrenceView | null
  readonly scheduledTime?: string
  /** The task this occurrence belongs to. */
  readonly taskId: string
  readonly title: string
}

export interface CatalogDiscoveryView {
  readonly firstDiscoveredAt: string
  readonly itemId: string
  readonly lastDiscoveredAt: string
  readonly quantity: number
}

/**
 * Grimo observation journal (決定事項ログ M-11/M-12). Unlike the item catalog,
 * unobserved records stay visible as silhouettes — so this view carries every
 * defined record, with `observedAt` null while it has not been seen.
 */
export interface CreatureObservationView {
  readonly id: string
  readonly observedAt: string | null
}

export type RewardNoticeView = {
  readonly artAlt: string
  readonly artSrc: string
  readonly collapsedCount: number
  readonly description: string
  readonly firstDiscovery: boolean
  readonly id: string
  readonly itemId: string
  readonly kind: 'created' | 'completed'
  readonly name: string
  readonly presentation: 'mini' | 'sheet'
}

export type BootstrapView =
  | { readonly status: 'ready' }
  | { readonly phase: string; readonly status: 'loading' }
  | { readonly message: string; readonly status: 'failed' }

export interface StorageHealthView {
  readonly databaseVersion: string
  readonly lastExportAt: string | null
  readonly lastWriteAt: string | null
  readonly pendingOperations: number
  readonly persistence: 'granted' | 'not-granted' | 'unknown'
  readonly usageBytes: number | null
}

export interface PreferenceView {
  readonly bgmEnabled: boolean
  readonly colorScheme: ColorScheme
  readonly motion: 'full' | 'reduced' | 'system'
  readonly sfxEnabled: boolean
  readonly splashMode: SplashDisplayMode
}

export interface ImportPreviewView {
  readonly available: boolean
  readonly issue?: string
  readonly rewardCount: number
  readonly runId?: string
  readonly taskCount: number
}

/**
 * Browser notification capability. `permission` is what the browser reports;
 * `enabled` is the app-level switch, which the user can turn off even after the
 * browser has granted permission (a site cannot revoke its own grant).
 */
export interface NotificationView {
  readonly enabled: boolean
  readonly permission: 'default' | 'denied' | 'granted' | 'unsupported'
  readonly scheduledCount: number
}

/** Google link state. Tokens live in memory only; nothing here is persisted. */
export interface GoogleLinkView {
  readonly calendarConnected: boolean
  readonly configured: boolean
  readonly gmailConnected: boolean
  readonly lastCalendarImportAt: string | null
  readonly lastGmailImportAt: string | null
}

/** Result of an import run. `skipped` counts items already present (二重登録防止). */
export interface ExternalImportResultView {
  readonly cancelled: boolean
  readonly imported: number
  readonly reason?: string
  readonly skipped: number
}

export interface WorldView {
  readonly selectedAreaId: string
  /** Records observed but not yet read, for the unobtrusive mark in F-14. */
  readonly unreadObservationCount: number
}

export interface AppReadModel {
  readonly bootstrap: BootstrapView
  readonly calendarEntries: readonly CalendarEntryView[]
  readonly catalogDiscoveries: readonly CatalogDiscoveryView[]
  readonly creatureObservations: readonly CreatureObservationView[]
  readonly googleLink: GoogleLinkView
  readonly migrationAvailable: boolean
  readonly migrationNoticeVisible: boolean
  readonly notifications: NotificationView
  readonly preferences: PreferenceView
  readonly rewardNotice: RewardNoticeView | null
  readonly storageHealth: StorageHealthView
  readonly tasksToday: readonly TaskRowView[]
  readonly world: WorldView
}

export interface AppUiPort {
  // --- lifecycle ---
  getSnapshot(): AppReadModel
  retryBootstrap(): Promise<void>
  subscribe(listener: () => void): () => void

  // --- tasks ---
  createTask(draft: TaskDraft): Promise<void>
  deleteTask(input: { readonly taskId: string }): Promise<void>
  setTaskCompleted(input: {
    readonly completed: boolean
    /**
     * Which occurrence to mark. Omitted means today, which is what the Home
     * screen wants; the calendar names the day the entry was opened on, or a
     * repeating task would resolve to the wrong occurrence.
     */
    readonly localDate?: string
    readonly taskId: string
  }): Promise<void>
  updateTask(input: {
    readonly draft: TaskDraft
    readonly taskId: string
  }): Promise<void>

  // --- calendar ---
  loadCalendarRange(input: {
    readonly fromLocalDate: string
    readonly toLocalDate: string
  }): Promise<void>

  // --- world / observations ---
  markObservationsRead(): Promise<void>
  selectArea(input: { readonly areaId: string }): Promise<void>

  // --- rewards ---
  dismissRewardNotice(): Promise<void>

  // --- preferences ---
  updatePreferences(patch: Partial<PreferenceView>): Promise<void>

  // --- notifications ---
  requestNotificationPermission(): Promise<NotificationView['permission']>
  setNotificationsEnabled(enabled: boolean): Promise<void>

  // --- google ---
  connectGoogle(scope: 'calendar' | 'gmail'): Promise<{
    readonly connected: boolean
    readonly reason?: string
  }>
  disconnectGoogle(scope: 'calendar' | 'gmail'): Promise<void>
  importFromGoogleCalendar(input: {
    readonly fromLocalDate: string
    readonly toLocalDate: string
  }): Promise<ExternalImportResultView>
  importFromGmail(): Promise<ExternalImportResultView>

  // --- storage, migration, backup ---
  acknowledgeMigrationNotice(): Promise<void>
  activatePreparedImport(runId: string): Promise<{
    readonly activated: boolean
    readonly importedTaskCount: number
    readonly reason?: string
  }>
  exportData(): Promise<{ readonly available: boolean; readonly reason?: string }>
  migrateLegacyData(): Promise<{
    readonly migrated: boolean
    readonly migratedTaskCount: number
    readonly reason?: string
  }>
  prepareImport(serializedBackup: string): Promise<ImportPreviewView>
  requestPersistentStorage(): Promise<boolean>
}
