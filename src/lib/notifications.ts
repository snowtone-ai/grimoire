import { getTasksForDate } from "./taskDb.ts";
import {
  buildReminders,
  nextPending,
  pruneDelivered,
  selectDue,
  type DeliveredLedger,
  type Reminder,
} from "./domain/reminders.ts";

const DELIVERED_KEY = "notif-delivered";
const ENABLED_KEY = "notif-enabled";
const ICON = "/icons/icon-192x192.png";

function dateString(offsetDays: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type NotificationPermissionState =
  | NotificationPermission
  | "unsupported";

export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window))
    return "denied";
  return Notification.requestPermission();
}

function canNotify(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "Notification" in window &&
    Notification.permission === "granted" &&
    getNotificationsEnabled()
  );
}

/** App-level on/off, independent of the browser's Notification permission.
 * Browsers give a site no way to revoke a "granted" permission itself (only
 * the user can, from site settings), so once permission is granted the app's
 * own preference is the only ON/OFF switch that can ever exist for it —
 * mirrors sound.ts's fx-enabled flag. Defaults to on so already-granted users
 * are not silently opted out by this flag's introduction. */
export function getNotificationsEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== "0";
  } catch {
    return true;
  }
}

/** Also (re)schedules or halts catch-up delivery so the toggle takes effect
 * immediately, rather than waiting for the next unrelated sync trigger. */
export function setNotificationsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    // Preference storage is best-effort, matching sound.ts's fx-enabled flag.
  }
  if (enabled) {
    void syncTaskNotifications();
  } else {
    clearTimeout(pageTimer);
  }
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
 * supported there). Returns false when the platform refuses it. */
async function show(title: string, body: string, tag: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, { body, icon: ICON, badge: ICON, tag });
    return true;
  } catch (err) {
    console.error("[notifications] show failed:", err);
    return false;
  }
}

/** In-page timer for a reminder that comes due while the app stays open. Unlike
 * the Service Worker's timers this one is only ever a bonus — the catch-up pass
 * on the next open is what actually guarantees delivery. */
let pageTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Deliver every reminder that is already due and not yet shown, then arm an
 * in-page timer for the next one. Safe to call as often as the task list
 * changes: the delivered ledger makes repeat calls idempotent.
 *
 * Runs are serialised. Callers fire this without awaiting (task toggle, task
 * list change, tab becoming visible), and two overlapping runs would both read
 * the ledger before either wrote it, so both would decide the same reminder was
 * undelivered. The Notification `tag` would quietly coalesce the duplicate, but
 * relying on that is relying on a side effect rather than on the ledger.
 */
let queue: Promise<void> = Promise.resolve();

export function syncTaskNotifications(): Promise<void> {
  const run = queue.then(runSync);
  // The chain must never reject, or every later call inherits the failure.
  queue = run.catch(() => {});
  return run;
}

async function runSync(): Promise<void> {
  if (!canNotify()) return;

  const today = dateString(0);
  const [todayTasks, tomorrowTasks] = await Promise.all([
    getTasksForDate(today),
    getTasksForDate(dateString(1)),
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

  clearTimeout(pageTimer);
  const next: Reminder | null = nextPending(reminders, now, delivered);
  if (next) {
    pageTimer = setTimeout(() => {
      void syncTaskNotifications();
    }, next.dueAt - now + 1000);
  }
}

/** テスト通知を即時送信する（動作確認用） */
export async function sendTestNotification(): Promise<void> {
  if (!canNotify()) return;
  await show(
    "Grimoire — テスト通知",
    "通知が正常に動作しています！締切前日・当日ぶんは、朝9時以降に最初にアプリを開いたときにお知らせします。",
    "notif-test"
  );
}
