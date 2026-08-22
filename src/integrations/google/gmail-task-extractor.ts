/**
 * Ported from v1 (main branch) src/lib/api/gmail-task-extractor.ts — see D-013.
 * Sends recent Gmail messages to the Gemini proxy route and turns the
 * response into task candidates, then normalizes those to the shared inbound
 * shape (`ImportedScheduleItem`).
 */

import { RateLimitError } from "../shared/errors";
import type { ImportedScheduleItem } from "../imported-item";
import type { GmailMessage } from "./gmail";

/**
 * v2 change (T020): v1's TaskCandidate carried `category`/`recurrence` (a
 * Gemini-guessed classification) plus `selected`/`subject`/`from` for a
 * manual pick-before-import screen. v2's port has no such preview step
 * (`AppUiPort.importFromGmail` in src/app/ui-port.ts imports directly and
 * returns only counts), and the shared import shape carries no
 * classification at all (決定事項ログ F-4/F-7/H-3). Category is still asked
 * of Gemini and still used to validate the response is well-formed — see
 * `isCategoryHint` below — it is simply not part of what survives into the
 * candidate.
 */
export interface GmailTaskCandidate {
  readonly messageId: string;
  readonly title: string;
  readonly dueDate: string | null;
  readonly dueTime: string | null;
}

interface ParsedCandidate {
  index: number;
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  category: string;
}

const VALID_CATEGORY_HINTS = ["job", "university", "life"] as const;

function truncateText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isCategoryHint(value: unknown): value is (typeof VALID_CATEGORY_HINTS)[number] {
  return (
    typeof value === "string" &&
    (VALID_CATEGORY_HINTS as readonly string[]).includes(value)
  );
}

/**
 * Calls the Gemini proxy route with the message list and returns validated
 * task candidates. Ported verbatim from v1, including its behaviour of
 * throwing a RateLimitError only to catch it in the same try/catch below
 * (both are folded into the empty-array outcome) — that quirk is v1's actual
 * shipped behaviour, not something introduced here.
 */
export async function extractTaskCandidates(
  messages: readonly GmailMessage[],
): Promise<GmailTaskCandidate[]> {
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
      if (!message || !isCategoryHint(candidate.category)) return [];

      return [{
        messageId: message.id,
        title: truncateText(candidate.title, 120),
        dueDate: candidate.dueDate,
        dueTime: candidate.dueTime,
      }];
    });
  } catch (err) {
    console.error("[gmail-extractor] Gemini parse failed:", err);
    return [];
  }
}

/**
 * Pure mapper from a validated candidate to the shared import shape. Returns
 * null when the candidate has no due date: `ImportedScheduleItem.localDate`
 * is mandatory (unlike v1's `TaskCandidate.task.dueDate: string | null`,
 * which relied on a manual confirm screen — absent in v2 — to let the user
 * fill in a date before the task was created). A dateless candidate cannot
 * be represented in the common shape, so it is dropped by the caller rather
 * than silently assigned a false due date.
 */
export function gmailCandidateToImportedItem(
  candidate: GmailTaskCandidate,
): ImportedScheduleItem | null {
  if (!candidate.dueDate) return null;
  return candidate.dueTime
    ? {
        externalId: candidate.messageId,
        title: candidate.title,
        localDate: candidate.dueDate,
        scheduledTime: candidate.dueTime,
      }
    : {
        externalId: candidate.messageId,
        title: candidate.title,
        localDate: candidate.dueDate,
      };
}
