import type { Category, Recurrence } from "@/lib/db";
import { googleAuthFetch } from "./google-auth";

export interface CalendarEvent {
  id: string;
  summary?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
}

const BASE = "https://www.googleapis.com/calendar/v3";

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

export async function fetchUpcomingEvents(): Promise<CalendarEvent[]> {
  const timeMin = encodeURIComponent(new Date().toISOString());
  const data = await authFetch<{ items?: CalendarEvent[] }>(
    `/calendars/primary/events?timeMin=${timeMin}&maxResults=30&singleEvents=true&orderBy=startTime`,
  );
  return data.items ?? [];
}

export function calendarEventToTaskData(event: CalendarEvent) {
  let dueDate: string;
  let dueTime: string | null;

  if (event.start.dateTime) {
    const date = new Date(event.start.dateTime);
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

  return {
    title: event.summary ?? "(無題)",
    dueDate,
    dueTime,
    category: "life" as Category,
    recurrence: "none" as Recurrence,
  };
}
