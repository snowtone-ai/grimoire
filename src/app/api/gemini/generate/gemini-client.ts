/** Whole-request budget, kept below the route's 60-second maxDuration. */
const DEFAULT_LADDER_BUDGET_MS = 50_000;
const DEFAULT_ATTEMPT_BUDGET_MS = 12_000;

// The managed alias currently resolves to the latest GA Flash release. The
// fixed Flash-Lite model is a distinct, stable continuity path for this small
// structured-extraction workload when the alias target is unavailable.
export const GEMINI_MODELS = ["gemini-flash-latest", "gemini-3.5-flash-lite"] as const;

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface GeminiClientOptions {
  fetchImpl?: FetchImplementation;
  ladderBudgetMs?: number;
  attemptBudgetMs?: number;
  now?: () => number;
  requestId?: string;
}

function errorResponse(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

function boundedMilliseconds(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || value === undefined) return fallback;
  return Math.max(1, Math.floor(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function hasCredentialMarker(body: string): boolean {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.error)) return false;
    const details = parsed.error.details;
    if (!Array.isArray(details)) return false;
    return details.some(
      (detail) =>
        isRecord(detail) &&
        typeof detail.reason === "string" &&
        detail.reason.startsWith("API_KEY_"),
    );
  } catch {
    return false;
  }
}

function isCredentialFailure(status: number, body: string): boolean {
  if (status === 401 || status === 403) return true;
  return hasCredentialMarker(body);
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

function validRequestId(requestId: string | undefined): string | undefined {
  return requestId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
    ? requestId
    : undefined;
}

function logClientOutcome(
  outcome:
    | "time_budget_exhausted"
    | "timeout"
    | "network_failure"
    | "credential_rejected"
    | "model_or_payload_rejected"
    | "temporarily_unavailable"
    | "upstream_rejected"
    | "invalid_json"
    | "empty_response",
  fields: { model?: (typeof GEMINI_MODELS)[number]; status?: number; requestId?: string },
): void {
  const event: Record<string, string | number> = {
    scope: "gemini/generate",
    outcome,
  };
  if (fields.model) event.model = fields.model;
  if (fields.status !== undefined) event.status = fields.status;
  const requestId = validRequestId(fields.requestId);
  if (requestId) event.requestId = requestId;
  console.error(JSON.stringify(event));
}

function responseText(data: unknown): string | null {
  if (!isRecord(data) || !Array.isArray(data.candidates)) return null;
  const candidate = data.candidates[0];
  if (!isRecord(candidate) || !isRecord(candidate.content)) return null;
  const parts = candidate.content.parts;
  if (!Array.isArray(parts)) return null;
  const content = parts
    .filter(
      (part) =>
        isRecord(part) && !part.thought && typeof part.text === "string",
    )
    .map((part) => (part as { text: string }).text)
    .join("");
  return content.trim() ? content : null;
}

export async function callGemini(
  apiKey: string,
  prompt: string,
  options: GeminiClientOptions = {},
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const requestId = validRequestId(options.requestId);
  const ladderBudgetMs = boundedMilliseconds(options.ladderBudgetMs, DEFAULT_LADDER_BUDGET_MS);
  const attemptBudgetMs = boundedMilliseconds(options.attemptBudgetMs, DEFAULT_ATTEMPT_BUDGET_MS);
  const deadline = now() + ladderBudgetMs;

  const payloads = [
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingLevel: "low" },
      },
    },
    // Compatibility fallback for a future alias target that rejects either
    // JSON response mode or thinkingConfig. Output validation remains local.
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2048 },
    },
  ] as const;

  let rejectedPayload = false;
  let retryableFailure = false;
  let emptyResponse = false;

  // Try the preferred payload on both models before relaxing it. That gives
  // the continuity model a chance without allowing any attempt to exceed the
  // shared deadline.
  for (const payload of payloads) {
    for (const model of GEMINI_MODELS) {
      const remaining = deadline - now();
      if (remaining <= 0) {
        logClientOutcome("time_budget_exhausted", { requestId });
        return errorResponse("upstream_timeout", 504);
      }

      let response: Response;
      try {
        response = await fetchImpl(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(Math.min(remaining, attemptBudgetMs)),
          },
        );
      } catch (error) {
        retryableFailure = true;
        logClientOutcome(isTimeoutError(error) ? "timeout" : "network_failure", {
          model,
          requestId,
        });
        continue;
      }

      if (response.status === 429) {
        return errorResponse("rate_limit", 429);
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");

        // Auth/account failures apply to every model and payload. Retrying
        // them only adds latency and can amplify a configuration problem.
        if (isCredentialFailure(response.status, body)) {
          logClientOutcome("credential_rejected", {
            status: response.status,
            requestId,
          });
          return errorResponse("service_configuration", 502);
        }

        if (response.status === 400 || response.status === 404) {
          rejectedPayload = true;
          logClientOutcome("model_or_payload_rejected", {
            model,
            status: response.status,
            requestId,
          });
          continue;
        }

        if (isRetryableStatus(response.status)) {
          retryableFailure = true;
          logClientOutcome("temporarily_unavailable", {
            model,
            status: response.status,
            requestId,
          });
          continue;
        }

        logClientOutcome("upstream_rejected", {
          status: response.status,
          requestId,
        });
        return errorResponse("upstream_rejected", 502);
      }

      let data: unknown;
      try {
        data = (await response.json()) as unknown;
      } catch {
        retryableFailure = true;
        logClientOutcome("invalid_json", { model, status: response.status, requestId });
        continue;
      }

      const content = responseText(data);

      if (content) return Response.json({ text: content });

      emptyResponse = true;
      logClientOutcome("empty_response", { model, status: response.status, requestId });
    }
  }

  if (retryableFailure) {
    return errorResponse("temporarily_unavailable", 503);
  }
  if (rejectedPayload) {
    return errorResponse("unsupported_model_or_payload", 502);
  }
  if (emptyResponse) {
    return errorResponse("invalid_response", 502);
  }
  return errorResponse("upstream_failure", 502);
}
