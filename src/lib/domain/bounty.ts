/* Daily bounty board — pure functions, no side effects.
 *
 * Three micro-missions per day, deterministic from the date key so no
 * generation state is stored. ADHD design rules:
 * - Every bounty is achievable at any time of day (no time-locked failures).
 * - Slot 1 is always "depart on one quest": initiation is the core barrier.
 * - Rewards flow through the existing drop pipeline; the drops table's
 *   unique [taskId+dateKey] index doubles as the claim ledger, so claims
 *   survive storage resets and can never be farmed. */

export type BountyKind = "start" | "complete" | "add";

export interface BountyDef {
  id: string;
  kind: BountyKind;
  target: number;
  label: string;
}

export interface BountyProgressInput {
  /** Tasks whose completedAt falls on the bounty day. */
  completedToday: number;
  /** Tasks created on the bounty day. */
  addedToday: number;
  /** Tasks departed (started) on the bounty day. */
  startedToday: number;
}

const START_ONE: BountyDef = {
  id: "start-1",
  kind: "start",
  target: 1,
  label: "どれか1件に出発する",
};

const ADD_ONE: BountyDef = {
  id: "add-1",
  kind: "add",
  target: 1,
  label: "クエストを1件登録する",
};

function completeBounty(target: number): BountyDef {
  return {
    id: `complete-${target}`,
    kind: "complete",
    target,
    label: `クエストを${target}件達成する`,
  };
}

/** Small deterministic hash so the same day always shows the same board. */
export function hashDateKey(dateKey: string): number {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** The day's three bounties: 出発1件 / 達成N件(1-3) / 登録1件. */
export function getDailyBounties(dateKey: string): BountyDef[] {
  const completeTarget = 1 + (hashDateKey(dateKey) % 3);
  return [START_ONE, completeBounty(completeTarget), ADD_ONE];
}

export function bountyProgress(
  bounty: BountyDef,
  input: BountyProgressInput
): number {
  const raw =
    bounty.kind === "start"
      ? input.startedToday
      : bounty.kind === "complete"
        ? input.completedToday
        : input.addedToday;
  return Math.min(bounty.target, Math.max(0, raw));
}

export function isBountyComplete(
  bounty: BountyDef,
  input: BountyProgressInput
): boolean {
  return bountyProgress(bounty, input) >= bounty.target;
}

/** Synthetic task id used to claim the bounty's bonus drop for the day. */
export function bountyTaskId(bounty: BountyDef): string {
  return `bounty:${bounty.id}`;
}
