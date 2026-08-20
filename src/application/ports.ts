import type { CommittedDomainEvent } from "../domain/events";
import type {
  CommandId,
  EventId,
  IsoInstant,
  OccurrenceKey,
  PayloadHash,
  TaskId,
} from "../domain/primitives";
import type { TaskRecord } from "../domain/tasks";

export interface Clock {
  now(): IsoInstant;
}

export interface CanonicalHasher {
  hash(value: unknown): Promise<PayloadHash>;
}

export interface IdFactory {
  commandId(): CommandId;
  taskId(): TaskId;
}

export interface CommandReceiptRow<Result = unknown> {
  readonly schemaVersion: 1;
  readonly commandId: CommandId;
  readonly kind: "createTask" | "completeTaskOccurrence" | "reopenTaskOccurrence";
  readonly payloadHash: PayloadHash;
  readonly result: Result;
  readonly committedAt: IsoInstant;
}

export interface DomainEventRow {
  readonly schemaVersion: 1;
  readonly eventId: EventId;
  readonly event: CommittedDomainEvent;
  readonly committedAt: IsoInstant;
}

export interface OutboxRow {
  readonly schemaVersion: 1;
  readonly eventId: EventId;
  readonly event: CommittedDomainEvent;
  readonly state: "pending" | "processing" | "published";
  readonly attempts: number;
  readonly createdAt: IsoInstant;
  readonly publishedAt?: IsoInstant;
  readonly leaseOwner?: string;
  readonly leaseExpiresAt?: IsoInstant;
}

export interface TaskOccurrenceRow {
  readonly schemaVersion: 1;
  readonly id: OccurrenceKey;
  readonly taskId: TaskId;
  readonly occurrenceKey: OccurrenceKey;
  readonly localDate: string;
  readonly status: "open" | "completed";
  readonly completedAt?: IsoInstant;
  readonly reopenedAt?: IsoInstant;
  readonly lastCompletionEventId?: EventId;
  readonly createdAt: IsoInstant;
  readonly updatedAt: IsoInstant;
  readonly origin: "native" | "migration" | "import";
}

export interface RewardLedgerRow {
  readonly schemaVersion: 1;
  readonly id: EventId;
  readonly taskId: TaskId;
  readonly eventId: EventId;
  readonly kind: "created" | "completed";
  readonly itemId: string;
  readonly committedAt: IsoInstant;
}

export interface GrowthLedgerRow {
  readonly schemaVersion: 1;
  readonly id: EventId;
  readonly taskId: TaskId;
  readonly eventId: EventId;
  readonly delta: number;
  readonly committedAt: IsoInstant;
}

export interface InventoryRow {
  readonly schemaVersion: 1;
  readonly itemId: string;
  readonly quantity: number;
  readonly firstDiscoveredAt: IsoInstant;
  readonly lastDiscoveredAt: IsoInstant;
  readonly updatedAt: IsoInstant;
}

export interface SettingRow {
  readonly schemaVersion: 1;
  readonly key: string;
  readonly value: unknown;
  readonly updatedAt: IsoInstant;
}

export interface AtomicWriteTransaction {
  getCommandReceipt(commandId: CommandId): Promise<CommandReceiptRow | undefined>;
  addCommandReceipt(receipt: CommandReceiptRow): Promise<void>;
  getTask(taskId: TaskId): Promise<TaskRecord | undefined>;
  addTask(task: TaskRecord): Promise<void>;
  putTask(task: TaskRecord): Promise<void>;
  getOccurrence(occurrenceKey: OccurrenceKey): Promise<TaskOccurrenceRow | undefined>;
  addOccurrence(occurrence: TaskOccurrenceRow): Promise<void>;
  putOccurrence(occurrence: TaskOccurrenceRow): Promise<void>;
  getRewardForTask(
    taskId: TaskId,
    kind: RewardLedgerRow["kind"],
  ): Promise<RewardLedgerRow | undefined>;
  addReward(row: RewardLedgerRow): Promise<void>;
  addGrowth(row: GrowthLedgerRow): Promise<void>;
  getInventory(itemId: string): Promise<InventoryRow | undefined>;
  putInventory(row: InventoryRow): Promise<void>;
  addDomainEvent(row: DomainEventRow): Promise<void>;
  addOutbox(row: OutboxRow): Promise<void>;
}

export interface AtomicStore {
  write<Result>(operation: (transaction: AtomicWriteTransaction) => Promise<Result>): Promise<Result>;
}

export interface RewardPolicy {
  draw(eventId: EventId): string;
}
