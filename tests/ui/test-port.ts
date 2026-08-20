import type {
  AppReadModel,
  AppUiPort,
  BootstrapView,
  PreferenceView,
  TaskRowView,
} from '@/app/ui-port'

const defaultModel: AppReadModel = {
  bootstrap: { status: 'ready' },
  calendarEntries: [],
  catalogDiscoveries: [],
  migrationAvailable: false,
  migrationNoticeVisible: false,
  preferences: {
    bgmEnabled: true,
    colorScheme: 'system',
    motion: 'full',
    sfxEnabled: true,
    splashMode: 'timed',
  },
  rewardNotice: null,
  storageHealth: {
    databaseVersion: 'test',
    lastExportAt: null,
    lastWriteAt: null,
    pendingOperations: 0,
    persistence: 'unknown',
    usageBytes: null,
  },
  tasksToday: [],
}

export class TestUiPort implements AppUiPort {
  private listeners = new Set<() => void>()

  private model: AppReadModel

  constructor(overrides: Partial<AppReadModel> = {}) {
    this.model = { ...defaultModel, ...overrides }
  }

  getSnapshot = (): AppReadModel => this.model

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setBootstrap(bootstrap: BootstrapView): void {
    this.model = { ...this.model, bootstrap }
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

  async createTodayTask({ title }: { readonly title: string }): Promise<void> {
    const task: TaskRowView = {
      completed: false,
      id: `task-${this.model.tasksToday.length + 1}`,
      title: title.trim(),
    }
    this.model = { ...this.model, tasksToday: [...this.model.tasksToday, task] }
    this.emit()
  }

  async exportData(): Promise<{ readonly available: boolean; readonly reason?: string }> {
    return { available: false, reason: 'test unavailable' }
  }

  async requestPersistentStorage(): Promise<boolean> {
    return false
  }

  async loadCalendarRange(): Promise<void> {
    // Test snapshots are supplied directly by each scenario.
  }

  async migrateLegacyData(): Promise<{
    readonly migrated: boolean
    readonly migratedTaskCount: number
    readonly reason?: string
  }> {
    return { migrated: false, migratedTaskCount: 0, reason: 'test unavailable' }
  }

  async prepareImport(): Promise<{
    readonly available: false
    readonly issue: string
    readonly rewardCount: 0
    readonly taskCount: 0
  }> {
    return { available: false, issue: 'test unavailable', rewardCount: 0, taskCount: 0 }
  }

  async activatePreparedImport(): Promise<{
    readonly activated: false
    readonly importedTaskCount: 0
    readonly reason: string
  }> {
    return { activated: false, importedTaskCount: 0, reason: 'test unavailable' }
  }

  async retryBootstrap(): Promise<void> {
    this.setBootstrap({ status: 'ready' })
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
    this.model = {
      ...this.model,
      preferences: { ...this.model.preferences, ...patch },
    }
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}
