"use client";

import Image from "next/image";
import { useEffect } from "react";
import { getRarityLabel } from "@/lib/domain/drops";
import { type GrantResult } from "@/lib/rewardDb";

// Ascending RARE 1-8 ladder: neutral -> cool -> ember -> gold, with the glow
// and dwell time growing with rank. Badge tokens match the /book sections.
const RARITY_STYLE: Record<
  number,
  { badge: string; ring: string; duration: number }
> = {
  1: { badge: "bg-muted text-muted-foreground", ring: "", duration: 2000 },
  2: { badge: "bg-success-soft text-success", ring: "", duration: 2200 },
  3: { badge: "bg-frost-soft text-frost", ring: "ring-1 ring-frost/40", duration: 2400 },
  4: { badge: "bg-cat-job-soft text-cat-job", ring: "ring-2 ring-cat-job/50 shadow-[0_0_44px] shadow-cat-job/25", duration: 2600 },
  5: { badge: "bg-cat-life-soft text-cat-life", ring: "ring-2 ring-cat-life/50 shadow-[0_0_48px] shadow-cat-life/25", duration: 2800 },
  6: { badge: "bg-brand-soft text-brand", ring: "ring-2 ring-brand/50 shadow-[0_0_52px] shadow-brand/30", duration: 3000 },
  7: { badge: "bg-brand text-primary-foreground", ring: "ring-2 ring-brand/70 shadow-[0_0_56px] shadow-brand/40", duration: 3200 },
  8: { badge: "bg-gold-soft text-gold", ring: "ring-2 ring-gold/60 shadow-[0_0_60px] shadow-gold/40", duration: 3400 },
};

/** Quest-clear reward card. Tap anywhere to skip; auto-dismisses. */
export function DropReveal({
  grant,
  onDismiss,
}: {
  grant: GrantResult;
  onDismiss: () => void;
}) {
  const style = RARITY_STYLE[grant.rarity] ?? RARITY_STYLE[1];

  useEffect(() => {
    const timer = setTimeout(onDismiss, style.duration);
    return () => clearTimeout(timer);
  }, [onDismiss, style.duration]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-8 animate-fade-in"
      role="status"
      aria-live="polite"
      onClick={onDismiss}
    >
      <div
        className={`drop-reveal relative w-full max-w-[280px] overflow-hidden rounded-3xl border border-border bg-card p-5 text-center shadow-xl ${style.ring}`}
      >
        {grant.rarity === 8 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-gold/15 via-transparent to-transparent"
          />
        )}
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/60" />
          <p className="font-display text-[13px] font-bold tracking-[0.24em] text-gold">
            QUEST CLEAR
          </p>
          <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/60" />
        </div>
        <p className="mt-1 text-[10px] font-bold tracking-[0.2em] text-brand">クエスト達成！</p>

        <div className="mt-4 flex items-center justify-center">
          {grant.drop.photo ? (
            <div className="relative h-36 w-full overflow-hidden rounded-2xl">
              <Image
                src={grant.drop.photo}
                alt={grant.drop.name}
                fill
                sizes="280px"
                className="object-cover"
              />
            </div>
          ) : (
            <span className="text-6xl select-none" aria-hidden>
              {grant.drop.emoji}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider ${style.badge}`}
          >
            {getRarityLabel(grant.rarity)}
          </span>
          {grant.isNew && (
            <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-bold tracking-wider text-gold">
              NEW!
            </span>
          )}
        </div>
        <p className="mt-1.5 text-lg font-bold text-foreground">{grant.drop.name}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {grant.drop.flavor}
        </p>
        <p className="mt-3 text-[11px] font-semibold text-frost">
          {grant.isNew ? "調査記録に追加された！" : "調査記録 +1"}
        </p>
      </div>
    </div>
  );
}
