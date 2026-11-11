"use client";

import * as React from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  parseISO,
  isValid,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "./utils";

export interface DatePickerProps {
  value?: string; // "YYYY-MM-DD" or ISO string
  onChange?: (date: string) => void;
  placeholder?: string;
  className?: string;
  popoverClassName?: string;
  align?: "start" | "center" | "end";
  disabled?: boolean;
  minDate?: Date | string;
  disablePastDates?: boolean;
  modal?: boolean;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DatePicker({
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
  className,
  popoverClassName,
  align = "end",
  disabled = false,
  minDate,
  disablePastDates = false,
  modal = true,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse current selected date
  const selectedDate = React.useMemo(() => {
    if (!value) return null;
    const parsed = typeof value === "string" && value.length === 10
      ? parseISO(value)
      : new Date(value);
    return isValid(parsed) ? parsed : null;
  }, [value]);

  // View month state (defaults to selected date or current date)
  const [viewMonth, setViewMonth] = React.useState<Date>(() => {
    return selectedDate || new Date();
  });

  // Calculate normalized minDateTime (start of day)
  const minDateTime = React.useMemo(() => {
    if (minDate) {
      const d = typeof minDate === "string" && minDate.length === 10
        ? parseISO(minDate)
        : new Date(minDate);
      if (isValid(d)) {
        const copy = new Date(d);
        copy.setHours(0, 0, 0, 0);
        return copy;
      }
    }
    if (disablePastDates) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }
    return null;
  }, [minDate, disablePastDates]);

  // When value changes from outside, sync viewMonth
  React.useEffect(() => {
    if (selectedDate) {
      setViewMonth(selectedDate);
    }
  }, [selectedDate]);

  // Check if previous month navigation is allowed
  const canGoPrevMonth = React.useMemo(() => {
    if (!minDateTime) return true;
    return startOfMonth(viewMonth) > startOfMonth(minDateTime);
  }, [viewMonth, minDateTime]);

  // Compute days for the month grid
  const daysInGrid = React.useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [viewMonth]);

  const handleSelectDay = (day: Date) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    if (minDateTime && dayStart < minDateTime) {
      return;
    }
    const formatted = format(day, "yyyy-MM-dd");
    onChange?.(formatted);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.("");
    setOpen(false);
  };

  const handleToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (minDateTime && today < minDateTime) {
      return;
    }
    setViewMonth(today);
    onChange?.(format(today, "yyyy-MM-dd"));
    setOpen(false);
  };

  const displayLabel = React.useMemo(() => {
    if (!selectedDate) return placeholder;
    return format(selectedDate, "dd/MM/yyyy");
  }, [selectedDate, placeholder]);

  return (
    <Popover modal={modal} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "group flex items-center justify-start gap-2 px-3 h-10 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-border rounded-2xl bg-background dark:bg-muted/30 shadow-2xs w-full text-left hover:border-sidebar/50 dark:hover:border-blue-400/50 focus:outline-hidden focus:ring-1 focus:ring-sidebar/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
            className
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0 group-hover:text-sidebar dark:group-hover:text-blue-400 transition-colors" />
          <span className="truncate select-none text-slate-700 dark:text-slate-200 font-medium">
            {displayLabel}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        sideOffset={6}
        collisionPadding={16}
        className={cn(
          "w-[270px] p-3.5 rounded-2xl border border-slate-200/90 dark:border-border bg-white dark:bg-card shadow-xl text-slate-900 dark:text-slate-100 select-none",
          popoverClassName
        )}
      >
        {/* Calendar Header */}
        <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100 dark:border-border/60">
          <div className="flex items-center gap-1">
            <span className="font-bold text-sm text-slate-900 dark:text-white">
              {format(viewMonth, "MMMM yyyy")}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              disabled={!canGoPrevMonth}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setViewMonth((prev) => subMonths(prev, 1));
              }}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                canGoPrevMonth
                  ? "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-[#112e7e] dark:hover:text-white cursor-pointer"
                  : "opacity-25 cursor-not-allowed text-slate-300 dark:text-slate-600"
              )}
              aria-label="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setViewMonth((prev) => addMonths(prev, 1));
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-[#112e7e] dark:hover:text-white transition-colors cursor-pointer"
              aria-label="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Weekday Row */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
          {WEEKDAYS.map((day) => (
            <span
              key={day}
              className="text-[11px] font-bold text-slate-700 dark:text-slate-300 py-0.5"
            >
              {day}
            </span>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {daysInGrid.map((day, idx) => {
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
            const isCurrentMonth = isSameMonth(day, viewMonth);
            const isDayToday = isToday(day);

            const dayStart = new Date(day);
            dayStart.setHours(0, 0, 0, 0);
            const isDayDisabled = minDateTime ? dayStart < minDateTime : false;

            return (
              <button
                key={idx}
                type="button"
                disabled={isDayDisabled}
                aria-disabled={isDayDisabled}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isDayDisabled) {
                    handleSelectDay(day);
                  }
                }}
                className={cn(
                  "h-8 w-8 mx-auto text-xs rounded-xl flex items-center justify-center font-medium transition-all",
                  // Disabled state
                  isDayDisabled &&
                    "opacity-25 cursor-not-allowed text-slate-400 dark:text-slate-600 select-none pointer-events-none",
                  // Selected state (Royal Blue #112e7e)
                  !isDayDisabled && isSelected &&
                    "bg-[#112e7e] text-white font-bold shadow-xs hover:bg-[#112e7e] hover:text-white cursor-pointer",
                  // Not selected, but is today
                  !isDayDisabled && !isSelected &&
                    isDayToday &&
                    "border border-[#112e7e] text-[#112e7e] dark:text-blue-400 font-bold hover:bg-blue-50/70 dark:hover:bg-slate-800 cursor-pointer",
                  // Normal day inside current month
                  !isDayDisabled && !isSelected &&
                    !isDayToday &&
                    isCurrentMonth &&
                    "text-slate-800 dark:text-slate-200 hover:bg-blue-50/60 dark:hover:bg-slate-800 hover:text-[#112e7e] dark:hover:text-white cursor-pointer",
                  // Outside days
                  !isDayDisabled && !isSelected &&
                    !isDayToday &&
                    !isCurrentMonth &&
                    "text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-500 cursor-pointer"
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 dark:border-border/60">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleClear}
            className="text-xs font-bold text-[#112e7e] dark:text-blue-400 hover:underline cursor-pointer px-1 py-0.5 rounded-sm focus:outline-hidden"
          >
            Clear
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleToday}
            className="text-xs font-bold text-[#112e7e] dark:text-blue-400 hover:underline cursor-pointer px-1 py-0.5 rounded-sm focus:outline-hidden"
          >
            Today
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
