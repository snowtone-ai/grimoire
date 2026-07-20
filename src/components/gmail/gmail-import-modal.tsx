"use client";

import { useState } from "react";
import { Check, Loader2, Mail, X } from "lucide-react";
import { useGoogleAuth } from "@/hooks/use-google-auth";
import { fetchRecentMessages } from "@/lib/api/gmail";
import { extractTasksFromEmails, type TaskCandidate } from "@/lib/api/gmail-task-extractor";
import { createTask } from "@/lib/taskDb";
import { todayDateString } from "@/lib/domain/task-date";

interface Props {
  open: boolean;
  onClose: () => void;
  onTasksCreated: () => void;
}

type Step = "auth" | "loading" | "confirm" | "done";

export function GmailImportModal({ open, onClose, onTasksCreated }: Props) {
  const auth = useGoogleAuth("gmail");
  const [step, setStep] = useState<Step>("auth");
  const [candidates, setCandidates] = useState<TaskCandidate[]>([]);
  const [createdCount, setCreatedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function loadCandidates() {
    setStep("loading");
    setError(null);
    try {
      if (!auth.isConnected) {
        const connected = await auth.connect();
        if (!connected) { setStep("auth"); return; } // user cancelled
      }
      const messages = await fetchRecentMessages();
      const extracted = await extractTasksFromEmails(messages);
      setCandidates(extracted);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gmailからの読み込みに失敗しました");
      setStep("auth");
    }
  }

  async function createSelectedTasks() {
    const selected = candidates.filter((candidate) => candidate.selected);
    await Promise.all(
      selected.map((candidate) => createTask({
        title: candidate.task.title,
        dueDate: candidate.task.dueDate ?? todayDateString(),
        dueTime: candidate.task.dueTime,
        category: candidate.task.category,
        completed: false,
        completedAt: null,
        recurrence: candidate.task.recurrence,
      }))
    );
    setCreatedCount(selected.length);
    onTasksCreated();
    setStep("done");
  }

  function toggleCandidate(messageId: string) {
    setCandidates((items) =>
      items.map((item) => item.messageId === messageId ? { ...item, selected: !item.selected } : item)
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-slide-up">
      <ModalHeader onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {step === "auth" && (
          <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
            <Mail className="mb-4 size-10 text-brand" />
            <button
              type="button"
              onClick={loadCandidates}
              disabled={auth.isLoading}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-50"
            >
              Gmailと接続
            </button>
            {(error || auth.error) && <p className="mt-3 text-sm text-destructive">{error ?? auth.error}</p>}
          </div>
        )}
        {step === "loading" && <LoadingState label="メールからタスク候補を抽出中..." />}
        {step === "confirm" && (
          <ConfirmList
            candidates={candidates}
            onToggle={toggleCandidate}
            onCreate={createSelectedTasks}
          />
        )}
        {step === "done" && <DoneState count={createdCount} onClose={onClose} />}
      </div>
    </div>
  );
}

function ModalHeader({ onClose }: { onClose: () => void }) {
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-4">
      <h2 className="text-lg font-bold text-foreground">Gmailからインポート</h2>
      <button type="button" onClick={onClose} aria-label="閉じる" className="rounded-full p-2 text-muted-foreground">
        <X className="size-5" />
      </button>
    </header>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3">
      <Loader2 className="size-8 animate-spin text-brand" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function ConfirmList({
  candidates,
  onToggle,
  onCreate,
}: {
  candidates: TaskCandidate[];
  onToggle: (messageId: string) => void;
  onCreate: () => void;
}) {
  const selectedCount = candidates.filter((candidate) => candidate.selected).length;

  if (candidates.length === 0) {
    return <p className="py-24 text-center text-sm text-muted-foreground">追加できるタスク候補はありませんでした</p>;
  }

  return (
    <div className="space-y-3">
      {candidates.map((candidate) => (
        <button
          key={candidate.messageId}
          type="button"
          onClick={() => onToggle(candidate.messageId)}
          className="flex w-full gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm"
        >
          <span className={`mt-0.5 flex size-5 items-center justify-center rounded border transition-colors ${candidate.selected ? "border-primary bg-primary" : "border-border"}`}>
            {candidate.selected && <Check className="size-3 text-primary-foreground" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">{candidate.task.title}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {candidate.task.dueDate ?? "期限なし"} {candidate.task.dueTime ?? ""}
            </span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">{candidate.subject}</span>
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={onCreate}
        disabled={selectedCount === 0}
        className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 active:scale-[0.98] disabled:opacity-50"
      >
        選択したタスクを追加
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
