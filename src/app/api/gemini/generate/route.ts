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

type RequestKind = "voice" | "gmail" | "invalid";

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

function requestKind(body: unknown): RequestKind {
  if (
    body !== null &&
    typeof body === "object" &&
    "kind" in body &&
    (body.kind === "voice" || body.kind === "gmail")
  ) {
    return body.kind;
  }
  return "invalid";
}

function requestId(): string {
  return crypto.randomUUID();
}

function withRequestId(response: Response, id: string): Response {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", id);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();
  const id = requestId();
  let kind: RequestKind = "invalid";

  const finish = (response: Response): Response => {
    const result = withRequestId(response, id);
    console.info(
      JSON.stringify({
        scope: "gemini/generate",
        requestId: id,
        durationMs: Math.max(0, Date.now() - startedAt),
        status: result.status,
        kind,
      }),
    );
    return result;
  };

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[gemini/generate] GEMINI_API_KEY is not configured");
      return finish(Response.json({ error: "service_configuration" }, { status: 503 }));
    }

    const body = (await request.json().catch(() => null)) as RequestBody | null;
    kind = requestKind(body);
    const prompt = body ? buildPrompt(body) : null;
    if (!prompt) {
      return finish(Response.json({ error: "invalid request" }, { status: 400 }));
    }

    return finish(await callGemini(apiKey, prompt, { requestId: id }));
  } catch {
    // Do not serialize arbitrary thrown values here: a custom fetch layer can
    // include request headers, including the server-only API key, in errors.
    console.error("[gemini/generate] unexpected error");
    return finish(Response.json({ error: "Gemini API request failed" }, { status: 502 }));
  }
}
