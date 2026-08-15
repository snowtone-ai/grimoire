import type { Category, Recurrence } from "@/lib/db";
import type { GmailMessage } from "./gmail";
import { RateLimitError } from "@/lib/errors";

export interface TaskCandidate {
  messageId: string;
  subject: string;
  from: string;
  task: {
    title: string;
    dueDate: string | null;
    dueTime: string | null;
    category: Category;
    recurrence: Recurrence;
  };
  selected: boolean;
}

interface ParsedCandidate {
  index: number;
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  category: Category;
}

const VALID_CATEGORIES: Category[] = ["job", "university", "life"];

function truncateText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isCategory(value: string): value is Category {
  return VALID_CATEGORIES.includes(value as Category);
}

export async function extractTasksFromEmails(messages: GmailMessage[]): Promise<TaskCandidate[]> {
  try {
    const response = await fetch("/api/gemini/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "gmail",
        messages: messages.map((m) => ({ subject: m.subject, from: m.from, snippet: m.snippet })),
      }),
    });

    if (response.status === 429) throw new RateLimitError();
    const json = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
    if (!response.ok) {
      throw new Error(json.error ?? `Gemini API error ${response.status}`);
    }
    const text: string = json.text ?? "[]";
    const parsed = JSON.parse(text) as ParsedCandidate[];

    return parsed.flatMap((candidate) => {
      const message = messages[candidate.index];
      if (!message || !isCategory(candidate.category)) return [];

      return [{
        messageId: message.id,
        subject: message.subject,
        from: message.from,
        task: {
          title: truncateText(candidate.title, 120),
          dueDate: candidate.dueDate,
          dueTime: candidate.dueTime,
          category: candidate.category,
          recurrence: "none",
        },
        selected: true,
      }];
    });
  } catch (err) {
    console.error("[gmail-extractor] Gemini parse failed:", err);
    return [];
  }
}
