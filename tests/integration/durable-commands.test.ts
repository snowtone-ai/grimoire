import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TaskCommandService,
  hashCompleteTaskOccurrenceCommand,
  hashCreateTaskCommand,
  hashDeleteTaskCommand,
  hashImportExternalTaskCommand,
  hashReopenTaskOccurrenceCommand,
  hashUpdateTaskCommand,
  type CompleteTaskOccurrenceCommand,
  type CreateTaskCommand,
  type DeleteTaskCommand,
  type ImportExternalTaskCommand,
  type ReopenTaskOccurrenceCommand,
  type UpdateTaskCommand,
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
      categoryId: overrides.categoryId ?? null,
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

async function updateCommand(
  overrides: Partial<Omit<UpdateTaskCommand["payload"], "schedule">> & {
    readonly commandId?: string;
    readonly schedule?: Partial<UpdateTaskCommand["payload"]["schedule"]>;
  } = {},
): Promise<UpdateTaskCommand> {
  const base = {
    kind: "updateTask" as const,
    commandId: commandId(overrides.commandId ?? "cmd-update-1"),
    payload: {
      taskId: overrides.taskId ?? taskId("task-1"),
      title: overrides.title ?? "更新後の記録",
      categoryId: overrides.categoryId ?? null,
      ...(overrides.description === undefined ? {} : { description: overrides.description }),
      schedule: {
        localDate: overrides.schedule?.localDate ?? localDate("2026-03-08"),
        localTime: overrides.schedule?.localTime ?? localTime("09:00"),
        timeZone: overrides.schedule?.timeZone ?? ianaTimeZone("America/New_York"),
      },
      recurrence:
        overrides.recurrence !== undefined
          ? overrides.recurrence
          : { frequency: "daily" as const, interval: 1 },
    },
  };
  return { ...base, payloadHash: await hashUpdateTaskCommand(base, hasher) };
}

async function deleteCommand(
  commandValue: string,
  taskIdValue = "task-1",
): Promise<DeleteTaskCommand> {
  const base = {
    kind: "deleteTask" as const,
    commandId: commandId(commandValue),
    payload: { taskId: taskId(taskIdValue) },
  };
  return { ...base, payloadHash: await hashDeleteTaskCommand(base, hasher) };
}

async function importCommand(
  overrides: Partial<Omit<ImportExternalTaskCommand["payload"], "schedule">> & {
    readonly commandId?: string;
    readonly schedule?: Partial<ImportExternalTaskCommand["payload"]["schedule"]>;
  } = {},
): Promise<ImportExternalTaskCommand> {
  const base = {
    kind: "importExternalTask" as const,
    commandId: commandId(overrides.commandId ?? "cmd-import-1"),
    payload: {
      taskId: overrides.taskId ?? taskId("task-import-1"),
      seriesId: overrides.seriesId ?? seriesId("series-import-1"),
      provider: overrides.provider ?? "google-calendar",
      externalId: overrides.externalId ?? "external-1",
      title: overrides.title ?? "外部予定",
      ...(overrides.description === undefined ? {} : { description: overrides.description }),
      schedule: {
        localDate: overrides.schedule?.localDate ?? localDate("2026-03-08"),
        localTime: overrides.schedule?.localTime ?? localTime("09:00"),
        timeZone: overrides.schedule?.timeZone ?? ianaTimeZone("America/New_York"),
      },
    },
  };
  return { ...base, payloadHash: await hashImportExternalTaskCommand(base, hasher) };
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

  it("updates title, description, category, schedule and recurrence on an active task", async () => {
    await service.createTask(await createCommand({ categoryId: "job" }));

    const result = await service.updateTask(
      await updateCommand({
        categoryId: "life",
        description: "更新後の詳細",
        recurrence: { frequency: "daily", interval: 2 },
        schedule: { localTime: localTime("18:00") },
        title: "更新後の記録",
      }),
    );

    expect(result).toMatchObject({ taskId: "task-1" });
    await expect(database.tasks.get(taskId("task-1"))).resolves.toMatchObject({
      categoryId: "life",
      description: "更新後の詳細",
      origin: "native",
      recurrence: { frequency: "daily", interval: 2 },
      schedule: { localTime: "18:00" },
      seriesId: "series-1",
      title: "更新後の記録",
    });
    await expect(database.domainEvents.count()).resolves.toBe(2);
    await expect(database.outbox.count()).resolves.toBe(2);
  });

  it("clears a previously set description and recurrence when the edited draft omits them", async () => {
    await service.createTask(await createCommand({ description: "元の詳細" }));

    await service.updateTask(await updateCommand({ recurrence: null }));

    const updated = await database.tasks.get(taskId("task-1"));
    expect(updated?.recurrence).toBeNull();
    expect(updated).not.toHaveProperty("description");
  });

  it("preserves firstCompletedAt and leaves reward and growth ledgers untouched when editing a completed task", async () => {
    await service.createTask(await createCommand());
    await service.completeTaskOccurrence(await completionCommand("cmd-complete-before-edit"));
    const completedAt = (await database.tasks.get(taskId("task-1")))?.firstCompletedAt;

    await service.updateTask(await updateCommand({ title: "完了後の編集" }));

    await expect(database.tasks.get(taskId("task-1"))).resolves.toMatchObject({
      firstCompletedAt: completedAt,
      title: "完了後の編集",
    });
    await expect(database.rewardLedger.count()).resolves.toBe(2);
    await expect(database.growthLedger.count()).resolves.toBe(1);
  });

  it("rejects updating a task that was never created", async () => {
    await expect(service.updateTask(await updateCommand())).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
    } satisfies Partial<ApplicationError>);
  });

  it("rejects updating a task that has been deleted", async () => {
    await service.createTask(await createCommand());
    await service.deleteTask(await deleteCommand("cmd-delete-before-update"));

    await expect(service.updateTask(await updateCommand())).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
    } satisfies Partial<ApplicationError>);
  });

  it("returns the committed update receipt without duplicating the domain event or outbox entry", async () => {
    await service.createTask(await createCommand());
    const command = await updateCommand({ title: "冪等性確認" });

    const first = await service.updateTask(command);
    const retry = await service.updateTask(command);

    expect(retry).toEqual(first);
    await expect(database.domainEvents.count()).resolves.toBe(2);
    await expect(database.outbox.count()).resolves.toBe(2);
    await expect(database.commandReceipts.count()).resolves.toBe(2);
  });

  it("snapshots an update payload before the first await", async () => {
    await service.createTask(await createCommand());
    const command = await updateCommand({ title: "更新前" });
    const gated = gatedHasher();
    const gatedService = new TaskCommandService(
      new DexieAtomicStore(database),
      fixedClock,
      gated.hasher,
      rewardPolicy,
    );

    const operation = gatedService.updateTask(command);
    (command.payload as { title: string }).title = "呼出後の改ざん";
    gated.release();

    await expect(operation).resolves.toMatchObject({ taskId: "task-1" });
    expect(await database.tasks.get(taskId("task-1"))).toMatchObject({ title: "更新前" });
  });

  it("rolls an update back completely when the underlying store fails with a quota error", async () => {
    await service.createTask(await createCommand());
    const quotaError = Object.assign(new Error("quota exceeded"), {
      name: "QuotaExceededError",
    });
    const putSpy = vi.spyOn(database.tasks, "put").mockRejectedValueOnce(quotaError);

    await expect(
      service.updateTask(await updateCommand({ title: "容量超過で失敗する更新" })),
    ).rejects.toThrow("quota exceeded");
    putSpy.mockRestore();

    await expect(database.commandReceipts.count()).resolves.toBe(1);
    await expect(database.domainEvents.count()).resolves.toBe(1);
    await expect(database.outbox.count()).resolves.toBe(1);
    await expect(database.tasks.get(taskId("task-1"))).resolves.toMatchObject({
      title: "朝の記録",
    });
  });

  it("tombstones an active task without touching reward, growth or inventory ledgers", async () => {
    await service.createTask(await createCommand());

    const result = await service.deleteTask(await deleteCommand("cmd-delete-1"));

    expect(result).toEqual({ taskId: "task-1", deleted: true });
    await expect(database.tasks.get(taskId("task-1"))).resolves.toMatchObject({
      status: "tombstone",
    });
    await expect(database.rewardLedger.count()).resolves.toBe(1);
    await expect(database.inventory.get("item:area-1:001")).resolves.toMatchObject({
      quantity: 1,
    });
    await expect(database.domainEvents.count()).resolves.toBe(2);
    await expect(database.outbox.count()).resolves.toBe(2);
  });

  it("is idempotent when deleting an already-tombstoned task without re-emitting an event", async () => {
    await service.createTask(await createCommand());
    await service.deleteTask(await deleteCommand("cmd-delete-1"));

    const second = await service.deleteTask(await deleteCommand("cmd-delete-2"));

    expect(second).toEqual({ taskId: "task-1", deleted: false });
    await expect(database.domainEvents.count()).resolves.toBe(2);
    await expect(database.outbox.count()).resolves.toBe(2);
  });

  it("rejects deleting a task that was never created", async () => {
    await expect(service.deleteTask(await deleteCommand("cmd-delete-missing"))).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
    } satisfies Partial<ApplicationError>);
  });

  it("snapshots a delete payload before the first await", async () => {
    await service.createTask(await createCommand());
    const command = await deleteCommand("cmd-delete-gated");
    const gated = gatedHasher();
    const gatedService = new TaskCommandService(
      new DexieAtomicStore(database),
      fixedClock,
      gated.hasher,
      rewardPolicy,
    );

    const operation = gatedService.deleteTask(command);
    (command.payload as { taskId: string }).taskId = "task-mutated";
    gated.release();

    await expect(operation).resolves.toEqual({ taskId: "task-1", deleted: true });
  });

  it("rolls a delete back completely when the underlying store fails with a quota error", async () => {
    await service.createTask(await createCommand());
    const quotaError = Object.assign(new Error("quota exceeded"), {
      name: "QuotaExceededError",
    });
    const putSpy = vi.spyOn(database.tasks, "put").mockRejectedValueOnce(quotaError);

    await expect(service.deleteTask(await deleteCommand("cmd-delete-quota"))).rejects.toThrow(
      "quota exceeded",
    );
    putSpy.mockRestore();

    await expect(database.commandReceipts.count()).resolves.toBe(1);
    await expect(database.domainEvents.count()).resolves.toBe(1);
    await expect(database.outbox.count()).resolves.toBe(1);
    await expect(database.tasks.get(taskId("task-1"))).resolves.toMatchObject({
      status: "active",
    });
  });

  it("creates a task from an external source and records its dedup link", async () => {
    const result = await service.importExternalTask(await importCommand());

    expect(result).toEqual({ taskId: "task-import-1", deduplicated: false });
    await expect(database.tasks.get(taskId("task-import-1"))).resolves.toMatchObject({
      categoryId: null,
      origin: "import",
      recurrence: null,
      title: "外部予定",
    });
    await expect(
      database.externalTaskLinks.get("google-calendar:external-1"),
    ).resolves.toMatchObject({
      externalId: "external-1",
      provider: "google-calendar",
      taskId: "task-import-1",
    });
    await expect(database.rewardLedger.count()).resolves.toBe(1);
  });

  it("deduplicates a second import of the same external item even under a different command ID", async () => {
    await service.importExternalTask(await importCommand());

    const second = await service.importExternalTask(
      await importCommand({ commandId: "cmd-import-2", title: "重複した外部予定" }),
    );

    expect(second).toEqual({ taskId: "task-import-1", deduplicated: true });
    await expect(database.tasks.count()).resolves.toBe(1);
    await expect(database.externalTaskLinks.count()).resolves.toBe(1);
    await expect(database.rewardLedger.count()).resolves.toBe(1);
  });

  it("does not deduplicate the same external ID across different providers", async () => {
    await service.importExternalTask(await importCommand({ provider: "google-calendar" }));

    const gmailResult = await service.importExternalTask(
      await importCommand({
        commandId: "cmd-import-gmail",
        provider: "gmail",
        taskId: taskId("task-import-2"),
      }),
    );

    expect(gmailResult).toEqual({ taskId: "task-import-2", deduplicated: false });
    await expect(database.tasks.count()).resolves.toBe(2);
    await expect(database.externalTaskLinks.count()).resolves.toBe(2);
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
      creatureObservations: await database.creatureObservations.toArray(),
      externalTaskLinks: await database.externalTaskLinks.toArray(),
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
