import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractTaskCandidates,
  gmailCandidateToImportedItem,
  type GmailTaskCandidate,
} from "../../../../src/integrations/google/gmail-task-extractor";
import type { GmailMessage } from "../../../../src/integrations/google/gmail";

const MESSAGES: GmailMessage[] = [
  { id: "msg-1", subject: "ES締切のお知らせ", snippet: "8/20までにご提出ください", date: "", from: "hr@example.com" },
  { id: "msg-2", subject: "今週のニュースレター", snippet: "特集記事はこちら", date: "", from: "news@example.com" },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("extractTaskCandidates", () => {
  it("keeps only well-formed candidates and drops the classification field (F-4/F-7)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          text: JSON.stringify([
            { index: 0, title: "ES提出", dueDate: "2026-08-20", dueTime: null, category: "job" },
          ]),
        }),
      ),
    );

    const candidates = await extractTaskCandidates(MESSAGES);

    expect(candidates).toEqual([
      { messageId: "msg-1", title: "ES提出", dueDate: "2026-08-20", dueTime: null },
    ]);
    expect(Object.keys(candidates[0] as object)).not.toContain("category");
  });

  it("drops a candidate whose category is not one of the known values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          text: JSON.stringify([
            { index: 0, title: "ES提出", dueDate: "2026-08-20", dueTime: null, category: "unknown" },
          ]),
        }),
      ),
    );

    expect(await extractTaskCandidates(MESSAGES)).toEqual([]);
  });

  it("drops a candidate whose index does not resolve to a sent message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          text: JSON.stringify([
            { index: 99, title: "ES提出", dueDate: "2026-08-20", dueTime: null, category: "job" },
          ]),
        }),
      ),
    );

    expect(await extractTaskCandidates(MESSAGES)).toEqual([]);
  });

  it("truncates an overlong title to 120 characters", async () => {
    const longTitle = "あ".repeat(200);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          text: JSON.stringify([
            { index: 0, title: longTitle, dueDate: "2026-08-20", dueTime: null, category: "job" },
          ]),
        }),
      ),
    );

    const [candidate] = await extractTaskCandidates(MESSAGES);
    expect(candidate?.title.length).toBe(120);
  });

  it("returns an empty array on a 429, without throwing (ported v1 behaviour)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 429)));
    await expect(extractTaskCandidates(MESSAGES)).resolves.toEqual([]);
  });

  it("returns an empty array when the route responds with a non-ok status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "boom" }, 500)));
    await expect(extractTaskCandidates(MESSAGES)).resolves.toEqual([]);
  });

  it("returns an empty array when the model's text is not valid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ text: "not json" })));
    await expect(extractTaskCandidates(MESSAGES)).resolves.toEqual([]);
  });

  it("returns an empty array immediately for an empty message list", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ text: "[]" }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await extractTaskCandidates([])).toEqual([]);
    // v1 still calls through with an empty messages array; this only pins
    // that the extractor does not crash on it, not that it short-circuits.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("gmailCandidateToImportedItem", () => {
  it("carries dueTime through when present", () => {
    const candidate: GmailTaskCandidate = {
      messageId: "msg-1",
      title: "ES提出",
      dueDate: "2026-08-20",
      dueTime: "18:00",
    };
    expect(gmailCandidateToImportedItem(candidate)).toEqual({
      externalId: "msg-1",
      title: "ES提出",
      localDate: "2026-08-20",
      scheduledTime: "18:00",
    });
  });

  it("omits scheduledTime entirely when dueTime is null (exactOptionalPropertyTypes)", () => {
    const candidate: GmailTaskCandidate = {
      messageId: "msg-1",
      title: "ES提出",
      dueDate: "2026-08-20",
      dueTime: null,
    };
    const item = gmailCandidateToImportedItem(candidate);
    expect(item).toEqual({ externalId: "msg-1", title: "ES提出", localDate: "2026-08-20" });
    expect(item && "scheduledTime" in item).toBe(false);
  });

  it("returns null when there is no due date to represent (localDate is mandatory)", () => {
    const candidate: GmailTaskCandidate = {
      messageId: "msg-1",
      title: "ES提出",
      dueDate: null,
      dueTime: null,
    };
    expect(gmailCandidateToImportedItem(candidate)).toBeNull();
  });
});
