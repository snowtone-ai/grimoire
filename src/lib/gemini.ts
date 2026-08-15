import { type Category } from "./db";
import { buildTaskParsePrompt } from "./api/gemini-prompts";
import { RateLimitError } from "./errors";

export interface ParsedTask {
  title: string;
  dueDate: string; // YYYY-MM-DD
  dueTime: string | null; // HH:MM or null
  category: Category;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;
const VALID_CATEGORIES: Category[] = ["job", "university", "life"];

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && VALID_CATEGORIES.includes(value as Category);
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

// Delegates to the server-side proxy (src/app/api/gemini/generate) so the
// Gemini API key never ships in the client bundle.
async function requestGemini(prompt: string): Promise<string> {
  const response = await fetch("/api/gemini/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (response.status === 429) throw new RateLimitError();

  const data = (await response.json().catch(() => ({}))) as { text?: string; error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? `Gemini API error ${response.status}`);
  }
  if (!data.text?.trim()) throw new Error("Empty response from Gemini API");
  return data.text;
}

export async function parseTaskFromText(
  text: string,
  todayDate: string
): Promise<ParsedTask> {
  const normalizedText = text.trim().replace(/\s+/g, " ").slice(0, 500);
  if (!normalizedText) throw new Error("Voice input is empty");

  const prompt = buildTaskParsePrompt(normalizedText, todayDate);
  const content = await requestGemini(prompt);
  return parseTaskPayload(content);
}
