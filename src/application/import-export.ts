import type {
  CommandReceiptRow,
  CreatureObservationRow,
  DomainEventRow,
  ExternalTaskLinkRow,
  GrowthLedgerRow,
  InventoryRow,
  OutboxRow,
  RewardLedgerRow,
  SettingRow,
  TaskOccurrenceRow,
} from "./ports";
import type { IanaTimeZone, IsoInstant, PayloadHash } from "../domain/primitives";
import type { TaskRecord } from "../domain/tasks";

export const EXPORT_COLLECTION_NAMES = [
  "tasks",
  "taskOccurrences",
  "commandReceipts",
  "domainEvents",
  "outbox",
  "rewardLedger",
  "growthLedger",
  "inventory",
  "settings",
  "creatureObservations",
  "externalTaskLinks",
] as const;

export type ExportCollectionName = (typeof EXPORT_COLLECTION_NAMES)[number];

export interface ExportCollections {
  readonly tasks: readonly TaskRecord[];
  readonly taskOccurrences: readonly TaskOccurrenceRow[];
  readonly commandReceipts: readonly CommandReceiptRow[];
  readonly domainEvents: readonly DomainEventRow[];
  readonly outbox: readonly OutboxRow[];
  readonly rewardLedger: readonly RewardLedgerRow[];
  readonly growthLedger: readonly GrowthLedgerRow[];
  readonly inventory: readonly InventoryRow[];
  readonly settings: readonly SettingRow[];
  readonly creatureObservations: readonly CreatureObservationRow[];
  readonly externalTaskLinks: readonly ExternalTaskLinkRow[];
}
export type ExportManifest = Readonly<
  Record<ExportCollectionName, Readonly<{ count: number; sha256: PayloadHash }>>
>;

export interface GrimoireExportEnvelopeV1 {
  readonly format: "grimoire-export";
  readonly formatVersion: 1;
  readonly schemaVersion: 1;
  readonly appVersion: string;
  readonly exportedAt: IsoInstant;
  readonly timeZone: IanaTimeZone;
  readonly manifest: ExportManifest;
  readonly collections: ExportCollections;
}

export interface ImportValidationIssue {
  readonly code: "CORRUPT_RECORD" | "COUNT_MISMATCH" | "HASH_MISMATCH" | "UNKNOWN_SCHEMA";
  readonly path: string;
  readonly message: string;
}

export interface ValidatedImport {
  readonly sourceHash: PayloadHash;
  readonly envelope: GrimoireExportEnvelopeV1;
}

export type ImportValidationResult =
  | Readonly<{ valid: true; value: ValidatedImport; issues: readonly [] }>
  | Readonly<{ valid: false; issues: readonly ImportValidationIssue[] }>;

export interface ImportStageResult {
  readonly runId: string;
  readonly sourceHash: PayloadHash;
  readonly recordCount: number;
  readonly reused: boolean;
  readonly status: "staged";
}

/** Staging is isolated. This port deliberately has no active-table mutation method. */
export interface ImportStagingPort {
  stage(
    validatedImport: ValidatedImport,
    context: Readonly<{ runId: string; now: IsoInstant }>,
  ): Promise<ImportStageResult>;
}
