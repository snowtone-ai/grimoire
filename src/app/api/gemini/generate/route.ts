import { buildTaskParsePrompt, buildGmailExtractionPrompt } from "@/lib/api/gemini-prompts";
import type { GmailMessage } from "@/lib/api/gmail";
import { redactSecret } from "@/lib/errors";

// Server-only proxy for Gemini calls. The API key never reaches the client,
// and — since this endpoint is unauthenticated on a public URL — only two
// fixed, size-bounded request shapes are accepted. There is no free-form
// "prompt" field: accepting one would turn this into an open LLM relay for
// anyone who finds the URL.
export const maxDuration = 60;

/** Whole-request budget for the model/payload retry ladder, inside maxDuration. */
const LADDER_BUDGET_MS = 50_000;
const ATTEMPT_BUDGET_MS = 12_000;

// Google hot-swaps this alias to the newest Flash release. Unlike a pinned
// model ID, it keeps the app current without a deploy for each Gemini release.
// The current GA release is only a continuity fallback when the alias target
// is temporarily overloaded or unavailable.
const GEMINI_MODELS = ["gemini-flash-latest", "gemini-3.7-flash"] as const;
const MAX_TEXT_LENGTH = 500;
const MAX_MESSAGES = 30;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

type RequestBody =
  | { kind: "voice"; text: string; todayDate: string }
  | { kind: "gmail"; messages: Pick<GmailMessage, "subject" | "from" | "snippet">[] };

function buildPrompt(body: RequestBody): string | null {
  if (body.kind === "voice") {
    if (typeof body.text !== "string" || typeof body.todayDate !== "string") return null;
    const text = body.text.trim().slice(0, MAX_TEXT_LENGTH);
    if (!text || !DATE_PATTERN.test(body.todayDate)) return null;
    return buildTaskParsePrompt(text, body.todayDate);
  }
  if (body.kind === "gmail") {
    if (!Array.isArray(body.messages) || body.messages.length === 0) return null;
    const messages = body.messages.slice(0, MAX_MESSAGES).filter(
      (m): m is Pick<GmailMessage, "subject" | "from" | "snippet"> =>
        !!m && typeof m.subject === "string" && typeof m.from === "string" && typeof m.snippet === "string"
    );
    if (messages.length === 0) return null;
    return buildGmailExtractionPrompt(messages);
  }
  return null;
}

async function callGemini(apiKey: string, prompt: string): Promise<Response> {
  const payloads = [
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 2048 },
    },
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2048 } },
  ] as const;

  let rejectedPayload = false;
  let retryableFailure = false;
  // One budget for the whole payload ladder rather than per attempt, so every
  // compatibility fallback stays inside the route's 60s maxDuration.
  const deadline = Date.now() + LADDER_BUDGET_MS;

  // Try the preferred JSON payload on both models before relaxing the payload.
  // This guarantees the continuity model gets a turn even if the latest alias
  // hangs, while the whole ladder remains inside the route budget.
  for (const payload of payloads) {
    for (const model of GEMINI_MODELS) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        console.error("[gemini/generate] exhausted the time budget before finding a working payload");
        return Response.json({ error: "Gemini API request failed" }, { status: 504 });
      }

      let response: Response;
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(Math.min(remaining, ATTEMPT_BUDGET_MS)),
          }
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "TimeoutError") {
          retryableFailure = true;
          console.error(`[gemini/generate] ${model} timed out`);
          continue;
        }
        throw err;
      }

      if (response.status === 429) return Response.json({ error: "rate_limit" }, { status: 429 });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        if (response.status === 400 || response.status === 404) {
          // Kept server-side only: it can carry project identifiers, and this
          // endpoint is reachable by anyone. Without it, a rejected ladder is
          // undiagnosable.
          rejectedPayload = true;
          console.error(`[gemini/generate] ${model} rejected a payload:`, redactSecret(body).slice(0, 200));
          continue;
        }
        if ([500, 502, 503, 504].includes(response.status)) {
          retryableFailure = true;
          console.error(
            `[gemini/generate] ${model} temporarily unavailable`,
            response.status,
            redactSecret(body).slice(0, 200)
          );
          continue;
        }
        console.error("[gemini/generate] upstream error", response.status, redactSecret(body).slice(0, 200));
        return Response.json({ error: "Gemini API request failed" }, { status: 502 });
      }

      const data = (await response.json()) as GeminiResponse;
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content?.trim()) return Response.json({ text: content });
    }
  }

  if (rejectedPayload) {
    console.error("[gemini/generate] all payload variants returned 400");
    return Response.json({ error: "Gemini API request failed" }, { status: 502 });
  }
  if (retryableFailure) {
    console.error("[gemini/generate] all model attempts were temporarily unavailable");
    return Response.json({ error: "Gemini API request failed" }, { status: 503 });
  }
  return Response.json({ error: "Empty response from Gemini API" }, { status: 502 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "AI機能は現在利用できません" }, { status: 500 });
    }

    const body = (await request.json().catch(() => null)) as RequestBody | null;
    const prompt = body ? buildPrompt(body) : null;
    if (!prompt) {
      return Response.json({ error: "invalid request" }, { status: 400 });
    }

    return await callGemini(apiKey, prompt);
  } catch (err) {
    console.error("[gemini/generate] unexpected error", err);
    return Response.json({ error: "Gemini API request failed" }, { status: 502 });
  }
}
