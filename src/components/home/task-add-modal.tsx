"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { type Category, type Recurrence } from "@/lib/db";
import { createTask } from "@/lib/taskDb";
import { CATEGORY_CONFIG, CATEGORY_LIST } from "@/lib/domain/category";

interface TaskAddModalProps {
  onClose: () => void;
  onTaskCreated: () => void;
  initialTitle?: string;
}

const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: "none", label: "なし" },
  { value: "daily", label: "毎日" },
  { value: "weekly", label: "毎週" },
  { value: "monthly", label: "毎月" },
];

const DAYS_OF_WEEK = ["日", "月", "火", "水", "木", "金", "土"];

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function TaskAddModal({ onClose, onTaskCreated, initialTitle = "" }: TaskAddModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(todayDateString());
  const [dueTime, setDueTime] = useState("");
  const [category, setCategory] = useState<Category>("life");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState<number>(1);
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState<number>(1);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    setSaving(true);
    try {
      await createTask({
        title: title.trim(),
        description: description.trim(),
        dueDate,
        dueTime: dueTime || null,
        category,
        completed: false,
        completedAt: null,
        recurrence,
        recurrenceDayOfWeek: recurrence === "weekly" ? recurrenceDayOfWeek : undefined,
        recurrenceDayOfMonth: recurrence === "monthly" ? recurrenceDayOfMonth : undefined,
      });
      onTaskCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Sheet */}
      <div
        className="w-full max-w-lg rounded-t-3xl bg-card p-6 pt-3 shadow-xl animate-slide-up"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
      >
        <div aria-hidden className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">タスクを追加</h2>
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
              htmlFor="task-title"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              タスク名<span className="ml-0.5 text-brand">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              required
              autoFocus
              placeholder="例: A社 ES提出"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25"
            />
          </div>

          <div>
            <label
              htmlFor="task-description"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              詳細
              <span className="ml-1 text-xs text-muted-foreground">(任意)</span>
            </label>
            <textarea
              id="task-description"
              rows={3}
              placeholder="例: パン、牛乳、テープ、洗剤"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25"
            />
          </div>

          {/* 期限日 + 期限時刻 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label
                htmlFor="task-due-date"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                期限日<span className="ml-0.5 text-brand">*</span>
              </label>
              <input
                id="task-due-date"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25"
              />
            </div>
            <div className="w-32">
              <label
                htmlFor="task-due-time"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                時刻
                <span className="ml-1 text-xs text-muted-foreground">
                  (任意)
                </span>
              </label>
              <input
                id="task-due-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25"
              />
            </div>
          </div>

          {/* カテゴリ */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              カテゴリ
            </p>
            <div className="flex gap-2">
              {CATEGORY_LIST.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  className={`flex-1 rounded-xl border-2 py-2 text-sm font-semibold transition-colors ${
                    category === value
                      ? CATEGORY_CONFIG[value].active
                      : `border ${CATEGORY_CONFIG[value].outline} bg-transparent`
                  }`}
                >
                  {label}
                </button>
              ))}
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

            {recurrence === "monthly" && (
              <div className="mt-3">
                <label
                  htmlFor="add-recurrence-day"
                  className="mb-1 block text-xs text-muted-foreground"
                >
                  毎月 何日
                </label>
                <input
                  id="add-recurrence-day"
                  type="number"
                  min={1}
                  max={31}
                  value={recurrenceDayOfMonth}
                  onChange={(e) => setRecurrenceDayOfMonth(Number(e.target.value))}
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
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            {saving ? "保存中..." : "保存する"}
          </button>
        </form>
      </div>
    </div>
  );
}
