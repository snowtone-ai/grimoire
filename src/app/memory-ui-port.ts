import { CREATURE_RECORDS } from '@/features/catalog/creature-records'
import { DEFAULT_AREA_ID, findArea } from '@/world/areas'

import type {
  AppReadModel,
  AppUiPort,
  CalendarEntryView,
  CreatureObservationView,
  ExternalImportResultView,
  NotificationView,
  PreferenceView,
  TaskDraft,
  TaskRowView,
} from './ui-port'

const splashStorageKey = 'grimoire:preference:splash-mode'
const UNAVAILABLE = '端末内データストアが未接続です。'

function isSplashMode(value: string | null): value is PreferenceView['splashMode'] {
  return value === 'off' || value === 'timed' || value === 'always'
}

function initialSplashMode(): PreferenceView['splashMode'] {
  if (typeof window === 'undefined') return 'timed'
  const stored = window.localStorage.getItem(splashStorageKey)
  return isSplashMode(stored) ? stored : 'timed'
}

function unobservedCreatureRecords(): readonly CreatureObservationView[] {
  return Object.freeze(
    CREATURE_RECORDS.map((record) => Object.freeze({ id: record.id, observedAt: null })),
  )
}

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

function calendarEntryFromDraft(id: string, draft: TaskDraft, completed: boolean): CalendarEntryView {
  return {
    categoryId: draft.categoryId,
    completed,
    id,
    localDate: draft.localDate,
    recurrence: draft.recurrence,
    // This adapter keeps one entry per task, so the occurrence id and the task
    // id coincide here. Commands still read `taskId`, matching the durable port.
    taskId: id,
    title: draft.title,
    ...(draft.scheduledTime === undefined ? {} : { scheduledTime: draft.scheduledTime }),
  }
}

/**
 * Preview-only adapter. It makes the UI independently exercisable while the
 * durable core is composed. It never claims that in-memory task writes are
 * backed up or synced, and is replaced at the bootstrap composition root.
 * External integrations (Google, notifications, backups) always answer
 * "unavailable" rather than pretending to succeed — the same honesty rule the
 * durable adapter follows when no real integration is injected.
 */
export class MemoryUiPort implements AppUiPort {
  private listeners = new Set<() => void>()

  private model: AppReadModel = {
    bootstrap: { status: 'ready' },
    calendarEntries: [],
    catalogDiscoveries: [],
    creatureObservations: unobservedCreatureRecords(),
    googleLink: {
      calendarConnected: false,
      configured: false,
      gmailConnected: false,
      lastCalendarImportAt: null,
      lastGmailImportAt: null,
    },
    migrationAvailable: false,
    migrationNoticeVisible: false,
    notifications: { enabled: false, permission: 'unsupported', scheduledCount: 0 },
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
    world: { selectedAreaId: DEFAULT_AREA_ID, unreadObservationCount: 0 },
  }

  private nextTaskId = 1

  getSnapshot = (): AppReadModel => this.model

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async retryBootstrap(): Promise<void> {
    this.model = { ...this.model, bootstrap: { status: 'ready' } }
    this.emit()
  }

  // --- tasks ---

  async createTask(draft: TaskDraft): Promise<void> {
    if (draft.title.trim().length === 0) throw new Error('タスク名を入力してください。')
    const id = globalThis.crypto?.randomUUID?.() ?? `preview-${this.nextTaskId++}`
    this.model = {
      ...this.model,
      calendarEntries: [...this.model.calendarEntries, calendarEntryFromDraft(id, draft, false)],
      tasksToday: [...this.model.tasksToday, rowFromDraft(id, draft, false)],
    }
    this.emit()
  }

  async updateTask({
    draft,
    taskId,
  }: {
    readonly draft: TaskDraft
    readonly taskId: string
  }): Promise<void> {
    if (draft.title.trim().length === 0) throw new Error('タスク名を入力してください。')
    this.model = {
      ...this.model,
      calendarEntries: this.model.calendarEntries.map((entry) =>
        entry.taskId === taskId ? calendarEntryFromDraft(taskId, draft, entry.completed) : entry,
      ),
      tasksToday: this.model.tasksToday.map((task) =>
        task.id === taskId ? rowFromDraft(taskId, draft, task.completed) : task,
      ),
    }
    this.emit()
  }

  async deleteTask({ taskId }: { readonly taskId: string }): Promise<void> {
    this.model = {
      ...this.model,
      calendarEntries: this.model.calendarEntries.filter((entry) => entry.taskId !== taskId),
      tasksToday: this.model.tasksToday.filter((task) => task.id !== taskId),
    }
    this.emit()
  }

  async setTaskCompleted({
    completed,
    taskId,
  }: {
    readonly completed: boolean
    /** Accepted for contract parity; this adapter has no repeating occurrences. */
    readonly localDate?: string
    readonly taskId: string
  }): Promise<void> {
    this.model = {
      ...this.model,
      calendarEntries: this.model.calendarEntries.map((entry) =>
        entry.taskId === taskId ? { ...entry, completed } : entry,
      ),
      tasksToday: this.model.tasksToday.map((task) =>
        task.id === taskId ? { ...task, completed } : task,
      ),
    }
    this.emit()
  }

  // --- calendar ---

  async loadCalendarRange(): Promise<void> {
    // The preview adapter already keeps its complete in-memory range in the snapshot.
  }

  // --- world / observations ---

  async markObservationsRead(): Promise<void> {
    this.model = { ...this.model, world: { ...this.model.world, unreadObservationCount: 0 } }
    this.emit()
  }

  async selectArea({ areaId }: { readonly areaId: string }): Promise<void> {
    this.model = {
      ...this.model,
      world: { ...this.model.world, selectedAreaId: findArea(areaId).id },
    }
    this.emit()
  }

  // --- rewards ---

  async dismissRewardNotice(): Promise<void> {
    this.model = { ...this.model, rewardNotice: null }
    this.emit()
  }

  // --- preferences ---

  async updatePreferences(patch: Partial<PreferenceView>): Promise<void> {
    const preferences = { ...this.model.preferences, ...patch }
    this.model = { ...this.model, preferences }
    if (typeof window !== 'undefined' && patch.splashMode !== undefined) {
      window.localStorage.setItem(splashStorageKey, patch.splashMode)
    }
    this.emit()
  }

  // --- notifications ---

  async requestNotificationPermission(): Promise<NotificationView['permission']> {
    return 'unsupported'
  }

  async setNotificationsEnabled(enabled: boolean): Promise<void> {
    this.model = { ...this.model, notifications: { ...this.model.notifications, enabled } }
    this.emit()
  }

  // --- google ---

  async connectGoogle(): Promise<{ readonly connected: boolean; readonly reason?: string }> {
    return { connected: false, reason: UNAVAILABLE }
  }

  async disconnectGoogle(scope: 'calendar' | 'gmail'): Promise<void> {
    this.model = {
      ...this.model,
      googleLink: {
        ...this.model.googleLink,
        ...(scope === 'calendar' ? { calendarConnected: false } : { gmailConnected: false }),
      },
    }
    this.emit()
  }

  async importFromGoogleCalendar(): Promise<ExternalImportResultView> {
    return { cancelled: false, imported: 0, reason: UNAVAILABLE, skipped: 0 }
  }

  async importFromGmail(): Promise<ExternalImportResultView> {
    return { cancelled: false, imported: 0, reason: UNAVAILABLE, skipped: 0 }
  }

  // --- storage, migration, backup ---

  async acknowledgeMigrationNotice(): Promise<void> {
    this.model = { ...this.model, migrationNoticeVisible: false }
    this.emit()
  }

  async requestPersistentStorage(): Promise<boolean> {
    return false
  }

  async migrateLegacyData(): Promise<{
    readonly migrated: boolean
    readonly migratedTaskCount: number
    readonly reason?: string
  }> {
    return { migrated: false, migratedTaskCount: 0, reason: UNAVAILABLE }
  }

  async prepareImport(): Promise<{
    readonly available: boolean
    readonly issue: string
    readonly rewardCount: number
    readonly taskCount: number
  }> {
    return {
      available: false,
      issue: UNAVAILABLE,
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
      reason: UNAVAILABLE,
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
