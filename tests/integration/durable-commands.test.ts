import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TaskCommandService,
  hashCompleteTaskOccurrenceCommand,
  hashCreateTaskCommand,
  hashReopenTaskOccurrenceCommand,
  type CompleteTaskOccurrenceCommand,
  type CreateTaskCommand,
  type ReopenTaskOccurrenceCommand,
} from "../../src/application/commands";
import { ApplicationError } from "../../src/application/errors";
import type { ExportCollections } from "../../src/application/import-export";
import type { CanonicalHasher } from "../../src/application/ports";
import {
  commandId,
  ianaTimeZone,
  isoInstant,
  localDate,
  localTime,
  occurrenceKey,
  seriesId,
  taskId,
} from "../../src/domain/primitives";
import { WebCryptoCanonicalHasher } from "../../src/infrastructure/canonical-json";
import { GrimoireDatabase } from "../../src/infrastructure/dexie/schema";
import { DexieAtomicStore } from "../../src/infrastructure/dexie/store";
import {
  buildExportEnvelope,
  validateImportEnvelope,
} from "../../src/infrastructure/versioned-export";

const hasher = new WebCryptoCanonicalHasher();
const fixedClock = { now: () => isoInstant("2026-08-19T12:34:56.000Z") };
const rewardPolicy = { draw: () => "item:area-1:001" };

function gatedHasher(): Readonly<{ hasher: CanonicalHasher; release: () => void }> {
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return Object.freeze({
    hasher: {
      async hash(value: unknown) {
        await gate;
        return hasher.hash(value);
      },
    },
    release,
  });
}

async function createCommand(
  overrides: Partial<Omit<CreateTaskCommand["payload"], "schedule">> & {
    readonly commandId?: string;
    readonly schedule?: Partial<CreateTaskCommand["payload"]["schedule"]>;
  } = {},
): Promise<CreateTaskCommand> {
  const base = {
    kind: "createTask" as const,
    commandId: commandId(overrides.commandId ?? "cmd-create-1"),
    payload: {
      taskId: overrides.taskId ?? taskId("task-1"),
      seriesId: overrides.seriesId ?? seriesId("series-1"),
      title: overrides.title ?? "朝の記録",
      ...(overrides.description === undefined ? {} : { description: overrides.description }),
      schedule: {
        localDate: overrides.schedule?.localDate ?? localDate("2026-03-08"),
        localTime: overrides.schedule?.localTime ?? localTime("09:00"),
        timeZone: overrides.schedule?.timeZone ?? ianaTimeZone("America/New_York"),
      },
      recurrence: overrides.recurrence ?? { frequency: "daily" as const, interval: 1 },
    },
  };
  return { ...base, payloadHash: await hashCreateTaskCommand(base, hasher) };
}

async function completionCommand(
  commandValue: string,
  dateValue = "2026-03-08",
): Promise<CompleteTaskOccurrenceCommand> {
  const date = localDate(dateValue);
  const base = {
    kind: "completeTaskOccurrence" as const,
    commandId: commandId(commandValue),
    payload: {
      taskId: taskId("task-1"),
      occurrenceKey: occurrenceKey(`series-1@${date}T09:00[America/New_York]`),
      localDate: date,
    },
  };
  return { ...base, payloadHash: await hashCompleteTaskOccurrenceCommand(base, hasher) };
}

async function reopenCommand(commandValue: string): Promise<ReopenTaskOccurrenceCommand> {
  const completion = await completionCommand(commandValue);
  const base = {
    kind: "reopenTaskOccurrence" as const,
    commandId: completion.commandId,
    payload: completion.payload,
  };
  return { ...base, payloadHash: await hashReopenTaskOccurrenceCommand(base, hasher) };
}

describe("durable task commands", () => {
  let database: GrimoireDatabase;
  let service: TaskCommandService;

  beforeEach(() => {
    database = new GrimoireDatabase(`grimoire-test-${crypto.randomUUID()}`);
    service = new TaskCommandService(
      new DexieAtomicStore(database),
      fixedClock,
      hasher,
      rewardPolicy,
    );
  });

  afterEach(async () => {
    database.close();
    await database.delete();
  });

  it("returns the committed receipt without duplicating task, event, or outbox", async () => {
    const command = await createCommand();

    const first = await service.createTask(command);
    const retry = await service.createTask(command);

    expect(retry).toEqual(first);
    await expect(database.tasks.count()).resolves.toBe(1);
    await expect(database.commandReceipts.count()).resolves.toBe(1);
    await expect(database.domainEvents.count()).resolves.toBe(1);
    await expect(database.outbox.count()).resolves.toBe(1);
    await expect(database.rewardLedger.count()).resolves.toBe(1);
    await expect(database.growthLedger.count()).resolves.toBe(0);
    expect(await database.inventory.get("item:area-1:001")).toMatchObject({ quantity: 1 });
  });

  it("rejects a command ID reused with a different valid payload hash", async () => {
    await service.createTask(await createCommand());
    const conflicting = await createCommand({ title: "別の記録" });

    await expect(service.createTask(conflicting)).rejects.toMatchObject({
      code: "COMMAND_ID_REUSED_WITH_DIFFERENT_PAYLOAD",
    } satisfies Partial<ApplicationError>);
    await expect(database.tasks.count()).resolves.toBe(1);
  });

  it("rejects payload mutation before opening the write transaction", async () => {
    const command = await createCommand();
    const mutated = { ...command, payload: { ...command.payload, title: "改ざん" } };

    await expect(service.createTask(mutated)).rejects.toMatchObject({
      code: "COMMAND_HASH_INVALID",
    } satisfies Partial<ApplicationError>);
    await expect(database.tasks.count()).resolves.toBe(0);
  });

  it("snapshots a create payload before the first await", async () => {
    const command = await createCommand();
    const gated = gatedHasher();
    const gatedService = new TaskCommandService(
      new DexieAtomicStore(database),
      fixedClock,
      gated.hasher,
      rewardPolicy,
    );

    const operation = gatedService.createTask(command);
    (command.payload as { title: string }).title = "呼出後の改ざん";
    (command.payload.schedule as { localTime: string }).localTime = "22:00";
    gated.release();

    await expect(operation).resolves.toMatchObject({ taskId: "task-1" });
    expect(await database.tasks.get(taskId("task-1"))).toMatchObject({
      title: "朝の記録",
      schedule: { localTime: "09:00" },
    });
  });

  it("snapshots a completion payload before the first await", async () => {
    await service.createTask(await createCommand());
    const command = await completionCommand("cmd-complete-snapshot");
    const gated = gatedHasher();
    const gatedService = new TaskCommandService(
      new DexieAtomicStore(database),
      fixedClock,
      gated.hasher,
      rewardPolicy,
    );

    const operation = gatedService.completeTaskOccurrence(command);
    (command.payload as { localDate: string }).localDate = "2026-03-09";
    (command.payload as { occurrenceKey: string }).occurrenceKey =
      "series-1@2026-03-09T09:00[America/New_York]";
    gated.release();

    await expect(operation).resolves.toMatchObject({
      occurrenceKey: "series-1@2026-03-08T09:00[America/New_York]",
      rewarded: true,
    });
    await expect(
      database.taskOccurrences.get(
        occurrenceKey("series-1@2026-03-08T09:00[America/New_York]"),
      ),
    ).resolves.toMatchObject({ localDate: "2026-03-08", status: "completed" });
  });

  it("snapshots a reopen payload before the first await", async () => {
    await service.createTask(await createCommand());
    await service.completeTaskOccurrence(await completionCommand("cmd-complete-before-reopen"));
    const command = await reopenCommand("cmd-reopen-snapshot");
    const gated = gatedHasher();
    const gatedService = new TaskCommandService(
      new DexieAtomicStore(database),
      fixedClock,
      gated.hasher,
      rewardPolicy,
    );

    const operation = gatedService.reopenTaskOccurrence(command);
    (command.payload as { taskId: string }).taskId = "task-mutated";
    gated.release();

    await expect(operation).resolves.toMatchObject({ reopened: true, taskId: "task-1" });
    await expect(
      database.taskOccurrences.get(
        occurrenceKey("series-1@2026-03-08T09:00[America/New_York]"),
      ),
    ).resolves.toMatchObject({ status: "open" });
  });

  it("completes an occurrence once and grants first reward and growth once", async () => {
    await service.createTask(await createCommand());

    const first = await service.completeTaskOccurrence(await completionCommand("cmd-complete-1"));
    const duplicate = await service.completeTaskOccurrence(await completionCommand("cmd-complete-2"));

    expect(first.rewarded).toBe(true);
    expect(duplicate.rewarded).toBe(false);
    expect(duplicate.completionEventId).toBe(first.completionEventId);
    await expect(database.taskOccurrences.count()).resolves.toBe(1);
    await expect(database.rewardLedger.count()).resolves.toBe(2);
    await expect(database.growthLedger.count()).resolves.toBe(1);
    await expect(database.domainEvents.count()).resolves.toBe(2);
    await expect(database.outbox.count()).resolves.toBe(2);
    expect(await database.inventory.get("item:area-1:001")).toMatchObject({ quantity: 2 });
  });

  it("durably reopens and recompletes without removing or duplicating earned value", async () => {
    await service.createTask(await createCommand());
    await service.completeTaskOccurrence(await completionCommand("cmd-complete-1"));

    const reopen = await service.reopenTaskOccurrence(await reopenCommand("cmd-reopen-1"));
    const reopenRetry = await service.reopenTaskOccurrence(await reopenCommand("cmd-reopen-1"));
    const recomplete = await service.completeTaskOccurrence(await completionCommand("cmd-complete-2"));

    expect(reopen.reopened).toBe(true);
    expect(reopenRetry).toEqual(reopen);
    expect(recomplete.rewarded).toBe(false);
    expect((await database.taskOccurrences.get(occurrenceKey(
      "series-1@2026-03-08T09:00[America/New_York]",
    )))?.status).toBe("completed");
    await expect(database.rewardLedger.count()).resolves.toBe(2);
    await expect(database.growthLedger.count()).resolves.toBe(1);
    expect(await database.inventory.get("item:area-1:001")).toMatchObject({ quantity: 2 });
    expect((await database.tasks.get(taskId("task-1")))?.firstCompletedAt).toBe(
      "2026-08-19T12:34:56.000Z",
    );
  });

  it("rolls task creation back when reward derivation fails", async () => {
    const failingService = new TaskCommandService(
      new DexieAtomicStore(database),
      fixedClock,
      hasher,
      {
        draw: () => {
          throw new Error("creation reward fault");
        },
      },
    );

    await expect(failingService.createTask(await createCommand())).rejects.toThrow(
      "creation reward fault",
    );
    await expect(database.tasks.count()).resolves.toBe(0);
    await expect(database.rewardLedger.count()).resolves.toBe(0);
    await expect(database.inventory.count()).resolves.toBe(0);
    await expect(database.domainEvents.count()).resolves.toBe(0);
    await expect(database.outbox.count()).resolves.toBe(0);
  });

  it("rolls every completion write back when reward derivation fails", async () => {
    await service.createTask(await createCommand());
    const failingService = new TaskCommandService(
      new DexieAtomicStore(database),
      fixedClock,
      hasher,
      {
        draw: () => {
          throw new Error("fault injection");
        },
      },
    );

    await expect(
      failingService.completeTaskOccurrence(await completionCommand("cmd-complete-fault")),
    ).rejects.toThrow("fault injection");
    await expect(database.taskOccurrences.count()).resolves.toBe(0);
    await expect(database.rewardLedger.count()).resolves.toBe(1);
    await expect(database.growthLedger.count()).resolves.toBe(0);
    await expect(database.domainEvents.count()).resolves.toBe(1);
    await expect(database.outbox.count()).resolves.toBe(1);
    expect(await database.inventory.get("item:area-1:001")).toMatchObject({ quantity: 1 });
    expect((await database.tasks.get(taskId("task-1")))?.firstCompletedAt).toBeUndefined();
  });

  it("rejects an empty first-completion reward ID and rolls the transaction back", async () => {
    const emptyCompletionRewardService = new TaskCommandService(
      new DexieAtomicStore(database),
      fixedClock,
      hasher,
      { draw: (drawEventId) => drawEventId.includes(":created:") ? "item:area-1:001" : "" },
    );
    await emptyCompletionRewardService.createTask(await createCommand());

    await expect(
      emptyCompletionRewardService.completeTaskOccurrence(
        await completionCommand("cmd-empty-completion-reward"),
      ),
    ).rejects.toMatchObject({ code: "CONSTRAINT" } satisfies Partial<ApplicationError>);
    await expect(database.taskOccurrences.count()).resolves.toBe(0);
    await expect(database.commandReceipts.count()).resolves.toBe(1);
    await expect(database.rewardLedger.count()).resolves.toBe(1);
    await expect(database.growthLedger.count()).resolves.toBe(0);
    await expect(database.domainEvents.count()).resolves.toBe(1);
    await expect(database.outbox.count()).resolves.toBe(1);
    expect(await database.inventory.get("item:area-1:001")).toMatchObject({ quantity: 1 });
    expect((await database.tasks.get(taskId("task-1")))?.firstCompletedAt).toBeUndefined();
  });

  it("accepts a strict export containing every durable command collection", async () => {
    await service.createTask(await createCommand());
    await service.completeTaskOccurrence(await completionCommand("cmd-complete-export"));
    const collections: ExportCollections = {
      tasks: await database.tasks.toArray(),
      taskOccurrences: await database.taskOccurrences.toArray(),
      commandReceipts: await database.commandReceipts.toArray(),
      domainEvents: await database.domainEvents.toArray(),
      outbox: await database.outbox.toArray(),
      rewardLedger: await database.rewardLedger.toArray(),
      growthLedger: await database.growthLedger.toArray(),
      inventory: await database.inventory.toArray(),
      settings: await database.settings.toArray(),
    };
    const envelope = await buildExportEnvelope(
      collections,
      {
        appVersion: "0.1.0",
        exportedAt: fixedClock.now(),
        timeZone: ianaTimeZone("Asia/Tokyo"),
      },
      hasher,
    );

    await expect(validateImportEnvelope(envelope, hasher)).resolves.toMatchObject({ valid: true });
  });
});
