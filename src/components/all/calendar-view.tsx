"use client";

import { useRef } from "react";
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
  summaries: {
    previous: Record<string, CalendarDaySummary>;
    current: Record<string, CalendarDaySummary>;
    next: Record<string, CalendarDaySummary>;
  };
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
  summaries,
  lifetimeCompleted,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: CalendarViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startRef = useRef({ x: 0, y: 0, time: 0 });
  const axisRef = useRef<"x" | "y" | null>(null);
  const offsetRef = useRef(0);
  const animatingRef = useRef(false);
  const suppressClickRef = useRef(false);

  const previousMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() - 1,
    1
  );
  const nextMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    1
  );

  function setTrackOffset(offset: number, animate: boolean) {
    const track = trackRef.current;
    if (!track) return;
    offsetRef.current = offset;
    track.style.transition = animate
      ? "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)"
      : "none";
    track.style.transform = `translate3d(calc(-33.333333% + ${offset}px), 0, 0)`;
  }

  function finishSwipe(direction: -1 | 1) {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    const changeMonth = direction === 1 ? onNextMonth : onPrevMonth;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      changeMonth();
      setTrackOffset(0, false);
      animatingRef.current = false;
      return;
    }

    animatingRef.current = true;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(fallback);
      changeMonth();
      setTrackOffset(0, false);
      animatingRef.current = false;
    };

    track.addEventListener("transitionend", finish, { once: true });
    const fallback = setTimeout(finish, 320);
    setTrackOffset(direction * viewport.clientWidth, true);
  }

  function settleSwipe() {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const elapsed = Math.max(performance.now() - startRef.current.time, 1);
    const velocity = offsetRef.current / elapsed;
    const shouldChange =
      Math.abs(offsetRef.current) >= viewport.clientWidth * 0.18 ||
      (Math.abs(offsetRef.current) >= 28 && Math.abs(velocity) >= 0.45);

    if (shouldChange) {
      finishSwipe(offsetRef.current > 0 ? 1 : -1);
    } else {
      setTrackOffset(0, true);
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || animatingRef.current) return;
    pointerIdRef.current = event.pointerId;
    startRef.current = { x: event.clientX, y: event.clientY, time: performance.now() };
    axisRef.current = null;
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId || animatingRef.current) return;

    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (!axisRef.current) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axisRef.current === "x") {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
    if (axisRef.current !== "x") return;

    const width = event.currentTarget.clientWidth;
    setTrackOffset(Math.max(-width, Math.min(width, dx)), false);
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    pointerIdRef.current = null;
    if (axisRef.current === "x") {
      suppressClickRef.current = true;
      settleSwipe();
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    axisRef.current = null;
  }

  function handlePointerCancel(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    pointerIdRef.current = null;
    axisRef.current = null;
    setTrackOffset(0, true);
  }

  return (
    <div
      ref={viewportRef}
      className="touch-pan-y overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerCancel}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        ref={trackRef}
        className="flex w-[300%] will-change-transform"
        style={{ transform: "translate3d(-33.333333%, 0, 0)" }}
      >
        <MonthPanel
          monthDate={nextMonth}
          selectedDate={selectedDate}
          today={today}
          summary={summaries.next}
          lifetimeCompleted={lifetimeCompleted}
          onSelectDate={onSelectDate}
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
        />
        <MonthPanel
          active
          monthDate={currentMonth}
          selectedDate={selectedDate}
          today={today}
          summary={summaries.current}
          lifetimeCompleted={lifetimeCompleted}
          onSelectDate={onSelectDate}
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
        />
        <MonthPanel
          monthDate={previousMonth}
          selectedDate={selectedDate}
          today={today}
          summary={summaries.previous}
          lifetimeCompleted={lifetimeCompleted}
          onSelectDate={onSelectDate}
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
        />
      </div>
    </div>
  );
}

function MonthPanel({
  active = false,
  monthDate,
  selectedDate,
  today,
  summary,
  lifetimeCompleted,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: Omit<CalendarViewProps, "currentMonth" | "summaries"> & {
  active?: boolean;
  monthDate: Date;
  summary: Record<string, CalendarDaySummary>;
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const cells: (string | null)[] = [
    ...Array<null>(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDateStr(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthStats = summarizeCalendarMonth(summary);

  return (
    <div
      className="w-1/3 shrink-0"
      aria-hidden={!active}
      inert={!active}
    >
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
