import test from "node:test";
import assert from "node:assert/strict";
import {
  GeminiTaskError,
  parseTaskFromText,
  parseTaskPayload,
} from "../../src/lib/gemini.ts";
import {
  GEMINI_MODELS,
  callGemini,
} from "../../src/app/api/gemini/generate/gemini-client.ts";

test("Gemini uses Google's managed latest Flash alias with one stable fallback", () => {
  assert.deepEqual(GEMINI_MODELS, [
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
  ]);
});

test("task payload validation rejects impossible calendar dates and times", () => {
  const valid = parseTaskPayload(
    '{"title":"薬を受け取る","dueDate":"2026-09-05","dueTime":"18:30","category":"life"}',
  );
  assert.equal(valid.title, "薬を受け取る");

  assert.throws(
    () =>
      parseTaskPayload(
        '{"title":"不正な日付","dueDate":"2026-02-30","dueTime":null,"category":"life"}',
      ),
    /Invalid task structure/,
  );
  assert.throws(
    () =>
      parseTaskPayload(
        '{"title":"不正な時刻","dueDate":"2026-09-05","dueTime":"24:10","category":"life"}',
      ),
    /Invalid task structure/,
  );
});

test("Gemini client combines non-thinking text parts from the latest alias", async () => {
  const requests = [];
  const response = await callGemini("test-key", "prompt", {
    fetchImpl: async (input, init) => {
      requests.push({ input: String(input), init });
      return Response.json({
        candidates: [
          {
            content: {
              parts: [
                { text: "internal", thought: true },
                { text: '{"title":"買い物",' },
                { text: '"dueDate":"2026-09-05"}' },
              ],
            },
          },
        ],
      });
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    text: '{"title":"買い物","dueDate":"2026-09-05"}',
  });
  assert.equal(requests.length, 1);
  assert.match(requests[0].input, /models\/gemini-flash-latest:generateContent$/);
  const payload = JSON.parse(requests[0].init.body);
  assert.equal(payload.generationConfig.thinkingConfig.thinkingLevel, "low");
});

test("a transient latest-model failure continues on the stable Flash fallback", async () => {
  const urls = [];
  const response = await callGemini("test-key", "prompt", {
    fetchImpl: async (input) => {
      urls.push(String(input));
      if (urls.length === 1) return Response.json({}, { status: 503 });
      return Response.json({
        candidates: [{ content: { parts: [{ text: "{}" }] } }],
      });
    },
  });

  assert.equal(response.status, 200);
  assert.equal(urls.length, 2);
  assert.match(urls[1], /models\/gemini-3\.5-flash-lite:generateContent$/);
});

test("credential rejection stops the retry ladder without leaking upstream detail", async () => {
  let calls = 0;
  const response = await callGemini("test-key", "prompt", {
    fetchImpl: async () => {
      calls += 1;
      return Response.json(
        {
          error: {
            details: [{ reason: "API_KEY_INVALID" }],
            message: "AIzaThisMustNeverReachTheClient123456789",
          },
        },
        { status: 403 },
      );
    },
  });

  assert.equal(calls, 1);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "service_configuration" });
});

test("voice parsing normalizes input and maps an invalid model response", async () => {
  const originalFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (_input, init) => {
    sent = JSON.parse(init.body);
    return Response.json({ text: "not-json" });
  };

  try {
    await assert.rejects(
      parseTaskFromText("  明日   買い物  ", "2026-09-05", { timeoutMs: 100 }),
      (error) =>
        error instanceof GeminiTaskError && error.kind === "invalid-response",
    );
    assert.deepEqual(sent, {
      kind: "voice",
      text: "明日 買い物",
      todayDate: "2026-09-05",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("voice parsing preserves caller cancellation", async () => {
  const controller = new AbortController();
  const reason = new DOMException("left page", "AbortError");
  controller.abort(reason);

  await assert.rejects(
    parseTaskFromText("買い物", "2026-09-05", { signal: controller.signal }),
    (error) => error === reason,
  );
});
