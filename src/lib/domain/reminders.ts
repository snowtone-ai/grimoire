/* Deadline reminders — pure scheduling logic (D-036).
 *
 * Delivery model is catch-up-on-open, NOT fire-and-forget scheduling. A Service
 * Worker is torn down after a few idle seconds, so a setTimeout living inside it
 * is destroyed long before a reminder hours away could fire — the previous
 * implementation could therefore only ever fire if the SW happened to stay alive
 * from before 09:00 until 09:00, which in practice never happens.
 *
 * Instead the app derives, on every open, which reminders are already due and
 * have not been delivered yet, and shows those immediately. A delivered ledger
 * keyed by reminder id keeps one from being shown twice. Reminder ids embed the
 * date key, so "today's 09:00 reminder for task X" is a different ledger entry
 * every day.
 */

/** Local hour at which a day's reminders become deliverable. */
export const REMIND_HOUR = 9;

/** How long a delivered-ledger entry is kept before it is pruned. */
export const DELIVERED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface ReminderTask {
  id: string;
  title: string;
  dueTime?: string | null;
  completed: boolean;
}

export interface Reminder {
  id: string;
  title: string;
  body: string;
  /** Epoch ms at which this reminder becomes deliverable. */
  dueAt: number;
}

/** Epoch ms of REMIND_HOUR on the given local date (YYYY-MM-DD). */
export function remindAtFor(dateKey: string): number {
  const hour = String(REMIND_HOUR).padStart(2, "0");
  return new Date(`${dateKey}T${hour}:00:00`).getTime();
}

function bodyFor(prefix: string, task: ReminderTask): string {
  return `${prefix}: ${task.title}${task.dueTime ? `（${task.dueTime}）` : ""}`;
}

/**
 * Every reminder that belongs to `dateKey`'s REMIND_HOUR slot: one "今日" entry
 * per incomplete task due that day, and one "明日" entry per incomplete task due
 * the next day. Completed tasks never produce a reminder.
 */
export function buildReminders(params: {
  dateKey: string;
  todayTasks: readonly ReminderTask[];
  tomorrowTasks: readonly ReminderTask[];
}): Reminder[] {
  const { dateKey, todayTasks, tomorrowTasks } = params;
  const dueAt = remindAtFor(dateKey);

  const reminders: Reminder[] = [];
  for (const task of todayTasks) {
    if (task.completed) continue;
    reminders.push({
      id: `notif-today-${task.id}-${dateKey}`,
      title: "今日の締切",
      body: bodyFor("今日", task),
      dueAt,
    });
  }
  for (const task of tomorrowTasks) {
    if (task.completed) continue;
    reminders.push({
      id: `notif-tomorrow-${task.id}-${dateKey}`,
      title: "明日の締切リマインダー",
      body: bodyFor("明日", task),
      dueAt,
    });
  }
  return reminders;
}

/** Delivered ledger: reminder id -> epoch ms it was shown. */
export type DeliveredLedger = Readonly<Record<string, number>>;

/** Reminders whose time has passed and which have not been shown yet. */
export function selectDue(
  reminders: readonly Reminder[],
  now: number,
  delivered: DeliveredLedger
): Reminder[] {
  return reminders.filter(
    (reminder) => reminder.dueAt <= now && delivered[reminder.id] === undefined
  );
}

/** The earliest not-yet-delivered reminder still in the future, if any. */
export function nextPending(
  reminders: readonly Reminder[],
  now: number,
  delivered: DeliveredLedger
): Reminder | null {
  let earliest: Reminder | null = null;
  for (const reminder of reminders) {
    if (reminder.dueAt <= now) continue;
    if (delivered[reminder.id] !== undefined) continue;
    if (earliest === null || reminder.dueAt < earliest.dueAt) earliest = reminder;
  }
  return earliest;
}

/** Drop ledger entries older than the retention window so it cannot grow forever. */
export function pruneDelivered(
  delivered: DeliveredLedger,
  now: number,
  retentionMs: number = DELIVERED_RETENTION_MS
): Record<string, number> {
  const kept: Record<string, number> = {};
  for (const [id, at] of Object.entries(delivered)) {
    if (now - at <= retentionMs) kept[id] = at;
  }
  return kept;
}
