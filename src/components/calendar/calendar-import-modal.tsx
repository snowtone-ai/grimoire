"use client";

import { useState } from "react";
import { CalendarPlus, Check, Loader2, X } from "lucide-react";
import { useGoogleAuth } from "@/hooks/use-google-auth";
import { calendarEventToTaskData, fetchUpcomingEvents, type CalendarEvent } from "@/lib/api/google-calendar";
import { type Category } from "@/lib/db";
import { createTask } from "@/lib/taskDb";

interface Props {
  open: boolean;
  onClose: () => void;
  onTasksCreated: () => void;
}

interface EventCandidate {
  event: CalendarEvent;
  selected: boolean;
  category: Category;
}

type Step = "auth" | "loading" | "confirm" | "done";

export function CalendarImportModal({ open, onClose, onTasksCreated }: Props) {
  const auth = useGoogleAuth("calendar");
  const [step, setStep] = useState<Step>("auth");
  const [candidates, setCandidates] = useState<EventCandidate[]>([]);
  const [createdCount, setCreatedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function loadEvents() {
    setStep("loading");
    setError(null);
    try {
      if (!auth.isConnected) {
        const connected = await auth.connect();
        if (!connected) throw new Error("Calendar認証に失敗しました");
      }
      const events = await fetchUpcomingEvents();
      setCandidates(events.map((event) => ({ event, selected: true, category: "life" })));
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calendarからの読み込みに失敗しました");
      setStep("auth");
    }
  }

  async function createSelectedTasks() {
    const selected = candidates.filter((candidate) => candidate.selected);
    await Promise.all(selected.map((candidate) => {
      const task = calendarEventToTaskData(candidate.event);
      return createTask({
        ...task,
        category: candidate.category,
        completed: false,
        completedAt: null,
      });
    }));
    setCreatedCount(selected.length);
    onTasksCreated();
    setStep("done");
  }

  function updateCandidate(id: string, changes: Partial<EventCandidate>) {
    setCandidates((items) =>
      items.map((item) => item.event.id === id ? { ...item, ...changes } : item)
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-slide-up">
      <header className="flex items-center justify-between border-b border-border px-4 py-4">
        <h2 className="text-lg font-bold text-foreground">Calendarからインポート</h2>
        <button type="button" onClick={onClose} aria-label="閉じる" className="rounded-full p-2 text-muted-foreground">
          <X className="size-5" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {step === "auth" && (
          <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
            <CalendarPlus className="mb-4 size-10 text-brand" />
            <button
              type="button"
              onClick={loadEvents}
              disabled={auth.isLoading}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-50"
            >
              Calendarと接続
            </button>
            {(error || auth.error) && <p className="mt-3 text-sm text-destructive">{error ?? auth.error}</p>}
          </div>
        )}
        {step === "loading" && <LoadingState />}
        {step === "confirm" && (
          <ConfirmEvents
            candidates={candidates}
            onUpdate={updateCandidate}
            onCreate={createSelectedTasks}
          />
        )}
        {step === "done" && <DoneState count={createdCount} onClose={onClose} />}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3">
      <Loader2 className="size-8 animate-spin text-brand" />
      <p className="text-sm text-muted-foreground">予定を読み込み中...</p>
    </div>
  );
}

function ConfirmEvents({
  candidates,
  onUpdate,
  onCreate,
}: {
  candidates: EventCandidate[];
  onUpdate: (id: string, changes: Partial<EventCandidate>) => void;
  onCreate: () => void;
}) {
  const selectedCount = candidates.filter((candidate) => candidate.selected).length;

  if (candidates.length === 0) {
    return <p className="py-24 text-center text-sm text-muted-foreground">追加できる予定はありませんでした</p>;
  }

  return (
    <div className="space-y-3">
      {candidates.map((candidate) => {
        const task = calendarEventToTaskData(candidate.event);
        return (
          <div key={candidate.event.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <button
              type="button"
              onClick={() => onUpdate(candidate.event.id, { selected: !candidate.selected })}
              className="flex w-full gap-3 text-left"
            >
              <span className={`mt-0.5 flex size-5 items-center justify-center rounded border transition-colors ${candidate.selected ? "border-primary bg-primary" : "border-border"}`}>
                {candidate.selected && <Check className="size-3 text-primary-foreground" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{task.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {task.dueDate} {task.dueTime ?? ""}
                </span>
              </span>
            </button>
            <select
              value={candidate.category}
              onChange={(event) => onUpdate(candidate.event.id, { category: event.target.value as Category })}
              className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25"
            >
              <option value="job">就活</option>
              <option value="university">大学</option>
              <option value="life">生活</option>
            </select>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onCreate}
        disabled={selectedCount === 0}
        className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 active:scale-[0.98] disabled:opacity-50"
      >
        選択した予定を追加
      </button>
    </div>
  );
}

function DoneState({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <Check className="mb-4 size-10 text-success" />
      <p className="text-base font-semibold text-foreground">{count}件のタスクを追加しました</p>
      <button type="button" onClick={onClose} className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
        閉じる
      </button>
    </div>
  );
}
