import { buildTaskParsePrompt, buildGmailExtractionPrompt } from "@/lib/api/gemini-prompts";
import type { GmailMessage } from "@/lib/api/gmail";
import { callGemini } from "./gemini-client";

// Server-only proxy for Gemini calls. The API key never reaches the client,
// and — since this endpoint is unauthenticated on a public URL — only two
// fixed, size-bounded request shapes are accepted. There is no free-form
// "prompt" field: accepting one would turn this into an open LLM relay for
// anyone who finds the URL.
export const maxDuration = 60;
const MAX_TEXT_LENGTH = 500;
const MAX_MESSAGES = 30;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

export async function POST(request: Request): Promise<Response> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[gemini/generate] GEMINI_API_KEY is not configured");
      return Response.json({ error: "service_configuration" }, { status: 503 });
    }

    const body = (await request.json().catch(() => null)) as RequestBody | null;
    const prompt = body ? buildPrompt(body) : null;
    if (!prompt) {
      return Response.json({ error: "invalid request" }, { status: 400 });
    }

    return await callGemini(apiKey, prompt);
  } catch (err) {
    // Do not serialize arbitrary thrown values here: a custom fetch layer can
    // include request headers, including the server-only API key, in errors.
    console.error(
      "[gemini/generate] unexpected error",
      err instanceof Error ? err.name : "unknown",
    );
    return Response.json({ error: "Gemini API request failed" }, { status: 502 });
  }
}
