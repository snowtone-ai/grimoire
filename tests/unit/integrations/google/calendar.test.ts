import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calendarEventToImportedItem,
  fetchCalendarEvents,
  fetchRawCalendarEvents,
  type CalendarEvent,
} from "../../../../src/integrations/google/calendar";
import { clearToken, connect } from "../../../../src/integrations/google/auth";

type GisCallback = (resp: { error?: string; access_token?: string }) => void;

function installFakeGis(onRequestAccessToken: (callback: GisCallback) => void): void {
  vi.stubGlobal("google", {
    accounts: {
      oauth2: {
        initTokenClient: (cfg: { callback: GisCallback }) => ({
          requestAccessToken: () => onRequestAccessToken(cfg.callback),
        }),
      },
    },
  });
}

/** fetchCalendarEvents delegates auth to googleAuthFetch, which requires a live
 * in-memory token — obtained the same way the app would, through connect(). */
async function withCalendarToken(): Promise<void> {
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id");
  installFakeGis((callback) => callback({ access_token: "tok-cal" }));
  await connect("calendar");
}

afterEach(() => {
  clearToken("calendar");
});

describe("calendarEventToImportedItem", () => {
  it("derives localDate/scheduledTime from a timed event using local wall-clock fields", () => {
    const event: CalendarEvent = {
      id: "evt-1",
      summary: "面談",
      start: { dateTime: "2026-09-01T14:30:00+09:00" },
      end: { dateTime: "2026-09-01T15:00:00+09:00" },
    };
    // Matches v1's own `new Date(event.start.dateTime)` + local getters
    // behaviour: interpreted in the test runner's local time zone.
    const expected = new Date("2026-09-01T14:30:00+09:00");

    const item = calendarEventToImportedItem(event);

    expect(item.externalId).toBe("evt-1");
    expect(item.title).toBe("面談");
    expect(item.localDate).toBe(
      `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, "0")}-${String(expected.getDate()).padStart(2, "0")}`,
    );
    expect(item.scheduledTime).toBe(
      `${String(expected.getHours()).padStart(2, "0")}:${String(expected.getMinutes()).padStart(2, "0")}`,
    );
  });

  it("omits scheduledTime entirely for an all-day event (exactOptionalPropertyTypes)", () => {
    const event: CalendarEvent = {
      id: "evt-2",
      summary: "休日",
      start: { date: "2026-09-05" },
      end: { date: "2026-09-06" },
    };

    const item = calendarEventToImportedItem(event);

    expect(item.localDate).toBe("2026-09-05");
    expect("scheduledTime" in item).toBe(false);
  });

  it("falls back to a generic title when summary is absent, and never leaks the source (F-4/H-3)", () => {
    const event: CalendarEvent = {
      id: "evt-3",
      start: { date: "2026-09-05" },
      end: { date: "2026-09-06" },
    };

    const item = calendarEventToImportedItem(event);
    expect(item.title).toBe("(無題)");
    expect(Object.keys(item).sort()).toEqual(["externalId", "localDate", "title"]);
  });
});

describe("fetchCalendarEvents", () => {
  it("fetches the given range and normalizes every event, matching GoogleIntegrationPort.fetchCalendarEvents", async () => {
    await withCalendarToken();
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                id: "evt-9",
                summary: "提出",
                start: { date: "2026-09-10" },
                end: { date: "2026-09-11" },
              },
            ],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const items = await fetchCalendarEvents({ fromLocalDate: "2026-09-01", toLocalDate: "2026-09-30" });

    expect(items).toEqual([{ externalId: "evt-9", title: "提出", localDate: "2026-09-10" }]);
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("fetch was not called");
    const [url] = call as unknown as [string];
    expect(url).toContain("timeMin=2026-09-01T00%3A00%3A00");
    expect(url).toContain("timeMax=2026-09-30T23%3A59%3A59");
  });

  it("returns an empty array when the Calendar API responds with no items", async () => {
    await withCalendarToken();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));

    const raw = await fetchRawCalendarEvents({ fromLocalDate: "2026-09-01", toLocalDate: "2026-09-30" });
    expect(raw).toEqual([]);
  });
});
