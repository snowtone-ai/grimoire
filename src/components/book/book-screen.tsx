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
  type DropDef,
} from "@/lib/domain/drops";
import { getCollection } from "@/lib/rewardDb";
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

  useEffect(() => {
    getCollection()
      .then((summary) => setCounts(summary.counts))
      .catch((err) => {
        console.error("[book] collection load failed:", err);
        setCounts(new Map());
      });
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
        <Section
          title="絶景の記録"
          rarityBadge="RARE 8"
          badgeClass="bg-gold-soft text-gold"
          drops={SSR_DROPS}
          counts={counts}
          columns="grid-cols-3"
          renderIcon={(drop, isFound) =>
            isFound && drop.photo ? (
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl">
                <Image
                  src={drop.photo}
                  alt={drop.name}
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-muted text-xl text-muted-foreground/60">
                ?
              </div>
            )
          }
        />
        <Section
          title="希少植物"
          rarityBadge="RARE 4"
          badgeClass="bg-frost-soft text-frost"
          drops={RARE_DROPS}
          counts={counts}
          columns="grid-cols-4"
          renderIcon={(drop, isFound) => (
            <span className={`text-3xl select-none ${isFound ? "" : "grayscale opacity-30"}`} aria-hidden>
              {isFound ? drop.emoji : "❔"}
            </span>
          )}
        />
        <Section
          title="採集素材"
          rarityBadge="RARE 1"
          badgeClass="bg-muted text-muted-foreground"
          drops={COMMON_DROPS}
          counts={counts}
          columns="grid-cols-4"
          renderIcon={(drop, isFound) => (
            <span className={`text-3xl select-none ${isFound ? "" : "grayscale opacity-30"}`} aria-hidden>
              {isFound ? drop.emoji : "❔"}
            </span>
          )}
        />

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
