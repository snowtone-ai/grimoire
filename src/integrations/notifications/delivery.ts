/**
 * Ported from v1 (main branch) src/lib/notifications.ts — see D-013.
 *
 * v1's module read tasks by importing `getTasksForDate` from its own
 * `./taskDb` directly. v2's data layer owns persistence, so that import is
 * replaced with `ReminderTaskSource`, a narrow port defined right here and
 * taken as a constructor argument by `createNotificationDelivery` — the data
 * layer's adapter satisfies it structurally, with no import of this module
 * required on its side.
 *
 * v1 also gated delivery on an app-level "notifications enabled" flag it
 * owned itself in localStorage (`notif-enabled`). v2 moves that preference
 * into the data layer's settings (決定事項ログ H-3: each module is the sole
 * owner of its own persisted data — `PreferenceView`/`NotificationView` in
 * src/app/ui-port.ts already model it there), so this module no longer reads
 * or writes an enabled flag: a caller only invokes `sync()` when the user's
 * preference allows it. The delivered-ledger (has this exact reminder been
 * shown yet) stays in localStorage as before — that is bookkeeping private to
 * this module, not product data, and is not the `./taskDb` dependency T020
 * was scoped to replace.
 */

import {
  buildReminders,
  nextPending,
  pruneDelivered,
  selectDue,
  type DeliveredLedger,
  type Reminder,
  type ReminderTask,
} from "./reminders";

const DELIVERED_KEY = "notif-delivered";
/** v1's path; this repo ships `icon-192.png`, so the old one 404s on every notification. */
const ICON = "/icons/icon-192.png";

/**
 * Narrow read port this module needs from the data layer: today's and
 * tomorrow's incomplete tasks for a given local date. Replaces v1's direct
 * `./taskDb` import (T020).
 */
export interface ReminderTaskSource {
  getTasksForDate(localDate: string): Promise<readonly ReminderTask[]>;
}

export type NotificationPermissionState = NotificationPermission | "unsupported";

function dateString(offsetDays: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

/**
 * v2 change (T020): v1 collapsed "the Notification API does not exist here"
 * into `"denied"`, since `Notification.requestPermission()` itself has no
 * "unsupported" outcome. v2's `NotificationIntegrationPort.requestPermission`
 * (src/application/ports.ts) declares the full `NotificationPermissionState`
 * union as its return type, so this now reports "unsupported" accurately
 * instead of the misleading "denied".
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.requestPermission();
}

function canNotify(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "Notification" in window &&
    Notification.permission === "granted"
  );
}

function readDelivered(): DeliveredLedger {
  try {
    const raw = localStorage.getItem(DELIVERED_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const ledger: Record<string, number> = {};
    for (const [id, at] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof at === "number" && Number.isFinite(at)) ledger[id] = at;
    }
    return ledger;
  } catch {
    return {};
  }
}

function writeDelivered(ledger: DeliveredLedger): void {
  try {
    localStorage.setItem(DELIVERED_KEY, JSON.stringify(ledger));
  } catch {
    // Ledger storage is best-effort; a failure only risks a repeat notification.
  }
}

/** Show a notification through the Service Worker registration, which is the
 * only path that works on mobile (the `new Notification()` constructor is not
 * supported there). Returns false when the platform refuses it.
 *
 * Asks for the registration rather than awaiting `navigator.serviceWorker.ready`:
 * `ready` waits for an *active* worker and never settles when none is
 * installed, so on a device where registration was refused — or in development,
 * where it is deliberately skipped — the first show hung forever and the
 * serialised queue behind it never moved again. `getRegistration()` resolves to
 * undefined instead of waiting. */
async function show(title: string, body: string, tag: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration === undefined || registration.active === null) return false;
    await registration.showNotification(title, { body, icon: ICON, badge: ICON, tag });
    return true;
  } catch (err) {
    console.error("[notifications] show failed:", err);
    return false;
  }
}

export interface NotificationDelivery {
  /**
   * Deliver every reminder that is already due and not yet shown, then arm an
   * in-page timer for the next one. Safe to call as often as the task list
   * changes: the delivered ledger makes repeat calls idempotent. Runs are
   * serialised per instance, matching v1's module-level queue.
   */
  sync(): Promise<void>;
  /** テスト通知を即時送信する（動作確認用） */
  sendTestNotification(): Promise<void>;
  /** Count of reminders from the most recent sync() that are still in the
   * future and have not been delivered yet. Matches
   * `NotificationIntegrationPort.scheduledCount` (src/application/ports.ts):
   * synchronous and zero-argument, so it reports a cached snapshot rather
   * than querying the task source directly. Zero before the first sync(). */
  scheduledCount(): number;
  /** Matches `NotificationIntegrationPort.currentPermission`. */
  currentPermission(): NotificationPermissionState;
  /** Matches `NotificationIntegrationPort.requestPermission`. */
  requestPermission(): Promise<NotificationPermissionState>;
}

/**
 * Creates a bound notification-delivery API for one ReminderTaskSource.
 * v1 kept the equivalent state (queue, pageTimer) at module scope, which this
 * factory turns into per-instance closure state instead — the direct
 * consequence of taking the task source as a constructor argument rather
 * than importing a singleton DB module.
 */
export function createNotificationDelivery(source: ReminderTaskSource): NotificationDelivery {
  let pageTimer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<void> = Promise.resolve();
  let pendingReminders: readonly Reminder[] = [];
  let deliveredSnapshot: DeliveredLedger = {};

  async function runSync(): Promise<void> {
    if (!canNotify()) return;

    const today = dateString(0);
    const [todayTasks, tomorrowTasks] = await Promise.all([
      source.getTasksForDate(today),
      source.getTasksForDate(dateString(1)),
    ]);

    const reminders = buildReminders({ dateKey: today, todayTasks, tomorrowTasks });
    const now = Date.now();
    const delivered: Record<string, number> = pruneDelivered(readDelivered(), now);

    for (const reminder of selectDue(reminders, now, delivered)) {
      if (await show(reminder.title, reminder.body, reminder.id)) {
        delivered[reminder.id] = now;
      }
    }
    writeDelivered(delivered);

    pendingReminders = reminders;
    deliveredSnapshot = delivered;

    clearTimeout(pageTimer);
    const next: Reminder | null = nextPending(reminders, now, delivered);
    if (next) {
      pageTimer = setTimeout(() => {
        void sync();
      }, next.dueAt - now + 1000);
    }
  }

  function sync(): Promise<void> {
    const run = queue.then(runSync);
    // The chain must never reject, or every later call inherits the failure.
    queue = run.catch(() => {});
    return run;
  }

  async function sendTestNotification(): Promise<void> {
    if (!canNotify()) return;
    await show(
      "Grimoire — テスト通知",
      "通知が正常に動作しています！締切前日・当日ぶんは、朝9時以降に最初にアプリを開いたときにお知らせします。",
      "notif-test"
    );
  }

  function scheduledCount(): number {
    const now = Date.now();
    return pendingReminders.filter(
      (reminder) => reminder.dueAt > now && deliveredSnapshot[reminder.id] === undefined
    ).length;
  }

  return {
    sync,
    sendTestNotification,
    scheduledCount,
    currentPermission: getNotificationPermission,
    requestPermission: requestNotificationPermission,
  };
}
