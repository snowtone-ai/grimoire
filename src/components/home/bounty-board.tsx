"use client";

import { Check } from "lucide-react";
import { type BountyView } from "@/hooks/use-home-screen";

/** Daily bounty board (調査依頼): three achievable-anytime micro-missions.
 * Finished bounties auto-claim a bonus drop — no button to remember. */
export function BountyBoard({ bounties }: { bounties: BountyView[] }) {
  if (bounties.length === 0) return null;
  const doneCount = bounties.filter((view) => view.claimed).length;

  return (
    <section
      aria-label="今日のバウンティ"
      className="mx-4 mt-3 rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex items-center gap-2">
        <p className="font-display text-[10px] font-bold tracking-[0.26em] text-frost">
          BOUNTIES
        </p>
        <p className="text-xs font-semibold text-muted-foreground">調査依頼</p>
        <p className="ml-auto text-xs text-muted-foreground tabular-nums">
          {doneCount}/{bounties.length}
        </p>
      </div>
      <div
        aria-hidden
        className="mt-1.5 mb-2.5 h-px bg-gradient-to-r from-gold/45 via-gold/15 to-transparent"
      />
      <ul className="space-y-2">
        {bounties.map(({ bounty, progress, claimed }) => (
          <li key={bounty.id} className="flex items-center gap-2.5">
            <span
              aria-hidden
              className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${
                claimed
                  ? "border-gold bg-gold-soft text-gold"
                  : "border-muted-foreground/30 text-transparent"
              }`}
            >
              <Check className="size-3" strokeWidth={3} />
            </span>
            <span
              className={`flex-1 text-[13px] font-medium ${
                claimed ? "text-muted-foreground line-through" : "text-foreground"
              }`}
            >
              {bounty.label}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {progress}/{bounty.target}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[11px] text-muted-foreground">
        依頼を達成すると素材がドロップします
      </p>
    </section>
  );
}
