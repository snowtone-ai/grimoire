"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { BottomNav } from "@/components/navigation/bottom-nav";
import {
  COMMON_DROPS,
  DROP_CATALOG,
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
import {
  buildBackupJson,
  downloadBackup,
  importBackup,
  parseBackup,
  type ParsedBackup,
} from "@/lib/backup";
import { playSave, playTap } from "@/lib/sound";

export function BookScreen() {
  const [counts, setCounts] = useState<Map<string, number> | null>(null);
  const [chronicle, setChronicle] = useState<ChronicleMonth[]>([]);

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
          />
        ))}

        <BackupSection onImported={() => {
          getCollection()
            .then((summary) => setCounts(summary.counts))
            .catch(console.error);
        }} />
      </main>

      <BottomNav />
    </div>
  );
}

function BackupSection({ onImported }: { onImported: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setMessage(null);
    try {
      playTap();
      downloadBackup(await buildBackupJson());
      setMessage("バックアップファイルを保存しました");
    } catch (err) {
      console.error("[backup] export failed:", err);
      setMessage("エクスポートに失敗しました");
    }
  }

  async function handleFileSelected(file: File | undefined) {
    setMessage(null);
    setPending(null);
    if (!file) return;
    try {
      setPending(parseBackup(await file.text()));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "ファイルを読み込めませんでした");
    }
  }

  async function handleImportConfirm() {
    if (!pending || busy) return;
    setBusy(true);
    try {
      await importBackup(pending.payload);
      playSave();
      setMessage(`取り込み完了: クエスト${pending.counts.tasks}件 / ドロップ${pending.counts.drops}件`);
      setPending(null);
      onImported();
    } catch (err) {
      console.error("[backup] import failed:", err);
      setMessage("取り込みに失敗しました");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <section
      aria-label="調査データのバックアップ"
      className="rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex items-center gap-2">
        <p className="font-display text-[10px] font-bold tracking-[0.26em] text-frost">ARCHIVE</p>
        <p className="text-xs font-semibold text-muted-foreground">調査データのバックアップ</p>
      </div>
      <div
        aria-hidden
        className="mt-1.5 mb-3 h-px bg-gradient-to-r from-gold/45 via-gold/15 to-transparent"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="btn-squish flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <Download className="size-4" aria-hidden />
          エクスポート
        </button>
        <button
          type="button"
          onClick={() => {
            playTap();
            fileInputRef.current?.click();
          }}
          className="btn-squish flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <Upload className="size-4" aria-hidden />
          インポート
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="バックアップファイルを選択"
          onChange={(event) => handleFileSelected(event.target.files?.[0])}
        />
      </div>
      {pending && (
        <div className="mt-3 rounded-xl bg-brand-soft p-3">
          <p className="text-sm font-semibold text-brand">
            クエスト{pending.counts.tasks}件・ドロップ{pending.counts.drops}件を取り込みます
          </p>
          <p className="mt-0.5 text-xs text-brand/80">
            同じIDのデータは上書きされます。既存データが消えることはありません
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPending(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="btn-squish flex-1 rounded-lg border border-border bg-card py-2 text-sm font-semibold text-foreground"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleImportConfirm}
              disabled={busy}
              className="btn-squish flex-1 rounded-lg bg-primary bg-gradient-to-b from-white/20 to-transparent py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "取り込み中..." : "取り込む"}
            </button>
          </div>
        </div>
      )}
      <div aria-live="polite">
        {message && <p className="mt-2.5 text-xs text-muted-foreground">{message}</p>}
      </div>
    </section>
  );
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
  { rarity: 4, title: "希少植物", badgeClass: "bg-cat-job-soft text-cat-job", pool: RARE_DROPS, columns: "grid-cols-4" },
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
}: {
  title: string;
  rarityBadge: string;
  badgeClass: string;
  drops: DropDef[];
  counts: Map<string, number> | null;
  columns: string;
  renderIcon: (drop: DropDef, isFound: boolean) => React.ReactNode;
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
          return (
            <li
              key={drop.id}
              className={`relative rounded-2xl border p-2 text-center transition-colors ${
                isFound ? "border-border bg-card" : "border-dashed border-border/70 bg-muted/30"
              }`}
            >
              {renderIcon(drop, isFound)}
              <p
                className={`mt-1.5 truncate text-[10px] font-semibold ${
                  isFound ? "text-foreground" : "text-muted-foreground/60"
                }`}
              >
                {isFound ? drop.name : "？？？"}
              </p>
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
