import { parseDuplicateMatches, type ComparisonPair } from "../domain/calendar-import.ts";

/** One bounded advisory request; failure never means "no duplicates". */
export async function checkCalendarDuplicates(pairs: ComparisonPair[], signal: AbortSignal): Promise<number[]> {
  const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  const response = await fetch("/api/gemini/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: boundedSignal,
    body: JSON.stringify({ kind: "calendar-duplicates", pairs }),
  });
  if (!response.ok) throw new Error("Duplicate check unavailable");
  return parseDuplicateMatches(await response.json(), pairs);
}
