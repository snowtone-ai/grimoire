/* RARE 1-8 -> visual style, consolidated (T036).
 *
 * Previously split across two files: drop-reveal.tsx owned the badge/ring/dwell
 * table, confetti.ts owned a separate 8-entry color ramp plus 3 coarse EMBER/
 * FROST/GOLD band arrays. Both were meant to be "the same ascending ladder" per
 * their own comments, so this pulls them into one pure data module every
 * rarity-aware effect (drop-reveal, confetti, the rank-8 grace-particles flourish)
 * reads from, instead of keeping two ramps in sync by hand.
 *
 * Ascending ladder: neutral -> green -> frost -> job-blue -> life-purple -> ember
 * -> deep-ember -> gold. Glow strength and dwell time grow with rank; `band`
 * buckets the 8 ranks into low(1-3)/mid(4-6)/high(7-8) for anywhere that still
 * wants a coarse tier (sound.ts's motif length, confetti burst intensity).
 */

export type RarityBand = "low" | "mid" | "high";

export interface RarityStyle {
  badge: string;
  ring: string;
  /** Card dwell time in ms, sized to actually read the card (D-036), not flash it. */
  duration: number;
  /** Primary accent hex, used by confetti and grace-particles. */
  color: string;
  band: RarityBand;
}

export const RARITY_STYLE: Record<number, RarityStyle> = {
  1: { badge: "bg-muted text-muted-foreground", ring: "", duration: 4000, color: "#9ca3af", band: "low" },
  2: { badge: "bg-success-soft text-success", ring: "", duration: 4400, color: "#22c55e", band: "low" },
  3: { badge: "bg-frost-soft text-frost", ring: "ring-1 ring-frost/40", duration: 4800, color: "#38bdf8", band: "low" },
  4: {
    badge: "bg-cat-job-soft text-cat-job",
    ring: "ring-2 ring-cat-job/50 shadow-[0_0_44px] shadow-cat-job/25",
    duration: 5400,
    color: "#60a5fa",
    band: "mid",
  },
  5: {
    badge: "bg-cat-life-soft text-cat-life",
    ring: "ring-2 ring-cat-life/50 shadow-[0_0_48px] shadow-cat-life/25",
    duration: 6000,
    color: "#c084fc",
    band: "mid",
  },
  6: {
    badge: "bg-brand-soft text-brand",
    ring: "ring-2 ring-brand/50 shadow-[0_0_52px] shadow-brand/30",
    duration: 6800,
    color: "#fb923c",
    band: "mid",
  },
  7: {
    badge: "bg-brand text-primary-foreground",
    ring: "ring-2 ring-brand/70 shadow-[0_0_56px] shadow-brand/40",
    duration: 7800,
    color: "#ea580c",
    band: "high",
  },
  8: {
    badge: "bg-gold-soft text-gold",
    ring: "ring-2 ring-gold/60 shadow-[0_0_60px] shadow-gold/40",
    duration: 9000,
    color: "#fbbf24",
    band: "high",
  },
};

export function rarityStyle(rarity: number): RarityStyle {
  return RARITY_STYLE[rarity] ?? RARITY_STYLE[1];
}

export function rarityBand(rarity: number): RarityBand {
  return rarityStyle(rarity).band;
}
