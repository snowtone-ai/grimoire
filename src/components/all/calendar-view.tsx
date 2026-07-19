import { ChevronLeft, ChevronRight } from "lucide-react";
import { type Category } from "@/lib/db";
import { WEEKDAY_LABELS, toDateStr } from "@/lib/domain/task-date";
import { categoryConfig } from "./all-constants";

interface CalendarViewProps {
  currentMonth: Date;
  selectedDate: string | null;
  today: string;
  dotMap: Record<string, Set<Category>>;
  onSelectDate: (date: string | null) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export function CalendarView({
  currentMonth,
  selectedDate,
  today,
  dotMap,
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
          <div key={label} className={`text-center text-xs font-medium py-1 ${i === 0 ? "text-destructive" : i === 6 ? "text-cat-job" : "text-muted-foreground"}`}>
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
              dots={dotMap[dateStr]}
              onSelectDate={onSelectDate}
            />
          ) : (
            <div key={`pad-${idx}`} />
          )
        )}
      </div>
    </div>
  );
}

function CalendarCell({
  dateStr,
  selected,
  today,
  dots,
  onSelectDate,
}: {
  dateStr: string;
  selected: boolean;
  today: boolean;
  dots?: Set<Category>;
  onSelectDate: (date: string | null) => void;
}) {
  const date = new Date(`${dateStr}T00:00:00`);
  const dayOfWeek = date.getDay();
  const dayNum = date.getDate();

  return (
    <button
      type="button"
      onClick={() => onSelectDate(selected ? null : dateStr)}
      className={`flex flex-col items-center justify-start rounded-xl px-1 py-1.5 min-h-[56px] transition-colors active:scale-95 ${
        selected ? "bg-primary" : today ? "bg-brand-soft ring-1 ring-brand/40" : "hover:bg-muted"
      }`}
    >
      <span className={`text-sm font-medium leading-none ${selected ? "font-bold text-primary-foreground" : today ? "text-brand font-bold" : dayOfWeek === 0 ? "text-destructive" : dayOfWeek === 6 ? "text-cat-job" : "text-foreground"}`}>
        {dayNum}
      </span>
      {dots && (
        <div className="mt-1 flex flex-wrap justify-center gap-0.5">
          {(["job", "university", "life"] as Category[])
            .filter((category) => dots.has(category))
            .map((category) => (
              <span key={category} className={`size-1.5 rounded-full ${selected ? "bg-primary-foreground" : categoryConfig[category].dot}`} />
            ))}
        </div>
      )}
    </button>
  );
}
