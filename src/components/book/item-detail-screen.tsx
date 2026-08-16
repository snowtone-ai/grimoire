"use client";

import dynamic from "next/dynamic";
import { Link } from "next-view-transitions";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { getDropById, getRarityLabel, type DropDef } from "@/lib/domain/drops";
import { getDomainById } from "@/lib/domain/domains";
import { getRegionById } from "@/lib/domain/regions";
import { getCollection } from "@/lib/rewardDb";
import { pickRecipe } from "@/lib/three/domain-recipes";
import { prefersReducedMotion } from "@/lib/view-transition";
import { playPage } from "@/lib/sound";

/* Item codex detail page (src/app/book/[dropId]/page.tsx). Route-based
 * rather than a modal (see the approved plan) so it inherits the app's
 * existing next-view-transitions page-turn feel and the browser back
 * button steps cleanly between items. The live 3D viewer is dynamically
 * imported (ssr:false, no WebGL on the server) and kept out of every other
 * route's bundle. */
const ItemViewer = dynamic(
  () => import("@/components/three/item-viewer").then((m) => ({ default: m.ItemViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        読み込み中...
      </div>
    ),
  }
);

export function ItemDetailScreen({ dropId }: { dropId: string }) {
  const [discovered, setDiscovered] = useState<number | null>(null);
  const [reducedMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    getCollection()
      .then((summary) => setDiscovered(summary.counts.get(dropId) ?? 0))
      .catch((err) => {
        console.error("[book/detail] collection load failed:", err);
        setDiscovered(0);
      });
  }, [dropId]);

  const drop = getDropById(dropId);

  if (!drop) {
    return <NotFound />;
  }

  // Loading state (discovered === null) and the "not yet discovered" state
  // render the same locked placeholder — never leak name/flavor/model for
  // an item the user hasn't actually rolled, matching book-screen's rule.
  const isLocked = discovered === null || discovered === 0;

  return (
    <div className="flex min-h-dvh flex-col pb-24">
      <header className="aurora px-5 pt-8 pb-4">
        <Link
          href="/book"
          onClick={() => playPage()}
          className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"
        >
          <ChevronLeft className="size-4" /> 記録に戻る
        </Link>
        <p className="font-display text-[10px] font-bold tracking-[0.32em] text-frost">
          SURVEY NOTES
        </p>
        <h1 className="mt-1 text-xl font-bold text-foreground">
          {isLocked ? "？？？" : drop.name}
        </h1>
      </header>

      <main className="flex-1 px-5">
        {isLocked ? (
          <LockedBody />
        ) : (
          <DiscoveredBody drop={drop} discoveredCount={discovered ?? 0} reducedMotion={reducedMotion} />
        )}
      </main>

      <BottomNav currentPath="/book" />
    </div>
  );
}

function DiscoveredBody({
  drop,
  discoveredCount,
  reducedMotion,
}: {
  drop: DropDef;
  discoveredCount: number;
  reducedMotion: boolean;
}) {
  const region = getRegionById(drop.region);
  const domain = drop.domain ? getDomainById(drop.domain) : undefined;
  const recipe = pickRecipe(drop.domain, drop.rarity, drop.effect);

  return (
    <div className="space-y-4">
      <div
        className="overflow-hidden rounded-2xl border border-border/70"
        style={{
          backgroundImage: `radial-gradient(120% 140% at 50% 20%, color-mix(in oklab, ${drop.color} 26%, transparent), transparent 70%)`,
        }}
      >
        {drop.model ? (
          <ItemViewer modelUrl={drop.model} color={drop.color} recipe={recipe} reducedMotion={reducedMotion} />
        ) : (
          <div className="flex h-64 items-center justify-center text-5xl" aria-hidden>
            {drop.emoji ?? "✦"}
          </div>
        )}
      </div>
      {drop.model && (
        <p className="text-center text-[11px] text-muted-foreground">タップして演出を再生</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold tracking-wider text-brand">
          {getRarityLabel(drop.rarity)}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider"
          style={{
            backgroundColor: `color-mix(in oklab, ${region.accent} 20%, transparent)`,
            color: region.accent,
          }}
        >
          {domain ? domain.name : region.name}
        </span>
        {discoveredCount > 1 && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground tabular-nums">
            ×{discoveredCount}
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed text-foreground">{drop.flavor}</p>

      {drop.params && drop.params.length > 0 && (
        <dl className="divide-y divide-border/60 rounded-2xl border border-border/70 bg-muted/30 px-4">
          {drop.params.map((param) => (
            <div key={param.label} className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-xs text-muted-foreground">{param.label}</dt>
              <dd className="text-right text-xs font-semibold text-foreground">{param.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function LockedBody() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/30 py-16 text-center">
      <span className="text-4xl text-muted-foreground/50" aria-hidden>
        ？
      </span>
      <p className="text-sm text-muted-foreground">まだ発見されていない記録です</p>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-5 text-center">
      <p className="text-sm text-muted-foreground">この記録は見つかりませんでした</p>
      <Link href="/book" className="text-sm font-semibold text-brand">
        記録に戻る
      </Link>
    </div>
  );
}
