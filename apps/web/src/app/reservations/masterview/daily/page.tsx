"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  CheckCircle2,
  Tv,
  Mic,
  Speaker,
  Clock,
  Calendar,
  Eye,
  MapPin,
  User,
  X,
  MoreHorizontal,
} from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
} from "date-fns";
import { useQuery } from "@tanstack/react-query";
import type { Booking, Room, Area, Worker, VenueElement, Ministry } from "@studio/types";
import {
  Badge,
  Button,
  Separator,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@studio/ui";
import { cn, toJsDate } from "@/lib/utils";
import { useUserRole } from "@/hooks/use-user-role";
import {
  getAreas,
  getBookings,
  getRooms,
  getVenueElements,
  getWorkers,
  getMinistries,
} from "@/actions/db";
import { ReservationDetailsSheet } from "@/components/reservations/reservation-details-sheet";

type CalendarViewMode = "month" | "week" | "day";

// Color styles for reservation badge pills
const EVENT_COLORS = [
  {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-900 dark:text-blue-200",
    border: "border-l-blue-500",
  },
  {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-900 dark:text-emerald-200",
    border: "border-l-emerald-500",
  },
  {
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-900 dark:text-purple-200",
    border: "border-l-purple-500",
  },
  {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-900 dark:text-amber-200",
    border: "border-l-amber-500",
  },
  {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-900 dark:text-rose-200",
    border: "border-l-rose-500",
  },
];

function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ScheduleCalendarPage() {
  const { canViewScheduleMasterview, canApproveRoomReservation, workerProfile, isSuperAdmin, myMinistryIds, isLoading: roleLoading } = useUserRole();
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [selectedAreaId, setSelectedAreaId] = useState<string>("all");
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{
    date: Date;
    bookings: any[];
  } | null>(null);
  const [previousDayEvents, setPreviousDayEvents] = useState<{
    date: Date;
    bookings: any[];
  } | null>(null);

  const handleDayClickMobile = (day: Date, events: any[]) => {
    if (!events || events.length === 0) return;
    if (events.length === 1) {
      handleBookingClick(events[0]);
    } else {
      setSelectedDayEvents({ date: day, bookings: events });
    }
  };

  // Fetch data live from Database queries
  const { data: rooms, isLoading: roomsLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => getRooms(),
  });

  const { data: areas, isLoading: areasLoading } = useQuery({
    queryKey: ["areas"],
    queryFn: () => getAreas(),
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["bookings", "calendar"],
    queryFn: () => getBookings(),
    staleTime: 5_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  const { data: workers, isLoading: workersLoading } = useQuery({
    queryKey: ["workers", "calendar"],
    queryFn: () => getWorkers(),
  });

  const { data: venueElements, isLoading: venueElementsLoading } = useQuery({
    queryKey: ["venue-elements"],
    queryFn: () => getVenueElements(),
  });

  const { data: ministries, isLoading: ministriesLoading } = useQuery({
    queryKey: ["ministries"],
    queryFn: () => getMinistries(),
  });

  const isLoading =
    roomsLoading ||
    areasLoading ||
    bookingsLoading ||
    workersLoading ||
    roleLoading ||
    venueElementsLoading ||
    ministriesLoading;

  // Protected route check
  React.useEffect(() => {
    if (!roleLoading && !canViewScheduleMasterview) {
      router.replace("/dashboard");
    }
  }, [canViewScheduleMasterview, roleLoading, router]);

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (viewMode === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subDays(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (viewMode === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const handleBookingClick = (booking: any, keepPreviousEvents = false) => {
    if (!keepPreviousEvents) {
      setPreviousDayEvents(null);
    }
    setSelectedBooking(booking);
    setIsDetailsOpen(true);
  };

  // Title text calculation
  const calendarTitle = useMemo(() => {
    if (viewMode === "month") {
      return format(currentDate, "MMMM yyyy");
    }
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    }
    return format(currentDate, "EEEE, MMMM d, yyyy");
  }, [currentDate, viewMode]);

  // Approved bookings only
  const approvedBookings = useMemo(() => {
    if (!bookings) return [];
    return bookings.filter((b) => b.status === "Approved");
  }, [bookings]);

  // Bookings for selected date on mobile
  const selectedDayBookings = useMemo(() => {
    return approvedBookings
      .filter((b) => isSameDay(toJsDate(b.start), selectedDate))
      .sort((a, b) => toJsDate(a.start).getTime() - toJsDate(b.start).getTime());
  }, [approvedBookings, selectedDate]);

  // Days for Month View Grid (Sun-Sat)
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  // Days for Week View
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Rooms for Day View filtered by chosen Area/Floor
  const dayRooms = useMemo(() => {
    if (!rooms) return [];
    if (selectedAreaId === "all") return rooms;
    return rooms.filter((r) => r.areaId === selectedAreaId);
  }, [rooms, selectedAreaId]);

  if (roleLoading) return null;
  if (!canViewScheduleMasterview) return null;

  return (
    <AppLayout>
      <div className="w-full space-y-6 pb-12">
        {/* Header Section */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-headline text-gray-900 dark:text-white">
            Schedule Calendar
          </h1>
          <p className="text-sm text-muted-foreground">
            View and manage room reservations across all facilities.
          </p>
        </div>

        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Navigation & View Mode Card */}
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-200/80 dark:border-border p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Date Navigator */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-border hover:bg-slate-100 dark:hover:bg-muted text-slate-700 dark:text-slate-200 transition-all shadow-2xs"
              title="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-foreground text-center min-w-[170px] px-2">
              {calendarTitle}
            </span>

            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-border hover:bg-slate-100 dark:hover:bg-muted text-slate-700 dark:text-slate-200 transition-all shadow-2xs"
              title="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* View Mode Pill Switcher */}
          <div className="bg-slate-100/90 dark:bg-muted p-1 rounded-xl flex items-center border border-slate-200/70 dark:border-border/50 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={cn(
                "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all",
                viewMode === "month"
                  ? "bg-sidebar text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground"
              )}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={cn(
                "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all",
                viewMode === "week"
                  ? "bg-sidebar text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground"
              )}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={cn(
                "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all",
                viewMode === "day"
                  ? "bg-sidebar text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground"
              )}
            >
              Day
            </button>
          </div>
        </div>

        {/* Floor / Area selector for Day view */}
        {viewMode === "day" && (
          <div className="flex items-center justify-end gap-2.5">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              Show rooms:
            </span>
            <Select
              value={selectedAreaId}
              onValueChange={setSelectedAreaId}
            >
              <SelectTrigger className="w-[190px] h-9 text-xs rounded-xl border-gray-200 dark:border-border bg-white dark:bg-card font-medium">
                <SelectValue placeholder="Select Floor / Area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-medium">
                  All Floors & Areas
                </SelectItem>
                {areas?.map((area) => (
                  <SelectItem
                    key={area.id}
                    value={area.id}
                    className="text-xs font-medium"
                  >
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Main Content Card */}
        <div className="bg-white dark:bg-card rounded-2xl border border-border/60 p-5 sm:p-6 shadow-card-dark overflow-hidden min-h-[520px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Loading calendar schedules...
              </p>
            </div>
          ) : viewMode === "month" ? (
            /* Month View Grid */
            <div className="space-y-2.5">
              {/* Day Headers (Sun - Sat) with styled header cards */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (dayName) => (
                    <div
                      key={dayName}
                      className="text-[10px] sm:text-xs font-bold py-1.5 sm:py-2 px-0.5 sm:px-1 text-center uppercase tracking-wider rounded-xl transition-colors shadow-2xs bg-sidebar text-white border border-sidebar-border/60"
                    >
                      {dayName}
                    </div>
                  )
                )}
              </div>

              {/* 7-column Days Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2.5">
                {monthDays.map((day, idx) => {
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isDayToday = isToday(day);
                  const isWeekend = idx % 7 === 0 || idx % 7 === 6;
                  const isSelected = isSameDay(day, selectedDate);

                  // Find bookings for this day
                  const dayEvents = approvedBookings.filter((b) =>
                    isSameDay(toJsDate(b.start), day)
                  );

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedDate(day);
                      }}
                      className={cn(
                        "p-1 sm:p-2.5 rounded-xl sm:rounded-2xl border transition-all duration-200 flex flex-col justify-start group relative cursor-pointer",
                        "min-h-[58px] sm:min-h-[135px]",
                        isCurrentMonth
                          ? isSelected
                            ? "bg-sidebar/10 dark:bg-sky-950/40 border-sidebar dark:border-sky-500 ring-2 ring-sidebar/30 shadow-sm"
                            : isDayToday
                            ? "bg-white dark:bg-card border-sidebar/50 dark:border-blue-500/60 ring-1 ring-sidebar/20 shadow-xs"
                            : isWeekend
                            ? "bg-slate-50/60 dark:bg-muted/20 border-slate-200/80 dark:border-border/70 shadow-2xs hover:border-sidebar/40"
                            : "bg-white dark:bg-card border-slate-200/80 dark:border-border/70 shadow-2xs hover:border-sidebar/40"
                          : "bg-slate-50/30 dark:bg-muted/10 border-slate-100 dark:border-border/30 text-slate-400 dark:text-slate-600 opacity-60"
                      )}
                    >
                      {/* Top Header: Day Number */}
                      <div className="flex items-center justify-between mb-0.5 sm:mb-1 w-full">
                        {isDayToday ? (
                          <div className="flex items-center gap-1">
                            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-sidebar text-white flex items-center justify-center text-[10px] sm:text-xs font-black shadow-xs shrink-0">
                              {format(day, "d")}
                            </span>
                            <span className="text-[10px] font-bold text-sidebar uppercase tracking-tight hidden md:inline-block">
                              Today
                            </span>
                          </div>
                        ) : (
                          <span
                            className={cn(
                              "text-[11px] sm:text-xs font-bold px-0.5 transition-colors",
                              isSelected
                                ? "text-sidebar dark:text-sky-400 font-extrabold"
                                : isCurrentMonth
                                ? "text-slate-700 dark:text-slate-200 group-hover:text-sidebar"
                                : "text-slate-400 dark:text-slate-600"
                            )}
                          >
                            {format(day, "d")}
                          </span>
                        )}
                      </div>

                      {/* ── MOBILE: Event dots indicator (clean & compact, no cramped text) ── */}
                      <div className="md:hidden flex items-center justify-center gap-1 mt-auto pt-1 pb-0.5">
                        {dayEvents.slice(0, 3).map((booking, bIdx) => {
                          const color = EVENT_COLORS[bIdx % EVENT_COLORS.length];
                          return (
                            <span
                              key={booking.id}
                              className={cn("w-1.5 h-1.5 rounded-full shadow-2xs", color.border.replace("border-l-", "bg-"))}
                            />
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <span className="text-[8px] font-bold text-slate-500 leading-none">+</span>
                        )}
                      </div>

                      {/* ── DESKTOP: Full Time & Room event pills ── */}
                      <div className="hidden md:block w-full space-y-1 overflow-y-auto max-h-[100px] pr-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mt-1">
                        {dayEvents.slice(0, 3).map((booking, bIdx) => {
                          const room = rooms?.find((r) => r.id === booking.roomId);
                          const color = EVENT_COLORS[bIdx % EVENT_COLORS.length];
                          const startTime = toJsDate(booking.start);

                          return (
                            <div
                              key={booking.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBookingClick(booking);
                              }}
                              className={cn(
                                "border-l-[3px] rounded-lg py-1 px-1.5 text-[10px] font-semibold truncate cursor-pointer hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-1 shadow-2xs",
                                color.bg,
                                color.text,
                                color.border
                              )}
                              title={`${booking.title} - ${room?.name || "Room"} (${format(startTime, "h:mm a")})`}
                            >
                              <span className="font-bold shrink-0">
                                {format(startTime, "h:mm a")}
                              </span>
                              <span className="truncate">
                                {room?.name || booking.title}
                              </span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 pl-1">
                            +{dayEvents.length - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── MOBILE: Selected Day Agenda Section (Apple/Google Calendar Style) ── */}
              <div className="md:hidden bg-card rounded-2xl border border-border/60 p-4 shadow-card-dark space-y-3 animate-in fade-in duration-300 mt-2">
                <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-sidebar/10 text-sidebar dark:text-sky-400 flex items-center justify-center font-black text-sm border border-sidebar/20">
                      {format(selectedDate, "d")}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-foreground">
                        {format(selectedDate, "EEEE, MMMM d, yyyy")}
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedDayBookings.length} {selectedDayBookings.length === 1 ? "reservation" : "reservations"}
                      </p>
                    </div>
                  </div>
                  {isToday(selectedDate) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sidebar/10 text-sidebar dark:text-sky-300 border border-sidebar/20">
                      Today
                    </span>
                  )}
                </div>

                {selectedDayBookings.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground italic flex flex-col items-center gap-1.5">
                    <Calendar className="w-6 h-6 opacity-40 text-muted-foreground" />
                    <span>No reservations scheduled for this date.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDayBookings.map((booking, bIdx) => {
                      const room = rooms?.find((r) => r.id === booking.roomId);
                      const color = EVENT_COLORS[bIdx % EVENT_COLORS.length];
                      const startTime = toJsDate(booking.start);
                      const endTime = toJsDate(booking.end);
                      const requesterName = booking.name || (booking as any)?.worker?.firstName || (booking as any)?.workerName || "User";

                      return (
                        <div
                          key={booking.id}
                          onClick={() => handleBookingClick(booking)}
                          className={cn(
                            "p-3 rounded-xl border-l-[4px] cursor-pointer hover:opacity-90 active:scale-98 transition-all flex flex-col gap-1.5 shadow-2xs",
                            color.bg,
                            color.text,
                            color.border
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold leading-snug">{booking.title}</p>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/80 dark:bg-black/40 whitespace-nowrap shadow-2xs">
                              {format(startTime, "h:mm a")} – {format(endTime, "h:mm a")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] opacity-85">
                            <span className="font-semibold flex items-center gap-1">
                              📍 {room?.name || "Room"}
                            </span>
                            <span className="text-[10px]">{requesterName}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : viewMode === "week" ? (
            /* Week view */
            <div>
              {/* ── MOBILE: vertical day-by-day list ── */}
              <div className="lg:hidden space-y-3">
                {weekDays.map((day, dIdx) => {
                  const isDayToday = isToday(day);
                  const dayEvents = approvedBookings.filter((b) =>
                    isSameDay(toJsDate(b.start), day)
                  ).sort((a, b) => toJsDate(a.start).getTime() - toJsDate(b.start).getTime());

                  return (
                    <div key={day.toISOString()} className="rounded-xl border border-gray-200 dark:border-border overflow-hidden">
                      {/* Day header */}
                      <div className="px-4 py-2.5 border-b border-sidebar-border/60 flex items-center gap-3 bg-sidebar text-white">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0",
                          isDayToday ? "bg-white text-sidebar shadow-xs" : "bg-white/15 text-white"
                        )}>
                          {format(day, "d")}
                        </div>
                        <div>
                          <p className="text-xs font-extrabold uppercase tracking-wider text-white">
                            {format(day, "EEEE")}
                          </p>
                          <p className="text-[11px] text-blue-100/80">{format(day, "MMMM d, yyyy")}</p>
                        </div>
                        {dayEvents.length > 0 && (
                          <span className="ml-auto text-[11px] font-bold text-sidebar bg-white px-2 py-0.5 rounded-full shadow-2xs">
                            {dayEvents.length} event{dayEvents.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      {/* Events */}
                      {dayEvents.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 italic">No events</div>
                      ) : (
                        <div className="divide-y divide-gray-100 dark:divide-border">
                          {dayEvents.map((booking, bIdx) => {
                            const room = rooms?.find((r) => r.id === booking.roomId);
                            const color = EVENT_COLORS[bIdx % EVENT_COLORS.length];
                            const startTime = toJsDate(booking.start);
                            const endTime = toJsDate(booking.end);
                            return (
                              <div
                                key={booking.id}
                                onClick={() => handleBookingClick(booking)}
                                className={cn("px-4 py-3 flex items-center justify-between gap-3 cursor-pointer border-l-[3px] hover:opacity-90 transition-all", color.bg, color.text, color.border)}
                              >
                                <div>
                                  <p className="text-xs font-bold leading-snug">{booking.title}</p>
                                  <p className="text-[11px] opacity-75 mt-0.5">{room?.name || "Room"}</p>
                                </div>
                                <div className="text-right shrink-0 text-[11px] font-semibold opacity-80 whitespace-nowrap">
                                  <p>{format(startTime, "h:mm a")} – {format(endTime, "h:mm a")}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── DESKTOP: original horizontal time grid ── */}
              <div className="hidden lg:block overflow-x-auto -mx-6">
                <div className="min-w-[760px] px-6">
                {/* Header Row: Days of the Week */}
                <div className="grid grid-cols-[80px_repeat(7,1fr)] bg-sidebar text-white border-b border-sidebar-border/60 sticky top-0 z-10 shadow-xs">
                  <div className="border-r border-white/15 py-3" />

                  {weekDays.map((day) => {
                    const isDayToday = isToday(day);

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "py-3 px-2 text-center border-r border-white/15 last:border-r-0 transition-colors flex flex-col items-center justify-center gap-0.5",
                          isDayToday ? "bg-white/15" : ""
                        )}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-100/90">
                          {format(day, "EEE")}
                        </p>
                        {isDayToday ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-7 h-7 rounded-full bg-white text-sidebar flex items-center justify-center text-xs font-black shadow-xs ring-2 ring-white/30">
                              {format(day, "d")}
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm font-bold mt-0.5 text-white">
                            {format(day, "d")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Hourly Rows (8 AM to 8 PM) */}
                {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(
                  (hour) => {
                    const hourLabel =
                      hour === 12
                        ? "12 PM"
                        : hour > 12
                          ? `${hour - 12} PM`
                          : `${hour} AM`;

                    return (
                      <div
                        key={hour}
                        className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-slate-100 dark:border-border/40 last:border-b-0 min-h-[58px] group/row"
                      >
                        {/* Time Label on left */}
                        <div className="border-r border-slate-200/70 dark:border-border/60 bg-slate-50/40 dark:bg-muted/10 text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center p-2 select-none">
                          {hourLabel}
                        </div>

                        {/* 7 Day Slot Cells */}
                        {weekDays.map((day, dIdx) => {
                          const isDayToday = isToday(day);
                          const isWeekend = dIdx === 0 || dIdx === 6;

                          const slotBookings = approvedBookings.filter((b) => {
                            const start = toJsDate(b.start);
                            return (
                              isSameDay(start, day) &&
                              start.getHours() === hour
                            );
                          });

                          return (
                            <div
                              key={dIdx}
                              className={cn(
                                "border-r border-slate-100 dark:border-border/40 last:border-r-0 p-1.5 relative flex flex-col justify-center gap-1.5 transition-colors",
                                isDayToday
                                  ? "bg-sidebar/[0.02] dark:bg-blue-950/10 hover:bg-sidebar/[0.06] dark:hover:bg-blue-950/20"
                                  : isWeekend
                                  ? "bg-slate-50/30 dark:bg-muted/5 hover:bg-slate-100/60 dark:hover:bg-muted/20"
                                  : "hover:bg-slate-50/80 dark:hover:bg-muted/30"
                              )}
                            >
                              {slotBookings.map((booking, bIdx) => {
                                const room = rooms?.find(
                                  (r) => r.id === booking.roomId
                                );
                                const color =
                                  EVENT_COLORS[bIdx % EVENT_COLORS.length];
                                const startTime = toJsDate(booking.start);
                                const endTime = toJsDate(booking.end);

                                return (
                                  <div
                                    key={booking.id}
                                    onClick={() =>
                                      handleBookingClick(booking)
                                    }
                                    className={cn(
                                      "w-full rounded-lg border-l-[3px] px-2 py-1 text-xs font-medium flex flex-col justify-center cursor-pointer hover:scale-[1.02] active:scale-95 transition-all truncate shadow-2xs",
                                      color.bg,
                                      color.text,
                                      color.border
                                    )}
                                    title={`${booking.title} - ${room?.name || "Room"} (${format(startTime, "h:mm a")} - ${format(endTime, "h:mm a")})`}
                                  >
                                    <span className="font-bold text-[10px] truncate leading-tight">
                                      {booking.title}
                                    </span>
                                    <div className="flex items-center justify-between gap-1 text-[9px] opacity-80 mt-0.5">
                                      <span className="truncate">{room?.name || "Room"}</span>
                                      <span className="shrink-0 font-medium">{format(startTime, "h:mm a")}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  }
                )}
              </div>
              </div>
            </div>
          ) : (
            /* Day View — vertical room list on mobile, grid on desktop */
            <div>
              {/* ── MOBILE: vertical list of rooms with their bookings (Image 2 style) ── */}
              <div className="lg:hidden space-y-3">
                {dayRooms.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">No rooms found.</p>
                ) : (
                  dayRooms.map((room) => {
                    const area = areas?.find((a) => a.id === room.areaId);
                    const roomBookings = approvedBookings
                      .filter((b) =>
                        b.roomId === room.id &&
                        isSameDay(toJsDate(b.start), currentDate)
                      )
                      .sort((a, b) => toJsDate(a.start).getTime() - toJsDate(b.start).getTime());

                    if (roomBookings.length === 0) {
                      const isMaintenance = room.status === 'Maintenance';
                      return (
                        <div key={room.id} className="rounded-xl border border-gray-200 dark:border-border overflow-hidden bg-card shadow-2xs">
                          <div className="bg-gray-50/80 dark:bg-muted/40 px-4 py-2.5 border-b border-gray-100 dark:border-border/50 flex items-center justify-between">
                            <p className="text-xs font-bold text-gray-700 dark:text-gray-200">{room.name}</p>
                            {isMaintenance ? (
                              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-full">
                                Maintenance
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">Available</span>
                            )}
                          </div>
                          <div className="px-4 py-3 text-xs text-muted-foreground italic flex items-center gap-2">
                            <span>{isMaintenance ? "Room is currently under maintenance" : "No reservations today"}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={room.id} className="space-y-3">
                        {roomBookings.map((booking) => {
                          const worker = workers?.find((w) => w.id === booking.workerProfileId);
                          const workerMinistry = ministries?.find(
                            (m) => m.id === worker?.majorMinistryId || m.id === (booking as any)?.ministryId
                          );
                          const ministryName = workerMinistry?.name || (booking as any)?.ministry?.name || (booking as any)?.department || "Whitelight";
                          const startTime = toJsDate(booking.start);
                          const endTime = toJsDate(booking.end);
                          const createdDate = booking.dateRequested || (booking as any)?.createdAt
                            ? toJsDate(booking.dateRequested || (booking as any)?.createdAt)
                            : startTime;
                          const requesterName = worker
                            ? `${worker.firstName} ${worker.lastName}`
                            : booking.name || (booking as any)?.workerName || "User";
                          const initials = getInitials(requesterName);
                          const reqId = booking.requestId || (booking.id ? `REQ-${booking.id.slice(-4).toUpperCase()}` : "REQ-1000");
                          const isApproved = booking.status === "Approved";
                          const isPending = booking.status?.toLowerCase().startsWith("pending");

                          return (
                            <div
                              key={booking.id}
                              className="rounded-2xl border border-gray-200 dark:border-border overflow-hidden bg-card shadow-card-dark transition-all"
                            >
                              {/* Blue Header: REQ ID + Actions */}
                              <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-sidebar text-white">
                                <span className="text-xs font-mono font-bold text-white tracking-wide">
                                  {reqId}
                                </span>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="p-1 rounded-lg hover:bg-white/10 text-white/90 hover:text-white transition-colors cursor-pointer"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-card-dark">
                                    <DropdownMenuItem
                                      onClick={() => handleBookingClick(booking)}
                                      className="text-xs cursor-pointer font-medium gap-2"
                                    >
                                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                      View Details
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              {/* Card Body */}
                              <div className="p-4 space-y-3">
                                {/* Requester info row */}
                                <div className="flex items-start justify-between gap-2.5">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-full bg-sidebar/10 text-sidebar dark:bg-sidebar/30 dark:text-sky-300 font-bold text-xs flex items-center justify-center shrink-0">
                                      {initials}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-foreground leading-tight truncate">
                                        {requesterName}
                                      </p>
                                      <p className="text-[11px] text-muted-foreground font-medium mt-0.5 truncate">
                                        {ministryName}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {isApproved ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        Approved
                                      </span>
                                    ) : isPending ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                        Pending
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                        {booking.status || "Scheduled"}
                                      </span>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleBookingClick(booking)}
                                      className="text-xs font-bold text-primary hover:underline px-1 py-0.5 cursor-pointer"
                                    >
                                      Details
                                    </button>
                                  </div>
                                </div>

                                {/* Title line: "Title" for room: RoomName */}
                                <div>
                                  <p className="text-sm font-bold text-foreground leading-snug">
                                    &ldquo;{booking.title}&rdquo; for room: {room.name}
                                  </p>
                                  {booking.purpose && booking.purpose !== booking.title && (
                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                      {booking.purpose}
                                    </p>
                                  )}
                                </div>

                                {/* 2x2 Info Grid Box (Matching Image 2) */}
                                <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-muted/20 border border-slate-200/80 dark:border-border/60 grid grid-cols-2 gap-3.5 text-xs shadow-2xs">
                                  <div className="space-y-0.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                      ROOM
                                    </span>
                                    <span className="font-bold text-foreground text-xs block truncate">
                                      {room.name}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground block truncate">
                                      {area?.name || "First Floor"}
                                    </span>
                                  </div>

                                  <div className="space-y-0.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                      DATE & TIME
                                    </span>
                                    <span className="font-bold text-foreground text-xs block truncate">
                                      {format(startTime, "MMM d, yyyy")}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground block truncate">
                                      {format(startTime, "h:mm a")} – {format(endTime, "h:mm a")}
                                    </span>
                                  </div>

                                  <div className="space-y-0.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                      MINISTRY
                                    </span>
                                    <span className="font-bold text-foreground text-xs block truncate">
                                      {ministryName}
                                    </span>
                                  </div>

                                  <div className="space-y-0.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                      CREATED
                                    </span>
                                    <span className="font-bold text-foreground text-xs block truncate">
                                      {format(createdDate, "MMM d, yyyy")}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>

              {/* ── DESKTOP: horizontal grid ── */}
              <div className="hidden lg:block overflow-x-scroll -m-5 sm:-m-6">
                <div style={{ minWidth: `${Math.max(760, dayRooms.length * 150 + 80)}px` }}>
                  <div className="grid bg-sidebar text-white border-b border-sidebar-border/60 sticky top-0 z-10 shadow-xs" style={{ gridTemplateColumns: `80px repeat(${Math.max(1, dayRooms.length)}, minmax(140px, 1fr))` }}>
                    <div className="border-r border-white/15 py-3" />
                    {dayRooms.map((room) => {
                      const area = areas?.find((a) => a.id === room.areaId);
                      const roomDayBookings = approvedBookings.filter(
                        (b) =>
                          b.roomId === room.id &&
                          isSameDay(toJsDate(b.start), currentDate)
                      );
                      const isMaintenance = room.status === 'Maintenance';
                      const isAvailable = !isMaintenance && roomDayBookings.length === 0;

                      return (
                        <div
                          key={room.id}
                          className="py-3 px-3 text-center border-r border-white/15 last:border-r-0 flex flex-col items-center justify-center gap-0.5"
                        >
                          <div className="flex items-center gap-1.5 max-w-full justify-center">
                            <span
                              className={cn(
                                "w-2 h-2 rounded-full shrink-0",
                                isMaintenance
                                  ? "bg-amber-400 ring-1 ring-amber-300"
                                  : isAvailable
                                  ? "bg-emerald-400"
                                  : "bg-sky-300 ring-1 ring-white/30"
                              )}
                              title={
                                isMaintenance
                                  ? "Room under maintenance"
                                  : isAvailable
                                  ? "Available today"
                                  : `${roomDayBookings.length} reservation(s) today`
                              }
                            />
                            <p className="text-xs font-bold text-white truncate">
                              {room.name}
                            </p>
                          </div>
                          {isMaintenance ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-400/25 text-amber-200 border border-amber-400/40 tracking-wider uppercase">
                              Maintenance
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 text-[10px] text-blue-100/75 truncate font-medium">
                              {area && <span className="truncate">{area.name}</span>}
                              {area && room.capacity > 0 && <span>•</span>}
                              {room.capacity > 0 && <span>{room.capacity} pax</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((hour) => {
                    const hourLabel = hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
                    return (
                      <div key={hour} className="grid border-b border-slate-100 dark:border-border/40 last:border-b-0 min-h-[58px] group/row" style={{ gridTemplateColumns: `80px repeat(${Math.max(1, dayRooms.length)}, minmax(140px, 1fr))` }}>
                        <div className="border-r border-slate-200/70 dark:border-border/60 bg-slate-50/40 dark:bg-muted/10 text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center p-2 select-none">{hourLabel}</div>
                        {dayRooms.map((room) => {
                          const slotBookings = approvedBookings.filter((b) => {
                            const start = toJsDate(b.start);
                            return b.roomId === room.id && isSameDay(start, currentDate) && start.getHours() === hour;
                          });
                          return (
                            <div key={room.id} className="border-r border-slate-100 dark:border-border/40 last:border-r-0 p-1.5 relative flex flex-col justify-center gap-1 hover:bg-slate-50/80 dark:hover:bg-muted/30 transition-colors">
                              {slotBookings.map((booking, bIdx) => {
                                const worker = workers?.find((w) => w.id === booking.workerProfileId);
                                const startTime = toJsDate(booking.start);
                                const endTime = toJsDate(booking.end);
                                const requesterName = worker ? `${worker.firstName} ${worker.lastName}` : booking.name || "Requester";
                                const color = EVENT_COLORS[bIdx % EVENT_COLORS.length];

                                return (
                                  <div
                                    key={booking.id}
                                    onClick={() => handleBookingClick(booking)}
                                    className={cn(
                                      "w-full rounded-lg border-l-[3px] px-2 py-1.5 flex flex-col justify-center cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-2xs",
                                      color.bg,
                                      color.text,
                                      color.border
                                    )}
                                    title={`${booking.title} (${format(startTime, "h:mm a")} - ${format(endTime, "h:mm a")})`}
                                  >
                                    <span className="text-[11px] font-bold leading-tight truncate">{booking.title}</span>
                                    <div className="flex items-center justify-between gap-1 text-[9px] opacity-80 mt-0.5">
                                      <span className="truncate">{requesterName}</span>
                                      <span className="shrink-0 font-medium">{format(startTime, "h:mm a")}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Room Availability Section for Day view */}
        {viewMode === "day" && !isLoading && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">
                Room Availability
              </h3>
            </div>

            <div className="space-y-2.5">
              {dayRooms.map((room) => {
                const roomBookings = approvedBookings.filter(
                  (b) =>
                    b.roomId === room.id &&
                    isSameDay(toJsDate(b.start), currentDate)
                );
                const isAvailable = roomBookings.length === 0;

                return (
                  <div
                    key={room.id}
                    className="w-full bg-white dark:bg-card rounded-2xl border border-gray-200/80 dark:border-border p-4 px-6 flex items-center justify-between shadow-xs hover:border-gray-300 transition-all"
                  >
                    <span className="font-bold text-sm text-gray-800 dark:text-gray-100">
                      {room.name}
                    </span>

                    {isAvailable ? (
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        Available
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                        Reserved ({roomBookings.length} booking
                        {roomBookings.length > 1 ? "s" : ""})
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Reservation Details Sheet */}
      <ReservationDetailsSheet
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setPreviousDayEvents(null);
        }}
        onBack={
          previousDayEvents
            ? () => {
                setIsDetailsOpen(false);
                setSelectedDayEvents(previousDayEvents);
                setPreviousDayEvents(null);
              }
            : undefined
        }
        booking={selectedBooking}
        roomName={selectedBooking ? rooms?.find((r) => r.id === selectedBooking.roomId)?.name || "Unknown Room" : ""}
        areaName={selectedBooking ? areas?.find((a) => { const r = rooms?.find((rm) => rm.id === selectedBooking.roomId); return a.id === r?.areaId; })?.name || "First Floor" : ""}
        workers={workers || []}
        venueElements={venueElements || []}
        ministries={ministries || []}
        hideRequesterInfo={!isSuperAdmin && !canApproveRoomReservation}
      />

      {/* Mobile Multiple Events Day Dialog */}
      <Dialog
        open={!!selectedDayEvents}
        onOpenChange={(open) => !open && setSelectedDayEvents(null)}
      >
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md p-0 overflow-hidden rounded-2xl border-border/80 shadow-2xl gap-0">
          <DialogTitle className="sr-only">Day Schedule</DialogTitle>
          {selectedDayEvents && (
            <>
              <div className="p-4 sm:p-5 pr-12 border-b border-border/70 bg-card/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-sidebar/10 text-sidebar dark:text-blue-400 shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold font-headline text-foreground">
                      {format(selectedDayEvents.date, "EEEE, MMMM d, yyyy")}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {selectedDayEvents.bookings.length} reservations scheduled
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-3 max-h-[65vh] overflow-y-auto divide-y divide-border/40">
                {selectedDayEvents.bookings.map((booking, bIdx) => {
                  const room = rooms?.find((r) => r.id === booking.roomId);
                  const area = areas?.find((a) => a.id === room?.areaId);
                  const startTime = toJsDate(booking.start);
                  const endTime = toJsDate(booking.end);
                  const worker = workers?.find((w) => w.id === booking.workerProfileId);
                  const requesterName = worker ? `${worker.firstName} ${worker.lastName}` : booking.name || "Requester";
                  const color = EVENT_COLORS[bIdx % EVENT_COLORS.length];

                  return (
                    <div
                      key={booking.id}
                      className="pt-3 first:pt-0 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm text-foreground truncate">
                            {booking.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1 font-semibold text-sidebar dark:text-blue-400">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {format(startTime, "h:mm a")} – {format(endTime, "h:mm a")}
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{room?.name || "Room"}{area ? ` (${area.name})` : ""}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{requesterName}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPreviousDayEvents(selectedDayEvents);
                          setSelectedDayEvents(null);
                          handleBookingClick(booking, true);
                        }}
                        className="w-full h-8 text-xs font-semibold rounded-xl gap-1.5 cursor-pointer hover:bg-sidebar hover:text-white transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
