import { describe, expect, it } from "vitest";
import { eventId } from "../../src/domain/primitives";
import { StableWeightedRewardPolicy } from "../../src/domain/rewards";

describe("StableWeightedRewardPolicy", () => {
  it("returns the same draw for the same durable event ID", () => {
    const policy = new StableWeightedRewardPolicy([
      { itemId: "common", weight: 80 },
      { itemId: "uncommon", weight: 18 },
      { itemId: "rare", weight: 2 },
    ]);
    const source = eventId("task:task-1:created:v1");

    expect(policy.draw(source)).toBe(policy.draw(source));
  });

  it("rejects ambiguous pools before a command transaction begins", () => {
    expect(
      () =>
        new StableWeightedRewardPolicy([
          { itemId: "same", weight: 1 },
          { itemId: "same", weight: 2 },
        ]),
    ).toThrow("unique");
    expect(() => new StableWeightedRewardPolicy([{ itemId: "invalid", weight: 0 }])).toThrow(
      "positive",
    );
  });
});
