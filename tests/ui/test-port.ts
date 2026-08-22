import type {
  AppReadModel,
  AppUiPort,
  BootstrapView,
  CalendarEntryView,
  ExternalImportResultView,
  ImportPreviewView,
  NotificationView,
  PreferenceView,
  TaskDraft,
  TaskRowView,
} from '@/app/ui-port'
import { DEFAULT_AREA_ID } from '@/world/areas'

/**
 * An in-memory `AppUiPort` for component tests. It implements the whole
 * contract — including the parts a given test does not touch — so that a screen
 * calling an unexercised command fails loudly instead of hitting `undefined`.
 *
 * External integrations (Google, notifications, backups) answer "unavailable"
 * rather than pretending to succeed: a test that needs one is expected to stub
 * that method, and a screen must render sensibly when they are all switched off.
 */
const defaultModel: AppReadModel = {
  bootstrap: { status: 'ready' },
  calendarEntries: [],
  catalogDiscoveries: [],
  creatureObservations: [],
  googleLink: {
    calendarConnected: false,
    configured: false,
    gmailConnected: false,
    lastCalendarImportAt: null,
    lastGmailImportAt: null,
  },
  migrationAvailable: false,
  migrationNoticeVisible: false,
  notifications: { enabled: false, permission: 'default', scheduledCount: 0 },
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
  world: { selectedAreaId: DEFAULT_AREA_ID, unreadObservationCount: 0 },
}

const UNAVAILABLE = 'test unavailable'

function rowFromDraft(id: string, draft: TaskDraft, completed: boolean): TaskRowView {
  return {
    categoryId: draft.categoryId,
    completed,
    id,
    recurrence: draft.recurrence,
    title: draft.title,
    ...(draft.description === undefined ? {} : { description: draft.description }),
    ...(draft.scheduledTime === undefined ? {} : { scheduledTime: draft.scheduledTime }),
  }
}

export class TestUiPort implements AppUiPort {
  private listeners = new Set<() => void>()

  private model: AppReadModel

  private nextTaskId = 1

  constructor(overrides: Partial<AppReadModel> = {}) {
    this.model = { ...defaultModel, ...overrides }
  }

  getSnapshot = (): AppReadModel => this.model

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setBootstrap(bootstrap: BootstrapView): void {
    this.patch({ bootstrap })
  }

  async retryBootstrap(): Promise<void> {
    this.setBootstrap({ status: 'ready' })
  }

  // --- tasks ---

  async createTask(draft: TaskDraft): Promise<void> {
    const id = `task-${this.nextTaskId}`
    this.nextTaskId += 1
    this.patch({ tasksToday: [...this.model.tasksToday, rowFromDraft(id, draft, false)] })
  }

  async deleteTask({ taskId }: { readonly taskId: string }): Promise<void> {
    this.patch({
      tasksToday: this.model.tasksToday.filter((task) => task.id !== taskId),
    })
  }

  async setTaskCompleted({
    completed,
    taskId,
  }: {
    readonly completed: boolean
    readonly localDate?: string
    readonly taskId: string
  }): Promise<void> {
    this.patch({
      calendarEntries: this.model.calendarEntries.map((entry) =>
        entry.taskId === taskId ? { ...entry, completed } : entry,
      ),
      tasksToday: this.model.tasksToday.map((task) =>
        task.id === taskId ? { ...task, completed } : task,
      ),
    })
  }

  async updateTask({
    draft,
    taskId,
  }: {
    readonly draft: TaskDraft
    readonly taskId: string
  }): Promise<void> {
    this.patch({
      tasksToday: this.model.tasksToday.map((task) =>
        task.id === taskId ? rowFromDraft(taskId, draft, task.completed) : task,
      ),
    })
  }

  // --- calendar ---

  async loadCalendarRange(): Promise<void> {
    // Test snapshots are supplied directly by each scenario.
  }

  /** Seeds the month projection a scenario wants on screen. */
  setCalendarEntries(calendarEntries: readonly CalendarEntryView[]): void {
    this.patch({ calendarEntries })
  }

  // --- world / observations ---

  async markObservationsRead(): Promise<void> {
    this.patch({ world: { ...this.model.world, unreadObservationCount: 0 } })
  }

  async selectArea({ areaId }: { readonly areaId: string }): Promise<void> {
    this.patch({ world: { ...this.model.world, selectedAreaId: areaId } })
  }

  // --- rewards ---

  async dismissRewardNotice(): Promise<void> {
    this.patch({ rewardNotice: null })
  }

  // --- preferences ---

  async updatePreferences(patch: Partial<PreferenceView>): Promise<void> {
    this.patch({ preferences: { ...this.model.preferences, ...patch } })
  }

  // --- notifications ---

  async requestNotificationPermission(): Promise<NotificationView['permission']> {
    return 'denied'
  }

  async setNotificationsEnabled(enabled: boolean): Promise<void> {
    this.patch({ notifications: { ...this.model.notifications, enabled } })
  }

  // --- google ---

  async connectGoogle(): Promise<{
    readonly connected: boolean
    readonly reason?: string
  }> {
    return { connected: false, reason: UNAVAILABLE }
  }

  async disconnectGoogle(scope: 'calendar' | 'gmail'): Promise<void> {
    this.patch({
      googleLink: {
        ...this.model.googleLink,
        ...(scope === 'calendar'
          ? { calendarConnected: false }
          : { gmailConnected: false }),
      },
    })
  }

  async importFromGoogleCalendar(): Promise<ExternalImportResultView> {
    return { cancelled: false, imported: 0, reason: UNAVAILABLE, skipped: 0 }
  }

  async importFromGmail(): Promise<ExternalImportResultView> {
    return { cancelled: false, imported: 0, reason: UNAVAILABLE, skipped: 0 }
  }

  // --- storage, migration, backup ---

  async acknowledgeMigrationNotice(): Promise<void> {
    this.patch({ migrationNoticeVisible: false })
  }

  async activatePreparedImport(): Promise<{
    readonly activated: boolean
    readonly importedTaskCount: number
    readonly reason?: string
  }> {
    return { activated: false, importedTaskCount: 0, reason: UNAVAILABLE }
  }

  async exportData(): Promise<{ readonly available: boolean; readonly reason?: string }> {
    return { available: false, reason: UNAVAILABLE }
  }

  async migrateLegacyData(): Promise<{
    readonly migrated: boolean
    readonly migratedTaskCount: number
    readonly reason?: string
  }> {
    return { migrated: false, migratedTaskCount: 0, reason: UNAVAILABLE }
  }

  async prepareImport(): Promise<ImportPreviewView> {
    return { available: false, issue: UNAVAILABLE, rewardCount: 0, taskCount: 0 }
  }

  async requestPersistentStorage(): Promise<boolean> {
    return false
  }

  private patch(next: Partial<AppReadModel>): void {
    this.model = { ...this.model, ...next }
    for (const listener of this.listeners) listener()
  }
}
