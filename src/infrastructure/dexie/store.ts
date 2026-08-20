import type {
  AtomicStore,
  AtomicWriteTransaction,
  CommandReceiptRow,
  DomainEventRow,
  GrowthLedgerRow,
  InventoryRow,
  OutboxRow,
  RewardLedgerRow,
  TaskOccurrenceRow,
} from "../../application/ports";
import type { CommandId, OccurrenceKey, TaskId } from "../../domain/primitives";
import type { TaskRecord } from "../../domain/tasks";
import type { GrimoireDatabase } from "./schema";

class DexieWriteTransaction implements AtomicWriteTransaction {
  constructor(private readonly database: GrimoireDatabase) {}

  getCommandReceipt(commandId: CommandId): Promise<CommandReceiptRow | undefined> {
    return this.database.commandReceipts.get(commandId);
  }

  async addCommandReceipt(receipt: CommandReceiptRow): Promise<void> {
    await this.database.commandReceipts.add(receipt);
  }

  getTask(taskId: TaskId): Promise<TaskRecord | undefined> {
    return this.database.tasks.get(taskId);
  }

  async addTask(task: TaskRecord): Promise<void> {
    await this.database.tasks.add(task);
  }

  async putTask(task: TaskRecord): Promise<void> {
    await this.database.tasks.put(task);
  }

  getOccurrence(occurrenceKey: OccurrenceKey): Promise<TaskOccurrenceRow | undefined> {
    return this.database.taskOccurrences.get(occurrenceKey);
  }

  async addOccurrence(occurrence: TaskOccurrenceRow): Promise<void> {
    await this.database.taskOccurrences.add(occurrence);
  }

  async putOccurrence(occurrence: TaskOccurrenceRow): Promise<void> {
    await this.database.taskOccurrences.put(occurrence);
  }

  getRewardForTask(
    taskId: TaskId,
    kind: RewardLedgerRow["kind"],
  ): Promise<RewardLedgerRow | undefined> {
    return this.database.rewardLedger.where("[taskId+kind]").equals([taskId, kind]).first();
  }

  async addReward(row: RewardLedgerRow): Promise<void> {
    await this.database.rewardLedger.add(row);
  }

  async addGrowth(row: GrowthLedgerRow): Promise<void> {
    await this.database.growthLedger.add(row);
  }

  getInventory(itemId: string): Promise<InventoryRow | undefined> {
    return this.database.inventory.get(itemId);
  }

  async putInventory(row: InventoryRow): Promise<void> {
    await this.database.inventory.put(row);
  }

  async addDomainEvent(row: DomainEventRow): Promise<void> {
    await this.database.domainEvents.add(row);
  }

  async addOutbox(row: OutboxRow): Promise<void> {
    await this.database.outbox.add(row);
  }
}

export class DexieAtomicStore implements AtomicStore {
  constructor(private readonly database: GrimoireDatabase) {}

  write<Result>(operation: (transaction: AtomicWriteTransaction) => Promise<Result>): Promise<Result> {
    return this.database.transaction(
      "rw",
      [
        this.database.tasks,
        this.database.taskOccurrences,
        this.database.commandReceipts,
        this.database.domainEvents,
        this.database.outbox,
        this.database.rewardLedger,
        this.database.growthLedger,
        this.database.inventory,
      ],
      async () => operation(new DexieWriteTransaction(this.database)),
    );
  }
}
