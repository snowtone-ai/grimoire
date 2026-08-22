import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNotificationDelivery,
  getNotificationPermission,
  requestNotificationPermission,
  type ReminderTaskSource,
} from "../../../../src/integrations/notifications/delivery";
import type { ReminderTask } from "../../../../src/integrations/notifications/reminders";

function stubNotification(permission: NotificationPermission): void {
  vi.stubGlobal("Notification", {
    permission,
    requestPermission: vi.fn(async () => permission),
  });
}

function stubServiceWorker(): { showNotification: ReturnType<typeof vi.fn> } {
  const showNotification = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "serviceWorker", {
    value: { ready: Promise.resolve({ showNotification }) },
    configurable: true,
  });
  return { showNotification };
}

function fakeSource(tasksByDate: Readonly<Record<string, readonly ReminderTask[]>>): {
  source: ReminderTaskSource;
  getTasksForDate: ReturnType<typeof vi.fn>;
} {
  const getTasksForDate = vi.fn(async (localDate: string) => tasksByDate[localDate] ?? []);
  return { source: { getTasksForDate }, getTasksForDate };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-16T10:00:00"));
  localStorage.clear();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "serviceWorker");
  vi.useRealTimers();
});

describe("getNotificationPermission / requestNotificationPermission", () => {
  it("report 'unsupported' when the Notification API does not exist, never throwing", async () => {
    // A real unsupported browser omits `window.Notification` entirely rather
    // than defining it as undefined, so the property itself must be absent
    // here — vi.stubGlobal(..., undefined) would still leave `"Notification"
    // in window` true and not exercise this path.
    const hadOwnProperty = Object.prototype.hasOwnProperty.call(globalThis, "Notification");
    const original = (globalThis as { Notification?: unknown }).Notification;
    Reflect.deleteProperty(globalThis, "Notification");
    try {
      expect(getNotificationPermission()).toBe("unsupported");
      await expect(requestNotificationPermission()).resolves.toBe("unsupported");
    } finally {
      if (hadOwnProperty) (globalThis as { Notification?: unknown }).Notification = original;
    }
  });

  it("proxy the browser's permission and request result when it does exist", async () => {
    stubNotification("granted");
    expect(getNotificationPermission()).toBe("granted");
    await expect(requestNotificationPermission()).resolves.toBe("granted");
  });
});

describe("createNotificationDelivery — sync() (T020 port substitution)", () => {
  it("never touches the task source when the browser permission is not granted", async () => {
    stubNotification("default");
    const { source, getTasksForDate } = fakeSource({});
    const delivery = createNotificationDelivery(source);

    await delivery.sync();

    expect(getTasksForDate).not.toHaveBeenCalled();
  });

  it("reads today's and tomorrow's tasks by local date from the injected source", async () => {
    stubNotification("granted");
    stubServiceWorker();
    const { source, getTasksForDate } = fakeSource({});
    const delivery = createNotificationDelivery(source);

    await delivery.sync();

    expect(getTasksForDate).toHaveBeenCalledWith("2026-08-16");
    expect(getTasksForDate).toHaveBeenCalledWith("2026-08-17");
  });

  it("shows an already-due reminder once and never repeats it on a later sync", async () => {
    stubNotification("granted");
    const { showNotification } = stubServiceWorker();
    // "now" is 10:00, past the 09:00 remind hour for today's task.
    const { source } = fakeSource({
      "2026-08-16": [{ id: "a", title: "ES提出", dueTime: "14:00", completed: false }],
    });
    const delivery = createNotificationDelivery(source);

    await delivery.sync();
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith(
      "今日の締切",
      expect.objectContaining({ body: "今日: ES提出（14:00）" }),
    );

    await delivery.sync();
    expect(showNotification).toHaveBeenCalledTimes(1);
  });

  it("does not show a completed task's reminder", async () => {
    stubNotification("granted");
    const { showNotification } = stubServiceWorker();
    const { source } = fakeSource({
      "2026-08-16": [{ id: "a", title: "済んだ用事", dueTime: null, completed: true }],
    });
    const delivery = createNotificationDelivery(source);

    await delivery.sync();

    expect(showNotification).not.toHaveBeenCalled();
  });

  it("scheduledCount() reflects not-yet-due, not-yet-delivered reminders after a sync", async () => {
    vi.setSystemTime(new Date("2026-08-16T07:00:00")); // before the 09:00 remind hour
    stubNotification("granted");
    stubServiceWorker();
    const { source } = fakeSource({
      "2026-08-16": [{ id: "a", title: "ES提出", dueTime: "14:00", completed: false }],
    });
    const delivery = createNotificationDelivery(source);

    expect(delivery.scheduledCount()).toBe(0); // before any sync()
    await delivery.sync();
    expect(delivery.scheduledCount()).toBe(1);
  });
});

describe("createNotificationDelivery — sendTestNotification()", () => {
  it("shows a test notification when permitted", async () => {
    stubNotification("granted");
    const { showNotification } = stubServiceWorker();
    const delivery = createNotificationDelivery(fakeSource({}).source);

    await delivery.sendTestNotification();

    expect(showNotification).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when the browser permission is not granted", async () => {
    stubNotification("denied");
    const delivery = createNotificationDelivery(fakeSource({}).source);

    await expect(delivery.sendTestNotification()).resolves.toBeUndefined();
  });
});
