import test from "node:test";
import assert from "node:assert/strict";
import { callGemini } from "../../src/app/api/gemini/generate/gemini-client.ts";

function captureErrors() {
  const original = console.error;
  const entries = [];
  console.error = (...args) => entries.push(args);
  return {
    entries,
    restore() {
      console.error = original;
    },
  };
}

function joinedLogs(entries) {
  return entries.flat().map(String).join("\n");
}

test("upstream credential details never reach logs or the client response", async () => {
  const marker = "UNIQUE_GEMINI_PROVIDER_SECRET_MARKER";
  const capture = captureErrors();
  try {
    const response = await callGemini("server-key-marker", "private transcript marker", {
      requestId: "123e4567-e89b-12d3-a456-426614174000",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error: {
              details: [{ reason: marker }],
              message: marker,
            },
          }),
          { status: 403, headers: { "content-type": "application/json" } },
        ),
    });

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "service_configuration" });
    assert.doesNotMatch(joinedLogs(capture.entries), /UNIQUE_GEMINI_PROVIDER_SECRET_MARKER/);
    assert.doesNotMatch(joinedLogs(capture.entries), /server-key-marker|private transcript marker/);
  } finally {
    capture.restore();
  }
});

test("malformed provider error details are bounded and sanitized", async () => {
  const marker = "UNIQUE_MALFORMED_PROVIDER_MARKER";
  const capture = captureErrors();
  try {
    const response = await callGemini("server-key-marker", "prompt", {
      fetchImpl: async () =>
        Response.json(
          {
            error: {
              details: { reason: marker },
              message: marker,
            },
          },
          { status: 503 },
        ),
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "temporarily_unavailable" });
    assert.doesNotMatch(joinedLogs(capture.entries), /UNIQUE_MALFORMED_PROVIDER_MARKER/);
  } finally {
    capture.restore();
  }
});

test("malformed candidates and parts return a fixed 502 instead of throwing", async () => {
  const marker = "UNIQUE_MALFORMED_CANDIDATE_MARKER";
  const capture = captureErrors();
  try {
    const response = await callGemini("server-key-marker", "prompt", {
      fetchImpl: async () =>
        Response.json({
          candidates: {
            content: { parts: { text: marker } },
          },
          promptFeedback: marker,
        }),
    });

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "invalid_response" });
    assert.doesNotMatch(joinedLogs(capture.entries), /UNIQUE_MALFORMED_CANDIDATE_MARKER/);
  } finally {
    capture.restore();
  }
});

test("network error names and messages are not logged", async () => {
  const marker = "UNIQUE_NETWORK_ERROR_MARKER";
  const capture = captureErrors();
  try {
    const response = await callGemini("server-key-marker", "prompt", {
      fetchImpl: async () => {
        const error = new Error(marker);
        error.name = marker;
        throw error;
      },
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "temporarily_unavailable" });
    assert.doesNotMatch(joinedLogs(capture.entries), /UNIQUE_NETWORK_ERROR_MARKER/);
    assert.doesNotMatch(joinedLogs(capture.entries), /server-key-marker/);
  } finally {
    capture.restore();
  }
});
