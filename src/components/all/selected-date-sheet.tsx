import { ChevronRight, Plus, X } from "lucide-react";
import { type Task } from "@/lib/db";
import { formatDateLabel } from "@/lib/domain/task-date";

interface SelectedDateSheetProps {
  selectedDate: string;
  tasks: Task[];
  onClose: () => void;
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
}

export function SelectedDateSheet({
  selectedDate,
  tasks,
  onClose,
  onAddTask,
  onEditTask,
}: SelectedDateSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="selected-date-title"
        className="flex max-h-[70dvh] w-full max-w-lg flex-col rounded-t-3xl bg-card shadow-xl animate-slide-up"
      >
        <div aria-hidden className="mx-auto mt-3 h-1.5 w-10 flex-shrink-0 rounded-full bg-muted" />
        <div className="flex items-center justify-between px-5 pt-2 pb-3 flex-shrink-0">
          <h2 id="selected-date-title" className="text-base font-bold text-foreground">{formatDateLabel(selectedDate)}</h2>
          <button type="button" aria-label="閉じる" onClick={onClose} className="btn-squish flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {tasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">この日のタスクはありません</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tasks.map((task) => (
                <li key={task.id}>
                  <SheetTaskButton task={task} onClose={onClose} onEditTask={onEditTask} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="flex-shrink-0 border-t border-frost/15 bg-card/95 px-5 pt-3"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={onAddTask}
            className="btn-squish flex min-h-12 w-full items-center gap-3 rounded-2xl border border-dashed border-frost/35 bg-frost-soft/45 px-3.5 py-2.5 text-left text-frost shadow-sm transition-colors hover:bg-frost-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-frost-soft">
              <Plus aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">この日にタスクを追加</span>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                期限は {formatDateLabel(selectedDate)} に設定
              </span>
            </span>
            <ChevronRight aria-hidden className="flex-shrink-0 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SheetTaskButton({
  task,
  onClose,
  onEditTask,
}: {
  task: Task;
  onClose: () => void;
  onEditTask: (task: Task) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onClose();
        onEditTask(task);
      }}
      className={`btn-squish w-full flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-sm transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${task.completed ? "opacity-50" : ""}`}
    >
      <span className={`size-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${task.completed ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
        {task.completed && (
          <svg viewBox="0 0 10 8" className="size-2.5 stroke-primary-foreground" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1,4 4,7 9,1" />
          </svg>
        )}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {task.title}
        </p>
        {task.dueTime && <p className="mt-0.5 text-xs text-muted-foreground">{task.dueTime}</p>}
      </div>
    </button>
  );
}
