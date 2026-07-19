"use client";

import Link from "next/link";
import { useState } from "react";
import { Leaf, Mail, Plus, Volume2, VolumeX } from "lucide-react";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { useHomeScreen } from "@/hooks/use-home-screen";
import { todayDateString } from "@/lib/domain/task-date";
import { getStageLabel, type GrowthStage, type PlantSpecies } from "@/lib/domain/plant";
import { isFxEnabled, playTap, setFxEnabled } from "@/lib/sound";
import { GmailImportModal } from "@/components/gmail/gmail-import-modal";
import { DropReveal } from "@/components/reward/drop-reveal";
import { TaskCard } from "./task-card";
import { TaskAddModal } from "./task-add-modal";
import { TaskEditModal } from "./task-edit-modal";
import { VoiceInputButton } from "./voice-input-button";

export function HomeScreen() {
  const screen = useHomeScreen();
  const completedCount = screen.tasks.filter((task) => task.completed).length;
  const totalCount = screen.tasks.length;
  const dateLabel = new Date(`${todayDateString()}T00:00:00`).toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between px-5 pt-8 pb-4">
        <div>
          <p className="text-[13px] font-medium text-muted-foreground">{dateLabel}</p>
          <h1 className="mt-0.5 text-[28px]/[1.15] font-bold tracking-tight text-foreground">
            今日のクエスト
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <FxToggle />
          <button
            type="button"
            onClick={() => screen.setShowGmailModal(true)}
            className="btn-squish flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-xs"
            aria-label="Gmailからインポート"
          >
            <Mail className="size-5" />
          </button>
        </div>
      </header>

      <HeroCard
        completedCount={completedCount}
        totalCount={totalCount}
        streakCount={screen.streakCount}
        species={screen.plantSpecies}
        stage={screen.plantStage}
      />

      <div aria-live="polite">
        {screen.allCompleteMessage && (
          <div className="mx-4 mt-3 animate-pop-in rounded-2xl bg-brand-soft px-4 py-3 text-center">
            <p className="text-sm font-bold text-brand">🏆 本日の全クエスト達成！</p>
          </div>
        )}
      </div>

      <NotificationPanel
        permission={screen.notifPermission}
        dismissed={screen.notifBannerDismissed}
        hasTasks={screen.tasks.length > 0}
        testSent={screen.testNotifSent}
        onRequest={screen.handleRequestNotification}
        onDismiss={screen.handleDismissNotifBanner}
        onTest={screen.handleTestNotification}
      />

      <main
        className="flex-1 px-4 pt-4"
        style={{ paddingBottom: "calc(8.5rem + env(safe-area-inset-bottom))" }}
      >
        {screen.loading ? (
          <LoadingState />
        ) : screen.tasks.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-3">
            {screen.tasks.map((task) => (
              <li
                key={task.id}
                className="task-vt"
                style={{ viewTransitionName: `t-${task.id.replaceAll(/[^a-zA-Z0-9-]/g, "")}` }}
              >
                <TaskCard task={task} onToggle={screen.handleToggle} onTap={screen.setEditingTask} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <BottomNav />
      <FloatingActions
        onVoiceTaskCreated={screen.onTasksChanged}
        onFallbackToManual={screen.openAddModal}
        onAdd={() => screen.openAddModal()}
      />

      {screen.showAddModal && (
        <TaskAddModal
          onClose={() => screen.setShowAddModal(false)}
          onTaskCreated={screen.onTasksChanged}
          initialTitle={screen.addModalInitialTitle}
        />
      )}
      <GmailImportModal
        open={screen.showGmailModal}
        onClose={() => screen.setShowGmailModal(false)}
        onTasksCreated={screen.onTasksChanged}
      />
      {screen.editingTask && (
        <TaskEditModal
          task={screen.editingTask}
          onClose={() => screen.setEditingTask(null)}
          onSaved={screen.onTasksChanged}
          onDeleted={screen.onTasksChanged}
        />
      )}
      {screen.pendingDrop && (
        <DropReveal grant={screen.pendingDrop} onDismiss={screen.dismissDrop} />
      )}
    </div>
  );
}

function FxToggle() {
  const [enabled, setEnabled] = useState(isFxEnabled);

  function toggle() {
    const next = !enabled;
    setFxEnabled(next);
    setEnabled(next);
    if (next) playTap();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? "効果音をオフにする" : "効果音をオンにする"}
      className="btn-squish flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-xs"
    >
      {enabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
    </button>
  );
}

function HeroCard({
  completedCount,
  totalCount,
  streakCount,
  species,
  stage,
}: {
  completedCount: number;
  totalCount: number;
  streakCount: number;
  species: PlantSpecies;
  stage: GrowthStage;
}) {
  const remaining = totalCount - completedCount;
  let title: string;
  let sub: string;
  if (totalCount === 0) {
    title = "今日の受注はなし";
    sub = "休息も大事な調査のうち";
  } else if (remaining === 0) {
    title = "全クエスト達成！";
    sub = "今日の調査は完了。おつかれさま";
  } else if (completedCount === 0) {
    title = `受注中 ${totalCount}件`;
    sub = "まずは1件、小さく出発しよう";
  } else {
    title = `あと${remaining}件`;
    sub = `${completedCount}件達成、いい調子`;
  }

  return (
    <section
      aria-label="今日の進捗"
      className="aurora mx-4 animate-pop-in rounded-3xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center gap-5">
        <ProgressRing completedCount={completedCount} totalCount={totalCount} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-foreground text-balance">{title}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{sub}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {streakCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">
                🔥 {streakCount}日連続
              </span>
            )}
            <Link
              href="/plant"
              className="btn-squish inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success"
            >
              <Leaf className="size-3.5" aria-hidden />
              研究所: {species.name}・{getStageLabel(stage)}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProgressRing({
  completedCount,
  totalCount,
}: {
  completedCount: number;
  totalCount: number;
}) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const fraction = totalCount > 0 ? completedCount / totalCount : 0;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={Math.max(totalCount, 1)}
      aria-valuenow={completedCount}
      aria-label={
        totalCount === 0
          ? "今日のタスクはありません"
          : `今日のタスク ${totalCount}件中${completedCount}件完了`
      }
      className="relative size-[84px] shrink-0"
    >
      <svg viewBox="0 0 76 76" className="size-full -rotate-90">
        <circle cx="38" cy="38" r={radius} fill="none" strokeWidth="7" className="stroke-muted" />
        <circle
          cx="38"
          cy="38"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-fluid"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
        {totalCount === 0 ? (
          <span className="text-xl select-none">🌱</span>
        ) : (
          <span className="text-lg font-bold tabular-nums text-foreground">
            {completedCount}
            <span className="text-sm font-semibold text-muted-foreground">/{totalCount}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function NotificationPanel({
  permission,
  dismissed,
  hasTasks,
  testSent,
  onRequest,
  onDismiss,
  onTest,
}: {
  permission: string;
  dismissed: boolean;
  hasTasks: boolean;
  testSent: boolean;
  onRequest: () => void;
  onDismiss: () => void;
  onTest: () => void;
}) {
  if (!dismissed && permission === "default" && hasTasks) {
    return (
      <div className="mx-4 mt-3 rounded-2xl border border-brand/20 bg-brand-soft px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-sm font-semibold text-brand">🔔 締切通知を有効にしますか？</p>
            <p className="mt-0.5 text-xs text-brand/80">締切前日・当日の朝9時にリマインドします</p>
          </div>
          <button
            type="button"
            aria-label="通知バナーを閉じる"
            onClick={onDismiss}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-brand/60 transition-colors hover:text-brand"
          >
            <span aria-hidden className="text-lg leading-none">×</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onRequest}
          className="mt-2 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-transform active:scale-[0.98]"
        >
          通知を許可する
        </button>
      </div>
    );
  }
  if (permission !== "granted" || dismissed) return null;

  return (
    <div className="mx-4 mt-3 rounded-2xl border border-success/20 bg-success-soft px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-success">🔔 通知が有効です</p>
        <button
          type="button"
          aria-label="通知バナーを閉じる"
          onClick={onDismiss}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-success/60 transition-colors hover:text-success"
        >
          <span aria-hidden className="text-lg leading-none">×</span>
        </button>
      </div>
      <button
        type="button"
        onClick={onTest}
        className="mt-2 w-full rounded-xl border border-success/30 bg-card py-2.5 text-sm font-semibold text-success transition-transform active:scale-[0.98]"
      >
        {testSent ? "✓ 送信しました！" : "テスト通知を送る"}
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-2xl bg-muted"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-5 flex size-20 items-center justify-center rounded-full bg-frost-soft text-4xl select-none animate-breathe">
        ❄️
      </div>
      <p className="text-base font-bold text-foreground">受注中のクエストはありません</p>
      <p className="mt-1.5 text-sm text-muted-foreground text-balance">
        「+」から追加するか、マイクで話しかけて登録
      </p>
    </div>
  );
}

function FloatingActions({
  onVoiceTaskCreated,
  onFallbackToManual,
  onAdd,
}: {
  onVoiceTaskCreated: () => void;
  onFallbackToManual: (prefill?: string) => void;
  onAdd: () => void;
}) {
  return (
    <div
      className="fixed right-4 z-40 flex flex-col items-end gap-3"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
    >
      <VoiceInputButton onTaskCreated={onVoiceTaskCreated} onFallbackToManual={onFallbackToManual} />
      <button
        type="button"
        aria-label="クエストを追加"
        onClick={() => {
          playTap();
          onAdd();
        }}
        className="btn-squish flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/35"
      >
        <Plus className="size-6" />
      </button>
    </div>
  );
}
