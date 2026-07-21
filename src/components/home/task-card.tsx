"use client";

import { useState } from "react";
import { ChevronDown, Footprints } from "lucide-react";
import { type Task } from "@/lib/db";

interface TaskCardProps {
  task: Task;
  departed: boolean;
  onToggle: (taskId: string) => Promise<void>;
  onTap: (task: Task) => void;
  onDepart: (taskId: string) => void;
}

export function TaskCard({ task, departed, onToggle, onTap, onDepart }: TaskCardProps) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const now = new Date();
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const isOverdue = !task.completed && task.dueTime !== null && task.dueTime < nowTime;
  const detailId = `task-detail-${task.id}`;

  async function handleCheck() {
    if (busy) return;
    setBusy(true);
    try {
      await onToggle(task.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border bg-card shadow-xs transition-all duration-300 ${
        task.completed ? "border-transparent opacity-60" : "border-border"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          aria-label={task.completed ? "達成を取り消す" : "クエストを達成にする"}
          disabled={busy}
          onClick={handleCheck}
          className={`btn-squish flex size-7 shrink-0 items-center justify-center rounded-full border-2 [transition-property:transform,border-color,background-color] duration-300 ${
            task.completed
              ? "is-checked border-primary bg-primary animate-check-pop"
              : "border-muted-foreground/35"
          } ${busy ? "opacity-50" : ""}`}
        >
          <svg
            viewBox="0 0 10 8"
            className="size-3.5"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="1,4 4,7 9,1" pathLength="1" className="check-draw stroke-primary-foreground" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => onTap(task)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label="クエストを編集"
        >
          <div className="min-w-0 flex-1">
            <p
              className={`task-strike text-[15px] font-medium leading-snug ${
                task.completed ? "is-struck text-muted-foreground" : "text-foreground"
              }`}
            >
              {task.title}
            </p>
            {task.dueTime && (
              <p
                className={`mt-0.5 text-xs tabular-nums ${
                  isOverdue ? "font-semibold text-destructive" : "text-muted-foreground"
                }`}
              >
                {task.dueTime}
                {isOverdue && "・期限超過"}
              </p>
            )}
          </div>

        </button>
        {!task.completed && (
          <button
            type="button"
            onClick={() => onDepart(task.id)}
            disabled={departed}
            aria-pressed={departed}
            aria-label={departed ? "出発済み" : "このクエストに出発する"}
            className={`btn-squish flex size-9 shrink-0 items-center justify-center rounded-full transition-colors ${
              departed ? "bg-brand-soft text-brand" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Footprints className="size-4" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
          className="btn-squish flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          aria-expanded={expanded}
          aria-controls={detailId}
          aria-label={expanded ? "詳細を折りたたむ" : "詳細を展開する"}
        >
          <ChevronDown
            className={`size-4 transition-transform duration-300 ease-spring ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      <div
        id={detailId}
        inert={!expanded}
        className={`grid transition-[grid-template-rows] duration-300 ease-fluid ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="mx-4 border-t border-border/60 pt-2.5 pb-3 pl-10 text-xs text-muted-foreground">
            <p className="whitespace-pre-wrap leading-relaxed">
              {task.description?.trim() || "詳細はありません"}
            </p>
            <button
              type="button"
              onClick={() => onTap(task)}
              className="-ml-2 mt-1 rounded-lg px-2 py-1.5 font-semibold text-brand underline-offset-2 hover:underline"
            >
              編集
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
