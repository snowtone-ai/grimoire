import type {
  AppReadModel,
  AppUiPort,
  PreferenceView,
  TaskRowView,
} from './ui-port'

const splashStorageKey = 'grimoire:preference:splash-mode'

function isSplashMode(value: string | null): value is PreferenceView['splashMode'] {
  return value === 'off' || value === 'timed' || value === 'always'
}

function initialSplashMode(): PreferenceView['splashMode'] {
  if (typeof window === 'undefined') return 'timed'
  const stored = window.localStorage.getItem(splashStorageKey)
  return isSplashMode(stored) ? stored : 'timed'
}

/**
 * Preview-only adapter. It makes the UI independently exercisable while the
 * durable core is composed. It never claims that in-memory task writes are
 * backed up or synced, and is replaced at the bootstrap composition root.
 */
export class MemoryUiPort implements AppUiPort {
  private listeners = new Set<() => void>()

  private model: AppReadModel = {
    bootstrap: { status: 'ready' },
    calendarEntries: [],
    catalogDiscoveries: [],
    migrationAvailable: false,
    migrationNoticeVisible: false,
    preferences: {
      bgmEnabled: true,
      colorScheme: 'system',
      motion: 'system',
      sfxEnabled: true,
      splashMode: initialSplashMode(),
    },
    rewardNotice: null,
    storageHealth: {
      databaseVersion: '未接続',
      lastExportAt: null,
      lastWriteAt: null,
      pendingOperations: 0,
      persistence: 'unknown',
      usageBytes: null,
    },
    tasksToday: [],
  }

  getSnapshot = (): AppReadModel => this.model

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async createTodayTask({ title }: { readonly title: string }): Promise<void> {
    const normalizedTitle = title.trim()
    if (normalizedTitle.length === 0) throw new Error('タスク名を入力してください。')

    const task: TaskRowView = {
      completed: false,
      id: globalThis.crypto?.randomUUID?.() ?? `preview-${Date.now()}`,
      title: normalizedTitle,
    }
    this.model = {
      ...this.model,
      calendarEntries: [
        ...this.model.calendarEntries,
        {
          id: task.id,
          localDate: formatLocalDate(new Date()),
          title: task.title,
        },
      ],
      tasksToday: [...this.model.tasksToday, task],
    }
    this.emit()
  }

  async setTaskCompleted({
    completed,
    taskId,
  }: {
    readonly completed: boolean
    readonly taskId: string
  }): Promise<void> {
    this.model = {
      ...this.model,
      tasksToday: this.model.tasksToday.map((task) =>
        task.id === taskId ? { ...task, completed } : task,
      ),
    }
    this.emit()
  }

  async updatePreferences(patch: Partial<PreferenceView>): Promise<void> {
    const preferences = { ...this.model.preferences, ...patch }
    this.model = { ...this.model, preferences }
    if (typeof window !== 'undefined' && patch.splashMode !== undefined) {
      window.localStorage.setItem(splashStorageKey, patch.splashMode)
    }
    this.emit()
  }

  async acknowledgeMigrationNotice(): Promise<void> {
    this.model = { ...this.model, migrationNoticeVisible: false }
    this.emit()
  }

  async dismissRewardNotice(): Promise<void> {
    this.model = { ...this.model, rewardNotice: null }
    this.emit()
  }

  async retryBootstrap(): Promise<void> {
    this.model = { ...this.model, bootstrap: { status: 'ready' } }
    this.emit()
  }

  async requestPersistentStorage(): Promise<boolean> {
    return false
  }

  async loadCalendarRange(): Promise<void> {
    // The preview adapter already keeps its complete in-memory range in the snapshot.
  }

  async migrateLegacyData(): Promise<{
    readonly migrated: boolean
    readonly migratedTaskCount: number
    readonly reason?: string
  }> {
    return { migrated: false, migratedTaskCount: 0, reason: '端末内データストアが未接続です。' }
  }

  async prepareImport(): Promise<{
    readonly available: boolean
    readonly issue: string
    readonly rewardCount: number
    readonly taskCount: number
  }> {
    return {
      available: false,
      issue: '端末内データストアが未接続です。',
      rewardCount: 0,
      taskCount: 0,
    }
  }

  async activatePreparedImport(): Promise<{
    readonly activated: false
    readonly importedTaskCount: 0
    readonly reason: string
  }> {
    return {
      activated: false,
      importedTaskCount: 0,
      reason: '端末内データストアが未接続です。',
    }
  }

  async exportData(): Promise<{ readonly available: boolean; readonly reason?: string }> {
    return {
      available: false,
      reason: '端末内データストアの接続後に利用できます。',
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
