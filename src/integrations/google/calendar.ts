/**
 * Ported from v1 (main branch) src/lib/api/google-calendar.ts — see D-013.
 * Fetches upcoming Calendar events and normalizes them to the shared inbound
 * shape (`ImportedScheduleItem`).
 */

import { googleAuthFetch } from "./auth";
import type { ImportedScheduleItem } from "../imported-item";

export interface CalendarEvent {
  readonly id: string;
  readonly summary?: string;
  readonly start: { readonly date?: string; readonly dateTime?: string };
  readonly end: { readonly date?: string; readonly dateTime?: string };
}

const BASE = "https://www.googleapis.com/calendar/v3";
// Generous page cap for a date-ranged query (v1's fixed "next 30 upcoming"
// had no range at all — see fetchRawCalendarEvents below). Google's own API
// ceiling is 2500; 250 comfortably covers a busy month without an unbounded
// request.
const MAX_RESULTS = 250;

// F1+F5: delegates auth + 401 handling to googleAuthFetch; generic T makes casts explicit.
async function authFetch<T>(path: string): Promise<T> {
  const response = await googleAuthFetch("calendar", `${BASE}${path}`);
  if (!response.ok) throw new Error(`Calendar API error: ${response.status}`);
  const data: unknown = await response.json();
  if (data === null || typeof data !== "object") {
    throw new Error("Calendar API returned an unexpected response");
  }
  return data as T;
}

/**
 * v2 change (T020): v1's fetchUpcomingEvents() took no arguments and always
 * fetched the next 30 events from "now" (no explicit end bound). v2's
 * Calendar screen imports a specific fromLocalDate..toLocalDate range (see
 * `AppUiPort.importFromGoogleCalendar` in src/app/ui-port.ts and
 * `GoogleIntegrationPort.fetchCalendarEvents` in src/application/ports.ts),
 * so timeMin/timeMax now come from the caller. The actual Calendar API call
 * shape (singleEvents + orderBy so recurring events expand into instances)
 * carries over from v1 unchanged.
 */
export async function fetchRawCalendarEvents(range: {
  readonly fromLocalDate: string;
  readonly toLocalDate: string;
}): Promise<readonly CalendarEvent[]> {
  const timeMin = encodeURIComponent(`${range.fromLocalDate}T00:00:00`);
  const timeMax = encodeURIComponent(`${range.toLocalDate}T23:59:59`);
  const data = await authFetch<{ items?: CalendarEvent[] }>(
    `/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=${MAX_RESULTS}&singleEvents=true&orderBy=startTime`,
  );
  return data.items ?? [];
}

/**
 * Ported from v1's calendarEventToTaskData, adapted to the v2 common import
 * shape. v1 always attached `category: "life"` and `recurrence: "none"` to
 * every calendar-derived task. v2's `ImportedScheduleItem` has no category or
 * recurrence field at all — imported items intentionally carry no
 * classification (決定事項ログ F-4/H-3: the screen must not reveal an
 * item's origin, and F-7 confirms "no classification" is itself the correct
 * neutral state for an import, not a gap to fill in here).
 */
export function calendarEventToImportedItem(event: CalendarEvent): ImportedScheduleItem {
  const title = event.summary ?? "(無題)";

  if (event.start.dateTime) {
    const date = new Date(event.start.dateTime);
    const localDate = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    const scheduledTime = [
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0"),
    ].join(":");
    return { externalId: event.id, title, localDate, scheduledTime };
  }

  return { externalId: event.id, title, localDate: event.start.date ?? "" };
}

/**
 * Matches `GoogleIntegrationPort.fetchCalendarEvents` in
 * src/application/ports.ts exactly by name and signature — a composition
 * root can assign this function directly to that port slot.
 */
export async function fetchCalendarEvents(range: {
  readonly fromLocalDate: string;
  readonly toLocalDate: string;
}): Promise<readonly ImportedScheduleItem[]> {
  const events = await fetchRawCalendarEvents(range);
  return events.map(calendarEventToImportedItem);
}
