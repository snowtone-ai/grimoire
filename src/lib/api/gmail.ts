import { googleAuthFetch } from "./google-auth";

export interface GmailMessage {
  id: string;
  subject: string;
  snippet: string;
  date: string;
  from: string;
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
