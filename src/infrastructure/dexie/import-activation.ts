import type { ExportCollections, ValidatedImport } from '@/application/import-export'
import type { CanonicalHasher } from '@/application/ports'
import type { IanaTimeZone, IsoInstant } from '@/domain/primitives'
import { buildExportEnvelope } from '@/infrastructure/versioned-export'

import type { GrimoireDatabase } from './schema'

export interface ImportDryRunIssue {
  readonly code: 'DUPLICATE_ID' | 'INVENTORY_MISMATCH' | 'ORPHAN_REFERENCE' | 'STAGING_MISMATCH'
  readonly path: string
  readonly message: string
}

export interface ImportDryRunReport {
  readonly valid: boolean
  readonly issues: readonly ImportDryRunIssue[]
  readonly taskCount: number
  readonly rewardCount: number
}

function duplicateValues(values: readonly string[]): readonly string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates]
}

export function inspectImportReferences(collections: ExportCollections): ImportDryRunReport {
  const issues: ImportDryRunIssue[] = []
  const taskIds = new Set<string>(collections.tasks.map((task) => task.id))
  const eventIds = new Set<string>(collections.domainEvents.map((row) => row.eventId))
  const checkDuplicates = (path: string, values: readonly string[]) => {
    for (const duplicate of duplicateValues(values)) {
      issues.push({
        code: 'DUPLICATE_ID',
        path,
        message: `重複IDを検出しました: ${duplicate}`,
      })
    }
  }
  checkDuplicates('$.collections.tasks', collections.tasks.map((row) => row.id))
  checkDuplicates('$.collections.taskOccurrences', collections.taskOccurrences.map((row) => row.occurrenceKey))
  checkDuplicates('$.collections.commandReceipts', collections.commandReceipts.map((row) => row.commandId))
  checkDuplicates('$.collections.domainEvents', collections.domainEvents.map((row) => row.eventId))
  checkDuplicates('$.collections.outbox', collections.outbox.map((row) => row.eventId))
  checkDuplicates('$.collections.rewardLedger', collections.rewardLedger.map((row) => row.id))
  checkDuplicates('$.collections.growthLedger', collections.growthLedger.map((row) => row.id))
  checkDuplicates('$.collections.inventory', collections.inventory.map((row) => row.itemId))
  checkDuplicates('$.collections.settings', collections.settings.map((row) => row.key))
  checkDuplicates('$.collections.creatureObservations', collections.creatureObservations.map((row) => row.id))
  checkDuplicates('$.collections.externalTaskLinks', collections.externalTaskLinks.map((row) => row.id))

  const requireTask = (taskId: string, path: string) => {
    if (!taskIds.has(taskId)) {
      issues.push({ code: 'ORPHAN_REFERENCE', path, message: `存在しないタスクを参照しています: ${taskId}` })
    }
  }
  const requireEvent = (eventId: string, path: string) => {
    if (!eventIds.has(eventId)) {
      issues.push({ code: 'ORPHAN_REFERENCE', path, message: `存在しないイベントを参照しています: ${eventId}` })
    }
  }
  collections.taskOccurrences.forEach((row, index) => requireTask(row.taskId, `$.collections.taskOccurrences[${index}].taskId`))
  collections.domainEvents.forEach((row, index) => {
    requireTask(row.event.taskId, `$.collections.domainEvents[${index}].event.taskId`)
    if (row.eventId !== row.event.eventId) {
      issues.push({
        code: 'ORPHAN_REFERENCE',
        path: `$.collections.domainEvents[${index}].eventId`,
        message: 'event wrapperとpayloadのIDが一致しません。',
      })
    }
  })
  collections.outbox.forEach((row, index) => {
    requireEvent(row.eventId, `$.collections.outbox[${index}].eventId`)
    if (row.eventId !== row.event.eventId) {
      issues.push({
        code: 'ORPHAN_REFERENCE',
        path: `$.collections.outbox[${index}].eventId`,
        message: 'outbox wrapperとpayloadのIDが一致しません。',
      })
    }
  })
  collections.rewardLedger.forEach((row, index) => {
    requireTask(row.taskId, `$.collections.rewardLedger[${index}].taskId`)
    requireEvent(row.eventId, `$.collections.rewardLedger[${index}].eventId`)
  })
  collections.growthLedger.forEach((row, index) => {
    requireTask(row.taskId, `$.collections.growthLedger[${index}].taskId`)
    requireEvent(row.eventId, `$.collections.growthLedger[${index}].eventId`)
  })
  collections.externalTaskLinks.forEach((row, index) => {
    requireTask(row.taskId, `$.collections.externalTaskLinks[${index}].taskId`)
    if (row.id !== `${row.provider}:${row.externalId}`) {
      issues.push({
        code: 'ORPHAN_REFERENCE',
        path: `$.collections.externalTaskLinks[${index}].id`,
        message: 'idがprovider/externalIdと一致しません。',
      })
    }
  })

  const rewardProjection = new Map<string, { quantity: number; first: string; last: string }>()
  for (const reward of collections.rewardLedger) {
    const prior = rewardProjection.get(reward.itemId)
    if (!prior) {
      rewardProjection.set(reward.itemId, {
        quantity: 1,
        first: reward.committedAt,
        last: reward.committedAt,
      })
    } else {
      prior.quantity += 1
      if (reward.committedAt < prior.first) prior.first = reward.committedAt
      if (reward.committedAt > prior.last) prior.last = reward.committedAt
    }
  }
  const inventoryProjection = new Map(collections.inventory.map((row) => [row.itemId, row]))
  const itemIds = new Set([...rewardProjection.keys(), ...inventoryProjection.keys()])
  for (const itemId of itemIds) {
    const reward = rewardProjection.get(itemId)
    const inventory = inventoryProjection.get(itemId)
    if (
      !reward ||
      !inventory ||
      reward.quantity !== inventory.quantity ||
      reward.first !== inventory.firstDiscoveredAt ||
      reward.last !== inventory.lastDiscoveredAt
    ) {
      issues.push({
        code: 'INVENTORY_MISMATCH',
        path: '$.collections.inventory',
        message: `報酬台帳と所持品の投影が一致しません: ${itemId}`,
      })
    }
  }

  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues),
    taskCount: collections.tasks.length,
    rewardCount: collections.rewardLedger.length,
  })
}

async function currentCollections(database: GrimoireDatabase): Promise<ExportCollections> {
  return {
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
}

export async function activateStagedImport(
  database: GrimoireDatabase,
  validatedImport: ValidatedImport,
  context: Readonly<{
    runId: string
    now: IsoInstant
    timeZone: IanaTimeZone
    appVersion: string
  }>,
  hasher: CanonicalHasher,
): Promise<Readonly<{ backupSnapshotId: string; importedTaskCount: number }>> {
  const run = await database.importRuns.get(context.runId)
  if (!run || run.sourceHash !== validatedImport.sourceHash || run.status !== 'staged') {
    throw new Error('検証済みstagingと読み込み要求が一致しません。')
  }
  if ((await hasher.hash(validatedImport.envelope)) !== validatedImport.sourceHash) {
    throw new Error('検証後に読み込み内容が変更されました。')
  }
  const report = inspectImportReferences(validatedImport.envelope.collections)
  if (!report.valid) throw new Error(report.issues[0]?.message ?? '参照整合性を確認できません。')
  const stagedCount = await database.importStaging.where('runId').equals(context.runId).count()
  const expectedCount = Object.values(validatedImport.envelope.collections)
    .reduce((total, rows) => total + rows.length, 0)
  if (stagedCount !== expectedCount) throw new Error('staging件数が検証時から変わっています。')

  const before = await currentCollections(database)
  const backup = await buildExportEnvelope(
    before,
    { appVersion: context.appVersion, exportedAt: context.now, timeZone: context.timeZone },
    hasher,
  )
  const backupJson = JSON.stringify(backup)
  const backupHash = await hasher.hash(backup)
  const backupSnapshotId = `pre-import:${context.now}:${backupHash}`
  await database.localSnapshots.put({
    schemaVersion: 1,
    id: backupSnapshotId,
    createdAt: context.now,
    sha256: backupHash,
    json: backupJson,
    verifiedAt: context.now,
  })

  const collections = validatedImport.envelope.collections
  try {
    await database.transaction(
      'rw',
      [
        database.tasks,
        database.taskOccurrences,
        database.commandReceipts,
        database.domainEvents,
        database.outbox,
        database.rewardLedger,
        database.growthLedger,
        database.inventory,
        database.settings,
        database.creatureObservations,
        database.externalTaskLinks,
        database.importRuns,
      ],
      async () => {
        await Promise.all([
          database.tasks.clear(),
          database.taskOccurrences.clear(),
          database.commandReceipts.clear(),
          database.domainEvents.clear(),
          database.outbox.clear(),
          database.rewardLedger.clear(),
          database.growthLedger.clear(),
          database.inventory.clear(),
          database.settings.clear(),
          database.creatureObservations.clear(),
          database.externalTaskLinks.clear(),
        ])
        await database.tasks.bulkAdd([...collections.tasks])
        await database.taskOccurrences.bulkAdd([...collections.taskOccurrences])
        await database.commandReceipts.bulkAdd([...collections.commandReceipts])
        await database.domainEvents.bulkAdd([...collections.domainEvents])
        await database.outbox.bulkAdd([...collections.outbox])
        await database.rewardLedger.bulkAdd([...collections.rewardLedger])
        await database.growthLedger.bulkAdd([...collections.growthLedger])
        await database.inventory.bulkAdd([...collections.inventory])
        await database.settings.bulkAdd([...collections.settings])
        await database.creatureObservations.bulkAdd([...collections.creatureObservations])
        await database.externalTaskLinks.bulkAdd([...collections.externalTaskLinks])
        await database.importRuns.update(context.runId, { status: 'active', updatedAt: context.now })
      },
    )
  } catch (cause) {
    await database.importRuns.update(context.runId, { status: 'failed', updatedAt: context.now })
    throw cause
  }
  return Object.freeze({ backupSnapshotId, importedTaskCount: collections.tasks.length })
}
