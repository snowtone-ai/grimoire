/* Per-day departure (task start) tracking.
 *
 * Deliberately ephemeral: departures only feed today's bounty and the card's
 * 出発中 state, so localStorage is enough. Losing it costs nothing durable —
 * bounty claims themselves live in IndexedDB via the drops table. */

const PREFIX = "departed-";

function storageKey(dateKey: string): string {
  return `${PREFIX}${dateKey}`;
}

export function getDepartedTaskIds(dateKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(dateKey));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

export function markDeparted(dateKey: string, taskId: string): Set<string> {
  const departed = getDepartedTaskIds(dateKey);
  departed.add(taskId);
  try {
    localStorage.setItem(storageKey(dateKey), JSON.stringify([...departed]));
    pruneOldDays(dateKey);
  } catch {
    // Storage is best-effort; the in-memory set still drives this session.
  }
  return departed;
}

function pruneOldDays(currentDateKey: string): void {
  const current = storageKey(currentDateKey);
  const stale: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX) && key !== current) stale.push(key);
  }
  for (const key of stale) localStorage.removeItem(key);
}
