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
    getTasksForDate: async (localDate) => {
      if (port === null) return []
      const tasks = await port.tasksOccurringOn(localDate)
      return tasks.map(toReminderTask)
    },
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

function toReminderTask(task: {
  readonly completed: boolean
  readonly id: string
  readonly scheduledTime: string | null
  readonly title: string
}): ReminderTask {
  return {
    completed: task.completed,
    dueTime: task.scheduledTime,
    id: task.id,
    title: task.title,
  }
}

/**
 * Delivery is catch-up-on-open (see `reminders.ts`), so `sync()` has to run
 * whenever the set of pending reminders could have changed: on start, and after
 * any edit to today's or tomorrow's tasks. The signature keeps a snapshot that
 * changed for an unrelated reason — a discovery, a preference, a calendar month
 * being paged — from re-running it.
 */
function watchForReminderChanges(
  port: DurableUiPort,
  delivery: { scheduledCount(): number; sync(): Promise<void> },
): void {
  let lastSignature: string | null = null
  let running = false

  const run = async (): Promise<void> => {
    if (running) return
    if (!port.getSnapshot().notifications.enabled) {
      lastSignature = null
      return
    }
    running = true
    try {
      const signature = await reminderSignature(port)
      if (signature === lastSignature) return
      lastSignature = signature
      const before = delivery.scheduledCount()
      await delivery.sync()
      // `scheduledCount` is read while the model is rebuilt, and a sync answers
      // to nobody, so the count would otherwise stay one step behind what is
      // actually armed.
      if (delivery.scheduledCount() !== before) await port.refreshNotificationState()
    } finally {
      running = false
    }
  }

  port.subscribe(() => void run())
  void run()
}

/**
 * Covers everything a reminder's text or existence depends on: which tasks fall
 * on the two days that matter, whether they are done, and the title and time
 * that go into the body. Leaving the last two out meant renaming a task never
 * re-synced, and the pending notification still carried the old wording.
 */
async function reminderSignature(port: DurableUiPort): Promise<string> {
  const today = currentLocalDate()
  const days = [today, nextLocalDate(today)]
  const parts: string[] = []
  for (const day of days) {
    for (const task of await port.tasksOccurringOn(day)) {
      parts.push(`${day}/${task.id}/${task.completed}/${task.scheduledTime ?? ''}/${task.title}`)
    }
  }
  return parts.join(',')
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
