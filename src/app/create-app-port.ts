'use client'

import type {
  ExternalScheduleItem,
  GoogleIntegrationPort,
  GoogleLinkScope,
  NotificationIntegrationPort,
} from '@/application/ports'
import { connect, disconnect, isGoogleConfigured } from '@/integrations/google/auth'
import { fetchCalendarEvents } from '@/integrations/google/calendar'
import { fetchGmailItems } from '@/integrations/google/gmail'
import {
  createNotificationDelivery,
  getNotificationPermission,
  requestNotificationPermission,
} from '@/integrations/notifications/delivery'
import type { ReminderTask } from '@/integrations/notifications/reminders'

import { DurableUiPort } from './durable-ui-port'

/**
 * The composition root: the one place where the abstract ports the data layer
 * declares are met by the concrete browser integrations that satisfy them.
 *
 * Everything below this line talks to Google, the Notification API and the
 * Service Worker; everything above it — the screens, the read model, the task
 * commands — only ever sees the interfaces in `@/application/ports`. Without
 * this file the port falls back to its null integrations, which is why the
 * settings screen reported "この端末のブラウザは通知に対応していません" on a
 * browser that supports notifications perfectly well.
 */
export function createAppPort(): DurableUiPort {
  // The reminder source reads tasks out of the port, and the port needs the
  // notification integration to construct — so the source is given a reference
  // that is filled in on the next line rather than a port that cannot exist
  // yet. `getTasksForDate` is only ever called from `sync()`, long after.
  let port: DurableUiPort | null = null

  const delivery = createNotificationDelivery({
    getTasksForDate: async (localDate) => tasksForDate(port, localDate),
  })

  const notifications: NotificationIntegrationPort = {
    currentPermission: getNotificationPermission,
    requestPermission: requestNotificationPermission,
    scheduledCount: () => delivery.scheduledCount(),
  }

  port = new DurableUiPort(undefined, {}, { google: GOOGLE_INTEGRATION, notifications })
  watchForReminderChanges(port, delivery)
  return port
}

const GOOGLE_INTEGRATION: GoogleIntegrationPort = {
  isConfigured: isGoogleConfigured,
  connect: (scope: GoogleLinkScope) => connect(scope),
  disconnect: (scope: GoogleLinkScope) => disconnect(scope),
  fetchCalendarEvents: (range): Promise<readonly ExternalScheduleItem[]> =>
    fetchCalendarEvents(range),
  fetchGmailItems: (): Promise<readonly ExternalScheduleItem[]> => fetchGmailItems(),
}

/**
 * Reminders are derived from the read model rather than from a second query.
 * Today comes from `tasksToday`, which always exists; any other date comes from
 * `calendarEntries`, which covers the current month before the calendar screen
 * has been opened and the whole visible grid afterwards.
 */
function tasksForDate(port: DurableUiPort | null, localDate: string): readonly ReminderTask[] {
  if (port === null) return []
  const model = port.getSnapshot()
  const today = currentLocalDate()

  if (localDate === today) {
    return model.tasksToday.map((row) => ({
      id: row.id,
      title: row.title,
      dueTime: row.scheduledTime ?? null,
      completed: row.completed,
    }))
  }

  return model.calendarEntries
    .filter((entry) => entry.localDate === localDate)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      dueTime: entry.scheduledTime ?? null,
      completed: entry.completed,
    }))
}

/**
 * Delivery is catch-up-on-open (see `reminders.ts`), so `sync()` has to run
 * whenever the set of pending reminders could have changed: on start, and after
 * any edit to today's or tomorrow's tasks. The signature keeps a snapshot that
 * changed for an unrelated reason — a discovery, a preference, a calendar month
 * being paged — from re-running it.
 */
function watchForReminderChanges(port: DurableUiPort, delivery: { sync(): Promise<void> }): void {
  let lastSignature: string | null = null

  const run = () => {
    const model = port.getSnapshot()
    if (!model.notifications.enabled) {
      lastSignature = null
      return
    }
    const signature = reminderSignature(port)
    if (signature === lastSignature) return
    lastSignature = signature
    void delivery.sync()
  }

  port.subscribe(run)
  run()
}

function reminderSignature(port: DurableUiPort): string {
  const today = currentLocalDate()
  const tomorrow = nextLocalDate(today)
  return [today, tomorrow]
    .flatMap((date) => tasksForDate(port, date).map((task) => `${date}/${task.id}/${task.completed}`))
    .join(',')
}

function currentLocalDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function nextLocalDate(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number)
  const next = new Date(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1)
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
