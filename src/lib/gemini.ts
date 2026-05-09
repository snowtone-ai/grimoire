import { type Category } from "./db";
import { buildTaskParsePrompt } from "./api/gemini-prompts";
import { RateLimitError, redactSecret } from "./errors";

export interface ParsedTask {
  title: string;
  dueDate: string; // YYYY-MM-DD
  dueTime: string | null; // HH:MM or null
  category: Category;
}

export async function parseTaskFromText(
  text: string,
  todayDate: string
): Promise<ParsedTask> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not configured");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildTaskParsePrompt(text, todayDate) }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (response.status === 429) {
    throw new RateLimitError();
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Gemini API error ${response.status}: ${redactSecret(body)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Empty response from Gemini API");

  const parsed = JSON.parse(content) as ParsedTask;

  // Validate required fields
  if (!parsed.title || !parsed.dueDate || !parsed.category) {
    throw new Error("Invalid task structure from Gemini API");
  }

  return parsed;
}
