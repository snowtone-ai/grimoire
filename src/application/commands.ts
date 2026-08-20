import { ApplicationError } from "./errors";
import type {
  AtomicStore,
  AtomicWriteTransaction,
  CanonicalHasher,
  Clock,
  CommandReceiptRow,
  RewardPolicy,
} from "./ports";
import type { CommittedDomainEvent } from "../domain/events";
import {
  eventId,
  type CommandId,
  type IanaTimeZone,
  type LocalDate,
  type LocalTime,
  type OccurrenceKey,
  type PayloadHash,
  type SeriesId,
  type TaskId,
} from "../domain/primitives";
import {
  normalizeTaskDescription,
  normalizeTaskTitle,
  validateRecurrenceRule,
  type RecurrenceRule,
  type TaskRecord,
} from "../domain/tasks";
import { assertRecurrenceStart, isTaskOccurrence, makeOccurrenceKey } from "../domain/recurrence";

export interface CreateTaskPayload {
  readonly taskId: TaskId;
  readonly seriesId: SeriesId;
  readonly title: string;
  readonly description?: string;
  readonly schedule: Readonly<{
    localDate: LocalDate;
    localTime: LocalTime;
    timeZone: IanaTimeZone;
  }>;
  readonly recurrence: RecurrenceRule | null;
}

export interface CreateTaskCommand {
  readonly kind: "createTask";
  readonly commandId: CommandId;
  readonly payloadHash: PayloadHash;
  readonly payload: CreateTaskPayload;
}

export interface CreateTaskResult {
  readonly taskId: TaskId;
  readonly eventId: ReturnType<typeof eventId>;
  readonly rewardItemId: string;
}

export interface CompleteTaskOccurrencePayload {
  readonly taskId: TaskId;
  readonly occurrenceKey: OccurrenceKey;
  readonly localDate: LocalDate;
}

export interface CompleteTaskOccurrenceCommand {
  readonly kind: "completeTaskOccurrence";
  readonly commandId: CommandId;
  readonly payloadHash: PayloadHash;
  readonly payload: CompleteTaskOccurrencePayload;
}

export interface CompleteTaskOccurrenceResult {
  readonly taskId: TaskId;
  readonly occurrenceKey: OccurrenceKey;
  readonly completionEventId: ReturnType<typeof eventId>;
  readonly firstCompletionEventId?: ReturnType<typeof eventId>;
  readonly rewarded: boolean;
}

export interface ReopenTaskOccurrenceCommand {
  readonly kind: "reopenTaskOccurrence";
  readonly commandId: CommandId;
  readonly payloadHash: PayloadHash;
  readonly payload: CompleteTaskOccurrencePayload;
}

export interface ReopenTaskOccurrenceResult {
  readonly taskId: TaskId;
  readonly occurrenceKey: OccurrenceKey;
  readonly reopened: boolean;
  readonly eventId?: ReturnType<typeof eventId>;
}

type TaskCommand =
  | CreateTaskCommand
  | CompleteTaskOccurrenceCommand
  | ReopenTaskOccurrenceCommand;

function snapshotRecurrence(rule: RecurrenceRule | null): RecurrenceRule | null {
  if (rule === null) return null;
  if (rule.frequency === "daily") {
    return Object.freeze({ frequency: rule.frequency, interval: rule.interval });
  }
  if (rule.frequency === "weekly") {
    return Object.freeze({
      frequency: rule.frequency,
      interval: rule.interval,
      weekdays: Object.freeze([...rule.weekdays]),
    });
  }
  if (rule.frequency === "monthly") {
    return Object.freeze({
      frequency: rule.frequency,
      interval: rule.interval,
      dayOfMonth: rule.dayOfMonth,
      invalidDatePolicy: rule.invalidDatePolicy,
    });
  }
  if (rule.frequency === "yearly") {
    return Object.freeze({
      frequency: rule.frequency,
      interval: rule.interval,
      month: rule.month,
      dayOfMonth: rule.dayOfMonth,
      invalidDatePolicy: rule.invalidDatePolicy,
    });
  }
  throw new RangeError("Recurrence frequency is invalid");
}

function snapshotCreateTaskCommand(command: CreateTaskCommand): CreateTaskCommand {
  return Object.freeze({
    kind: command.kind,
    commandId: command.commandId,
    payloadHash: command.payloadHash,
    payload: Object.freeze({
      taskId: command.payload.taskId,
      seriesId: command.payload.seriesId,
      title: command.payload.title,
      ...(command.payload.description === undefined
        ? {}
        : { description: command.payload.description }),
      schedule: Object.freeze({
        localDate: command.payload.schedule.localDate,
        localTime: command.payload.schedule.localTime,
        timeZone: command.payload.schedule.timeZone,
      }),
      recurrence: snapshotRecurrence(command.payload.recurrence),
    }),
  });
}

function snapshotOccurrenceCommand<
  Command extends CompleteTaskOccurrenceCommand | ReopenTaskOccurrenceCommand,
>(command: Command): Command {
  return Object.freeze({
    kind: command.kind,
    commandId: command.commandId,
    payloadHash: command.payloadHash,
    payload: Object.freeze({
      taskId: command.payload.taskId,
      occurrenceKey: command.payload.occurrenceKey,
      localDate: command.payload.localDate,
    }),
  }) as Command;
}

function canonicalCommandPayload(command: TaskCommand): unknown {
  return { kind: command.kind, payload: command.payload };
}

async function assertPayloadHash(
  command: TaskCommand,
  hasher: CanonicalHasher,
): Promise<void> {
  const actual = await hasher.hash(canonicalCommandPayload(command));
  if (actual !== command.payloadHash) {
    throw new ApplicationError("COMMAND_HASH_INVALID", "Command payload hash does not match payload");
  }
}

function readReceipt<Result>(
  prior: CommandReceiptRow | undefined,
  command: TaskCommand,
): Result | undefined {
  if (!prior) return undefined;
  if (prior.kind !== command.kind || prior.payloadHash !== command.payloadHash) {
    throw new ApplicationError(
      "COMMAND_ID_REUSED_WITH_DIFFERENT_PAYLOAD",
      "Command ID was already used with a different payload",
    );
  }
  return prior.result as Result;
}

async function incrementInventory(
  transaction: AtomicWriteTransaction,
  itemId: string,
  committedAt: ReturnType<Clock["now"]>,
): Promise<void> {
  const prior = await transaction.getInventory(itemId);
  await transaction.putInventory({
    schemaVersion: 1,
    itemId,
    quantity: (prior?.quantity ?? 0) + 1,
    firstDiscoveredAt: prior?.firstDiscoveredAt ?? committedAt,
    lastDiscoveredAt: committedAt,
    updatedAt: committedAt,
  });
}

export class TaskCommandService {
  constructor(
    private readonly store: AtomicStore,
    private readonly clock: Clock,
    private readonly hasher: CanonicalHasher,
    private readonly rewardPolicy: RewardPolicy,
  ) {}

  async createTask(command: CreateTaskCommand): Promise<CreateTaskResult> {
    const snapshot = snapshotCreateTaskCommand(command);
    await assertPayloadHash(snapshot, this.hasher);
    const title = normalizeTaskTitle(snapshot.payload.title);
    const description = normalizeTaskDescription(snapshot.payload.description);
    const recurrence = validateRecurrenceRule(snapshot.payload.recurrence);
    assertRecurrenceStart(snapshot.payload.schedule, recurrence);
    if (snapshot.payload.taskId.startsWith("migration:")) {
      throw new ApplicationError("CONSTRAINT", "Native task ID uses a reserved migration prefix");
    }

    return this.store.write(async (transaction) => {
      const prior = readReceipt<CreateTaskResult>(
        await transaction.getCommandReceipt(snapshot.commandId),
        snapshot,
      );
      if (prior) return prior;

      const committedAt = this.clock.now();
      const createdEventId = eventId(`task:${snapshot.payload.taskId}:created:v1`);
      const rewardItemId = this.rewardPolicy.draw(createdEventId);
      if (rewardItemId.length === 0) {
        throw new ApplicationError("CONSTRAINT", "Reward policy returned an empty item ID");
      }
      const task: TaskRecord = Object.freeze({
        schemaVersion: 1,
        id: snapshot.payload.taskId,
        seriesId: snapshot.payload.seriesId,
        title,
        ...(description === undefined ? {} : { description }),
        schedule: snapshot.payload.schedule,
        recurrence,
        status: "active",
        createdAt: committedAt,
        updatedAt: committedAt,
        origin: "native",
      });
      const committedEvent = Object.freeze({
        schemaVersion: 1 as const,
        type: "taskCreated" as const,
        eventId: createdEventId,
        taskId: task.id,
        committedAt,
      });
      const result = Object.freeze({
        taskId: task.id,
        eventId: createdEventId,
        rewardItemId,
      });

      await transaction.addTask(task);
      await transaction.addReward({
        schemaVersion: 1,
        id: createdEventId,
        taskId: task.id,
        eventId: createdEventId,
        kind: "created",
        itemId: rewardItemId,
        committedAt,
      });
      await incrementInventory(transaction, rewardItemId, committedAt);
      await transaction.addDomainEvent({
        schemaVersion: 1,
        eventId: createdEventId,
        event: committedEvent,
        committedAt,
      });
      await transaction.addOutbox({
        schemaVersion: 1,
        eventId: createdEventId,
        event: committedEvent,
        state: "pending",
        attempts: 0,
        createdAt: committedAt,
      });
      await transaction.addCommandReceipt({
        schemaVersion: 1,
        commandId: snapshot.commandId,
        kind: snapshot.kind,
        payloadHash: snapshot.payloadHash,
        result,
        committedAt,
      });
      return result;
    });
  }

  async completeTaskOccurrence(
    command: CompleteTaskOccurrenceCommand,
  ): Promise<CompleteTaskOccurrenceResult> {
    const snapshot = snapshotOccurrenceCommand(command);
    await assertPayloadHash(snapshot, this.hasher);

    return this.store.write(async (transaction) => {
      const prior = readReceipt<CompleteTaskOccurrenceResult>(
        await transaction.getCommandReceipt(snapshot.commandId),
        snapshot,
      );
      if (prior) return prior;

      const task = await transaction.getTask(snapshot.payload.taskId);
      if (!task || task.status !== "active") {
        throw new ApplicationError("TASK_NOT_FOUND", "Task does not exist or is deleted");
      }

      const expectedOccurrenceKey = makeOccurrenceKey(
        task.seriesId,
        task.schedule,
        snapshot.payload.localDate,
      );
      if (
        expectedOccurrenceKey !== snapshot.payload.occurrenceKey ||
        !isTaskOccurrence(task, snapshot.payload.localDate)
      ) {
        throw new ApplicationError("CONSTRAINT", "Occurrence key does not match task schedule");
      }

      const existingOccurrence = await transaction.getOccurrence(snapshot.payload.occurrenceKey);
      const committedAt = this.clock.now();
      if (existingOccurrence?.status === "completed") {
        if (!existingOccurrence.lastCompletionEventId) {
          throw new ApplicationError("CONSTRAINT", "Completed occurrence has no event reference");
        }
        const duplicateResult = Object.freeze({
          taskId: task.id,
          occurrenceKey: snapshot.payload.occurrenceKey,
          completionEventId: existingOccurrence.lastCompletionEventId,
          rewarded: false,
        });
        await transaction.addCommandReceipt({
          schemaVersion: 1,
          commandId: snapshot.commandId,
          kind: snapshot.kind,
          payloadHash: snapshot.payloadHash,
          result: duplicateResult,
          committedAt,
        });
        return duplicateResult;
      }

      const existingCompletionReward = await transaction.getRewardForTask(task.id, "completed");
      if (
        (task.firstCompletedAt === undefined) !== (existingCompletionReward === undefined)
      ) {
        throw new ApplicationError("CONSTRAINT", "First-completion ledger is inconsistent");
      }
      const firstForTask = task.firstCompletedAt === undefined;
      const completionEventId = firstForTask
        ? eventId(`task:${task.id}:completed:v1`)
        : eventId(`event:${snapshot.commandId}:occurrence-completed`);
      const firstCompletionEventId = firstForTask ? completionEventId : undefined;
      const completionEvent: CommittedDomainEvent = firstForTask
        ? Object.freeze({
            schemaVersion: 1,
            type: "taskCompletedFirstTime",
            eventId: completionEventId,
            taskId: task.id,
            occurrenceKey: snapshot.payload.occurrenceKey,
            committedAt,
            aggregate: Object.freeze({ completionCountDelta: 1 as const }),
          })
        : Object.freeze({
            schemaVersion: 1,
            type: "taskOccurrenceCompleted",
            eventId: completionEventId,
            taskId: task.id,
            occurrenceKey: snapshot.payload.occurrenceKey,
            committedAt,
          });
      const completedOccurrence = Object.freeze({
        schemaVersion: 1 as const,
        id: snapshot.payload.occurrenceKey,
        taskId: task.id,
        occurrenceKey: snapshot.payload.occurrenceKey,
        localDate: snapshot.payload.localDate,
        status: "completed" as const,
        completedAt: committedAt,
        lastCompletionEventId: completionEventId,
        createdAt: existingOccurrence?.createdAt ?? committedAt,
        updatedAt: committedAt,
        origin: existingOccurrence?.origin ?? ("native" as const),
      });
      if (existingOccurrence) await transaction.putOccurrence(completedOccurrence);
      else await transaction.addOccurrence(completedOccurrence);

      if (firstForTask) {
        const rewardItemId = this.rewardPolicy.draw(completionEventId);
        if (rewardItemId.length === 0) {
          throw new ApplicationError("CONSTRAINT", "Reward policy returned an empty item ID");
        }
        await transaction.putTask(
          Object.freeze({ ...task, firstCompletedAt: committedAt, updatedAt: committedAt }),
        );
        await transaction.addReward({
          schemaVersion: 1,
          id: completionEventId,
          taskId: task.id,
          eventId: completionEventId,
          kind: "completed",
          itemId: rewardItemId,
          committedAt,
        });
        await transaction.addGrowth({
          schemaVersion: 1,
          id: completionEventId,
          taskId: task.id,
          eventId: completionEventId,
          delta: 1,
          committedAt,
        });
        await incrementInventory(transaction, rewardItemId, committedAt);
      }
      await transaction.addDomainEvent({
        schemaVersion: 1,
        eventId: completionEventId,
        event: completionEvent,
        committedAt,
      });
      await transaction.addOutbox({
        schemaVersion: 1,
        eventId: completionEventId,
        event: completionEvent,
        state: "pending",
        attempts: 0,
        createdAt: committedAt,
      });

      const result = Object.freeze({
        taskId: task.id,
        occurrenceKey: snapshot.payload.occurrenceKey,
        completionEventId,
        ...(firstCompletionEventId === undefined ? {} : { firstCompletionEventId }),
        rewarded: firstForTask,
      });
      await transaction.addCommandReceipt({
        schemaVersion: 1,
        commandId: snapshot.commandId,
        kind: snapshot.kind,
        payloadHash: snapshot.payloadHash,
        result,
        committedAt,
      });
      return result;
    });
  }

  async reopenTaskOccurrence(
    command: ReopenTaskOccurrenceCommand,
  ): Promise<ReopenTaskOccurrenceResult> {
    const snapshot = snapshotOccurrenceCommand(command);
    await assertPayloadHash(snapshot, this.hasher);
    return this.store.write(async (transaction) => {
      const prior = readReceipt<ReopenTaskOccurrenceResult>(
        await transaction.getCommandReceipt(snapshot.commandId),
        snapshot,
      );
      if (prior) return prior;

      const task = await transaction.getTask(snapshot.payload.taskId);
      if (!task || task.status !== "active") {
        throw new ApplicationError("TASK_NOT_FOUND", "Task does not exist or is deleted");
      }
      if (
        makeOccurrenceKey(task.seriesId, task.schedule, snapshot.payload.localDate) !==
          snapshot.payload.occurrenceKey ||
        !isTaskOccurrence(task, snapshot.payload.localDate)
      ) {
        throw new ApplicationError("CONSTRAINT", "Occurrence key does not match task schedule");
      }

      const occurrence = await transaction.getOccurrence(snapshot.payload.occurrenceKey);
      const committedAt = this.clock.now();
      let result: ReopenTaskOccurrenceResult;
      if (!occurrence || occurrence.status === "open") {
        result = Object.freeze({
          taskId: task.id,
          occurrenceKey: snapshot.payload.occurrenceKey,
          reopened: false,
        });
      } else {
        const reopenedEventId = eventId(`event:${snapshot.commandId}:occurrence-reopened`);
        const reopenedEvent: CommittedDomainEvent = Object.freeze({
          schemaVersion: 1,
          type: "taskOccurrenceReopened",
          eventId: reopenedEventId,
          taskId: task.id,
          occurrenceKey: snapshot.payload.occurrenceKey,
          committedAt,
        });
        await transaction.putOccurrence(
          Object.freeze({
            schemaVersion: 1,
            id: occurrence.id,
            taskId: occurrence.taskId,
            occurrenceKey: occurrence.occurrenceKey,
            localDate: occurrence.localDate,
            status: "open",
            reopenedAt: committedAt,
            ...(occurrence.lastCompletionEventId === undefined
              ? {}
              : { lastCompletionEventId: occurrence.lastCompletionEventId }),
            createdAt: occurrence.createdAt,
            updatedAt: committedAt,
            origin: occurrence.origin,
          }),
        );
        await transaction.addDomainEvent({
          schemaVersion: 1,
          eventId: reopenedEventId,
          event: reopenedEvent,
          committedAt,
        });
        await transaction.addOutbox({
          schemaVersion: 1,
          eventId: reopenedEventId,
          event: reopenedEvent,
          state: "pending",
          attempts: 0,
          createdAt: committedAt,
        });
        result = Object.freeze({
          taskId: task.id,
          occurrenceKey: snapshot.payload.occurrenceKey,
          reopened: true,
          eventId: reopenedEventId,
        });
      }
      await transaction.addCommandReceipt({
        schemaVersion: 1,
        commandId: snapshot.commandId,
        kind: snapshot.kind,
        payloadHash: snapshot.payloadHash,
        result,
        committedAt,
      });
      return result;
    });
  }
}

export async function hashCreateTaskCommand(
  command: Omit<CreateTaskCommand, "payloadHash">,
  hasher: CanonicalHasher,
): Promise<PayloadHash> {
  return hasher.hash(canonicalCommandPayload(command as CreateTaskCommand));
}

export async function hashCompleteTaskOccurrenceCommand(
  command: Omit<CompleteTaskOccurrenceCommand, "payloadHash">,
  hasher: CanonicalHasher,
): Promise<PayloadHash> {
  return hasher.hash(canonicalCommandPayload(command as CompleteTaskOccurrenceCommand));
}

export async function hashReopenTaskOccurrenceCommand(
  command: Omit<ReopenTaskOccurrenceCommand, "payloadHash">,
  hasher: CanonicalHasher,
): Promise<PayloadHash> {
  return hasher.hash(canonicalCommandPayload(command as ReopenTaskOccurrenceCommand));
}
