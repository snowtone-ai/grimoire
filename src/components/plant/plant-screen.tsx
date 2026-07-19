"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { usePlant } from "@/hooks/use-plant";
import { calcProgress, getStageLabel } from "@/lib/domain/plant";
import { PlantParticles } from "./plant-particles";
import { PlantRenderer } from "./plant-renderer";

export function PlantScreen() {
  const { species, stage, state } = usePlant();
  const [flipped, setFlipped] = useState(true);
  const isBlooming = stage >= 4;
  const progress = calcProgress(state?.monthlyCompleted ?? 0, stage);

  useEffect(() => {
    const timer = setTimeout(() => setFlipped(false), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`relative flex min-h-dvh flex-col overflow-hidden bg-background ${flipped ? "flip-enter" : ""}`}>
      {isBlooming ? (
        <>
          <Image
            src={species.rewardImage}
            alt={`${species.name}の写真`}
            fill
            priority
            sizes="100vw"
            className="pointer-events-none object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-black/5 to-black/55" />
        </>
      ) : null}

      <div
        className={`relative z-10 flex flex-1 flex-col items-center justify-center px-4 ${isBlooming ? "text-white" : ""}`}
        style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 text-center drop-shadow-sm">
          <p className={`text-[11px] font-bold tracking-[0.22em] ${isBlooming ? "text-white/80" : "text-frost"}`}>
            植生研究所
          </p>
          <p className={`text-2xl font-bold ${isBlooming ? "text-white" : "text-foreground"}`}>{species.name}</p>
          <p className={`text-sm ${isBlooming ? "text-white/85" : "text-muted-foreground"}`}>
            {getStageLabel(stage)} · 今月 {state?.monthlyCompleted ?? 0}件達成
          </p>
          <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
            {([0, 1, 2, 3, 4, 5] as const).map((step) => (
              <span
                key={step}
                className={`rounded-full transition-all duration-500 ${step <= stage ? "size-2" : "size-1.5 bg-muted"}`}
                style={
                  step <= stage
                    ? { backgroundColor: isBlooming ? "rgba(255,255,255,0.9)" : species.color }
                    : undefined
                }
              />
            ))}
          </div>
        </div>

        <div className={`relative h-[400px] w-[300px] ${isBlooming ? "pointer-events-none opacity-0" : ""}`}>
          {!isBlooming && (
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success-soft/80 blur-3xl"
            />
          )}
          {!isBlooming ? <PlantRenderer species={species} stage={stage} /> : null}
          <PlantParticles color={species.color} active={isBlooming} />
        </div>

        {stage < 5 ? (
          <div className="mt-6 w-64">
            <p className={`mb-1 text-center text-xs ${isBlooming ? "text-white/80" : "text-muted-foreground"}`}>次のステージまで</p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="次の成長ステージまでの進捗"
              className={`h-2 overflow-hidden rounded-full ${isBlooming ? "bg-white/30" : "bg-muted"}`}
            >
              <div
                className="h-full rounded-full transition-all duration-700 ease-fluid"
                style={{ width: `${progress}%`, backgroundColor: isBlooming ? "#fff" : species.color }}
              />
            </div>
          </div>
        ) : (
          <p className={`mt-6 text-sm font-semibold ${isBlooming ? "text-white" : "text-success"}`}>
            満開です！タスクを完了し続けて維持しましょう
          </p>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
