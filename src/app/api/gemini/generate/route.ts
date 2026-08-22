/**
 * Ported from v1 (main branch) src/app/api/gemini/generate/route.ts — see D-013.
 * Server-only proxy for Gemini calls. The API key never reaches the client,
 * and — since this endpoint is unauthenticated on a public URL — only two
 * fixed, size-bounded request shapes are accepted. There is no free-form
 * "prompt" field: accepting one would turn this into an open LLM relay for
 * anyone who finds the URL.
 */

import { buildGmailExtractionPrompt, buildTaskParsePrompt } from "@/integrations/gemini/prompts";
import { redactSecret } from "@/integrations/shared/errors";
import type { GmailMessage } from "@/integrations/google/gmail";

export const maxDuration = 60;

/** Whole-request budget for the model/payload retry ladder, inside maxDuration. */
const LADDER_BUDGET_MS = 50_000;

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;
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
      generationConfig: { temperature: 0.1, responseMimeType: "application/json", maxOutputTokens: 2048 },
    },
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    },
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2048 } },
  ] as const;

  let last400Status = 0;
  // One budget for the whole ladder rather than per attempt: 2 models x 3
  // payloads at 45s each would be 270s against a 60s maxDuration, so the tail
  // of the ladder could never actually run.
  const deadline = Date.now() + LADDER_BUDGET_MS;

  for (const model of GEMINI_MODELS) {
    for (const payload of payloads) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        console.error("[gemini/generate] exhausted the time budget before finding a working payload");
        return Response.json({ error: "Gemini API request failed" }, { status: 504 });
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(remaining),
        }
      );

      if (response.status === 429) return Response.json({ error: "rate_limit" }, { status: 429 });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        if (response.status === 400) {
          // Kept server-side only: it can carry project identifiers, and this
          // endpoint is reachable by anyone. Without it, an all-400 ladder is
          // undiagnosable.
          last400Status = 400;
          console.error(`[gemini/generate] ${model} rejected a payload:`, redactSecret(body).slice(0, 200));
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

  if (last400Status) {
    console.error("[gemini/generate] all model/payload combinations returned 400");
    return Response.json({ error: "Gemini API request failed" }, { status: 502 });
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
