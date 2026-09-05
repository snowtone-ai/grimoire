"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, CalendarPlus, List } from "lucide-react";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { type Task } from "@/lib/db";
import { getAllTasks, syncPlantStateFromTasks } from "@/lib/taskDb";
import {
  buildCalendarSummary,
  doesTaskApplyToDate,
  sortTasksByDateTime,
  sortTasksByTime,
  taskForDisplayDate,
  todayDateString,
} from "@/lib/domain/task-date";
import { TaskEditModal } from "@/components/home/task-edit-modal";
import { TaskAddModal } from "@/components/home/task-add-modal";
import { CalendarImportModal } from "@/components/calendar/calendar-import-modal";
import { CalendarView } from "./calendar-view";
import { ListView } from "./list-view";
import { SelectedDateSheet } from "./selected-date-sheet";

export function AllScreen() {
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addingTaskDate, setAddingTaskDate] = useState<string | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showFutureOnly, setShowFutureOnly] = useState(true);

  async function loadTasks() {
    const tasks = await getAllTasks();
    setAllTasks(tasks);
    return tasks;
  }

  async function reloadTasksAndPlantState() {
    await Promise.all([loadTasks(), syncPlantStateFromTasks()]);
  }

  useEffect(() => {
    const fallback = setTimeout(() => setLoading(false), 1500);

    // IndexedDB is an external client store; initial hydration sync belongs here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTasks()
      .catch((err) => console.error("[all] initial load failed:", err))
      .finally(() => {
        clearTimeout(fallback);
        setLoading(false);
      });

    return () => clearTimeout(fallback);
  }, []);

  const today = todayDateString();
  const calendarSummaries = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    return {
      previous: buildCalendarSummary(allTasks, year, month - 1),
      current: buildCalendarSummary(allTasks, year, month),
      next: buildCalendarSummary(allTasks, year, month + 1),
    };
  }, [allTasks, currentMonth]);
  const lifetimeCompleted = allTasks.filter((task) => task.completedAt).length;
  const selectedDateTasks = selectedDate
    ? sortTasksByTime(
        allTasks
          .filter((task) => doesTaskApplyToDate(task, selectedDate))
          .map((task) => taskForDisplayDate(task, selectedDate))
      )
    : [];
  const filteredTasks = sortTasksByDateTime(
    allTasks
      .filter((task) => !showFutureOnly || task.dueDate >= today)
      .map((task) => taskForDisplayDate(task, today))
  );

  function prevMonth() {
    setCurrentMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1));
    setSelectedDate(null);
  }

  function nextMonth() {
    setCurrentMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1));
    setSelectedDate(null);
  }

  function openTaskAddForSelectedDate() {
    if (!selectedDate) return;
    // Keep the date in its own state while the full-screen entry dialog is
    // open. The sheet closes first, so the two overlays never compete for
    // focus or Android Back handling.
    setAddingTaskDate(selectedDate);
    setSelectedDate(null);
  }

  function closeTaskAdd() {
    const dateToRestore = addingTaskDate;
    setAddingTaskDate(null);
    // Returning to the selected day keeps the user's calendar context intact
    // after cancelling or saving, and the refreshed task list is immediately
    // visible there after a save.
    if (dateToRestore) setSelectedDate(dateToRestore);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 pt-8 pb-3 flex items-center justify-between gap-2">
        <div>
          <p className="font-display text-[0.625rem] font-bold tracking-[0.32em] text-frost">
            FIELD MAP
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">全クエスト</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCalendarModal(true)}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-transform hover:bg-muted active:scale-90"
            aria-label="カレンダーからインポート"
          >
            <CalendarPlus className="size-5" />
          </button>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </header>

      <main
        aria-busy={loading}
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: "calc(8rem + env(safe-area-inset-bottom))" }}
      >
        {view === "calendar" ? (
          <CalendarView
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            today={today}
            summaries={calendarSummaries}
            lifetimeCompleted={lifetimeCompleted}
            onSelectDate={setSelectedDate}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
          />
        ) : (
          <ListView
            tasks={filteredTasks}
            today={today}
            showFutureOnly={showFutureOnly}
            onShowFutureOnlyChange={setShowFutureOnly}
            onEditTask={setEditingTask}
          />
        )}
      </main>

      <BottomNav />
      {selectedDate && (
        <SelectedDateSheet
          selectedDate={selectedDate}
          tasks={selectedDateTasks}
          onClose={() => setSelectedDate(null)}
          onAddTask={openTaskAddForSelectedDate}
          onEditTask={setEditingTask}
        />
      )}
      <CalendarImportModal
        open={showCalendarModal}
        onClose={() => setShowCalendarModal(false)}
        onTasksCreated={() => reloadTasksAndPlantState().catch(console.error)}
      />
      {addingTaskDate && (
        <TaskAddModal
          initialDueDate={addingTaskDate}
          onClose={closeTaskAdd}
          onTaskCreated={() => reloadTasksAndPlantState().catch(console.error)}
        />
      )}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={() => reloadTasksAndPlantState().catch(console.error)}
          onDeleted={() => {
            setEditingTask(null);
            reloadTasksAndPlantState().catch(console.error);
          }}
        />
      )}
    </div>
  );
}
function ViewToggle({
  view,
  onChange,
}: {
  view: "calendar" | "list";
  onChange: (view: "calendar" | "list") => void;
}) {
  return (
    <div className="flex items-center rounded-xl bg-muted p-1 gap-1">
      <button type="button" onClick={() => onChange("calendar")} aria-pressed={view === "calendar"} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${view === "calendar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
        <Calendar className="size-3.5" />
        カレンダー
      </button>
      <button type="button" onClick={() => onChange("list")} aria-pressed={view === "list"} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
        <List className="size-3.5" />
        リスト
      </button>
    </div>
  );
}
