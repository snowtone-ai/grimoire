import Dexie, { type EntityTable } from "dexie";
import type {
  CommandReceiptRow,
  DomainEventRow,
  GrowthLedgerRow,
  InventoryRow,
  OutboxRow,
  RewardLedgerRow,
  SettingRow,
  TaskOccurrenceRow,
} from "../../application/ports";
import type { EventId, IsoInstant, TaskId } from "../../domain/primitives";
import type { TaskRecord } from "../../domain/tasks";

export const DATABASE_VERSION = 2;

export const DATABASE_V1_STORES = Object.freeze({
  tasks:
    "id,seriesId,status,createdAt,updatedAt,firstCompletedAt,schedule.localDate,schedule.timeZone",
  taskOccurrences: "id,&[taskId+occurrenceKey],taskId,localDate,status,completedAt",
  commandReceipts: "commandId,kind,committedAt",
  domainEvents: "eventId,event.type,event.taskId,committedAt",
  outbox: "eventId,state,createdAt,leaseExpiresAt",
  inboxAcks: "id,&[consumer+eventId],state,leaseExpiresAt",
  rewardLedger: "id,&[taskId+kind],taskId,kind,&eventId,committedAt",
  growthLedger: "id,&eventId,taskId,committedAt",
  inventory: "itemId,updatedAt",
  settings: "key,updatedAt",
  integrations: "provider,state,lastSuccessAt",
  migrationRuns: "id,&[source+sourceHash],status,updatedAt",
  migrationStaging: "id,&[runId+sourceKey],runId,collection",
  importRuns: "id,&sourceHash,status,updatedAt",
  importStaging: "id,&[runId+collection+recordKey],runId,collection",
  localSnapshots: "id,createdAt,sha256,verifiedAt",
});

export interface InboxAckRow {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly consumer: string;
  readonly eventId: EventId;
  readonly state: "processing" | "acknowledged";
  readonly leaseOwner?: string;
  readonly leaseExpiresAt?: IsoInstant;
  readonly acknowledgedAt?: IsoInstant;
}

export interface IntegrationRow {
  readonly schemaVersion: 1;
  readonly provider: string;
  readonly state: "disconnected" | "connected" | "error";
  readonly cursor?: string;
  readonly pendingCount: number;
  readonly lastAttemptAt?: IsoInstant;
  readonly lastSuccessAt?: IsoInstant;
  readonly lastErrorCode?: string;
}

export interface MigrationRunRow {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly source: string;
  readonly sourceHash: string;
  readonly status: "running" | "staged" | "verified" | "active" | "failed" | "superseded";
  readonly recordCount: number;
  readonly updatedAt: IsoInstant;
}

export interface MigrationStagingRow {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly runId: string;
  readonly sourceKey: string;
  readonly collection: string;
  readonly value: unknown;
}

export interface ImportRunRow {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly sourceHash: string;
  readonly status: "validating" | "staged" | "verified" | "active" | "failed";
  readonly createdAt: IsoInstant;
  readonly updatedAt: IsoInstant;
}

export interface ImportStagingRow {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly runId: string;
  readonly collection: string;
  readonly recordKey: string;
  readonly value: unknown;
}

export interface LocalSnapshotRow {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly createdAt: IsoInstant;
  readonly sha256: string;
  readonly json: string;
  readonly verifiedAt?: IsoInstant;
}

export class GrimoireDatabase extends Dexie {
  tasks!: EntityTable<TaskRecord, "id">;
  taskOccurrences!: EntityTable<TaskOccurrenceRow, "id">;
  commandReceipts!: EntityTable<CommandReceiptRow, "commandId">;
  domainEvents!: EntityTable<DomainEventRow, "eventId">;
  outbox!: EntityTable<OutboxRow, "eventId">;
  inboxAcks!: EntityTable<InboxAckRow, "id">;
  rewardLedger!: EntityTable<RewardLedgerRow, "id">;
  growthLedger!: EntityTable<GrowthLedgerRow, "id">;
  inventory!: EntityTable<InventoryRow, "itemId">;
  settings!: EntityTable<SettingRow, "key">;
  integrations!: EntityTable<IntegrationRow, "provider">;
  migrationRuns!: EntityTable<MigrationRunRow, "id">;
  migrationStaging!: EntityTable<MigrationStagingRow, "id">;
  importRuns!: EntityTable<ImportRunRow, "id">;
  importStaging!: EntityTable<ImportStagingRow, "id">;
  localSnapshots!: EntityTable<LocalSnapshotRow, "id">;

  constructor(name = "GrimoireDB") {
    super(name);
    this.version(1).stores(DATABASE_V1_STORES);
    this.version(DATABASE_VERSION)
      .stores({ inventory: DATABASE_V1_STORES.inventory })
      .upgrade(async (transaction) => {
        const rewardTable = transaction.table<RewardLedgerRow, string>("rewardLedger");
        const inventoryTable = transaction.table<InventoryRow, string>("inventory");
        const [rewards, inventory] = await Promise.all([
          rewardTable.toArray(),
          inventoryTable.toArray(),
        ]);
        const windows = new Map<string, { first: IsoInstant; last: IsoInstant }>();
        for (const reward of rewards) {
          const prior = windows.get(reward.itemId);
          if (!prior) {
            windows.set(reward.itemId, {
              first: reward.committedAt,
              last: reward.committedAt,
            });
          } else {
            if (reward.committedAt < prior.first) prior.first = reward.committedAt;
            if (reward.committedAt > prior.last) prior.last = reward.committedAt;
          }
        }
        await inventoryTable.bulkPut(
          inventory.map((row) => {
            const window = windows.get(row.itemId);
            return {
              ...row,
              firstDiscoveredAt: window?.first ?? row.updatedAt,
              lastDiscoveredAt: window?.last ?? row.updatedAt,
            };
          }),
        );
      });
  }
}

export type TaskLookup = Readonly<{ taskId: TaskId }>;
