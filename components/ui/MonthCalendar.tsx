"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getISODay,
  parseISO,
  startOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { cn, focusRingClasses } from "@/lib/cn";

export type DayStatus = "complete" | "partial" | "missing";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_LABEL: Record<DayStatus, string> = {
  complete: "All entered",
  partial: "Partly entered",
  missing: "Nothing entered",
};

const STATUS_MARK: Record<DayStatus, string> = {
  complete: "bg-green-text",
  partial: "bg-amber-border",
  missing: "border-2 border-red",
};

function StatusMark({ status, className }: { status: DayStatus; className?: string }) {
  return <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", STATUS_MARK[status], className)} />;
}

export function MonthCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  maxDate,
  getStatus,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  selected: string;
  onSelect: (date: string) => void;
  maxDate?: string;
  getStatus?: (date: string) => DayStatus | null;
}) {
  const first = startOfMonth(parseISO(month));
  const days = eachDayOfInterval({ start: first, end: endOfMonth(first) }).map((d) => format(d, "yyyy-MM-dd"));
  const leadingBlanks = getISODay(first) - 1;
  const nextMonth = format(addMonths(first, 1), "yyyy-MM-dd");
  const nextDisabled = maxDate !== undefined && nextMonth.slice(0, 7) > maxDate.slice(0, 7);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <IconButton
          aria-label="Previous month"
          onClick={() => onMonthChange(format(addMonths(first, -1), "yyyy-MM-dd"))}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </IconButton>
        <h2 className="text-lg font-semibold" aria-live="polite">
          {format(first, "MMMM yyyy")}
        </h2>
        <IconButton aria-label="Next month" disabled={nextDisabled} onClick={() => onMonthChange(nextMonth)}>
          <ChevronRight size={16} aria-hidden="true" />
        </IconButton>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <span key={day} className="text-center font-mono text-xs font-medium text-muted uppercase">
            {day}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden="true" />
        ))}
        {days.map((date) => {
          const disabled = maxDate !== undefined && date > maxDate;
          const status = disabled ? null : (getStatus?.(date) ?? null);
          const isSelected = date === selected;
          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={`${format(parseISO(date), "EEEE d MMMM")}${status ? `, ${STATUS_LABEL[status]}` : ""}`}
              onClick={() => onSelect(date)}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-1 rounded-md font-mono text-sm transition-colors duration-150",
                focusRingClasses,
                isSelected ? "bg-navy text-white" : "text-ink hover:bg-blue-tint",
                date === maxDate && !isSelected && "border-2 border-navy",
                "disabled:cursor-not-allowed disabled:text-muted disabled:opacity-50 disabled:hover:bg-transparent",
              )}
            >
              {Number(date.slice(8))}
              {status ? <StatusMark status={status} className={cn(isSelected && "border-white")} /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DayStatusLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-strong-muted">
      {(Object.keys(STATUS_LABEL) as DayStatus[]).map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <StatusMark status={status} />
          {STATUS_LABEL[status]}
        </li>
      ))}
    </ul>
  );
}
