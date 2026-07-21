import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  WEEKDAY_LABELS,
  toDateStr,
  completionHeatLevel,
  summarizeCalendarMonth,
  type CalendarDaySummary,
} from "@/lib/domain/task-date";

interface CalendarViewProps {
  currentMonth: Date;
  selectedDate: string | null;
  today: string;
  summary: Record<string, CalendarDaySummary>;
  lifetimeCompleted: number;
  onSelectDate: (date: string | null) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

// Ember-fill opacity per heat tier. Capped low so the day number keeps a safe
// contrast on the tint in both light and dark schemes (D-024 restraint rule).
const HEAT_MIX = ["", "18%", "30%", "42%"] as const;

export function CalendarView({
  currentMonth,
  selectedDate,
  today,
  summary,
  lifetimeCompleted,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: CalendarViewProps) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const cells: (string | null)[] = [
    ...Array<null>(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDateStr(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthStats = summarizeCalendarMonth(summary);

  return (
    <div>
      <div className="flex items-center justify-between px-4 pb-3">
        <button type="button" onClick={onPrevMonth} aria-label="前月" className="flex size-8 items-center justify-center rounded-full hover:bg-muted active:scale-90 transition-transform">
          <ChevronLeft className="size-5 text-foreground" />
        </button>
        <span className="text-base font-bold text-foreground">
          {year}年{month + 1}月
        </span>
        <button type="button" onClick={onNextMonth} aria-label="翌月" className="flex size-8 items-center justify-center rounded-full hover:bg-muted active:scale-90 transition-transform">
          <ChevronRight className="size-5 text-foreground" />
        </button>
      </div>

      <div className="grid grid-cols-7 px-2 mb-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={label} className={`text-center text-xs font-medium py-1 ${i === 0 ? "text-destructive" : i === 6 ? "text-frost" : "text-muted-foreground"}`}>
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 px-2 gap-y-1">
        {cells.map((dateStr, idx) =>
          dateStr ? (
            <CalendarCell
              key={dateStr}
              dateStr={dateStr}
              selected={dateStr === selectedDate}
              today={dateStr === today}
              summary={summary[dateStr]}
              onSelectDate={onSelectDate}
            />
          ) : (
            <div key={`pad-${idx}`} />
          )
        )}
      </div>

      <SurveyLog stats={monthStats} lifetimeCompleted={lifetimeCompleted} />
    </div>
  );
}

function CalendarCell({
  dateStr,
  selected,
  today,
  summary,
  onSelectDate,
}: {
  dateStr: string;
  selected: boolean;
  today: boolean;
  summary?: CalendarDaySummary;
  onSelectDate: (date: string | null) => void;
}) {
  const date = new Date(`${dateStr}T00:00:00`);
  const dayOfWeek = date.getDay();
  const dayNum = date.getDate();
  const completed = summary?.completed ?? 0;
  const pending = summary?.pending ?? 0;
  const heat = completionHeatLevel(completed);

  const classes = [
    "relative flex flex-col items-center justify-start rounded-xl px-1 py-1.5 min-h-[56px] transition-colors active:scale-95",
  ];
  let style: React.CSSProperties | undefined;

  if (selected) {
    classes.push("bg-primary");
  } else {
    if (today) classes.push("ring-1 ring-brand/40");
    if (heat > 0) {
      style = { backgroundColor: `color-mix(in oklab, var(--brand) ${HEAT_MIX[heat]}, transparent)` };
      if (heat === 3) style.boxShadow = "inset 0 0 0 1.5px color-mix(in oklab, var(--brand) 55%, transparent)";
    } else if (today) {
      classes.push("bg-brand-soft");
    } else {
      classes.push("hover:bg-muted");
    }
  }

  const parts = [`${dayNum}日`];
  if (completed > 0) parts.push(`討伐${completed}件`);
  if (pending > 0) parts.push(`予定${pending}件`);

  return (
    <button
      type="button"
      aria-label={parts.join(" ")}
      onClick={() => onSelectDate(selected ? null : dateStr)}
      className={classes.join(" ")}
      style={style}
    >
      <span className={`text-sm font-medium leading-none ${selected ? "font-bold text-primary-foreground" : today ? "text-brand font-bold" : dayOfWeek === 0 ? "text-destructive" : dayOfWeek === 6 ? "text-muted-foreground" : "text-foreground"}`}>
        {dayNum}
      </span>
      {pending > 0 && (
        <span
          aria-hidden
          className={`mt-1 size-1.5 rounded-full ${selected ? "bg-primary-foreground" : "bg-frost"}`}
        />
      )}
    </button>
  );
}

function SurveyLog({
  stats,
  lifetimeCompleted,
}: {
  stats: { completed: number; activeDays: number; pending: number };
  lifetimeCompleted: number;
}) {
  return (
    <div className="mt-4 px-4">
      <div className="rounded-2xl border border-border bg-card/70 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="font-display text-[10px] font-bold tracking-[0.28em] text-gold">SURVEY LOG</span>
          <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-gold/40 to-transparent" />
        </div>
        <dl className="mt-2 flex items-end gap-5">
          <Stat label="討伐" value={stats.completed} unit="件" valueClass="text-brand" />
          <Stat label="活動" value={stats.activeDays} unit="日" valueClass="text-frost" />
          <Stat label="予定" value={stats.pending} unit="件" valueClass="text-foreground" />
        </dl>
        <p className="mt-2 text-[11px] text-muted-foreground">
          通算 <span className="font-semibold text-foreground tabular-nums">{lifetimeCompleted}</span> 件の調査記録
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  valueClass,
}: {
  label: string;
  value: number;
  unit: string;
  valueClass: string;
}) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={`text-lg font-bold tabular-nums ${valueClass}`}>
        {value}
        <span className="ml-0.5 text-xs font-medium text-muted-foreground">{unit}</span>
      </dd>
    </div>
  );
}
