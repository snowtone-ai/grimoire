import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractJsonObjectText,
  parseTaskFromText,
  parseTaskPayload,
} from "../../../../src/integrations/gemini/client";
import { RateLimitError } from "../../../../src/integrations/shared/errors";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("extractJsonObjectText", () => {
  it("unwraps a ```json fenced block", () => {
    expect(extractJsonObjectText('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("unwraps a bare fenced block without a language tag", () => {
    expect(extractJsonObjectText('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("slices from the first { to the last } when there is no fence", () => {
    expect(extractJsonObjectText('here you go: {"a":1} thanks')).toBe('{"a":1}');
  });

  it("passes already-clean JSON through unchanged", () => {
    expect(extractJsonObjectText('{"a":1}')).toBe('{"a":1}');
  });
});

describe("parseTaskPayload", () => {
  const valid = JSON.stringify({
    title: "ES提出",
    dueDate: "2026-08-20",
    dueTime: "18:00",
    category: "job",
  });

  it("parses a well-formed payload", () => {
    expect(parseTaskPayload(valid)).toEqual({
      title: "ES提出",
      dueDate: "2026-08-20",
      dueTime: "18:00",
      category: "job",
    });
  });

  it("accepts a null dueTime", () => {
    const payload = JSON.stringify({ title: "T", dueDate: "2026-08-20", dueTime: null, category: "life" });
    expect(parseTaskPayload(payload).dueTime).toBeNull();
  });

  it("truncates an overlong title to 120 characters", () => {
    const payload = JSON.stringify({
      title: "あ".repeat(200),
      dueDate: "2026-08-20",
      dueTime: null,
      category: "life",
    });
    expect(parseTaskPayload(payload).title.length).toBe(120);
  });

  it.each([
    ["blank title", { title: "  ", dueDate: "2026-08-20", dueTime: null, category: "life" }],
    ["malformed dueDate", { title: "T", dueDate: "2026/08/20", dueTime: null, category: "life" }],
    ["malformed dueTime", { title: "T", dueDate: "2026-08-20", dueTime: "6pm", category: "life" }],
    ["invalid category", { title: "T", dueDate: "2026-08-20", dueTime: null, category: "hobby" }],
  ])("rejects a payload with %s", (_label, payload) => {
    expect(() => parseTaskPayload(JSON.stringify(payload))).toThrow(
      "Invalid task structure from Gemini API",
    );
  });
});

describe("parseTaskFromText", () => {
  it("posts normalized voice text and parses the returned task", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            text: JSON.stringify({
              title: "ES提出",
              dueDate: "2026-08-20",
              dueTime: "18:00",
              category: "job",
            }),
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const task = await parseTaskFromText("  明日 ES を   出す  ", "2026-08-19");

    expect(task.title).toBe("ES提出");
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("fetch was not called");
    const [url, init] = call as unknown as [string, RequestInit];
    expect(url).toBe("/api/gemini/generate");
    const body = JSON.parse(init.body as string) as { kind: string; text: string; todayDate: string };
    expect(body).toEqual({ kind: "voice", text: "明日 ES を 出す", todayDate: "2026-08-19" });
  });

  it("throws RateLimitError on 429 without reading the body as a task", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 429 })));
    await expect(parseTaskFromText("何かのタスク", "2026-08-19")).rejects.toBeInstanceOf(RateLimitError);
  });

  it("throws with the server's error message on a non-ok, non-429 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "AI機能は現在利用できません" }), { status: 500 })),
    );
    await expect(parseTaskFromText("何かのタスク", "2026-08-19")).rejects.toThrow(
      "AI機能は現在利用できません",
    );
  });

  it("throws on an empty model response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ text: "" }), { status: 200 })));
    await expect(parseTaskFromText("何かのタスク", "2026-08-19")).rejects.toThrow(
      "Empty response from Gemini API",
    );
  });

  it("rejects blank input before ever calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(parseTaskFromText("   ", "2026-08-19")).rejects.toThrow("Voice input is empty");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
