"use client";

import Image from "next/image";
import { useEffect, type CSSProperties } from "react";
import { getRarityLabel } from "@/lib/domain/drops";
import { rarityStyle } from "@/lib/domain/rarity-style";
import { type GrantResult } from "@/lib/rewardDb";
import { GraceParticles } from "@/components/fx/grace-particles";
import { isEffectEnabled, isReducedMotionForced } from "@/lib/fx";

// Dwell time is sized to READ the card, not to flash it (D-036). The card shows
// seven pieces of information (banner, art, rarity badge, NEW, name, flavor
// text, ledger line); the previous 2.0-3.4s could not be read in time, which is
// exactly what the user reported. Rank still extends the moment, from a rank-1
// glance to a rank-8 pause. Badge/ring/color/dwell ramp now lives in
// src/lib/domain/rarity-style.ts, shared with confetti.ts (T036).

/** Quest-clear reward card. Tapping the backdrop or the explicit button closes
 * it; tapping the card itself does not, so reading it cannot dismiss it.
 *
 * `replay` re-plays an already-collected drop from the survey notes (D-036):
 * the user opened it on purpose, so it waits for an explicit close instead of
 * auto-dismissing, and drops the two "you just got this" tells (NEW badge,
 * ledger line) that would be false the second time around. */
export function DropReveal({
  grant,
  onDismiss,
  replay = false,
}: {
  grant: GrantResult;
  onDismiss: () => void;
  replay?: boolean;
}) {
  const style = rarityStyle(grant.rarity);
  // Anticipation: a short pre-flip hold, scaled slightly by rank (a higher
  // rank gets a slightly longer held breath before it starts moving).
  const holdMs = 60 + grant.rarity * 5;
  // The card itself always shows (D-036: it's information, not decoration).
  // For a live completion, the juice layered on top (spring-settle, shine
  // sweep, glow pulse, rank-8 particles) is exactly what 完了エフェクト
  // ("completion") toggles off elsewhere, so it respects that choice too.
  // For a replay (tapping an already-collected entry in /book), D-036 is
  // explicit that this flow stays "always active" regardless of any effects
  // preference — same reasoning fireReplayEffect in confetti.ts follows — so
  // only OS reduced-motion (an accessibility signal, not a taste one) can
  // turn it off here.
  const juiceEnabled = replay ? !isReducedMotionForced() : isEffectEnabled("completion");
  const spring = juiceEnabled && grant.rarity >= 4;
  const shine = juiceEnabled && grant.rarity >= 6;
  const glow = juiceEnabled && grant.rarity >= 6;
  const particles = juiceEnabled && grant.rarity === 8;

  useEffect(() => {
    if (replay) return;
    const timer = setTimeout(onDismiss, style.duration);
    return () => clearTimeout(timer);
  }, [replay, onDismiss, style.duration]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-8 animate-fade-in"
      role="status"
      aria-live="polite"
      onClick={onDismiss}
    >
      {particles && <GraceParticles preset="reveal" />}
      <div className="relative w-full max-w-[280px]">
        {glow && (
          <div
            aria-hidden
            className="drop-reveal-glow pointer-events-none absolute -inset-2 rounded-[2rem]"
            style={{ "--glow-color": style.color } as CSSProperties}
          />
        )}
        <div
          className={`drop-reveal relative w-full overflow-hidden rounded-3xl border border-border bg-card p-5 text-center shadow-xl ${style.ring} ${
            spring ? "drop-reveal-spring" : ""
          }`}
          style={{ "--reveal-delay": `${holdMs}ms` } as CSSProperties}
          onClick={(event) => event.stopPropagation()}
        >
          {grant.rarity === 8 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-gold/15 via-transparent to-transparent"
            />
          )}
          {shine && <div aria-hidden className="drop-reveal-shine pointer-events-none absolute inset-0" />}
          <div className="flex items-center gap-2.5">
          <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/60" />
          <p className="font-display text-[13px] font-bold tracking-[0.24em] text-gold">
            {replay ? "SURVEY RECORD" : "QUEST CLEAR"}
          </p>
          <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/60" />
        </div>
        <p className="mt-1 text-[10px] font-bold tracking-[0.2em] text-brand">
          {replay ? "調査記録より" : "クエスト達成！"}
        </p>

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
          {!replay && grant.isNew && (
            <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-bold tracking-wider text-gold">
              NEW!
            </span>
          )}
        </div>
        <p className="mt-1.5 text-lg font-bold text-foreground">{grant.drop.name}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {grant.drop.flavor}
        </p>
        {!replay && (
          <p className="mt-3 text-[11px] font-semibold text-frost">
            {grant.isNew ? "調査記録に追加された！" : "調査記録 +1"}
          </p>
        )}

          <button
            type="button"
            onClick={onDismiss}
            className="btn-squish mt-4 w-full rounded-xl border border-border bg-secondary py-2 text-xs font-bold text-secondary-foreground"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
