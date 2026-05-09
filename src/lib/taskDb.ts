import { db, type Task, type Streak, type Category } from "./db";
import {
  doesTaskApplyToDate,
  sortTasksByTime,
  taskForDisplayDate,
  todayDateString,
} from "./domain/task-date";

// ── Task CRUD ──────────────────────────────────────────────────────────────

/** 全タスクを取得 */
export async function getAllTasks(): Promise<Task[]> {
  return db.tasks.toArray();
}

/** 指定日のタスクを時刻順で取得（当日締切 + 繰り返しで該当する日） */
export async function getTasksForDate(date: string): Promise<Task[]> {
  const all = await db.tasks.toArray();
  const filtered = all
    .filter((task) => doesTaskApplyToDate(task, date))
    .map((task) => taskForDisplayDate(task, date));

  return sortTasksByTime(filtered);
}

/** IDでタスクを1件取得 */
export async function getTaskById(id: string): Promise<Task | undefined> {
  return db.tasks.get(id);
}

/** タスクを作成 */
export async function createTask(
  task: Omit<Task, "id" | "createdAt">
): Promise<Task> {
  const newTask: Task = {
    ...task,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await db.tasks.add(newTask);
  return newTask;
}

/** タスクを更新 */
export async function updateTask(
  id: string,
  changes: Partial<Omit<Task, "id" | "createdAt">>
): Promise<void> {
  await db.tasks.update(id, changes);
}

/** タスクを削除 */
export async function deleteTask(id: string): Promise<void> {
  await db.tasks.delete(id);
}

/** タスクを完了/未完了に切り替え */
export async function toggleTaskComplete(id: string): Promise<void> {
  const task = await db.tasks.get(id);
  if (!task) return;

  if (task.recurrence !== "none") {
    // 繰り返しタスク: 「今日完了済みか」で判断し、当日のみ有効な完了状態にする
    const today = todayDateString();
    const completedToday = task.completedAt?.slice(0, 10) === today;
    await db.tasks.update(id, {
      completed: !completedToday,
      completedAt: completedToday ? null : new Date().toISOString(),
    });
  } else {
    const completed = !task.completed;
    await db.tasks.update(id, {
      completed,
      completedAt: completed ? new Date().toISOString() : null,
    });
  }
}

/** カテゴリでフィルタしたタスクを取得 */
export async function getTasksByCategory(
  category: Category
): Promise<Task[]> {
  return db.tasks.where("category").equals(category).toArray();
}

// ── Streak CRUD ────────────────────────────────────────────────────────────

/** 指定日のストリークレコードを取得 */
export async function getStreak(date: string): Promise<Streak | undefined> {
  return db.streaks.get(date);
}

/** 全ストリークを日付順で取得 */
export async function getAllStreaks(): Promise<Streak[]> {
  return db.streaks.orderBy("date").toArray();
}

/** ストリークを記録（upsert） */
export async function recordStreak(
  date: string,
  allCompleted: boolean
): Promise<void> {
  await db.streaks.put({ date, allCompleted });
}

/**
 * 現在の連続全完了日数を計算する
 * - タスクが0件の日はカウントしない（Assumptions参照）
 * - allCompleted=true の日だけを連続日数に加算する
 */
export async function getCurrentStreakCount(): Promise<number> {
  const streaks = await db.streaks.orderBy("date").reverse().toArray();
  if (streaks.length === 0) return 0;

  let count = 0;
  const today = new Date();

  for (let i = 0; i < streaks.length; i++) {
    const streak = streaks[i];
    if (!streak.allCompleted) break;

    const streakDate = new Date(streak.date);
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);

    const isSameDay =
      streakDate.toISOString().slice(0, 10) ===
      expectedDate.toISOString().slice(0, 10);

    if (!isSameDay) break;
    count++;
  }

  return count;
}
