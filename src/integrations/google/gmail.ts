/**
 * Ported from v1 (main branch) src/lib/api/gmail.ts — see D-013.
 * Fetches recent Gmail messages, then composes the Gemini-based extraction
 * step (gmail-task-extractor.ts) to produce the shared inbound shape.
 */

import { googleAuthFetch } from "./auth";
import { extractTaskCandidates, gmailCandidateToImportedItem } from "./gmail-task-extractor";
import type { ImportedScheduleItem } from "../imported-item";

export interface GmailMessage {
  readonly id: string;
  readonly subject: string;
  readonly snippet: string;
  readonly date: string;
  readonly from: string;
}

const BASE = "https://gmail.googleapis.com/gmail/v1";

// F1+F5: delegates auth + 401 handling to googleAuthFetch; generic T makes casts explicit.
async function authFetch<T>(path: string): Promise<T> {
  const response = await googleAuthFetch("gmail", `${BASE}${path}`);
  if (!response.ok) throw new Error(`Gmail API error: ${response.status}`);
  const data: unknown = await response.json();
  if (data === null || typeof data !== "object") {
    throw new Error("Gmail API returned an unexpected response");
  }
  return data as T;
}

export async function fetchRecentMessages(): Promise<GmailMessage[]> {
  const query = encodeURIComponent("newer_than:7d");
  const list = await authFetch<{ messages?: { id: string }[] }>(
    `/users/me/messages?q=${query}&maxResults=20`,
  );
  if (!list.messages?.length) return [];

  return Promise.all(
    list.messages.map(async (message) => {
      const data = await authFetch<{
        payload?: { headers?: { name: string; value: string }[] };
        snippet?: string;
      }>(
        `/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=From`,
      );
      const headers = data.payload?.headers ?? [];
      const getHeader = (name: string) => headers.find((header) => header.name === name)?.value ?? "";

      return {
        id: message.id,
        subject: getHeader("Subject"),
        snippet: data.snippet ?? "",
        date: getHeader("Date"),
        from: getHeader("From"),
      };
    }),
  );
}

/**
 * v2 addition (T020): matches `GoogleIntegrationPort.fetchGmailItems` in
 * src/application/ports.ts exactly by name and signature — a composition
 * root can assign this function directly to that port slot. v1 exposed
 * fetch and extraction as two separate steps for a manual pick-before-import
 * screen; v2's port has no such screen, so this composes both steps (fetch,
 * then Gemini extraction) into the one call the port expects.
 */
export async function fetchGmailItems(): Promise<readonly ImportedScheduleItem[]> {
  const messages = await fetchRecentMessages();
  if (messages.length === 0) return [];

  const candidates = await extractTaskCandidates(messages);
  const items: ImportedScheduleItem[] = [];
  for (const candidate of candidates) {
    const item = gmailCandidateToImportedItem(candidate);
    if (item) items.push(item);
  }
  return items;
}
