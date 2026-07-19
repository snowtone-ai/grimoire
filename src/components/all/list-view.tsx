import { type Category, type Task } from "@/lib/db";
import { formatDateLabel, getRecurrenceDetail } from "@/lib/domain/task-date";
import { CATEGORY_FILTERS, categoryConfig } from "./all-constants";

interface ListViewProps {
  tasks: Task[];
  today: string;
  categoryFilter: Category | "all";
  showFutureOnly: boolean;
  onCategoryFilterChange: (category: Category | "all") => void;
  onShowFutureOnlyChange: (value: boolean) => void;
  onEditTask: (task: Task) => void;
}

export function ListView({
  tasks,
  today,
  categoryFilter,
  showFutureOnly,
  onCategoryFilterChange,
  onShowFutureOnlyChange,
  onEditTask,
}: ListViewProps) {
  return (
    <div>
      <div className="flex gap-2 px-4 pb-4 overflow-x-auto">
        {CATEGORY_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onCategoryFilterChange(value)}
            aria-pressed={categoryFilter === value}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              categoryFilter === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 px-4 pb-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={showFutureOnly}
          onChange={(event) => onShowFutureOnlyChange(event.target.checked)}
          className="size-4 rounded border-border accent-brand"
        />
        今日以降のみ表示
      </label>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <div className="mb-4 text-5xl select-none">📋</div>
          <p className="text-base font-semibold text-foreground">タスクがありません</p>
          <p className="mt-1 text-sm text-muted-foreground">右下の「+」ボタンからタスクを追加しましょう</p>
        </div>
      ) : (
        <ul className="space-y-2 px-4">
          {tasks.map((task) => (
            <li key={task.id}>
              <ListTaskButton task={task} today={today} onEditTask={onEditTask} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListTaskButton({
  task,
  today,
  onEditTask,
}: {
  task: Task;
  today: string;
  onEditTask: (task: Task) => void;
}) {
  const config = categoryConfig[task.category];
  const recurrenceDetail = getRecurrenceDetail(task);
  const isPast = task.dueDate < today && !task.completed && task.recurrence === "none";

  return (
    <button
      type="button"
      onClick={() => onEditTask(task)}
      className={`w-full flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm text-left transition-opacity ${task.completed ? "opacity-50" : ""}`}
    >
      <span className={`mt-0.5 size-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${task.completed ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
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
        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
          <span className={`text-xs tabular-nums ${isPast ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
            {formatDateLabel(task.dueDate)}
            {task.dueTime ? ` ${task.dueTime}` : ""}
            {isPast ? " (期限切れ)" : ""}
          </span>
          {recurrenceDetail && <span className="text-xs text-brand font-medium">🔄 {recurrenceDetail}</span>}
        </div>
      </div>

      <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    </button>
  );
}
