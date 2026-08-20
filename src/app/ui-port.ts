import type { ColorScheme, SplashDisplayMode } from '@/ui/tokens'

/**
 * Read models shaped for the interface. They deliberately contain no reward,
 * recurrence, persistence, or sync rules. The bootstrap adapter maps the
 * durable application core to this boundary.
 */
export interface TaskRowView {
  readonly completed: boolean
  readonly id: string
  readonly scheduledTime?: string
  readonly title: string
}

export interface CalendarEntryView {
  readonly id: string
  readonly localDate: string
  readonly scheduledTime?: string
  readonly title: string
}

export interface CatalogDiscoveryView {
  readonly firstDiscoveredAt: string
  readonly itemId: string
  readonly lastDiscoveredAt: string
  readonly quantity: number
}

export interface RewardNoticeView {
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

export interface AppReadModel {
  readonly bootstrap: BootstrapView
  readonly calendarEntries: readonly CalendarEntryView[]
  readonly catalogDiscoveries: readonly CatalogDiscoveryView[]
  readonly migrationAvailable: boolean
  readonly migrationNoticeVisible: boolean
  readonly preferences: PreferenceView
  readonly rewardNotice: RewardNoticeView | null
  readonly storageHealth: StorageHealthView
  readonly tasksToday: readonly TaskRowView[]
}

export interface AppUiPort {
  acknowledgeMigrationNotice(): Promise<void>
  dismissRewardNotice(): Promise<void>
  createTodayTask(input: { readonly title: string }): Promise<void>
  exportData(): Promise<{ readonly available: boolean; readonly reason?: string }>
  getSnapshot(): AppReadModel
  loadCalendarRange(input: {
    readonly fromLocalDate: string
    readonly toLocalDate: string
  }): Promise<void>
  migrateLegacyData(): Promise<{
    readonly migrated: boolean
    readonly migratedTaskCount: number
    readonly reason?: string
  }>
  prepareImport(serializedBackup: string): Promise<ImportPreviewView>
  activatePreparedImport(runId: string): Promise<{
    readonly activated: boolean
    readonly importedTaskCount: number
    readonly reason?: string
  }>
  requestPersistentStorage(): Promise<boolean>
  retryBootstrap(): Promise<void>
  setTaskCompleted(input: {
    readonly completed: boolean
    readonly taskId: string
  }): Promise<void>
  subscribe(listener: () => void): () => void
  updatePreferences(patch: Partial<PreferenceView>): Promise<void>
}
