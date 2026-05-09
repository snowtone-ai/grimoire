import { X } from "lucide-react";
import { type Task } from "@/lib/db";
import { formatDateLabel } from "@/lib/domain/task-date";
import { categoryConfig } from "./all-constants";

interface SelectedDateSheetProps {
  selectedDate: string;
  tasks: Task[];
  onClose: () => void;
  onEditTask: (task: Task) => void;
}

export function SelectedDateSheet({
  selectedDate,
  tasks,
  onClose,
  onEditTask,
}: SelectedDateSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-t-2xl bg-background shadow-xl flex flex-col max-h-[70dvh] animate-slide-up">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <h2 className="text-base font-bold text-foreground">{formatDateLabel(selectedDate)}</h2>
          <button type="button" aria-label="閉じる" onClick={onClose} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5" style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>
          {tasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">この日のタスクはありません</p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((task) => (
                <li key={task.id}>
                  <SheetTaskButton task={task} onClose={onClose} onEditTask={onEditTask} />
                </li>
              ))}
            </ul>
          )}
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
  const config = categoryConfig[task.category];

  return (
    <button
      type="button"
      onClick={() => {
        onClose();
        onEditTask(task);
      }}
      className={`w-full flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm text-left transition-opacity ${task.completed ? "opacity-50" : ""}`}
    >
      <span className={`size-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${task.completed ? "border-orange-500 bg-orange-500" : "border-muted-foreground/40"}`}>
        {task.completed && (
          <svg viewBox="0 0 10 8" className="size-2.5 stroke-white" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    </button>
  );
}
