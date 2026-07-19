import Dexie, { type Table } from "dexie";
import { countMonthlyCompletedTasks, monthKeyLocal } from "./domain/plant";

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

class TaskManagerDB extends Dexie {
  tasks!: Table<Task, string>;
  streaks!: Table<Streak, string>;
  plantState!: Table<PlantState, number>;
  drops!: Table<DropRecord, number>;

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
        drops: "++id, taskId, dateKey, rarity, [taskId+dateKey]",
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
    return real[prop as string];
  },
});
