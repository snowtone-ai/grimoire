import { db, type FoodAwardRecord, type FoodInventoryRecord } from "./db.ts";
import {
  assertDateKey,
  assertValidDate,
  canGrantDailyCompletionMacaron,
  DAILY_COMPLETION_MACARON_LIMIT,
  localDateKey,
  loginMacaronEventKey,
  MACARON_AWARD_AMOUNT,
  MACARON_ITEM_ID,
  taskAdditionMacaronEventKey,
  taskCompletionMacaronEventKey,
  type MacaronAwardSource,
  type TaskRecurrence,
} from "./domain/macarons.ts";

export interface MacaronGrantResult {
  itemId: typeof MACARON_ITEM_ID;
  source: MacaronAwardSource;
  eventKey: string;
  dateKey: string;
  taskId?: string;
  amount: number;
  /** Balance after this grant. */
  balance: number;
  /** Alias useful to inventory-oriented callers. */
  quantity: number;
}

/** Read the current macaron balance. A missing row is the valid zero state. */
export async function getMacaronCount(): Promise<number> {
  const record = await db.foodInventory.get(MACARON_ITEM_ID);
  return record?.quantity ?? 0;
}

/** Inventory-shaped alias for callers that render more than one food later. */
export async function getMacaronBalance(): Promise<number> {
  return getMacaronCount();
}

export async function getFoodInventory(): Promise<FoodInventoryRecord | undefined> {
  return db.foodInventory.get(MACARON_ITEM_ID);
}

export interface MacaronFeedResult {
  /** Balance after Carol has eaten one macaron. */
  balance: number;
  quantity: number;
}

/**
 * Spend one macaron atomically. A read followed by a write outside this
 * transaction would let two tabs feed the same last treat, so the zero check
 * and decrement deliberately live in the same IndexedDB readwrite scope.
 */
export async function feedMacaron(now = new Date()): Promise<MacaronFeedResult | null> {
  assertValidDate(now);
  return db.transaction("rw", db.foodInventory, async () => {
    const current = await db.foodInventory.get(MACARON_ITEM_ID);
    if (!current || current.quantity < 1) return null;
    const balance = current.quantity - 1;
    await db.foodInventory.put({
      ...current,
      quantity: balance,
      lastUpdated: now.toISOString(),
    });
    return { balance, quantity: balance };
  });
}

/** Return the number of completion grants already made for a local date. */
export async function getTaskCompletionMacaronsForDate(dateKey: string): Promise<number> {
  assertDateKey(dateKey);
  return db.foodAwards
    .where("[source+dateKey]")
    .equals(["task-completion", dateKey])
    .count();
}

interface GrantRequest {
  source: MacaronAwardSource;
  dateKey: string;
  eventKey: string;
  taskId?: string;
  now: Date;
}

/**
 * Persist one grant and its idempotency record as one IndexedDB transaction.
 *
 * The unique eventKey index is the final guard against retries and concurrent
 * tabs. The completion cap is checked inside the same readwrite transaction;
 * IndexedDB serializes competing writers for this database, so two different
 * tasks cannot both pass the cap and commit as the fourth grant.
 */
async function persistMacaronGrant(
  request: GrantRequest,
  inCurrentTransaction = false
): Promise<MacaronGrantResult | null> {
  assertDateKey(request.dateKey);
  assertValidDate(request.now);

  const write = async (): Promise<MacaronGrantResult | null> => {
    const existing = await db.foodAwards
      .where("eventKey")
      .equals(request.eventKey)
      .first();
    if (existing) return null;

    if (request.source === "task-completion") {
      const completionCount = await db.foodAwards
        .where("[source+dateKey]")
        .equals([request.source, request.dateKey])
        .count();
      if (!canGrantDailyCompletionMacaron(completionCount)) return null;
    }

    const current = await db.foodInventory.get(MACARON_ITEM_ID);
    const balance = (current?.quantity ?? 0) + MACARON_AWARD_AMOUNT;
    const award: FoodAwardRecord = {
      eventKey: request.eventKey,
      source: request.source,
      dateKey: request.dateKey,
      ...(request.taskId === undefined ? {} : { taskId: request.taskId }),
      amount: MACARON_AWARD_AMOUNT,
      at: request.now.toISOString(),
    };

    // Keep the ledger and balance in one transaction. If either write fails,
    // retrying the same operation sees neither a phantom award nor a lost item.
    await db.foodAwards.add(award);
    await db.foodInventory.put({
      id: MACARON_ITEM_ID,
      quantity: balance,
      lastUpdated: request.now.toISOString(),
    });

    return {
      itemId: MACARON_ITEM_ID,
      source: request.source,
      eventKey: request.eventKey,
      dateKey: request.dateKey,
      ...(request.taskId === undefined ? {} : { taskId: request.taskId }),
      amount: MACARON_AWARD_AMOUNT,
      balance,
      quantity: balance,
    };
  };

  return inCurrentTransaction
    ? write()
    : db.transaction("rw", db.foodInventory, db.foodAwards, write);
}

/** Claim the once-per-local-day welcome macaron when Grimo is opened. */
export async function claimLoginMacaron(now = new Date()): Promise<MacaronGrantResult | null> {
  const dateKey = localDateKey(now);
  return persistMacaronGrant({
    source: "login",
    dateKey,
    eventKey: loginMacaronEventKey(dateKey),
    now,
  });
}

/** Claim the once-per-local-day reward for a manual task addition. */
export async function claimTaskAdditionMacaron(now = new Date()): Promise<MacaronGrantResult | null> {
  const dateKey = localDateKey(now);
  return persistMacaronGrant({
    source: "task-add",
    dateKey,
    eventKey: taskAdditionMacaronEventKey(dateKey),
    now,
  });
}

/**
 * Explicit-date form for task-add flows that already have a local date key.
 * This is the form to use when the UI's notion of “today” is passed down.
 */
export async function grantMacaronForTaskAddition(
  dateKey: string,
  now = new Date()
): Promise<MacaronGrantResult | null> {
  assertDateKey(dateKey);
  return persistMacaronGrant({
    source: "task-add",
    dateKey,
    eventKey: taskAdditionMacaronEventKey(dateKey),
    now,
  });
}

/**
 * Transaction-aware task-add form for taskDb's create boundary. Callers must
 * already have opened a readwrite transaction over foodInventory and
 * foodAwards; this avoids nested Dexie transactions and keeps the task row and
 * its reward atomic.
 */
export async function grantMacaronForTaskAdditionInCurrentTransaction(
  dateKey: string,
  now = new Date()
): Promise<MacaronGrantResult | null> {
  assertDateKey(dateKey);
  return persistMacaronGrant({
    source: "task-add",
    dateKey,
    eventKey: taskAdditionMacaronEventKey(dateKey),
    now,
  }, true);
}

/** Claim a completion macaron using the task's recurrence identity. */
export async function claimTaskCompletionMacaron(
  taskId: string,
  recurrence: TaskRecurrence = "none",
  now = new Date()
): Promise<MacaronGrantResult | null> {
  return grantMacaronForTaskCompletion(taskId, localDateKey(now), recurrence, now);
}

/**
 * Explicit-date completion form. Normal tasks are once in their lifetime;
 * recurring tasks are once per task and local effort date. Every source still
 * grants exactly one macaron, with at most three completion grants per date.
 */
export async function grantMacaronForTaskCompletion(
  taskId: string,
  dateKey: string,
  recurrence: TaskRecurrence = "none",
  now = new Date()
): Promise<MacaronGrantResult | null> {
  assertDateKey(dateKey);
  return persistMacaronGrant({
    source: "task-completion",
    dateKey,
    eventKey: taskCompletionMacaronEventKey(taskId, dateKey, recurrence),
    taskId,
    now,
  });
}

/** Transaction-aware completion form for taskDb's toggle boundary. */
export async function grantMacaronForTaskCompletionInCurrentTransaction(
  taskId: string,
  dateKey: string,
  recurrence: TaskRecurrence = "none",
  now = new Date()
): Promise<MacaronGrantResult | null> {
  assertDateKey(dateKey);
  return persistMacaronGrant({
    source: "task-completion",
    dateKey,
    eventKey: taskCompletionMacaronEventKey(taskId, dateKey, recurrence),
    taskId,
    now,
  }, true);
}

/** Naming alias for code that calls all three triggers “grant” operations. */
export async function grantMacaronForLogin(
  dateKey: string,
  now = new Date()
): Promise<MacaronGrantResult | null> {
  assertDateKey(dateKey);
  return persistMacaronGrant({
    source: "login",
    dateKey,
    eventKey: loginMacaronEventKey(dateKey),
    now,
  });
}

export const MACARON_DAILY_COMPLETION_LIMIT = DAILY_COMPLETION_MACARON_LIMIT;
