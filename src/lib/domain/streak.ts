/* Streak calculation with insurance — pure functions, no side effects.
 *
 * ADHD-safe rules:
 * - Today counts when done, but an unfinished today never breaks the chain
 *   (grace, no freeze consumed) — the 🔥 chip survives the morning.
 * - One missed/failed day per chain is absorbed as a "freeze" (insurance):
 *   it does not add to the count, but it does not reset it either.
 * - The second gap ends the chain. */

export interface StreakRecord {
  date: string; // YYYY-MM-DD
  allCompleted: boolean;
}

const MAX_LOOKBACK_DAYS = 400;

function shiftDate(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calcStreakCount(
  records: StreakRecord[],
  today: string,
  freezes = 1
): number {
  const byDate = new Map(records.map((record) => [record.date, record.allCompleted]));

  let count = 0;
  let freezesLeft = freezes;

  for (let i = 0; i < MAX_LOOKBACK_DAYS; i++) {
    const date = shiftDate(today, -i);
    const done = byDate.get(date) === true;

    if (done) {
      count++;
      continue;
    }
    if (i === 0) continue; // Today still pending: grace, no freeze consumed.
    if (freezesLeft > 0) {
      freezesLeft--;
      continue;
    }
    break;
  }

  return count;
}
