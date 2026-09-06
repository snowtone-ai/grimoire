import type { Category, Recurrence } from "@/lib/db";
import { googleAuthFetch } from "./google-auth.ts";
import { validAppointment } from "../domain/calendar-import.ts";

export interface CalendarEvent {
  id: string;
  calendarId?: string;
  summary?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
}

const BASE = "https://www.googleapis.com/calendar/v3";
const ID_PATTERN = /^[^/\s]{1,512}$/;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

// F1+F5: delegates auth + 401 handling to googleAuthFetch; generic T makes casts explicit.
async function authFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await googleAuthFetch("calendar", `${BASE}${path}`, { signal });
  if (!response.ok) throw new Error(`Calendar API error: ${response.status}`);
  const data: unknown = await response.json();
  if (data === null || typeof data !== "object") {
    throw new Error("Calendar API returned an unexpected response");
  }
  return data as T;
}

export async function fetchUpcomingEvents(signal?: AbortSignal): Promise<CalendarEvent[]> {
  const boundedSignal = AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])]);
  const calendar = await authFetch<{ id?: string }>("/calendars/primary", boundedSignal);
  if (typeof calendar.id !== "string" || !ID_PATTERN.test(calendar.id)) {
    throw new Error("Calendar ID is invalid");
  }
  const timeMin = encodeURIComponent(new Date().toISOString());
  const data = await authFetch<{ items?: CalendarEvent[] }>(
    `/calendars/${encodeURIComponent(calendar.id)}/events?timeMin=${timeMin}&maxResults=30&singleEvents=true&orderBy=startTime`,
    boundedSignal,
  );
  const events = data.items ?? [];
  if (!Array.isArray(events)) throw new Error("Invalid Calendar events");
  const seen = new Set<string>();
  return events.slice(0, 30).map((event) => ({ ...event, calendarId: calendar.id })).filter(event => {
    const key = calendarImportSourceKey(event);
    calendarEventToTaskData(event);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function calendarImportSourceKey(event: Pick<CalendarEvent, "calendarId" | "id">): string {
  if (typeof event.calendarId !== "string" || !ID_PATTERN.test(event.calendarId)) {
    throw new Error("Calendar ID is invalid");
  }
  if (typeof event.id !== "string" || !ID_PATTERN.test(event.id)) {
    throw new Error("Calendar event ID is invalid");
  }
  return `google-calendar:${encodeURIComponent(event.calendarId)}:${encodeURIComponent(event.id)}`;
}

export function calendarEventToTaskData(event: CalendarEvent) {
  let dueDate: string;
  let dueTime: string | null;

  if (event.start.dateTime) {
    const date = new Date(event.start.dateTime);
    if (!DATE_TIME_PATTERN.test(event.start.dateTime) || Number.isNaN(date.getTime())) {
      throw new Error("Calendar event date-time is invalid");
    }
    if (!validAppointment({ title: "date", dueDate: event.start.dateTime.slice(0, 10), dueTime: event.start.dateTime.slice(11, 16) })) {
      throw new Error("Calendar event date-time is invalid");
    }
    dueDate = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    dueTime = [
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0"),
    ].join(":");
  } else {
    dueDate = event.start.date ?? "";
    dueTime = null;
  }

  const task = {
    title: typeof event.summary === "string" && event.summary.trim() ? event.summary.trim().slice(0, 500) : "(無題)",
    dueDate,
    dueTime,
    category: "life" as Category,
    recurrence: "none" as Recurrence,
  };
  if (!validAppointment(task)) throw new Error("Calendar event date is invalid");
  return task;
}
