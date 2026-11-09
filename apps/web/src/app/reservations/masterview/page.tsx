"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Search,
  CheckCircle2,
  Tv,
  Mic,
  Speaker,
  LoaderCircle,
  MoreHorizontal,
  Eye,
} from "lucide-react";
import { format, isAfter, isBefore, startOfToday } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@studio/ui";
import { ReservationDetailsSheet } from "@/components/reservations/reservation-details-sheet";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Separator,
  Input,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@studio/ui";

const ITEMS_PER_PAGE = 6;

export default function MasterviewPage() {
  const { canViewScheduleMasterview, canApproveRoomReservation, workerProfile, isSuperAdmin, myMinistryIds, isLoading: roleLoading } = useUserRole();
  const router = useRouter();

  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"history" | "upcoming">("history");

  // Fetch live data directly from Database actions via React Query
  const { data: rooms, isLoading: roomsLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => getRooms(),
  });

  const { data: areas, isLoading: areasLoading } = useQuery({
    queryKey: ["areas"],
    queryFn: () => getAreas(),
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["bookings", "masterview"],
    queryFn: () => getBookings(),
    staleTime: 5_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  const { data: workers, isLoading: workersLoading } = useQuery({
    queryKey: ["workers", "masterview"],
    queryFn: () => getWorkers(),
    staleTime: 2 * 60_000,
  });

  const { data: venueElements, isLoading: venueElementsLoading } = useQuery({
    queryKey: ["venue-elements"],
    queryFn: () => getVenueElements(),
    staleTime: 5 * 60_000,
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

  const handleBookingClick = (booking: any) => {
    setSelectedBooking(booking);
    setIsDetailsOpen(true);
  };

  // Filter & process approved bookings
  const filteredBookings = useMemo(() => {
    if (!bookings) return [];

    let result = [...bookings]
      .filter((b) => b.status === "Approved")
      .sort(
        (a, b) => toJsDate(b.start).getTime() - toJsDate(a.start).getTime()
      );

    if (viewMode === "upcoming") {
      const today = startOfToday();
      result = result.filter((b) => isAfter(toJsDate(b.end), today));
      result.sort(
        (a, b) => toJsDate(a.start).getTime() - toJsDate(b.start).getTime()
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((b) => {
        const room = rooms?.find((r) => r.id === b.roomId);
        const area = areas?.find(
          (a) => a.id === room?.areaId || a.areaId === room?.areaId
        );
        const worker = workers?.find((w) => w.id === b.workerProfileId);
        const requesterName = worker
          ? `${worker.firstName} ${worker.lastName}`
          : b.name || "";

        return (
          b.title.toLowerCase().includes(query) ||
          b.purpose?.toLowerCase().includes(query) ||
          room?.name.toLowerCase().includes(query) ||
          area?.name.toLowerCase().includes(query) ||
          requesterName.toLowerCase().includes(query)
        );
      });
    }

    return result;
  }, [bookings, viewMode, searchQuery, rooms, areas, workers]);

  // Pagination calculation
  const totalRecords = filteredBookings.length;
  const totalPages = Math.ceil(totalRecords / ITEMS_PER_PAGE) || 1;

  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBookings.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBookings, currentPage]);

  // Calculate visible page numbers for pagination
  const visiblePageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 3;
    let startPage = Math.max(1, currentPage - 1);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages]);

  if (roleLoading) return null;
  if (!canViewScheduleMasterview) return null;

  return (
    <AppLayout>
      <div className="w-full space-y-6 pb-12">
        {/* Header Section */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">
            Schedule Masterview
          </h1>
          <p className="text-sm text-muted-foreground">
            Comprehensive reservation manifest and facility utilization.
          </p>
        </div>

        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Search Bar & View Mode Toggle Card */}
        <div className="bg-card rounded-2xl border border-border/60 p-4 shadow-none flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by title, purpose, or room..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 pr-4 text-xs font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 h-10 bg-background border border-slate-200/90 dark:border-border rounded-xl shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar w-full transition-all"
            />
          </div>

          <div className="flex items-center justify-end shrink-0">
            <div className="bg-slate-100/90 dark:bg-muted p-1 rounded-xl flex items-center border border-slate-200/70 dark:border-border/50 shadow-2xs w-full sm:w-auto">
              <button
                type="button"
                onClick={() => { setViewMode("history"); setCurrentPage(1); }}
                className={cn(
                  "flex-1 sm:flex-initial px-6 py-2 text-xs font-bold rounded-lg transition-all text-center cursor-pointer",
                  viewMode === "history"
                    ? "bg-sidebar text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground"
                )}
              >
                History
              </button>
              <button
                type="button"
                onClick={() => { setViewMode("upcoming"); setCurrentPage(1); }}
                className={cn(
                  "flex-1 sm:flex-initial px-6 py-2 text-xs font-bold rounded-lg transition-all text-center cursor-pointer",
                  viewMode === "upcoming"
                    ? "bg-sidebar text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground"
                )}
              >
                Upcoming
              </button>
            </div>
          </div>
        </div>

        {/* Table Container Card */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card-dark overflow-hidden flex flex-col min-h-[480px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3 flex-grow">
              <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading schedule records...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center flex-grow">
              <h3 className="text-lg font-semibold text-foreground">No Reservations Found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                No approved reservations match your current search criteria.
              </p>
            </div>
          ) : (
            <>
              {/* ── MOBILE CARD LIST (hidden on lg+) ── */}
              <div className="flex flex-col space-y-3 p-3 bg-muted/10 lg:hidden flex-grow">
                {paginatedBookings.map((booking) => {
                  const room = rooms?.find((r) => r.id === booking.roomId);
                  const area = areas?.find(
                    (a) => a.id === room?.areaId || a.areaId === room?.areaId
                  );
                  const startTime = toJsDate(booking.start);
                  const endTime = toJsDate(booking.end);
                  const b = booking as any;
                  const reqId = b.requestId || `REQ-${booking.id?.slice(0, 4)?.toUpperCase()}`;
                  const isApproved = booking.status === "Approved";
                  const isPending = booking.status?.toLowerCase().startsWith("pending");
                  const requesterName = booking.worker
                    ? `${booking.worker.firstName} ${booking.worker.lastName}`
                    : b.requesterName || b.userName || "User";
                  const ministry = (ministries as any[])?.find(
                    (m: any) => m.id === booking.ministryId || m.name === b.ministry
                  );
                  const ministryName = ministry?.name || b.ministry || "Ministry";
                  const initials = requesterName
                    .trim()
                    .split(" ")
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase() || "WW";
                  const createdDate = b.createdAt ? toJsDate(b.createdAt) : startTime;

                  return (
                    <div
                      key={booking.id}
                      className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs hover:border-primary/40 transition-all text-left"
                    >
                      {/* Navy Header: REQ ID + Actions */}
                      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-sidebar text-white">
                        <span className="text-xs font-mono font-bold text-white tracking-wide">
                          {reqId}
                        </span>

                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-1 rounded-lg hover:bg-white/10 active:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer"
                              aria-label="Actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 p-1 rounded-xl shadow-lg border-border/80 bg-popover text-popover-foreground">
                            <DropdownMenuItem
                              onSelect={() => handleBookingClick(booking)}
                              onClick={() => handleBookingClick(booking)}
                              className="text-xs cursor-pointer font-medium gap-2 py-2 rounded-lg"
                            >
                              <Eye className="h-3.5 w-3.5 text-muted-foreground" /> View Details
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

                          <div className="shrink-0">
                            {isApproved ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Approved
                              </span>
                            ) : isPending ? (
                              booking.status === "Pending Ministry Approval" || (booking.status as string) === "Pending Ministry Head" ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                  Pending Ministry Head
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  {booking.status === "Pending Admin Approval" ? "Pending Admin Approval" : "Pending"}
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                {booking.status || "Scheduled"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Purpose / Title */}
                        <div>
                          <p className="text-sm font-bold text-foreground leading-snug">
                            {booking.title || booking.purpose || "Room Reservation"}
                          </p>
                          {booking.purpose && booking.purpose !== booking.title && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {booking.purpose}
                            </p>
                          )}
                        </div>

                        {/* 2x2 Info Grid Box */}
                        <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-muted/20 border border-slate-200/80 dark:border-border/60 grid grid-cols-2 gap-3.5 text-xs shadow-2xs">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                              ROOM
                            </span>
                            <span className="font-bold text-foreground text-xs block truncate">
                              {room?.name || "Room"}
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

              {/* ── DESKTOP TABLE (hidden on mobile) ── */}
              <div className="hidden lg:block overflow-x-auto flex-grow">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-sidebar hover:bg-sidebar border-b border-sidebar-border/40">
                      <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-8 text-left w-[24%]">
                        Venue
                      </TableHead>
                      <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-6 text-left w-[26%]">
                        Date & Time
                      </TableHead>
                      <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-6 text-left w-[26%]">
                        Event Details
                      </TableHead>
                      <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-6 text-center w-[18%]">
                        Requirements
                      </TableHead>
                      <TableHead className="bg-sidebar w-[6%] h-11 px-6" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedBookings.map((booking) => {
                      const room = rooms?.find((r) => r.id === booking.roomId);
                      const area = areas?.find(
                        (a) => a.id === room?.areaId || a.areaId === room?.areaId
                      );
                      const startTime = toJsDate(booking.start);
                      const endTime = toJsDate(booking.end);

                      const hasEquipment =
                        booking.equipment_TV ||
                        booking.equipment_Mic ||
                        booking.equipment_Speakers;
                      const hasRequestedElements =
                        booking.requestedElements &&
                        booking.requestedElements.length > 0;

                      return (
                        <TableRow
                          key={booking.id}
                          className="hover:bg-muted/20 border-b border-border/40 transition-colors"
                        >
                          {/* Venue */}
                          <TableCell className="py-4 px-8 align-middle">
                            <p className="font-bold text-sm text-foreground leading-snug">
                              {room?.name || "Unassigned Room"}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {area?.name || "First Floor"}
                            </p>
                          </TableCell>

                          {/* Date & Time */}
                          <TableCell className="py-4 px-6 align-middle">
                            <p className="font-bold text-sm text-foreground leading-snug">
                              {format(startTime, "MMMM d, yyyy")}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {format(startTime, "h:mm a")} – {format(endTime, "h:mm a")}
                            </p>
                          </TableCell>

                          {/* Event Details */}
                          <TableCell className="py-4 px-6 align-middle">
                            <p className="font-bold text-sm text-foreground leading-snug">
                              {booking.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                              {booking.purpose || "Meeting"}
                            </p>
                          </TableCell>

                          {/* Requirements */}
                          <TableCell className="py-4 px-6 align-middle text-center">
                            {hasRequestedElements ? (
                              <div className="flex flex-wrap gap-1 justify-center max-w-[180px] mx-auto">
                                {booking.requestedElements.map((elId: string) => {
                                  const el = venueElements?.find((v) => v.id === elId);
                                  return (
                                    <Badge
                                      key={elId}
                                      variant="outline"
                                      className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 rounded-md"
                                    >
                                      {el ? el.name : elId}
                                    </Badge>
                                  );
                                })}
                              </div>
                            ) : hasEquipment ? (
                              <div className="flex flex-wrap gap-1 justify-center max-w-[180px] mx-auto">
                                {booking.equipment_TV && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800 rounded-md">
                                    TV
                                  </Badge>
                                )}
                                {booking.equipment_Mic && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 rounded-md">
                                    Mic
                                  </Badge>
                                )}
                                {booking.equipment_Speakers && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800 rounded-md">
                                    Audio
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">None</span>
                            )}
                          </TableCell>

                          {/* Info Button */}
                          <TableCell className="py-4 px-6 align-middle text-right">
                            <button
                              type="button"
                              onClick={() => handleBookingClick(booking)}
                              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted"
                              title="View details"
                            >
                              <Info className="h-4 w-4 stroke-[1.75]" />
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {/* end desktop table */}
              
              {/* Pagination Footer */}
              <div className="mt-auto p-4 px-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">
                  Showing{" "}
                  {totalRecords > 0
                    ? `${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, totalRecords)}`
                    : "0"}{" "}
                  of {totalRecords} records
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-2xs"
                  >
                    <ChevronLeft className="h-4 w-4 stroke-[2.25]" />
                  </button>

                  {visiblePageNumbers.map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "h-8 w-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-all",
                        currentPage === page
                          ? "bg-[#f4f4f7] text-neutral-800 font-bold dark:bg-neutral-800 dark:text-neutral-100"
                          : "border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 shadow-2xs"
                      )}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-2xs"
                  >
                    <ChevronRight className="h-4 w-4 stroke-[2.25]" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        </div>
      </div>

      {/* Booking Details Sheet (View Only) */}
      <ReservationDetailsSheet
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        booking={selectedBooking}
        roomName={
          selectedBooking
            ? rooms?.find((r) => r.id === selectedBooking.roomId)?.name ||
              "Unknown Room"
            : ""
        }
        areaName={
          selectedBooking
            ? areas?.find((a) => {
                const r = rooms?.find((rm) => rm.id === selectedBooking.roomId);
                return a.id === r?.areaId || a.areaId === r?.areaId;
              })?.name || "First Floor"
            : ""
        }
        workers={workers || []}
        venueElements={venueElements || []}
        ministries={ministries || []}
        hideRequesterInfo={!isSuperAdmin && !canApproveRoomReservation}
      />
    </AppLayout>
  );
}
