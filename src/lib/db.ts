import Dexie, { type Table } from "dexie";
import { countMonthlyCompletedTasks, monthKeyLocal } from "./domain/plant.ts";

export type Category = "job" | "university" | "life";
export type Recurrence = "none" | "daily" | "weekly" | "monthly";

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime: string | null; // HH:MM or null (all-day)
  category: Category;
  completed: boolean;
  completedAt: string | null; // ISO datetime
  recurrence: Recurrence;
  recurrenceDayOfWeek?: number; // 0=Sun ~ 6=Sat (weekly only)
  recurrenceDayOfMonth?: number; // 1-31 (monthly only)
  createdAt: string; // ISO datetime
  /** Stable identity for imported external records (currently Calendar). */
  importSourceKey?: string;
}

export interface Streak {
  date: string; // YYYY-MM-DD (primary key)
  allCompleted: boolean;
}

export interface PlantState {
  id?: number;
  /** Cumulative completions within the current local month (never reset mid-month). */
  monthlyCompleted: number;
  monthKey: string; // YYYY-MM
  lifetimeCompleted: number;
  lastUpdated: string; // ISO datetime
}

/** One reward roll granted for completing a task (never revoked). */
export interface DropRecord {
  id?: number;
  taskId: string;
  dateKey: string; // YYYY-MM-DD (local)
  dropId: string;
  rarity: number;
  at: string; // ISO datetime
}

/** The local Grimo food balance. One row per food item keeps the new store
 * extensible without changing the existing task/drop records. */
export interface FoodInventoryRecord {
  id: string; // food item id, currently "macaron"
  quantity: number;
  lastUpdated: string; // ISO datetime
}

/** Append-only idempotency ledger for food grants. */
export interface FoodAwardRecord {
  id?: number;
  /** Stable operation identity. This is the unique retry/concurrency guard. */
  eventKey: string;
  source: "login" | "task-add" | "task-completion";
  dateKey: string; // YYYY-MM-DD (local)
  taskId?: string;
  amount: number;
  at: string; // ISO datetime
}

class TaskManagerDB extends Dexie {
  tasks!: Table<Task, string>;
  streaks!: Table<Streak, string>;
  plantState!: Table<PlantState, number>;
  drops!: Table<DropRecord, number>;
  foodInventory!: Table<FoodInventoryRecord, string>;
  foodAwards!: Table<FoodAwardRecord, number>;

  constructor() {
    super("TaskManagerDB");
    this.version(1).stores({
      tasks: "id, dueDate, category, completed, recurrence",
      streaks: "date",
    });
    this.version(2).stores({
      tasks: "id, dueDate, category, completed, recurrence",
      streaks: "date",
      plantState: "++id",
    });
    // v3: material-drop rewards + monthly (cumulative) plant growth.
    // The upgrade recomputes monthly progress from tasks; nothing is lost.
    this.version(3)
      .stores({
        tasks: "id, dueDate, category, completed, recurrence",
        streaks: "date",
        plantState: "++id",
        // &[taskId+dateKey] is unique: one drop per task per day is enforced
        // by the store itself, not just the read-then-add check.
        drops: "++id, taskId, dateKey, rarity, &[taskId+dateKey]",
      })
      .upgrade(async (tx) => {
        const now = new Date();
        const tasks = (await tx.table("tasks").toArray()) as Task[];
        const monthlyCompleted = countMonthlyCompletedTasks(tasks, now);
        await tx
          .table("plantState")
          .toCollection()
          .modify((state: Record<string, unknown>) => {
            state.monthlyCompleted = monthlyCompleted;
            state.monthKey = monthKeyLocal(now);
            delete state.weeklyCompleted;
            delete state.weekStartDate;
          });
      });
    // v4: imported Calendar occurrences are idempotent across replayed and
    // concurrent imports. The ampersand makes the sparse source key unique;
    // legacy tasks without a key are left untouched.
    this.version(4).stores({
      tasks: "id, dueDate, category, completed, recurrence, &importSourceKey",
      streaks: "date",
      plantState: "++id",
      drops: "++id, taskId, dateKey, rarity, &[taskId+dateKey]",
    });
    // v5: Grimo food balance + append-only grant ledger. Existing stores and
    // records are deliberately unchanged; adding stores is an IndexedDB-safe
    // upgrade for installs on schema versions 1 through 4.
    this.version(5).stores({
      tasks: "id, dueDate, category, completed, recurrence, &importSourceKey",
      streaks: "date",
      plantState: "++id",
      drops: "++id, taskId, dateKey, rarity, &[taskId+dateKey]",
      foodInventory: "id",
      foodAwards: "++id, &eventKey, source, dateKey, [source+dateKey]",
    });
  }
}

// Lazy singleton — instantiating Dexie at module load triggers side effects
// that only make sense in the browser. Keeping this lazy lets server-side
// rendering safely import anything from `lib/db` without touching IndexedDB.
let _db: TaskManagerDB | null = null;

export function getDb(): TaskManagerDB {
  if (typeof window === "undefined") {
    throw new Error("getDb() called in a non-browser environment");
  }
  if (!_db) _db = new TaskManagerDB();
  return _db;
}

// Back-compat proxy so existing `db.tasks...` call sites keep working.
// Access on the server will throw via getDb() — intended.
export const db = new Proxy({} as TaskManagerDB, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop as string];
    // Dexie methods use their instance as `this`. Returning an unbound method
    // from this compatibility proxy makes transaction/open run against the
    // proxy object, whose internal schema is absent — especially visible on a
    // schema upgrade. Tables are values and stay untouched; methods bind to
    // the real lazy singleton.
    return typeof value === "function" ? value.bind(real) : value;
  },
});
