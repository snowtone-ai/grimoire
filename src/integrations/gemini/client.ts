/**
 * Ported from v1 (main branch) src/lib/gemini.ts — see D-013.
 * Client-side caller for the voice-input "parse a task from free text" flow.
 * Delegates to the server-side proxy (src/app/api/gemini/generate), which
 * builds the actual prompt itself — the client only sends structured input,
 * so the Gemini API key never ships in the client bundle.
 */

import { RateLimitError } from "../shared/errors";

/**
 * v2 change (T020): v1 imported `Category` from its local `./db` module.
 * Duplicated here as a literal type instead — this module stays free of v2
 * domain imports, matching how src/app/ui-port.ts keeps its own
 * `TaskCategoryId` rather than importing the domain's `CategoryId` (a
 * refactor on either side must not silently change what this module accepts
 * from Gemini or what a form may submit).
 */
export type ParsedTaskCategory = "job" | "university" | "life";

export interface ParsedTask {
  title: string;
  dueDate: string; // YYYY-MM-DD
  dueTime: string | null; // HH:MM or null
  category: ParsedTaskCategory;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;
const VALID_CATEGORIES: ParsedTaskCategory[] = ["job", "university", "life"];

function isCategory(value: unknown): value is ParsedTaskCategory {
  return typeof value === "string" && VALID_CATEGORIES.includes(value as ParsedTaskCategory);
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
  const parsed = JSON.parse(jsonText) as Partial<ParsedTask>;

  if (
    typeof parsed.title !== "string" ||
    !parsed.title.trim() ||
    typeof parsed.dueDate !== "string" ||
    !DATE_PATTERN.test(parsed.dueDate) ||
    (parsed.dueTime !== null && (typeof parsed.dueTime !== "string" || !TIME_PATTERN.test(parsed.dueTime))) ||
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
  todayDate: string
): Promise<ParsedTask> {
  const normalizedText = text.trim().replace(/\s+/g, " ").slice(0, 500);
  if (!normalizedText) throw new Error("Voice input is empty");

  const response = await fetch("/api/gemini/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "voice", text: normalizedText, todayDate }),
  });

  if (response.status === 429) throw new RateLimitError();

  const data = (await response.json().catch(() => ({}))) as { text?: string; error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? `Gemini API error ${response.status}`);
  }
  if (!data.text?.trim()) throw new Error("Empty response from Gemini API");
  return parseTaskPayload(data.text);
}
