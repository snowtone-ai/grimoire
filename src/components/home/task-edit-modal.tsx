"use client";

import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { type Task, type Recurrence } from "@/lib/db";
import { updateTask, deleteTask } from "@/lib/taskDb";
import { playSave } from "@/lib/sound";

interface TaskEditModalProps {
  task: Task;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: "none", label: "なし" },
  { value: "daily", label: "毎日" },
  { value: "weekly", label: "毎週" },
  { value: "monthly", label: "毎月" },
];

const DAYS_OF_WEEK = ["日", "月", "火", "水", "木", "金", "土"];

export function TaskEditModal({
  task,
  onClose,
  onSaved,
  onDeleted,
}: TaskEditModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [dueTime, setDueTime] = useState(task.dueTime ?? "");
  const [recurrence, setRecurrence] = useState<Recurrence>(task.recurrence);
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState<number>(
    task.recurrenceDayOfWeek ?? 1
  );
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState<number>(
    task.recurrenceDayOfMonth ?? 1
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    setSaving(true);
    try {
      const changes: Partial<Omit<Task, "id" | "createdAt">> = {
        title: title.trim(),
        description: description.trim(),
        dueDate,
        dueTime: dueTime || null,
        recurrence,
        recurrenceDayOfWeek:
          recurrence === "weekly" ? recurrenceDayOfWeek : undefined,
        recurrenceDayOfMonth:
          recurrence === "monthly" ? recurrenceDayOfMonth : undefined,
      };
      await updateTask(task.id, changes);
      playSave();
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteTask(task.id);
      onDeleted();
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl bg-card p-6 pt-3 shadow-xl max-h-[90dvh] overflow-y-auto animate-slide-up"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
      >
        <div aria-hidden className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">クエストを編集</h2>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* タスク名 */}
          <div>
            <label
              htmlFor="edit-task-title"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              クエスト名<span className="ml-0.5 text-brand">*</span>
            </label>
            <input
              id="edit-task-title"
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25"
            />
          </div>

          <div>
            <label
              htmlFor="edit-task-description"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              詳細
              <span className="ml-1 text-xs text-muted-foreground">(任意)</span>
            </label>
            <textarea
              id="edit-task-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25"
            />
          </div>

          {/* 期限日 + 期限時刻 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label
                htmlFor="edit-task-due-date"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                期限日<span className="ml-0.5 text-brand">*</span>
              </label>
              <input
                id="edit-task-due-date"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25"
              />
            </div>
            <div className="w-32">
              <label
                htmlFor="edit-task-due-time"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                時刻
                <span className="ml-1 text-xs text-muted-foreground">(任意)</span>
              </label>
              <input
                id="edit-task-due-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25"
              />
            </div>
          </div>

          {/* 繰り返し */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">繰り返し</p>
            <div className="flex gap-2">
              {RECURRENCES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRecurrence(value)}
                  className={`flex-1 rounded-xl border-2 py-2 text-sm font-semibold transition-colors ${
                    recurrence === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground bg-transparent"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 毎週: 曜日選択 */}
            {recurrence === "weekly" && (
              <div className="mt-3 flex gap-1.5">
                {DAYS_OF_WEEK.map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRecurrenceDayOfWeek(i)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                      recurrenceDayOfWeek === i
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            )}

            {/* 毎月: 日付選択 */}
            {recurrence === "monthly" && (
              <div className="mt-3">
                <label
                  htmlFor="edit-recurrence-day"
                  className="mb-1 block text-xs text-muted-foreground"
                >
                  毎月 何日
                </label>
                <input
                  id="edit-recurrence-day"
                  type="number"
                  min={1}
                  max={31}
                  value={recurrenceDayOfMonth}
                  onChange={(e) =>
                    setRecurrenceDayOfMonth(Number(e.target.value))
                  }
                  className="w-24 rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25"
                />
                <span className="ml-2 text-sm text-muted-foreground">日</span>
                {recurrenceDayOfMonth > 28 && (
                  <p className="mt-1.5 text-xs text-brand">
                    2月など短い月はこの日にタスクが表示されません
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 保存ボタン */}
          <button
            type="submit"
            disabled={saving || !title.trim() || !dueDate}
            className="btn-squish w-full rounded-xl bg-primary bg-gradient-to-b from-white/20 to-transparent py-3 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 inset-shadow-[0_1px_0_rgba(255,255,255,0.25)] disabled:opacity-50"
          >
            {saving ? "保存中..." : "変更を保存"}
          </button>
        </form>

        {/* 削除セクション */}
        <div className="mt-4 border-t border-border pt-4">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 active:scale-[0.98]"
            >
              <Trash2 className="size-4" />
              クエストを削除
            </button>
          ) : (
            <div className="rounded-xl bg-destructive/10 border border-destructive/25 p-4 space-y-3">
              <p className="text-sm text-destructive font-medium text-center">
                このクエストを削除しますか？
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-bold text-background transition-opacity disabled:opacity-50 active:scale-[0.98]"
                >
                  {deleting ? "削除中..." : "削除する"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
