import type { TouchZone } from "./grimo-companions";

export type CarolReaction = "arrival" | "poke" | "slow-stroke" | "hold" | "drag" | "release" | "repeat-tap" | "wait" | "zone-touch" | "food";

export type CarolReactionStyle = { displacement: number; cloud: number; stars: number; settleMs: number };

const REACTIONS: Record<CarolReaction, CarolReactionStyle> = {
  arrival: { displacement: 0.12, cloud: 0.18, stars: 0.24, settleMs: 720 },
  poke: { displacement: 0.82, cloud: 0.92, stars: 0.58, settleMs: 520 },
  "slow-stroke": { displacement: 0.36, cloud: 0.46, stars: 0.3, settleMs: 900 },
  hold: { displacement: 0.18, cloud: 0.3, stars: 0.62, settleMs: 1200 },
  drag: { displacement: 0.56, cloud: 0.7, stars: 0.38, settleMs: 680 },
  release: { displacement: 0.26, cloud: 0.4, stars: 0.35, settleMs: 650 },
  "repeat-tap": { displacement: 0.68, cloud: 0.72, stars: 0.92, settleMs: 780 },
  // A treat is a rare, intentional action: Carol leans forward and her sky
  // brightens more than it does for ordinary contact.
  food: { displacement: 0.3, cloud: 0.82, stars: 1.2, settleMs: 1400 },
  wait: { displacement: 0.08, cloud: 0.12, stars: 0.16, settleMs: 1000 },
  "zone-touch": { displacement: 0.42, cloud: 0.58, stars: 0.42, settleMs: 800 },
};

export function carolReactionStyle(reaction: CarolReaction, zone: TouchZone): CarolReactionStyle {
  const base = REACTIONS[reaction];
  const zoneBoost = zone === "face" ? { cloud: 0.65, stars: 1.35 } : zone === "feet" ? { cloud: 1.2, stars: 0.72 } : { cloud: 1, stars: 1 };
  return { ...base, cloud: base.cloud * zoneBoost.cloud, stars: base.stars * zoneBoost.stars };
}

export function inferCarolMoveReaction(distance: number, durationMs: number): CarolReaction {
  if (durationMs >= 520 && distance < 0.12) return "hold";
  if (distance < 0.22) return "slow-stroke";
  return "drag";
}
