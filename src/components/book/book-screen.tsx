"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { DropReveal } from "@/components/reward/drop-reveal";
import {
  COMMON_DROPS,
  DROP_CATALOG,
  RARE4_POOL,
  RARE_DROPS,
  SSR_DROPS,
  TIER2_DROPS,
  TIER3_DROPS,
  TIER5_DROPS,
  TIER6_DROPS,
  TIER7_DROPS,
  type DropDef,
} from "@/lib/domain/drops";
import { getCollection, getChronicle } from "@/lib/rewardDb";
import { type ChronicleMonth } from "@/lib/domain/chronicle";
import { EXPEDITION_REGIONS, getRegionById } from "@/lib/domain/regions";
import { fireReplayEffect } from "@/lib/confetti";
import { playClear } from "@/lib/sound";

export function BookScreen() {
  const [counts, setCounts] = useState<Map<string, number> | null>(null);
  const [chronicle, setChronicle] = useState<ChronicleMonth[]>([]);
  // The drop currently replaying its reveal card, or null when none is open.
  // Lives here (not per grid cell) so exactly one DropReveal ever mounts.
  const [replayDrop, setReplayDrop] = useState<DropDef | null>(null);
  const cancelConfettiRef = useRef<() => void>(() => {});

  useEffect(() => {
    getCollection()
      .then((summary) => setCounts(summary.counts))
      .catch((err) => {
        console.error("[book] collection load failed:", err);
        setCounts(new Map());
      });
    getChronicle()
      .then(setChronicle)
      .catch((err) => console.error("[book] chronicle load failed:", err));
  }, []);

  // Leaving /book mid-burst must not let a queued confetti wave fire over
  // whatever screen the user navigates to next.
  useEffect(() => {
    return () => cancelConfettiRef.current();
  }, []);

  const handleReplay = useCallback((drop: DropDef) => {
    cancelConfettiRef.current(); // supersede any wave still pending from the last tap
    playClear(drop.rarity);
    cancelConfettiRef.current = fireReplayEffect(drop.rarity);
    setReplayDrop(drop);
  }, []);

  const handleDismissReplay = useCallback(() => {
    cancelConfettiRef.current();
    setReplayDrop(null);
  }, []);

  const discovered = counts?.size ?? 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="aurora px-5 pt-8 pb-4">
        <p className="font-display text-[10px] font-bold tracking-[0.32em] text-frost">
          SURVEY NOTES
        </p>
        <h1 className="mt-0.5 text-[28px]/[1.15] font-bold tracking-tight text-foreground">
          調査記録
        </h1>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
          記録 {discovered}/{DROP_CATALOG.length} 種
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={DROP_CATALOG.length}
          aria-valuenow={discovered}
          aria-label={`調査記録 ${DROP_CATALOG.length}種中${discovered}種を記録済み`}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-frost transition-all duration-700 ease-fluid"
            style={{ width: `${(discovered / DROP_CATALOG.length) * 100}%` }}
          />
        </div>
      </header>

      <main
        className="flex-1 space-y-6 px-4 pt-2"
        style={{ paddingBottom: "calc(6.5rem + env(safe-area-inset-bottom))" }}
      >
        <ExpeditionsSection counts={counts} />
        <ChronicleSection chronicle={chronicle} />
        {RARITY_SECTIONS.map((section) => (
          <Section
            key={section.rarity}
            title={section.title}
            rarityBadge={`RARE ${section.rarity}`}
            badgeClass={section.badgeClass}
            drops={section.pool}
            counts={counts}
            columns={section.columns}
            renderIcon={section.rarity === 8 ? photoIcon : emojiIcon}
            onReplay={handleReplay}
          />
        ))}
      </main>

      {replayDrop && (
        <DropReveal
          replay
          grant={{ drop: replayDrop, rarity: replayDrop.rarity, isNew: false }}
          onDismiss={handleDismissReplay}
        />
      )}

      <BottomNav />
    </div>
  );
}

function ExpeditionsSection({ counts }: { counts: Map<string, number> | null }) {
  const regionStats = useMemo(() => {
    const totals = new Map<string, number>();
    const found = new Map<string, number>();
    for (const drop of DROP_CATALOG) {
      totals.set(drop.region, (totals.get(drop.region) ?? 0) + 1);
      if ((counts?.get(drop.id) ?? 0) > 0) {
        found.set(drop.region, (found.get(drop.region) ?? 0) + 1);
      }
    }
    return EXPEDITION_REGIONS.map((region) => ({
      region,
      found: found.get(region.id) ?? 0,
      total: totals.get(region.id) ?? 0,
    }));
  }, [counts]);

  return (
    <section aria-label="遠征記録">
      <div className="mb-1.5 flex items-center gap-2">
        <p className="font-display text-[10px] font-bold tracking-[0.26em] text-frost">EXPEDITIONS</p>
        <h2 className="text-sm font-bold text-foreground">遠征記録</h2>
      </div>
      <div
        aria-hidden
        className="mb-2.5 h-px bg-gradient-to-r from-gold/45 via-gold/15 to-transparent"
      />
      <ul
        tabIndex={0}
        className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {regionStats.map(({ region, found, total }) => (
          <li
            key={region.id}
            title={region.blurb}
            className="w-40 flex-shrink-0 rounded-2xl border border-border bg-card p-3"
            style={{
              boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${region.accent} 20%, transparent)`,
            }}
          >
            <div className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 flex-shrink-0 rounded-full" style={{ backgroundColor: region.accent }} />
              <p className="truncate text-xs font-bold text-foreground">{region.name}</p>
            </div>
            <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
              {region.subtitle}
            </p>
            <p className="mt-2 text-right text-[11px] font-bold tabular-nums text-foreground">
              {found}/{total}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Layered gradient + rarity-scaled glow, replacing a flat colored circle.
 * Blends the item's own color with its expedition region's accent so
 * high ranks (6-8) read as a subtle foil card without any image assets. */
function materialCardStyle(drop: DropDef): CSSProperties {
  const accent = getRegionById(drop.region).accent;
  const glow =
    drop.rarity >= 6
      ? `inset 0 0 0 1px color-mix(in oklab, ${accent} 55%, transparent), 0 0 14px -4px color-mix(in oklab, ${accent} 65%, transparent)`
      : `inset 0 0 0 1px color-mix(in oklab, ${accent} 22%, transparent)`;
  return {
    backgroundImage: `radial-gradient(120% 140% at 25% 15%, color-mix(in oklab, ${drop.color} 32%, transparent), transparent 65%), linear-gradient(165deg, color-mix(in oklab, ${accent} 16%, var(--card)) 0%, var(--card) 70%)`,
    boxShadow: glow,
  };
}

const emojiIcon = (drop: DropDef, isFound: boolean) => (
  <span className={`text-3xl select-none ${isFound ? "" : "grayscale opacity-30"}`} aria-hidden>
    {isFound ? drop.emoji : "❔"}
  </span>
);

const photoIcon = (drop: DropDef, isFound: boolean) =>
  isFound && drop.photo ? (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl">
      <Image src={drop.photo} alt={drop.name} fill sizes="120px" className="object-cover" />
    </div>
  ) : (
    <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-muted text-xl text-muted-foreground/60">
      ?
    </div>
  );

// The full RARE 1-8 ladder, shown top rank first. Badge tokens ascend
// neutral -> green -> cool -> ember -> gold, matching the drop reveal.
const RARITY_SECTIONS: {
  rarity: number;
  title: string;
  badgeClass: string;
  pool: DropDef[];
  columns: string;
}[] = [
  { rarity: 8, title: "絶景の記録", badgeClass: "bg-gold-soft text-gold", pool: SSR_DROPS, columns: "grid-cols-3" },
  { rarity: 7, title: "秘蔵の遺物", badgeClass: "bg-brand text-primary-foreground", pool: TIER7_DROPS, columns: "grid-cols-4" },
  { rarity: 6, title: "貴重標本", badgeClass: "bg-brand-soft text-brand", pool: TIER6_DROPS, columns: "grid-cols-4" },
  { rarity: 5, title: "特殊素材", badgeClass: "bg-cat-life-soft text-cat-life", pool: TIER5_DROPS, columns: "grid-cols-4" },
  { rarity: 4, title: "希少植物", badgeClass: "bg-cat-job-soft text-cat-job", pool: RARE4_POOL, columns: "grid-cols-4" },
  { rarity: 3, title: "希少結晶", badgeClass: "bg-frost-soft text-frost", pool: TIER3_DROPS, columns: "grid-cols-4" },
  { rarity: 2, title: "良質素材", badgeClass: "bg-success-soft text-success", pool: TIER2_DROPS, columns: "grid-cols-4" },
  { rarity: 1, title: "採集素材", badgeClass: "bg-muted text-muted-foreground", pool: COMMON_DROPS, columns: "grid-cols-4" },
];

// Season identity comes from the RARE4 specimen emoji, so the chronicle can
// show a month's flower without spoiling its still-locked RARE8 photo.
const MONTH_EMOJI = new Map<number, string>(
  RARE_DROPS.map((drop) => [drop.month ?? 0, drop.emoji ?? "🌸"])
);
function monthEmoji(month: number): string {
  return MONTH_EMOJI.get(month) ?? "🌸";
}

function ChronicleSection({ chronicle }: { chronicle: ChronicleMonth[] }) {
  if (chronicle.length === 0) return null;
  const [current, ...past] = chronicle;

  return (
    <section aria-label="年代記">
      <div className="mb-1.5 flex items-center gap-2">
        <p className="font-display text-[10px] font-bold tracking-[0.26em] text-gold">CHRONICLE</p>
        <h2 className="text-sm font-bold text-foreground">年代記</h2>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{chronicle.length}か月</span>
      </div>
      <div
        aria-hidden
        className="mb-2.5 h-px bg-gradient-to-r from-gold/45 via-gold/15 to-transparent"
      />
      <CurrentMonthPage month={current} />
      {past.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {past.map((month) => (
            <li key={month.monthKey}>
              <PastMonthCard month={month} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CurrentMonthPage({ month }: { month: ChronicleMonth }) {
  return (
    <div
      className="rounded-2xl border border-gold/25 bg-card p-4"
      style={{ boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${month.species.color} 16%, transparent)` }}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-12 flex-shrink-0 items-center justify-center rounded-xl text-2xl select-none"
          style={{ backgroundColor: `color-mix(in oklab, ${month.species.color} 22%, transparent)` }}
        >
          {monthEmoji(month.month)}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-gold">今月の調査対象</p>
          <p className="truncate text-base font-bold text-foreground">
            {month.year}年{month.month}月 · {month.species.name}
          </p>
        </div>
        <span className="ml-auto flex-shrink-0 rounded-full bg-frost-soft px-2 py-0.5 text-[10px] font-bold text-frost">
          調査中
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <ChronicleStat label="討伐" value={month.totalDrops} />
        <ChronicleStat label="希少" value={month.rareDrops} />
        <ChronicleStat label="活動" value={month.activeDays} unit="日" />
      </dl>
    </div>
  );
}

function PastMonthCard({ month }: { month: ChronicleMonth }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/70 px-3 py-2">
      <span
        aria-hidden
        className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg text-lg select-none"
        style={{ backgroundColor: `color-mix(in oklab, ${month.species.color} 18%, transparent)` }}
      >
        {monthEmoji(month.month)}
      </span>
      <p className="min-w-0 truncate text-sm font-semibold text-foreground">
        {month.year}年{month.month}月 · {month.species.name}
      </p>
      <p className="ml-auto flex-shrink-0 text-xs text-muted-foreground tabular-nums">
        討伐{month.totalDrops} · 活動{month.activeDays}日
      </p>
    </div>
  );
}

function ChronicleStat({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div className="rounded-xl bg-muted/50 py-1.5">
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className="text-base font-bold tabular-nums text-foreground">
        {value}
        {unit && <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">{unit}</span>}
      </dd>
    </div>
  );
}

function Section({
  title,
  rarityBadge,
  badgeClass,
  drops,
  counts,
  columns,
  renderIcon,
  onReplay,
}: {
  title: string;
  rarityBadge: string;
  badgeClass: string;
  drops: DropDef[];
  counts: Map<string, number> | null;
  columns: string;
  renderIcon: (drop: DropDef, isFound: boolean) => React.ReactNode;
  onReplay: (drop: DropDef) => void;
}) {
  const foundCount = drops.filter((drop) => (counts?.get(drop.id) ?? 0) > 0).length;

  return (
    <section aria-label={title}>
      <div className="mb-1.5 flex items-center gap-2">
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider ${badgeClass}`}>
          {rarityBadge}
        </span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {foundCount}/{drops.length}
        </span>
      </div>
      <div
        aria-hidden
        className="mb-2.5 h-px bg-gradient-to-r from-gold/45 via-gold/15 to-transparent"
      />
      <ul className={`grid ${columns} gap-2`}>
        {drops.map((drop) => {
          const count = counts?.get(drop.id) ?? 0;
          const isFound = count > 0;
          const region = getRegionById(drop.region);
          return (
            <li
              key={drop.id}
              className={`relative rounded-2xl border p-2 text-center transition-colors ${
                isFound ? "border-transparent" : "border-dashed border-border/70 bg-muted/30"
              }`}
              style={isFound ? materialCardStyle(drop) : undefined}
            >
              {isFound && (
                <span
                  aria-hidden
                  title={region.name}
                  className="absolute left-1.5 top-1.5 size-1.5 rounded-full"
                  style={{ backgroundColor: region.accent }}
                />
              )}
              {isFound ? (
                // Only collected entries replay — an unfound "？？？" slot has
                // nothing to show, so it stays inert (no button, no focus stop).
                <button
                  type="button"
                  onClick={() => onReplay(drop)}
                  aria-label={`${drop.name}の記録を見る`}
                  className="btn-squish block w-full cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-frost"
                >
                  {renderIcon(drop, isFound)}
                  <p
                    title={drop.name}
                    className="mt-1.5 line-clamp-2 text-[10px] font-semibold leading-tight text-foreground"
                  >
                    {drop.name}
                  </p>
                </button>
              ) : (
                <>
                  {renderIcon(drop, isFound)}
                  <p className="mt-1.5 line-clamp-2 text-[10px] font-semibold leading-tight text-muted-foreground/60">
                    ？？？
                  </p>
                </>
              )}
              {isFound && <span className="sr-only">{region.name}産</span>}
              {count > 1 && (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-secondary-foreground tabular-nums">
                  ×{count}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
