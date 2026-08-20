import type { RewardPolicy } from "../application/ports";
import type { EventId } from "./primitives";

export interface WeightedReward {
  readonly itemId: string;
  readonly weight: number;
}
function stableUnitInterval(value: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

/** One immutable weighted pool is shared by creation and first-completion commands. */
export class StableWeightedRewardPolicy implements RewardPolicy {
  private readonly rewards: readonly WeightedReward[];
  private readonly totalWeight: number;

  constructor(rewards: readonly WeightedReward[]) {
    if (rewards.length === 0) throw new RangeError("Reward pool must not be empty");
    const itemIds = new Set<string>();
    let totalWeight = 0;
    this.rewards = Object.freeze(
      rewards.map((reward) => {
        if (reward.itemId.length === 0 || itemIds.has(reward.itemId)) {
          throw new RangeError("Reward item IDs must be non-empty and unique");
        }
        if (!Number.isSafeInteger(reward.weight) || reward.weight <= 0) {
          throw new RangeError("Reward weight must be a positive safe integer");
        }
        itemIds.add(reward.itemId);
        totalWeight += reward.weight;
        if (!Number.isSafeInteger(totalWeight)) throw new RangeError("Reward weight total is unsafe");
        return Object.freeze({ ...reward });
      }),
    );
    this.totalWeight = totalWeight;
  }

  draw(eventId: EventId): string {
    const selection = stableUnitInterval(eventId) * this.totalWeight;
    let cursor = 0;
    for (const reward of this.rewards) {
      cursor += reward.weight;
      if (selection < cursor) return reward.itemId;
    }
    return this.rewards[this.rewards.length - 1]!.itemId;
  }
}
