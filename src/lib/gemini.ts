import type { Category } from "./db";
import { RateLimitError } from "./errors.ts";

export interface ParsedTask {
  title: string;
  dueDate: string; // YYYY-MM-DD
  dueTime: string | null; // HH:MM or null
  category: Category;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;
const VALID_CATEGORIES: Category[] = ["job", "university", "life"];
const GEMINI_REQUEST_TIMEOUT_MS = 55_000;

export type GeminiTaskErrorKind =
  | "timeout"
  | "unavailable"
  | "invalid-response";

export class GeminiTaskError extends Error {
  readonly kind: GeminiTaskErrorKind;

  constructor(kind: GeminiTaskErrorKind, options?: ErrorOptions) {
    super(`Gemini task parsing failed: ${kind}`, options);
    this.name = "GeminiTaskError";
    this.kind = kind;
  }
}

export interface ParseTaskOptions {
  signal?: AbortSignal;
  /** Test seam; production callers are always capped at the route budget. */
  timeoutMs?: number;
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && VALID_CATEGORIES.includes(value as Category);
}

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidTime(value: string): boolean {
  if (!TIME_PATTERN.test(value)) return false;
  const [hour, minute] = value.split(":").map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function extractJsonObjectText(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

export function parseTaskPayload(value: string): ParsedTask {
  const jsonText = extractJsonObjectText(value);
  const candidate = JSON.parse(jsonText) as unknown;

  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("Invalid task structure from Gemini API");
  }

  const parsed = candidate as Partial<ParsedTask>;

  if (
    typeof parsed.title !== "string" ||
    !parsed.title.trim() ||
    typeof parsed.dueDate !== "string" ||
    !isValidDate(parsed.dueDate) ||
    (parsed.dueTime !== null &&
      (typeof parsed.dueTime !== "string" || !isValidTime(parsed.dueTime))) ||
    !isCategory(parsed.category)
  ) {
    throw new Error("Invalid task structure from Gemini API");
  }

  return {
    title: parsed.title.trim().slice(0, 120),
    dueDate: parsed.dueDate,
    dueTime: parsed.dueTime,
    category: parsed.category,
  };
}

// Delegates to the server-side proxy (src/app/api/gemini/generate), which
// builds the actual prompt itself — the client only sends structured input,
// so the Gemini API key never ships in the client bundle and the endpoint
// can't be used as a free-form prompt relay.
export async function parseTaskFromText(
  text: string,
  todayDate: string,
  options: ParseTaskOptions = {},
): Promise<ParsedTask> {
  const normalizedText = text.trim().replace(/\s+/g, " ").slice(0, 500);
  if (!normalizedText) throw new Error("Voice input is empty");

  if (options.signal?.aborted) {
    throw options.signal.reason instanceof Error
      ? options.signal.reason
      : new DOMException("The operation was aborted", "AbortError");
  }

  const controller = new AbortController();
  let timedOut = false;
  const requestedTimeout = Number.isFinite(options.timeoutMs)
    ? Math.max(1, Math.floor(options.timeoutMs ?? GEMINI_REQUEST_TIMEOUT_MS))
    : GEMINI_REQUEST_TIMEOUT_MS;
  const timeoutMs = Math.min(requestedTimeout, GEMINI_REQUEST_TIMEOUT_MS);
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  let response: Response;
  try {
    response = await fetch("/api/gemini/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "voice", text: normalizedText, todayDate }),
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) throw new GeminiTaskError("timeout", { cause: error });
    if (options.signal?.aborted) {
      throw options.signal.reason instanceof Error
        ? options.signal.reason
        : new DOMException("The operation was aborted", "AbortError");
    }
    throw new GeminiTaskError("unavailable", { cause: error });
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }

  if (response.status === 429) throw new RateLimitError();

  const data = (await response.json().catch(() => ({}))) as { text?: string };

  if (!response.ok) {
    throw new GeminiTaskError("unavailable");
  }
  if (!data.text?.trim()) throw new GeminiTaskError("invalid-response");

  try {
    return parseTaskPayload(data.text);
  } catch (error) {
    throw new GeminiTaskError("invalid-response", { cause: error });
  }
}
