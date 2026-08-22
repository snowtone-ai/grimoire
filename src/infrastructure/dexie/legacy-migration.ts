import type { CanonicalHasher } from '@/application/ports'
import {
  isoInstant,
  localDate,
  localTime,
  occurrenceKey,
  seriesId,
  taskId,
  type IanaTimeZone,
} from '@/domain/primitives'
import { isoWeekday, makeOccurrenceKey, monthlyRecurrence } from '@/domain/recurrence'
import {
  normalizeTaskDescription,
  normalizeTaskTitle,
  validateCategoryId,
  type CategoryId,
  type TaskRecord,
} from '@/domain/tasks'

import type { GrimoireDatabase } from './schema'

const LEGACY_DATABASE_NAME = 'TaskManagerDB'

interface LegacySnapshot {
  readonly databaseName: typeof LEGACY_DATABASE_NAME
  readonly capturedAt: string
  readonly stores: Readonly<Record<string, readonly unknown[]>>
}

interface LegacyTask {
  readonly id: string
  readonly title: string
  readonly description?: string
  /** v1's `category` field (決定事項ログ F-4: carried over unchanged, never dropped). */
  readonly category: CategoryId
  readonly dueDate: string
  readonly dueTime: string | null
  readonly completed: boolean
  readonly completedAt: string | null
  readonly recurrence: 'none' | 'daily' | 'weekly' | 'monthly'
  readonly createdAt: string
}

export interface LegacyMigrationResult {
  readonly migrated: boolean
  readonly migratedTaskCount: number
  readonly reused: boolean
  readonly snapshotId: string
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

async function readLegacySnapshot(capturedAt: string): Promise<LegacySnapshot> {
  if (typeof indexedDB.databases !== 'function') {
    throw new Error('このブラウザでは旧データベースを安全に検出できません。')
  }
  const databases = await indexedDB.databases()
  if (!databases.some(({ name }) => name === LEGACY_DATABASE_NAME)) {
    throw new Error('以前のデータは見つかりませんでした。')
  }
  const database = await requestResult(indexedDB.open(LEGACY_DATABASE_NAME))
  try {
    const storeNames = Array.from(database.objectStoreNames)
    const transaction = database.transaction(storeNames, 'readonly')
    const entries = await Promise.all(
      storeNames.map(async (name) => [name, await requestResult(transaction.objectStore(name).getAll())] as const),
    )
    return Object.freeze({
      databaseName: LEGACY_DATABASE_NAME,
      capturedAt,
      stores: Object.freeze(Object.fromEntries(entries)),
    })
  } finally {
    database.close()
  }
}

function record(value: unknown, index: number): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`旧タスク${index + 1}件目が壊れています。`)
  }
  return value as Record<string, unknown>
}

function requiredString(source: Record<string, unknown>, key: string, index: number): string {
  const value = source[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`旧タスク${index + 1}件目の${key}が不正です。`)
  }
  return value
}

function optionalString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key]
  return typeof value === 'string' ? value : undefined
}

function normalizeInstant(value: string, field: string): ReturnType<typeof isoInstant> {
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) throw new RangeError(`${field}が不正です。`)
  return isoInstant(parsed.toISOString())
}

function normalizeLegacyTask(value: unknown, index: number): LegacyTask {
  const source = record(value, index)
  const dueTime = source.dueTime
  const completedAt = source.completedAt
  const recurrence = source.recurrence
  if (dueTime !== null && typeof dueTime !== 'string') throw new TypeError('旧タスクの時刻が不正です。')
  if (completedAt !== null && typeof completedAt !== 'string') {
    throw new TypeError('旧タスクの完了日時が不正です。')
  }
  if (
    recurrence !== 'none' &&
    recurrence !== 'daily' &&
    recurrence !== 'weekly' &&
    recurrence !== 'monthly'
  ) {
    throw new TypeError('旧タスクの繰り返し設定が不正です。')
  }
  if (typeof source.completed !== 'boolean') throw new TypeError('旧タスクの完了状態が不正です。')
  const category = source.category
  if (category !== 'job' && category !== 'university' && category !== 'life') {
    throw new TypeError('旧タスクの分類が不正です。')
  }
  const description = optionalString(source, 'description')
  return Object.freeze({
    id: requiredString(source, 'id', index),
    title: requiredString(source, 'title', index),
    ...(description === undefined ? {} : { description }),
    category,
    dueDate: requiredString(source, 'dueDate', index),
    dueTime,
    completed: source.completed,
    completedAt,
    recurrence,
    createdAt: requiredString(source, 'createdAt', index),
  })
}

function recurrenceFor(task: LegacyTask, date: ReturnType<typeof localDate>) {
  if (task.recurrence === 'none') return null
  if (task.recurrence === 'daily') return Object.freeze({ frequency: 'daily' as const, interval: 1 })
  if (task.recurrence === 'weekly') {
    return Object.freeze({
      frequency: 'weekly' as const,
      interval: 1,
      weekdays: Object.freeze([isoWeekday(date)]),
    })
  }
  const dayOfMonth = Number(date.slice(8, 10))
  return monthlyRecurrence(dayOfMonth)
}

async function convertedTask(
  legacy: LegacyTask,
  index: number,
  timeZone: IanaTimeZone,
  hasher: CanonicalHasher,
): Promise<TaskRecord> {
  const stableHash = await hasher.hash({ legacyTaskId: legacy.id })
  const date = localDate(legacy.dueDate)
  const time = localTime(legacy.dueTime ?? '00:00')
  const createdAt = normalizeInstant(legacy.createdAt, `旧タスク${index + 1}件目の作成日時`)
  const description = normalizeTaskDescription(legacy.description)
  return Object.freeze({
    schemaVersion: 1,
    id: taskId(`migration:${stableHash.slice(0, 32)}`),
    seriesId: seriesId(`migration:${stableHash.slice(0, 32)}`),
    title: normalizeTaskTitle(legacy.title),
    ...(description === undefined ? {} : { description }),
    categoryId: validateCategoryId(legacy.category),
    schedule: Object.freeze({ localDate: date, localTime: time, timeZone }),
    recurrence: recurrenceFor(legacy, date),
    status: 'active',
    createdAt,
    updatedAt: createdAt,
    origin: 'migration',
  })
}

export async function migrateLegacyDatabase(
  database: GrimoireDatabase,
  hasher: CanonicalHasher,
  context: Readonly<{ now: ReturnType<typeof isoInstant>; timeZone: IanaTimeZone }>,
): Promise<LegacyMigrationResult> {
  const snapshot = await readLegacySnapshot(context.now)
  const snapshotJson = JSON.stringify(snapshot)
  const sourceHash = await hasher.hash(snapshot)
  const snapshotId = `legacy:${sourceHash}`
  await database.localSnapshots.put({
    schemaVersion: 1,
    id: snapshotId,
    createdAt: context.now,
    sha256: sourceHash,
    json: snapshotJson,
    verifiedAt: context.now,
  })

  const runId = `legacy:${sourceHash}`
  const existing = await database.migrationRuns.get(runId)
  if (existing?.status === 'active') {
    return Object.freeze({ migrated: false, migratedTaskCount: existing.recordCount, reused: true, snapshotId })
  }
  const rawTasks = snapshot.stores.tasks
  if (!rawTasks) throw new Error('旧データベースにtasks storeがありません。')
  const legacyTasks = rawTasks.map(normalizeLegacyTask)
  await database.migrationRuns.put({
    schemaVersion: 1,
    id: runId,
    source: LEGACY_DATABASE_NAME,
    sourceHash,
    status: 'running',
    recordCount: legacyTasks.length,
    updatedAt: context.now,
  })
  try {
    const tasks = await Promise.all(
      legacyTasks.map((legacy, index) => convertedTask(legacy, index, context.timeZone, hasher)),
    )
    if (new Set(tasks.map((task) => task.id)).size !== tasks.length) {
      throw new Error('旧タスクIDが重複しています。')
    }
    await database.transaction(
      'rw',
      [database.tasks, database.taskOccurrences, database.migrationRuns, database.settings],
      async () => {
        for (let index = 0; index < tasks.length; index += 1) {
          const task = tasks[index]!
          const legacy = legacyTasks[index]!
          await database.tasks.add(task)
          if (legacy.completed) {
            const key = makeOccurrenceKey(task.seriesId, task.schedule, task.schedule.localDate)
            const completedAt = legacy.completedAt === null
              ? task.createdAt
              : normalizeInstant(legacy.completedAt, `旧タスク${index + 1}件目の完了日時`)
            await database.taskOccurrences.add({
              schemaVersion: 1,
              id: occurrenceKey(key),
              taskId: task.id,
              occurrenceKey: key,
              localDate: task.schedule.localDate,
              status: 'completed',
              completedAt,
              createdAt: task.createdAt,
              updatedAt: context.now,
              origin: 'migration',
            })
          }
        }
        await database.migrationRuns.put({
          schemaVersion: 1,
          id: runId,
          source: LEGACY_DATABASE_NAME,
          sourceHash,
          status: 'active',
          recordCount: tasks.length,
          updatedAt: context.now,
        })
        await database.settings.put({
          schemaVersion: 1,
          key: 'migration:legacy-completed',
          value: true,
          updatedAt: context.now,
        })
      },
    )
    return Object.freeze({ migrated: true, migratedTaskCount: tasks.length, reused: false, snapshotId })
  } catch (cause) {
    await database.migrationRuns.put({
      schemaVersion: 1,
      id: runId,
      source: LEGACY_DATABASE_NAME,
      sourceHash,
      status: 'failed',
      recordCount: legacyTasks.length,
      updatedAt: context.now,
    })
    throw cause
  }
}
