import {
  EXPORT_COLLECTION_NAMES,
  type ExportCollectionName,
  type ExportCollections,
  type GrimoireExportEnvelopeV1,
  type ImportValidationIssue,
  type ImportValidationResult,
} from "../application/import-export";
import type { CanonicalHasher } from "../application/ports";
import {
  commandId,
  eventId,
  ianaTimeZone,
  isoInstant,
  localDate,
  localTime,
  occurrenceKey,
  payloadHash,
  seriesId,
  taskId,
  type IanaTimeZone,
  type IsoInstant,
} from "../domain/primitives";
import { assertRecurrenceStart } from "../domain/recurrence";
import {
  normalizeTaskDescription,
  normalizeTaskTitle,
  validateRecurrenceRule,
  type RecurrenceRule,
  type TaskSchedule,
} from "../domain/tasks";

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) && keys.every((key) => allowed.has(key));
}

function parsesString(value: unknown, parser: (input: string) => unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    parser(value);
    return true;
  } catch {
    return false;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isSafeInteger(value: unknown, minimum = Number.MIN_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum;
}

function isSemanticOccurrenceKey(value: unknown): value is string {
  if (typeof value !== "string" || !parsesString(value, occurrenceKey)) return false;
  const match = /^([^@]+)@(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})\[([^\]]+)\]$/u.exec(value);
  return match !== null &&
    parsesString(match[1], seriesId) &&
    parsesString(match[2], localDate) &&
    parsesString(match[3], localTime) &&
    parsesString(match[4], ianaTimeZone);
}

function isJsonValue(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.every((entry) => isJsonValue(entry, seen));
    if (!isRecord(value)) return false;
    return Object.values(value).every(
      (entry) => entry !== undefined && isJsonValue(entry, seen),
    );
  } finally {
    seen.delete(value);
  }
}

function isRecurrenceRule(value: unknown): value is RecurrenceRule | null {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  if (value.frequency === "daily") {
    if (!hasExactKeys(value, ["frequency", "interval"])) return false;
  } else if (value.frequency === "weekly") {
    if (
      !hasExactKeys(value, ["frequency", "interval", "weekdays"]) ||
      !Array.isArray(value.weekdays)
    ) {
      return false;
    }
  } else if (value.frequency === "monthly") {
    if (
      !hasExactKeys(value, ["frequency", "interval", "dayOfMonth", "invalidDatePolicy"])
    ) {
      return false;
    }
  } else if (value.frequency === "yearly") {
    if (
      !hasExactKeys(value, [
        "frequency",
        "interval",
        "month",
        "dayOfMonth",
        "invalidDatePolicy",
      ])
    ) {
      return false;
    }
  } else {
    return false;
  }
  try {
    const snapshot = value.frequency === "weekly"
      ? { ...value, weekdays: [...(value.weekdays as unknown[])] }
      : { ...value };
    validateRecurrenceRule(snapshot as RecurrenceRule);
    return true;
  } catch {
    return false;
  }
}

function isCategoryId(value: unknown): boolean {
  return value === null || value === "job" || value === "life" || value === "university";
}

function isTaskRecord(value: unknown): boolean {
  if (
    !hasExactKeys(
      value,
      [
        "schemaVersion",
        "id",
        "seriesId",
        "title",
        "categoryId",
        "schedule",
        "recurrence",
        "status",
        "createdAt",
        "updatedAt",
        "origin",
      ],
      ["description", "firstCompletedAt"],
    ) ||
    value.schemaVersion !== 1 ||
    !parsesString(value.id, taskId) ||
    !parsesString(value.seriesId, seriesId) ||
    typeof value.title !== "string" ||
    !isCategoryId(value.categoryId) ||
    (value.status !== "active" && value.status !== "tombstone") ||
    (value.origin !== "native" && value.origin !== "migration" && value.origin !== "import") ||
    !parsesString(value.createdAt, isoInstant) ||
    !parsesString(value.updatedAt, isoInstant) ||
    (value.firstCompletedAt !== undefined && !parsesString(value.firstCompletedAt, isoInstant)) ||
    !hasExactKeys(value.schedule, ["localDate", "localTime", "timeZone"]) ||
    !parsesString(value.schedule.localDate, localDate) ||
    !parsesString(value.schedule.localTime, localTime) ||
    !parsesString(value.schedule.timeZone, ianaTimeZone) ||
    !isRecurrenceRule(value.recurrence)
  ) {
    return false;
  }
  try {
    if (normalizeTaskTitle(value.title) !== value.title) return false;
    if (
      value.description !== undefined &&
      (typeof value.description !== "string" ||
        normalizeTaskDescription(value.description) !== value.description)
    ) {
      return false;
    }
    assertRecurrenceStart(value.schedule as unknown as TaskSchedule, value.recurrence);
    return true;
  } catch {
    return false;
  }
}

function isTaskOccurrenceRecord(value: unknown): boolean {
  if (
    !hasExactKeys(
      value,
      [
        "schemaVersion",
        "id",
        "taskId",
        "occurrenceKey",
        "localDate",
        "status",
        "createdAt",
        "updatedAt",
        "origin",
      ],
      ["completedAt", "reopenedAt", "lastCompletionEventId"],
    ) ||
    value.schemaVersion !== 1 ||
    !isSemanticOccurrenceKey(value.id) ||
    !isSemanticOccurrenceKey(value.occurrenceKey) ||
    value.id !== value.occurrenceKey ||
    !parsesString(value.taskId, taskId) ||
    !parsesString(value.localDate, localDate) ||
    (value.status !== "open" && value.status !== "completed") ||
    (value.origin !== "native" && value.origin !== "migration" && value.origin !== "import") ||
    !parsesString(value.createdAt, isoInstant) ||
    !parsesString(value.updatedAt, isoInstant) ||
    (value.completedAt !== undefined && !parsesString(value.completedAt, isoInstant)) ||
    (value.reopenedAt !== undefined && !parsesString(value.reopenedAt, isoInstant)) ||
    (value.lastCompletionEventId !== undefined &&
      !parsesString(value.lastCompletionEventId, eventId))
  ) {
    return false;
  }
  return value.status === "open"
    ? value.completedAt === undefined
    : value.completedAt !== undefined && value.lastCompletionEventId !== undefined;
}

function isCommandResult(kind: unknown, value: unknown): boolean {
  if (kind === "createTask") {
    return (
      hasExactKeys(value, ["taskId", "eventId", "rewardItemId"]) &&
      parsesString(value.taskId, taskId) &&
      parsesString(value.eventId, eventId) &&
      isNonEmptyString(value.rewardItemId)
    );
  }
  if (kind === "updateTask") {
    return (
      hasExactKeys(value, ["taskId", "eventId"]) &&
      parsesString(value.taskId, taskId) &&
      parsesString(value.eventId, eventId)
    );
  }
  if (kind === "deleteTask") {
    return (
      hasExactKeys(value, ["taskId", "deleted"]) &&
      parsesString(value.taskId, taskId) &&
      typeof value.deleted === "boolean"
    );
  }
  if (kind === "importExternalTask") {
    return (
      hasExactKeys(value, ["taskId", "deduplicated"]) &&
      parsesString(value.taskId, taskId) &&
      typeof value.deduplicated === "boolean"
    );
  }
  if (kind === "completeTaskOccurrence") {
    return (
      hasExactKeys(
        value,
        ["taskId", "occurrenceKey", "completionEventId", "rewarded"],
        ["firstCompletionEventId"],
      ) &&
      parsesString(value.taskId, taskId) &&
      isSemanticOccurrenceKey(value.occurrenceKey) &&
      parsesString(value.completionEventId, eventId) &&
      (value.firstCompletionEventId === undefined ||
        parsesString(value.firstCompletionEventId, eventId)) &&
      typeof value.rewarded === "boolean" &&
      (value.rewarded
        ? value.firstCompletionEventId === value.completionEventId
        : value.firstCompletionEventId === undefined)
    );
  }
  if (kind === "reopenTaskOccurrence") {
    return (
      hasExactKeys(value, ["taskId", "occurrenceKey", "reopened"], ["eventId"]) &&
      parsesString(value.taskId, taskId) &&
      isSemanticOccurrenceKey(value.occurrenceKey) &&
      typeof value.reopened === "boolean" &&
      (value.eventId === undefined || parsesString(value.eventId, eventId)) &&
      (value.reopened ? value.eventId !== undefined : value.eventId === undefined)
    );
  }
  return false;
}

function isCommandReceiptRecord(value: unknown): boolean {
  return (
    hasExactKeys(value, [
      "schemaVersion",
      "commandId",
      "kind",
      "payloadHash",
      "result",
      "committedAt",
    ]) &&
    value.schemaVersion === 1 &&
    parsesString(value.commandId, commandId) &&
    (value.kind === "createTask" ||
      value.kind === "updateTask" ||
      value.kind === "deleteTask" ||
      value.kind === "completeTaskOccurrence" ||
      value.kind === "reopenTaskOccurrence" ||
      value.kind === "importExternalTask") &&
    parsesString(value.payloadHash, payloadHash) &&
    isCommandResult(value.kind, value.result) &&
    parsesString(value.committedAt, isoInstant)
  );
}

function isCommittedEvent(
  value: unknown,
): value is Record<string, unknown> & { readonly eventId: string; readonly committedAt: string } {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !parsesString(value.eventId, eventId) ||
    !parsesString(value.taskId, taskId) ||
    !parsesString(value.committedAt, isoInstant)
  ) {
    return false;
  }
  if (value.type === "taskCreated" || value.type === "taskUpdated" || value.type === "taskDeleted") {
    return hasExactKeys(value, ["schemaVersion", "type", "eventId", "taskId", "committedAt"]);
  }
  if (value.type === "taskOccurrenceCompleted" || value.type === "taskOccurrenceReopened") {
    return (
      hasExactKeys(value, [
        "schemaVersion",
        "type",
        "eventId",
        "taskId",
        "occurrenceKey",
        "committedAt",
      ]) && isSemanticOccurrenceKey(value.occurrenceKey)
    );
  }
  if (value.type === "taskCompletedFirstTime") {
    return (
      hasExactKeys(value, [
        "schemaVersion",
        "type",
        "eventId",
        "taskId",
        "occurrenceKey",
        "committedAt",
        "aggregate",
      ]) &&
      isSemanticOccurrenceKey(value.occurrenceKey) &&
      hasExactKeys(value.aggregate, ["completionCountDelta"]) &&
      value.aggregate.completionCountDelta === 1
    );
  }
  return false;
}

function isDomainEventRecord(value: unknown): boolean {
  return (
    hasExactKeys(value, ["schemaVersion", "eventId", "event", "committedAt"]) &&
    value.schemaVersion === 1 &&
    parsesString(value.eventId, eventId) &&
    parsesString(value.committedAt, isoInstant) &&
    isCommittedEvent(value.event) &&
    value.eventId === value.event.eventId &&
    value.committedAt === value.event.committedAt
  );
}

function isOutboxRecord(value: unknown): boolean {
  if (
    !hasExactKeys(
      value,
      ["schemaVersion", "eventId", "event", "state", "attempts", "createdAt"],
      ["publishedAt", "leaseOwner", "leaseExpiresAt"],
    ) ||
    value.schemaVersion !== 1 ||
    !parsesString(value.eventId, eventId) ||
    !isCommittedEvent(value.event) ||
    value.eventId !== value.event.eventId ||
    (value.state !== "pending" && value.state !== "processing" && value.state !== "published") ||
    !isSafeInteger(value.attempts, 0) ||
    !parsesString(value.createdAt, isoInstant) ||
    (value.publishedAt !== undefined && !parsesString(value.publishedAt, isoInstant)) ||
    (value.leaseOwner !== undefined && !isNonEmptyString(value.leaseOwner)) ||
    (value.leaseExpiresAt !== undefined && !parsesString(value.leaseExpiresAt, isoInstant))
  ) {
    return false;
  }
  if (value.state === "published") return value.publishedAt !== undefined;
  if (value.state === "processing") {
    return value.leaseOwner !== undefined && value.leaseExpiresAt !== undefined;
  }
  return value.publishedAt === undefined;
}

function isRewardRecord(value: unknown): boolean {
  return (
    hasExactKeys(value, [
      "schemaVersion",
      "id",
      "taskId",
      "eventId",
      "kind",
      "itemId",
      "committedAt",
    ]) &&
    value.schemaVersion === 1 &&
    parsesString(value.id, eventId) &&
    parsesString(value.eventId, eventId) &&
    value.id === value.eventId &&
    parsesString(value.taskId, taskId) &&
    (value.kind === "created" || value.kind === "completed") &&
    isNonEmptyString(value.itemId) &&
    parsesString(value.committedAt, isoInstant)
  );
}

function isGrowthRecord(value: unknown): boolean {
  return (
    hasExactKeys(value, ["schemaVersion", "id", "taskId", "eventId", "delta", "committedAt"]) &&
    value.schemaVersion === 1 &&
    parsesString(value.id, eventId) &&
    parsesString(value.eventId, eventId) &&
    value.id === value.eventId &&
    parsesString(value.taskId, taskId) &&
    isSafeInteger(value.delta, 1) &&
    parsesString(value.committedAt, isoInstant)
  );
}

function isInventoryRecord(value: unknown): boolean {
  if (!(
    hasExactKeys(value, [
      "schemaVersion",
      "itemId",
      "quantity",
      "firstDiscoveredAt",
      "lastDiscoveredAt",
      "updatedAt",
    ]) &&
    value.schemaVersion === 1 &&
    isNonEmptyString(value.itemId) &&
    isSafeInteger(value.quantity, 1) &&
    typeof value.firstDiscoveredAt === "string" &&
    parsesString(value.firstDiscoveredAt, isoInstant) &&
    typeof value.lastDiscoveredAt === "string" &&
    parsesString(value.lastDiscoveredAt, isoInstant) &&
    typeof value.updatedAt === "string" &&
    parsesString(value.updatedAt, isoInstant)
  )) return false;
  return value.firstDiscoveredAt <= value.lastDiscoveredAt && value.lastDiscoveredAt <= value.updatedAt;
}

function isSettingRecord(value: unknown): boolean {
  return (
    hasExactKeys(value, ["schemaVersion", "key", "value", "updatedAt"]) &&
    value.schemaVersion === 1 &&
    isNonEmptyString(value.key) &&
    isJsonValue(value.value) &&
    parsesString(value.updatedAt, isoInstant)
  );
}

function isCreatureObservationRecord(value: unknown): boolean {
  return (
    hasExactKeys(value, ["schemaVersion", "id", "observedAt"]) &&
    value.schemaVersion === 1 &&
    isNonEmptyString(value.id) &&
    parsesString(value.observedAt, isoInstant)
  );
}

function isExternalTaskLinkRecord(value: unknown): boolean {
  return (
    hasExactKeys(value, ["schemaVersion", "id", "provider", "externalId", "taskId", "importedAt"]) &&
    value.schemaVersion === 1 &&
    isNonEmptyString(value.id) &&
    (value.provider === "google-calendar" || value.provider === "gmail") &&
    isNonEmptyString(value.externalId) &&
    value.id === `${value.provider}:${value.externalId}` &&
    parsesString(value.taskId, taskId) &&
    parsesString(value.importedAt, isoInstant)
  );
}

const RECORD_VALIDATORS: Readonly<Record<ExportCollectionName, (value: unknown) => boolean>> = {
  tasks: isTaskRecord,
  taskOccurrences: isTaskOccurrenceRecord,
  commandReceipts: isCommandReceiptRecord,
  domainEvents: isDomainEventRecord,
  outbox: isOutboxRecord,
  rewardLedger: isRewardRecord,
  growthLedger: isGrowthRecord,
  inventory: isInventoryRecord,
  settings: isSettingRecord,
  creatureObservations: isCreatureObservationRecord,
  externalTaskLinks: isExternalTaskLinkRecord,
};

function hasRequiredRecordFields(collection: ExportCollectionName, value: unknown): boolean {
  return RECORD_VALIDATORS[collection](value);
}

function invalidImport(issues: readonly ImportValidationIssue[]): ImportValidationResult {
  return Object.freeze({ valid: false, issues: Object.freeze(issues) });
}

function recordIdentity(collection: ExportCollectionName, value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const field =
    collection === "inventory"
      ? "itemId"
      : collection === "settings"
        ? "key"
        : collection === "commandReceipts"
          ? "commandId"
          : collection === "domainEvents" || collection === "outbox"
            ? "eventId"
            : "id";
  return typeof value[field] === "string" && value[field].length > 0 ? value[field] : undefined;
}

export async function buildExportEnvelope(
  collections: ExportCollections,
  metadata: Readonly<{
    appVersion: string;
    exportedAt: IsoInstant;
    timeZone: IanaTimeZone;
  }>,
  hasher: CanonicalHasher,
): Promise<GrimoireExportEnvelopeV1> {
  if (metadata.appVersion.length === 0) throw new RangeError("App version must not be empty");
  const manifestEntries = await Promise.all(
    EXPORT_COLLECTION_NAMES.map(async (name) => [
      name,
      Object.freeze({ count: collections[name].length, sha256: await hasher.hash(collections[name]) }),
    ] as const),
  );
  const manifest = Object.freeze(Object.fromEntries(manifestEntries)) as GrimoireExportEnvelopeV1["manifest"];
  return Object.freeze({
    format: "grimoire-export",
    formatVersion: 1,
    schemaVersion: 1,
    appVersion: metadata.appVersion,
    exportedAt: metadata.exportedAt,
    timeZone: metadata.timeZone,
    manifest,
    collections: Object.freeze({ ...collections }),
  });
}

export async function validateImportEnvelope(
  input: unknown,
  hasher: CanonicalHasher,
): Promise<ImportValidationResult> {
  const issues: ImportValidationIssue[] = [];
  if (
    !hasExactKeys(input, [
      "format",
      "formatVersion",
      "schemaVersion",
      "appVersion",
      "exportedAt",
      "timeZone",
      "manifest",
      "collections",
    ]) ||
    input.format !== "grimoire-export"
  ) {
    return invalidImport([
      { code: "CORRUPT_RECORD", path: "$", message: "Not a Grimoire export envelope" },
    ]);
  }
  if (input.formatVersion !== 1 || input.schemaVersion !== 1) {
    return invalidImport([
      {
        code: "UNKNOWN_SCHEMA",
        path: "$.schemaVersion",
        message: "Export schema is newer or unsupported",
      },
    ]);
  }
  if (
    !isNonEmptyString(input.appVersion) ||
    typeof input.exportedAt !== "string" ||
    typeof input.timeZone !== "string" ||
    !isRecord(input.manifest) ||
    !isRecord(input.collections)
  ) {
    return invalidImport([
      { code: "CORRUPT_RECORD", path: "$", message: "Envelope metadata is malformed" },
    ]);
  }
  if (!parsesString(input.exportedAt, isoInstant)) {
    issues.push({ code: "CORRUPT_RECORD", path: "$.exportedAt", message: "Export date is invalid" });
  }
  if (!parsesString(input.timeZone, ianaTimeZone)) {
    issues.push({ code: "CORRUPT_RECORD", path: "$.timeZone", message: "Time zone is invalid" });
  }
  if (!hasExactKeys(input.manifest, EXPORT_COLLECTION_NAMES)) {
    issues.push({ code: "CORRUPT_RECORD", path: "$.manifest", message: "Manifest keys are invalid" });
  }
  if (!hasExactKeys(input.collections, EXPORT_COLLECTION_NAMES)) {
    issues.push({
      code: "CORRUPT_RECORD",
      path: "$.collections",
      message: "Collection keys are invalid",
    });
  }

  for (const name of EXPORT_COLLECTION_NAMES) {
    const records = input.collections[name];
    const manifestEntry = input.manifest[name];
    if (!Array.isArray(records) || !isRecord(manifestEntry)) {
      issues.push({
        code: "CORRUPT_RECORD",
        path: `$.collections.${name}`,
        message: "Collection or manifest entry is missing",
      });
      continue;
    }
    if (!hasExactKeys(manifestEntry, ["count", "sha256"])) {
      issues.push({
        code: "CORRUPT_RECORD",
        path: `$.manifest.${name}`,
        message: "Manifest entry schema is invalid",
      });
    }
    if (!isSafeInteger(manifestEntry.count, 0)) {
      issues.push({
        code: "CORRUPT_RECORD",
        path: `$.manifest.${name}.count`,
        message: "Manifest count is invalid",
      });
    } else if (manifestEntry.count !== records.length) {
      issues.push({
        code: "COUNT_MISMATCH",
        path: `$.manifest.${name}.count`,
        message: "Manifest count does not match collection",
      });
    }
    let expectedHash: string | undefined;
    if (typeof manifestEntry.sha256 !== "string") {
      issues.push({
        code: "CORRUPT_RECORD",
        path: `$.manifest.${name}.sha256`,
        message: "Manifest hash is malformed",
      });
    } else {
      try {
        expectedHash = payloadHash(manifestEntry.sha256);
      } catch {
        issues.push({
          code: "CORRUPT_RECORD",
          path: `$.manifest.${name}.sha256`,
          message: "Manifest hash is malformed",
        });
      }
    }
    if (expectedHash !== undefined) {
      try {
        if ((await hasher.hash(records)) !== expectedHash) {
          issues.push({
            code: "HASH_MISMATCH",
            path: `$.manifest.${name}.sha256`,
            message: "Collection content does not match its hash",
          });
        }
      } catch {
        issues.push({
          code: "CORRUPT_RECORD",
          path: `$.collections.${name}`,
          message: "Collection cannot be canonically encoded",
        });
      }
    }
    const identities = new Set<string>();
    records.forEach((record, index) => {
      if (!hasRequiredRecordFields(name, record)) {
        issues.push({
          code: "CORRUPT_RECORD",
          path: `$.collections.${name}[${index}]`,
          message: "Record schema or identity is invalid",
        });
      }
      const identity = recordIdentity(name, record);
      if (identity !== undefined) {
        if (identities.has(identity)) {
          issues.push({
            code: "CORRUPT_RECORD",
            path: `$.collections.${name}[${index}]`,
            message: "Duplicate record identity in collection",
          });
        }
        identities.add(identity);
      }
    });
  }

  if (issues.length > 0) return invalidImport(issues);
  const envelope = input as unknown as GrimoireExportEnvelopeV1;
  try {
    return Object.freeze({
      valid: true,
      value: Object.freeze({ sourceHash: await hasher.hash(envelope), envelope }),
      issues: [] as const,
    });
  } catch {
    return invalidImport([
      { code: "CORRUPT_RECORD", path: "$", message: "Envelope cannot be canonically encoded" },
    ]);
  }
}
