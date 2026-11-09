"use client";

import React, { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Button,
  Badge,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DatePicker,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Separator,
} from "@studio/ui";
import {
  Search,
  Calendar as CalendarIcon,
  MoreHorizontal,
  LoaderCircle,
  CheckCircle2,
  Tv,
  Mic,
  Speaker,
  ScanLine,
  Eye,
} from "lucide-react";
import { cn, toJsDate } from "@/lib/utils";
import { useUserRole } from "@/hooks/use-user-role";
import { useAuthStore } from "@studio/store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBookings,
  getRooms,
  getAreas,
  getVenueElements,
  getMinistries,
  updateBooking,
  createScanLog,
} from "@/actions/db";
import { format, isAfter, isBefore, isToday, subMinutes } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ReservationDetailsSheet } from "@/components/reservations/reservation-details-sheet";
import type { Booking, Room, Area, VenueElement, Ministry } from "@studio/types";

type TabFilter = "upcoming" | "active" | "history";

export default function MyReservationsPage() {
  const { user } = useAuthStore();
  const { workerProfile, isLoading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabFilter>("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Queries
  const { data: allBookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(),
    staleTime: 5_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  const { data: rooms } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => getRooms(),
  });

  const { data: areas } = useQuery({
    queryKey: ["areas"],
    queryFn: () => getAreas(),
  });

  const { data: venueElements } = useQuery({
    queryKey: ["venue-elements"],
    queryFn: () => getVenueElements(),
  });

  const { data: ministries } = useQuery({
    queryKey: ["ministries"],
    queryFn: () => getMinistries(),
  });

  const isLoading = (roleLoading || bookingsLoading) && !allBookings;

  // Filter bookings belonging to the current user
  const userBookings = useMemo(() => {
    if (!allBookings) return [];
    return (allBookings as any[]).filter((b: any) => {
      const matchesProfile =
        workerProfile && b.workerProfileId === workerProfile.id;
      const matchesEmail =
        user?.email &&
        (b.email === user.email || b.requesterEmail === user.email);
      return matchesProfile || matchesEmail;
    });
  }, [allBookings, workerProfile, user]);

  // Apply tab, search, date, and status filters
  const filteredBookings = useMemo(() => {
    let result = [...userBookings];
    const now = new Date();

    // Tab filter
    if (activeTab === "upcoming") {
      result = result.filter((b) => isAfter(toJsDate(b.start), now));
      result.sort(
        (a, b) => toJsDate(a.start).getTime() - toJsDate(b.start).getTime()
      );
    } else if (activeTab === "active") {
      result = result.filter((b) => {
        const start = toJsDate(b.start);
        const end = toJsDate(b.end);
        return isToday(start) || (isBefore(start, now) && isAfter(end, now));
      });
      result.sort(
        (a, b) => toJsDate(a.start).getTime() - toJsDate(b.start).getTime()
      );
    } else {
      // "history"
      result = result.filter((b) => isBefore(toJsDate(b.end), now));
      result.sort(
        (a, b) => toJsDate(b.start).getTime() - toJsDate(a.start).getTime()
      );
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((b) => {
        const room = rooms?.find((r) => r.id === b.roomId);
        const area = areas?.find(
          (a) => a.id === room?.areaId || a.areaId === room?.areaId
        );
        const reqId = b.requestId || `REQ-${b.id?.slice(0, 4)}`;

        return (
          reqId.toLowerCase().includes(q) ||
          b.title.toLowerCase().includes(q) ||
          b.purpose?.toLowerCase().includes(q) ||
          room?.name.toLowerCase().includes(q) ||
          area?.name.toLowerCase().includes(q)
        );
      });
    }

    // Specific Date filter
    if (dateFilter) {
      result = result.filter((b) => {
        const dStr = format(toJsDate(b.start), "yyyy-MM-dd");
        return dStr === dateFilter;
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((b) => {
        if (statusFilter === "Pending") {
          return b.status.toLowerCase().startsWith("pending");
        }
        return b.status.toLowerCase() === statusFilter.toLowerCase();
      });
    }

    return result;
  }, [
    userBookings,
    activeTab,
    searchQuery,
    dateFilter,
    statusFilter,
    rooms,
    areas,
  ]);

  const getRoom = (roomId: string) => {
    return (rooms as any[])?.find((r: any) => r.id === roomId);
  };

  const getArea = (areaId?: string) => {
    return (areas as any[])?.find(
      (a: any) => a.id === areaId || a.areaId === areaId
    );
  };

  const handleCheckIn = async (booking: any) => {
    if (!booking.id) return;

    try {
      await updateBooking(booking.id, { checkedInAt: new Date() });

      await createScanLog({
        scannerId: workerProfile?.id || "system-admin",
        scannerName: workerProfile
          ? `${workerProfile.firstName} ${workerProfile.lastName}`
          : "System Admin",
        scanType: "Room Check-in",
        details: `Self check-in for: ${booking.title}`,
        reservationId: booking.id,
        targetUserId: workerProfile?.id,
        targetUserName: workerProfile
          ? `${workerProfile.firstName} ${workerProfile.lastName}`
          : undefined,
      });

      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({
        title: "Checked In Successfully",
        description: `You have checked into ${getRoom(booking.roomId)?.name || "the room"}.`,
      });
    } catch (error) {
      console.error("Check-in error:", error);
      toast({
        variant: "destructive",
        title: "Check-in Failed",
        description: "Could not complete check-in. Please try again.",
      });
    }
  };

  const canCheckIn = (booking: any) => {
    if (booking.status !== "Approved" || booking.checkedInAt) return false;
    const now = new Date();
    const start = toJsDate(booking.start);
    const end = toJsDate(booking.end);
    const allowStart = subMinutes(start, 15);
    return isAfter(now, allowStart) && isBefore(now, end);
  };

  return (
    <AppLayout>
      <div className="w-full space-y-6 pb-12">
        {/* Header Section */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-headline text-gray-900 dark:text-white">
            My Reservations
          </h1>
          <p className="text-sm text-muted-foreground">
            Track your upcoming, active, and past room reservations.
          </p>
        </div>

        {/* Main Card Container */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card-dark p-5 sm:p-6 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Top Controls Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
            {/* Left: Search Bar */}
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search ID, room, purpose..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 h-10 text-xs font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 border border-slate-200/90 dark:border-border rounded-2xl bg-background dark:bg-muted/30 shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar w-full transition-all"
              />
            </div>

            {/* Right: Tab Switcher Pills (Upcoming container), Status Filter, Date Picker */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
              {/* Tab Switcher Pills */}
              <div className="w-full sm:w-auto bg-slate-100/90 dark:bg-muted p-1 rounded-xl grid grid-cols-3 items-center border border-slate-200/70 dark:border-border/50 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("upcoming")}
                  className={cn(
                    "w-full text-center px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                    activeTab === "upcoming"
                      ? "bg-sidebar text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground"
                  )}
                >
                  Upcoming
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("active")}
                  className={cn(
                    "w-full text-center px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                    activeTab === "active"
                      ? "bg-sidebar text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground"
                  )}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className={cn(
                    "w-full text-center px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                    activeTab === "history"
                      ? "bg-sidebar text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground"
                  )}
                >
                  History
                </button>
              </div>

              {/* Status Select & Date Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 flex-1 sm:w-[130px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-background dark:bg-muted/30 font-medium shadow-2xs px-3">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      All Statuses
                    </SelectItem>
                    <SelectItem value="Approved" className="text-xs">
                      Approved
                    </SelectItem>
                    <SelectItem value="Pending" className="text-xs">
                      Pending
                    </SelectItem>
                    <SelectItem value="Rejected" className="text-xs">
                      Rejected
                    </SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex-1 sm:flex-initial">
                  <DatePicker
                    value={dateFilter}
                    onChange={setDateFilter}
                    align="start"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Table Content */}
          <div className="border border-border/60 rounded-2xl mt-5 overflow-hidden">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Loading your reservations...
                </p>
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                <p className="text-sm font-semibold text-foreground">No reservations found.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You have no {activeTab} reservations matching your search.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 text-xs rounded-xl"
                  onClick={() => (window.location.href = "/reservations/new")}
                >
                  Reserve a Room
                </Button>
              </div>
            ) : (
              <div>
                {/* ── Mobile card view (Enhanced with Navy Top Header & 2x2 Grid) ── */}
                <div className="md:hidden space-y-3 p-3 bg-muted/10">
                  {filteredBookings.map((booking) => {
                    const room = getRoom(booking.roomId);
                    const area = getArea(room?.areaId);
                    const startTime = toJsDate(booking.start);
                    const endTime = toJsDate(booking.end);
                    const reqId = booking.requestId || `REQ-${booking.id?.slice(0, 4)?.toUpperCase()}`;
                    const isApproved = booking.status === "Approved";
                    const isPending = booking.status?.toLowerCase().startsWith("pending");
                    const ministry = (ministries as any[])?.find(
                      (m: any) => m.id === booking.ministryId || m.name === booking.ministry
                    );
                    const ministryName = ministry?.name || booking.ministry || "Whitelight";
                    const requesterName =
                      booking.requesterName ||
                      booking.userName ||
                      (workerProfile ? `${workerProfile.firstName} ${workerProfile.lastName}` : "Worship Worker");
                    const initials = requesterName
                      .trim()
                      .split(" ")
                      .map((n: string) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase() || "WW";
                    const createdDate = booking.createdAt ? toJsDate(booking.createdAt) : startTime;

                    return (
                      <div
                        key={booking.id}
                        className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs hover:border-primary/40 transition-all text-left"
                      >
                        {/* Navy Header: Checkbox + REQ ID + Actions */}
                        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-sidebar text-white">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded border border-white/40 flex items-center justify-center shrink-0" />
                            <span className="text-xs font-mono font-bold text-white tracking-wide">
                              {reqId}
                            </span>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="p-1 rounded-lg hover:bg-white/10 text-white/90 hover:text-white transition-colors cursor-pointer"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 p-1 rounded-xl shadow-lg border-border/80">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  setIsDetailsOpen(true);
                                }}
                                className="text-xs cursor-pointer font-medium gap-2 py-2 rounded-lg"
                              >
                                <Eye className="h-3.5 w-3.5 text-muted-foreground" /> View Details
                              </DropdownMenuItem>
                              {canCheckIn(booking) && (
                                <DropdownMenuItem
                                  onClick={() => handleCheckIn(booking)}
                                  className="text-xs cursor-pointer font-medium text-blue-600 dark:text-blue-400 gap-2 py-2 rounded-lg"
                                >
                                  <ScanLine className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Check In
                                </DropdownMenuItem>
                              )}
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
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  Pending
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  {booking.status}
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

                {/* ── Desktop table view ── */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-sidebar hover:bg-sidebar border-b border-sidebar-border/40">
                        <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-6 text-left w-[14%]">ID</TableHead>
                        <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-6 text-left w-[24%]">Floor / Room</TableHead>
                        <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-6 text-left w-[18%]">Date</TableHead>
                        <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-6 text-left w-[18%]">Time</TableHead>
                        <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-4 text-center w-[8%]">Pax</TableHead>
                        <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-6 text-center w-[10%]">Status</TableHead>
                        <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-6 pr-8 text-center w-[8%]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBookings.map((booking) => {
                        const room = getRoom(booking.roomId);
                        const area = getArea(room?.areaId);
                        const startTime = toJsDate(booking.start);
                        const endTime = toJsDate(booking.end);
                        const reqId = booking.requestId || `REQ-${booking.id?.slice(0, 4)}`;
                        const isApproved = booking.status === "Approved";
                        const isPending = booking.status?.toLowerCase().startsWith("pending");
                        return (
                          <TableRow key={booking.id} className="hover:bg-gray-50/60 dark:hover:bg-muted/30 border-b border-gray-100 dark:border-border/60 transition-colors">
                            <TableCell className="py-4 px-6 text-left align-middle font-medium text-xs text-gray-700 dark:text-gray-300 font-mono">{reqId}</TableCell>
                            <TableCell className="py-4 px-6 text-left align-middle">
                              <div>
                                <p className="text-xs text-muted-foreground font-medium">{area?.name || "5th Floor"},</p>
                                <p className="text-xs text-gray-800 dark:text-gray-200 font-semibold mt-0.5">{room?.name || "Sapphire"}</p>
                              </div>
                            </TableCell>
                            <TableCell className="py-4 px-6 text-left align-middle text-xs text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">{format(startTime, "MMMM d, yyyy")}</TableCell>
                            <TableCell className="py-4 px-6 text-left align-middle text-xs text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">{format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}</TableCell>
                            <TableCell className="py-4 px-4 text-center align-middle text-xs font-semibold text-gray-700 dark:text-gray-300">{booking.pax || 0}</TableCell>
                            <TableCell className="py-4 px-6 text-center align-middle">
                              {isApproved ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Approved</span>
                              ) : isPending ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Pending</span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />{booking.status}</span>
                              )}
                            </TableCell>
                            <TableCell className="py-4 px-6 pr-8 text-center align-middle">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button type="button" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 p-1 rounded-xl shadow-lg border-border/80">
                                  <DropdownMenuItem onClick={() => { setSelectedBooking(booking); setIsDetailsOpen(true); }} className="text-xs cursor-pointer font-medium gap-2 py-2 rounded-lg">
                                    <Eye className="h-3.5 w-3.5 text-muted-foreground" /> View Details
                                  </DropdownMenuItem>
                                  {canCheckIn(booking) && (
                                    <DropdownMenuItem onClick={() => handleCheckIn(booking)} className="text-xs cursor-pointer font-medium text-blue-600 dark:text-blue-400 gap-2 py-2 rounded-lg">
                                      <ScanLine className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Check In
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking Details Sheet */}
      <ReservationDetailsSheet
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        booking={selectedBooking}
        roomName={
          selectedBooking
            ? getRoom(selectedBooking.roomId)?.name || "Unknown Room"
            : ""
        }
        areaName={
          selectedBooking
            ? getArea(getRoom(selectedBooking.roomId)?.areaId)?.name ||
            "First Floor"
            : ""
        }
        venueElements={(venueElements as any[]) || []}
        ministries={(ministries as any[]) || []}
      />
    </AppLayout>
  );
}
