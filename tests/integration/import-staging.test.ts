import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  ExportCollectionName,
  ExportCollections,
} from "../../src/application/import-export";
import {
  ianaTimeZone,
  isoInstant,
  localDate,
  localTime,
  seriesId,
  taskId,
} from "../../src/domain/primitives";
import { WebCryptoCanonicalHasher } from "../../src/infrastructure/canonical-json";
import { DexieImportStagingStore } from "../../src/infrastructure/dexie/import-staging";
import { GrimoireDatabase } from "../../src/infrastructure/dexie/schema";
import {
  buildExportEnvelope,
  validateImportEnvelope,
} from "../../src/infrastructure/versioned-export";

const hasher = new WebCryptoCanonicalHasher();
const exportedAt = isoInstant("2026-08-19T12:34:56.000Z");

function exportCollections(): ExportCollections {
  return {
    tasks: [],
    taskOccurrences: [],
    commandReceipts: [],
    domainEvents: [],
    outbox: [],
    rewardLedger: [],
    growthLedger: [],
    inventory: [],
    settings: [
      {
        schemaVersion: 1,
        key: "theme",
        value: "system",
        updatedAt: exportedAt,
      },
    ],
  };
}

function exportCollectionsWithTask(): ExportCollections {
  return {
    ...exportCollections(),
    tasks: [
      {
        schemaVersion: 1,
        id: taskId("task-import-1"),
        seriesId: seriesId("series-import-1"),
        title: "検証対象",
        schedule: {
          localDate: localDate("2026-08-19"),
          localTime: localTime("09:00"),
          timeZone: ianaTimeZone("Asia/Tokyo"),
        },
        recurrence: {
          frequency: "monthly",
          interval: 1,
          dayOfMonth: 19,
          invalidDatePolicy: "clamp",
        },
        status: "active",
        createdAt: exportedAt,
        updatedAt: exportedAt,
        origin: "native",
      },
    ],
  };
}

type MutableEnvelope = {
  manifest: Record<ExportCollectionName, { count: number; sha256: string }>;
  collections: Record<ExportCollectionName, unknown[]>;
};

async function rehashCollection(
  envelope: unknown,
  collection: ExportCollectionName,
): Promise<MutableEnvelope> {
  const mutable = structuredClone(envelope) as MutableEnvelope;
  mutable.manifest[collection].count = mutable.collections[collection].length;
  mutable.manifest[collection].sha256 = await hasher.hash(mutable.collections[collection]);
  return mutable;
}

describe("versioned import staging", () => {
  let database: GrimoireDatabase;

  beforeEach(() => {
    database = new GrimoireDatabase(`grimoire-import-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    database.close();
    await database.delete();
  });

  it("rejects corrupt collection content before it can reach staging", async () => {
    const envelope = await buildExportEnvelope(
      exportCollections(),
      { appVersion: "0.1.0", exportedAt, timeZone: ianaTimeZone("Asia/Tokyo") },
      hasher,
    );
    const corrupt = structuredClone(envelope) as unknown as {
      collections: { settings: unknown[] };
    };
    corrupt.collections.settings.push({ schemaVersion: 1, key: "motion", value: "full" });

    const result = await validateImportEnvelope(corrupt, hasher);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining(["COUNT_MISMATCH", "HASH_MISMATCH", "CORRUPT_RECORD"]),
      );
    }
    await expect(database.importStaging.count()).resolves.toBe(0);
    await expect(database.settings.count()).resolves.toBe(0);
  });

  it("rejects a newer schema instead of guessing how to import it", async () => {
    const envelope = await buildExportEnvelope(
      exportCollections(),
      { appVersion: "0.1.0", exportedAt, timeZone: ianaTimeZone("Asia/Tokyo") },
      hasher,
    );

    const result = await validateImportEnvelope({ ...envelope, schemaVersion: 2 }, hasher);

    expect(result).toMatchObject({ valid: false, issues: [{ code: "UNKNOWN_SCHEMA" }] });
  });

  it.each([
    ["invalid local date", (task: Record<string, unknown>) => {
      (task.schedule as Record<string, unknown>).localDate = "2026-02-31";
    }],
    ["invalid local time", (task: Record<string, unknown>) => {
      (task.schedule as Record<string, unknown>).localTime = "25:00";
    }],
    ["invalid IANA zone", (task: Record<string, unknown>) => {
      (task.schedule as Record<string, unknown>).timeZone = "Moon/SeaOfTranquility";
    }],
    ["missing required field", (task: Record<string, unknown>) => {
      delete task.updatedAt;
    }],
  ] as const)("rejects a correctly rehashed task with %s", async (_label, corruptTask) => {
    const envelope = await buildExportEnvelope(
      exportCollectionsWithTask(),
      { appVersion: "0.1.0", exportedAt, timeZone: ianaTimeZone("Asia/Tokyo") },
      hasher,
    );
    const mutable = structuredClone(envelope) as unknown as MutableEnvelope;
    corruptTask(mutable.collections.tasks[0] as Record<string, unknown>);
    const corrupt = await rehashCollection(mutable, "tasks");

    const result = await validateImportEnvelope(corrupt, hasher);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.code)).toContain("CORRUPT_RECORD");
      expect(result.issues.map((issue) => issue.code)).not.toContain("HASH_MISMATCH");
    }
  });

  it("rejects strict unknown fields and duplicate identities with correct hashes", async () => {
    const envelope = await buildExportEnvelope(
      exportCollectionsWithTask(),
      { appVersion: "0.1.0", exportedAt, timeZone: ianaTimeZone("Asia/Tokyo") },
      hasher,
    );
    const mutable = structuredClone(envelope) as unknown as MutableEnvelope;
    (mutable.collections.tasks[0] as Record<string, unknown>).unexpected = true;
    mutable.collections.tasks.push(structuredClone(mutable.collections.tasks[0]));
    const corrupt = await rehashCollection(mutable, "tasks");

    const result = await validateImportEnvelope(corrupt, hasher);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: "Record schema or identity is invalid" }),
          expect.objectContaining({ message: "Duplicate record identity in collection" }),
        ]),
      );
      expect(result.issues.map((issue) => issue.code)).not.toContain("HASH_MISMATCH");
    }
  });

  it("stages a verified envelope once without touching active settings", async () => {
    const envelope = await buildExportEnvelope(
      exportCollections(),
      { appVersion: "0.1.0", exportedAt, timeZone: ianaTimeZone("Asia/Tokyo") },
      hasher,
    );
    const validation = await validateImportEnvelope(envelope, hasher);
    expect(validation.valid).toBe(true);
    if (!validation.valid) throw new Error("fixture unexpectedly failed validation");
    const staging = new DexieImportStagingStore(database);

    const first = await staging.stage(validation.value, { runId: "import-1", now: exportedAt });
    const retry = await staging.stage(validation.value, { runId: "import-2", now: exportedAt });

    expect(first).toMatchObject({ runId: "import-1", recordCount: 1, reused: false });
    expect(retry).toMatchObject({ runId: "import-1", recordCount: 1, reused: true });
    await expect(database.importRuns.count()).resolves.toBe(1);
    await expect(database.importStaging.count()).resolves.toBe(1);
    await expect(database.settings.count()).resolves.toBe(0);
  });
});
