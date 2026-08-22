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
  readonly kind:
    | "createTask"
    | "updateTask"
    | "deleteTask"
    | "completeTaskOccurrence"
    | "reopenTaskOccurrence"
    | "importExternalTask";
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

/** One observed record in the Grimo observation journal (決定事項ログ M-11/M-12). */
export interface CreatureObservationRow {
  readonly schemaVersion: 1;
  /** Matches a `CreatureRecordDefinition.id` from `src/features/catalog/creature-records.ts`. */
  readonly id: string;
  readonly observedAt: IsoInstant;
}

/**
 * De-duplication index for external imports (F-4/H-3): one row per external
 * source item that has ever been imported, keyed so a second import of the
 * same source item is recognized before a duplicate task is ever created.
 */
export interface ExternalTaskLinkRow {
  readonly schemaVersion: 1;
  /** `${provider}:${externalId}`, also the table's primary key. */
  readonly id: string;
  readonly provider: "google-calendar" | "gmail";
  readonly externalId: string;
  readonly taskId: TaskId;
  readonly importedAt: IsoInstant;
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
  getExternalTaskLink(
    provider: ExternalTaskLinkRow["provider"],
    externalId: string,
  ): Promise<ExternalTaskLinkRow | undefined>;
  addExternalTaskLink(row: ExternalTaskLinkRow): Promise<void>;
}

export interface AtomicStore {
  write<Result>(operation: (transaction: AtomicWriteTransaction) => Promise<Result>): Promise<Result>;
}

export interface RewardPolicy {
  draw(eventId: EventId): string;
}

/**
 * Narrow ports the data layer depends on for browser notifications and Google
 * linking. `src/integrations/**` (owned by a parallel workstream, T020) is
 * expected to provide the real implementations; until one is injected, the
 * composition root wires an honest "unavailable" default (never a throw, never
 * a faked success) so the rest of the app can render without them.
 */
export type NotificationPermissionState = "default" | "denied" | "granted" | "unsupported";

export interface NotificationIntegrationPort {
  currentPermission(): NotificationPermissionState;
  requestPermission(): Promise<NotificationPermissionState>;
  scheduledCount(): number;
}

export type GoogleLinkScope = "calendar" | "gmail";

/**
 * One inbound item from an external source, already normalized to the shape
 * the data layer expects. This is intentionally the same shape as
 * `src/integrations/imported-item.ts`'s `ImportedScheduleItem` (T020's shared
 * DTO for "every external import source") without importing it: `application`
 * depends only on domain and abstract ports, and a structural match is enough
 * for a real adapter to satisfy this port with zero translation.
 */
export interface ExternalScheduleItem {
  readonly externalId: string;
  readonly title: string;
  readonly localDate: string;
  readonly scheduledTime?: string;
  readonly description?: string;
}

export interface GoogleIntegrationPort {
  isConfigured(): boolean;
  connect(scope: GoogleLinkScope): Promise<Readonly<{ connected: boolean; reason?: string }>>;
  disconnect(scope: GoogleLinkScope): Promise<void>;
  fetchCalendarEvents(
    range: Readonly<{ fromLocalDate: string; toLocalDate: string }>,
  ): Promise<readonly ExternalScheduleItem[]>;
  fetchGmailItems(): Promise<readonly ExternalScheduleItem[]>;
}
