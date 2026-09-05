import { redactSecret } from "../../../../lib/errors.ts";

/** Whole-request budget, kept below the route's 60-second maxDuration. */
const DEFAULT_LADDER_BUDGET_MS = 50_000;
const DEFAULT_ATTEMPT_BUDGET_MS = 12_000;

// The managed alias currently resolves to the latest GA Flash release. The
// fixed Flash-Lite model is a distinct, stable continuity path for this small
// structured-extraction workload when the alias target is unavailable.
export const GEMINI_MODELS = ["gemini-flash-latest", "gemini-3.5-flash-lite"] as const;

type GeminiResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
  }>;
  promptFeedback?: { blockReason?: string };
};

type GeminiErrorEnvelope = {
  error?: {
    status?: string;
    details?: Array<{ reason?: string }>;
  };
};

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface GeminiClientOptions {
  fetchImpl?: FetchImplementation;
  ladderBudgetMs?: number;
  attemptBudgetMs?: number;
  now?: () => number;
}

function errorResponse(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

function boundedMilliseconds(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || value === undefined) return fallback;
  return Math.max(1, Math.floor(value));
}

function parseErrorEnvelope(body: string): GeminiErrorEnvelope | null {
  try {
    const parsed = JSON.parse(body) as unknown;
    return parsed !== null && typeof parsed === "object"
      ? (parsed as GeminiErrorEnvelope)
      : null;
  } catch {
    return null;
  }
}

function upstreamReason(body: string): string | undefined {
  return parseErrorEnvelope(body)?.error?.details?.find(
    (detail) => typeof detail?.reason === "string",
  )?.reason;
}

function isCredentialFailure(status: number, body: string): boolean {
  if (status === 401 || status === 403) return true;
  return upstreamReason(body)?.startsWith("API_KEY_") ?? false;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 500 || status === 502 || status === 503 || status === 504;
}

function safeDetail(body: string): string {
  return redactSecret(body).slice(0, 200);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

export async function callGemini(
  apiKey: string,
  prompt: string,
  options: GeminiClientOptions = {},
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
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
        console.error("[gemini/generate] exhausted the request time budget");
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
        console.error(
          isTimeoutError(error)
            ? `[gemini/generate] ${model} timed out`
            : `[gemini/generate] ${model} network request failed`,
        );
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
          console.error(
            "[gemini/generate] credential or account request rejected",
            response.status,
            upstreamReason(body) ?? "unknown",
          );
          return errorResponse("service_configuration", 502);
        }

        if (response.status === 400 || response.status === 404) {
          rejectedPayload = true;
          console.error(
            `[gemini/generate] ${model} rejected a model or payload`,
            response.status,
            safeDetail(body),
          );
          continue;
        }

        if (isRetryableStatus(response.status)) {
          retryableFailure = true;
          console.error(
            `[gemini/generate] ${model} temporarily unavailable`,
            response.status,
            safeDetail(body),
          );
          continue;
        }

        console.error(
          "[gemini/generate] upstream request rejected",
          response.status,
          safeDetail(body),
        );
        return errorResponse("upstream_rejected", 502);
      }

      let data: GeminiResponse;
      try {
        data = (await response.json()) as GeminiResponse;
      } catch {
        retryableFailure = true;
        console.error(`[gemini/generate] ${model} returned invalid JSON`);
        continue;
      }

      const content = data.candidates?.[0]?.content?.parts
        ?.filter((part) => !part.thought && typeof part.text === "string")
        .map((part) => part.text)
        .join("");

      if (content?.trim()) return Response.json({ text: content });

      emptyResponse = true;
      console.error(
        `[gemini/generate] ${model} returned no text`,
        data.promptFeedback?.blockReason ?? data.candidates?.[0]?.finishReason ?? "unknown",
      );
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
