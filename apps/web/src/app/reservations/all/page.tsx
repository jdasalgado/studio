"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
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
  SelectGroup,
  SelectLabel,
  DatePicker,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Checkbox,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@studio/ui";
import {
  Search,
  Calendar as CalendarIcon,
  Filter,
  MoreHorizontal,
  LoaderCircle,
  Check,
  X,
  Trash2,
  CheckCircle2,
  Tv,
  Mic,
  Speaker,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  CalendarDays,
  User,
  MapPin,
  Users,
  Eye,
} from "lucide-react";
import { cn, toJsDate } from "@/lib/utils";
import { useUserRole } from "@/hooks/use-user-role";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBookings,
  getRooms,
  getAreas,
  getVenueElements,
  getMinistries,
  getWorkers,
  updateBooking,
  deleteBooking,
} from "@/actions/db";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ReservationDetailsSheet } from "@/components/reservations/reservation-details-sheet";
import { DeleteConfirmationDialog } from "@/components/common/delete-confirmation-dialog";
import type { Booking, Room, Area, VenueElement, Ministry, Worker } from "@studio/types";

// ── WORDA Department Matrix ───────────────────────────────────────────────────
export const WORDA_MINISTRIES_BY_DEPT = {
  Worship: ["whitelight", "dance", "pmt", "crusade", "singers", "musicians", "audio"],
  Outreach: ["cluster 1", "cluster 2", "cluster 3", "cluster 4", "cluster 5", "cluster 6", "cluster 7", "cluster 8", "cluster 9", "weyj", "tapat"],
  Relationship: ["sports", "gem", "ushering", "mens", "ladies", "youth empowered", "young adults", "worker"],
  Discipleship: ["j12", "oneliner", "cldp", "kid", "children's ministry", "life institute", "kca"],
  Administration: ["general", "arts", "engineering", "finance", "in house", "linkages", "security and shuttle", "technology", "ventures"],
};

export type WordaDepartment = keyof typeof WORDA_MINISTRIES_BY_DEPT;

export function getWorkerDepartment(
  workerProfile: any,
  allMinistries: any[],
  userRoleDept?: string
): WordaDepartment {
  const direct = (workerProfile?.department || workerProfile?.departmentCode || userRoleDept || "").toLowerCase();
  if (direct.includes("worship") || direct === "w") return "Worship";
  if (direct.includes("outreach") || direct === "o") return "Outreach";
  if (direct.includes("relationship") || direct === "r") return "Relationship";
  if (direct.includes("discipleship") || direct === "d") return "Discipleship";
  if (direct.includes("administration") || direct === "a") return "Administration";

  const userMinistries = (allMinistries || []).filter(
    (m: any) =>
      m.headId === workerProfile?.id ||
      m.approverId === workerProfile?.id ||
      m.id === workerProfile?.majorMinistryId ||
      m.id === workerProfile?.minorMinistryId ||
      (Array.isArray(workerProfile?.assignedMinistryIds) && workerProfile.assignedMinistryIds.includes(m.id))
  );

  for (const m of userMinistries) {
    const d = (m.department || m.departmentCode || "").toLowerCase();
    const name = (m.name || "").toLowerCase();
    if (d.includes("worship") || d === "w" || WORDA_MINISTRIES_BY_DEPT.Worship.some(k => name.includes(k))) return "Worship";
    if (d.includes("outreach") || d === "o" || WORDA_MINISTRIES_BY_DEPT.Outreach.some(k => name.includes(k))) return "Outreach";
    if (d.includes("relationship") || d === "r" || WORDA_MINISTRIES_BY_DEPT.Relationship.some(k => name.includes(k))) return "Relationship";
    if (d.includes("discipleship") || d === "d" || WORDA_MINISTRIES_BY_DEPT.Discipleship.some(k => name.includes(k))) return "Discipleship";
    if (d.includes("administration") || d === "a" || WORDA_MINISTRIES_BY_DEPT.Administration.some(k => name.includes(k))) return "Administration";
  }

  return "Outreach";
}

export function isBookingInDepartment(
  booking: any,
  deptName: WordaDepartment,
  allMinistries: any[],
  workers: any[]
): boolean {
  const worker = workers?.find((w: any) => w.id === booking.workerProfileId);
  const targetMinistryId = booking.ministryId || worker?.majorMinistryId;
  const ministry = targetMinistryId ? allMinistries?.find((m: any) => m.id === targetMinistryId) : null;

  const minName = (ministry?.name || "").toLowerCase().trim();
  const minDept = (typeof ministry?.department === 'string' ? ministry.department : ministry?.department?.name || ministry?.departmentCode || "").toLowerCase().trim();
  const targetDeptCode = deptName === "Worship" ? "w" : deptName === "Outreach" ? "o" : deptName === "Relationship" ? "r" : deptName === "Discipleship" ? "d" : "a";

  const deptKeywords = WORDA_MINISTRIES_BY_DEPT[deptName];
  if (deptKeywords.some(keyword => minName === keyword || minName.includes(keyword))) {
    return true;
  }

  if (minDept === deptName.toLowerCase() || minDept === targetDeptCode) {
    return true;
  }

  return false;
}

const ITEMS_PER_PAGE = 10;

export default function AllReservationsPage() {
  const { canApproveRoomReservation, workerProfile, isSuperAdmin, myMinistryIds, isLoading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [roomFilter, setRoomFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);

  // Queries
  const { data: allBookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["bookings", { actorId: workerProfile?.id, ministryIds: !isSuperAdmin ? myMinistryIds : undefined }],
    queryFn: () => getBookings({ actorId: workerProfile?.id, ministryIds: !isSuperAdmin ? myMinistryIds : undefined }),
    staleTime: 5_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  const { data: rooms } = useQuery({
    queryKey: ["rooms"],
    queryFn: getRooms,
  });

  const { data: areas } = useQuery({
    queryKey: ["areas"],
    queryFn: getAreas,
  });

  const { data: venueElements } = useQuery({
    queryKey: ["venue-elements"],
    queryFn: getVenueElements,
  });

  const { data: ministries } = useQuery({
    queryKey: ["ministries"],
    queryFn: getMinistries,
  });

  const { data: workers } = useQuery({
    queryKey: ["workers", { actorId: workerProfile?.id, ministryIds: !isSuperAdmin ? myMinistryIds : undefined }],
    queryFn: () => getWorkers({ actorId: workerProfile?.id, ministryIds: !isSuperAdmin ? myMinistryIds : undefined }),
  });

  const isLoading = (roleLoading || bookingsLoading) && !allBookings;

  const getRoom = (roomId: string) => {
    return (rooms as any[])?.find((r: any) => r.id === roomId);
  };

  const getArea = (areaId?: string) => {
    return (areas as any[])?.find(
      (a: any) => a.id === areaId || a.areaId === areaId
    );
  };

  const getRequesterName = (booking: any) => {
    const worker = workers?.find((w) => w.id === booking.workerProfileId);
    if (worker) return `${worker.firstName} ${worker.lastName}`;
    return booking.name || "System Admin";
  };

  const getInitials = (name: string) => {
    if (!name) return "SA";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Scoped bookings based on user role (Ministry Heads strictly see only their department's reservations)
  const scopedBookings = useMemo(() => {
    if (!allBookings) return [];
    const list = allBookings as any[];
    if (isSuperAdmin) return list;

    const effectiveDept = getWorkerDepartment(workerProfile, ministries || [], (workerProfile as any)?.department);
    return list.filter((b: any) => isBookingInDepartment(b, effectiveDept, ministries || [], workers || []));
  }, [allBookings, isSuperAdmin, workerProfile, ministries, workers]);

  // Stats calculation
  const stats = useMemo(() => {
    const list = scopedBookings;
    return {
      total: list.length,
      pending: list.filter((b) => b.status?.toLowerCase().startsWith("pending")).length,
      approved: list.filter((b) => b.status === "Approved").length,
      rejected: list.filter((b) => b.status === "Rejected").length,
    };
  }, [scopedBookings]);

  const filteredBookings = useMemo(() => {
    return scopedBookings
      .filter((b: any) => {
        const room = getRoom(b.roomId);
        const area = getArea(room?.areaId);
        const reqName = getRequesterName(b);
        const reqId = b.requestId || `REQ-${b.id?.slice(0, 4)}`;

        // Search Filter
        const q = searchTerm.toLowerCase().trim();
        const matchesSearch =
          !q ||
          reqId.toLowerCase().includes(q) ||
          reqName.toLowerCase().includes(q) ||
          b.title.toLowerCase().includes(q) ||
          (b.purpose && b.purpose.toLowerCase().includes(q)) ||
          (room && room.name.toLowerCase().includes(q)) ||
          (area && area.name.toLowerCase().includes(q));

        // Status Filter
        let matchesStatus = true;
        if (statusFilter !== "all") {
          if (statusFilter === "Pending") {
            matchesStatus = b.status?.toLowerCase().startsWith("pending");
          } else {
            matchesStatus =
              b.status?.toLowerCase() === statusFilter.toLowerCase();
          }
        }

        // Room/Floor Filter
        let matchesRoom = true;
        if (roomFilter !== "all") {
          matchesRoom = b.roomId === roomFilter || room?.areaId === roomFilter;
        }

        // Date Filter
        let matchesDate = true;
        if (dateFilter) {
          const dStr = format(toJsDate(b.start), "yyyy-MM-dd");
          matchesDate = dStr === dateFilter;
        }

        return matchesSearch && matchesStatus && matchesRoom && matchesDate;
      })
      .sort((a: any, b: any) => {
        const timeB = b.dateRequested ? new Date(b.dateRequested).getTime() : toJsDate(b.start).getTime();
        const timeA = a.dateRequested ? new Date(a.dateRequested).getTime() : toJsDate(a.start).getTime();
        return timeB - timeA;
      });
  }, [
    allBookings,
    searchTerm,
    statusFilter,
    roomFilter,
    dateFilter,
    rooms,
    areas,
    workers,
  ]);

  // Pagination calculation
  const totalRecords = filteredBookings.length;
  const totalPages = Math.ceil(totalRecords / ITEMS_PER_PAGE) || 1;

  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBookings.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBookings, currentPage]);

  const visiblePageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 4;
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

  // Handle Select All Checkbox (Current Page)
  const isAllCurrentPageSelected =
    paginatedBookings.length > 0 &&
    paginatedBookings.every((b) => selectedIds.includes(b.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pageIds = paginatedBookings.map((b) => b.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIds = paginatedBookings.map((b) => b.id);
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    }
  };

  // Handle Single Checkbox
  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchTerm("");
    setStatusFilter("Pending");
    setRoomFilter("all");
    setDateFilter("");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    statusFilter !== "Pending" ||
    roomFilter !== "all" ||
    dateFilter !== "";

  // Single Delete Trigger (Opens Dialog)
  const handleDeleteBooking = (bookingId: string) => {
    setDeleteBookingId(bookingId);
  };

  // Confirmed Single Delete
  const handleConfirmDeleteSingle = async () => {
    if (!deleteBookingId) return;
    const bookingId = deleteBookingId;
    setDeleteBookingId(null);
    setIsProcessing(true);
    try {
      await deleteBooking(bookingId, workerProfile?.id);
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setSelectedIds((prev) => prev.filter((id) => id !== bookingId));
      toast({
        title: "Reservation Deleted",
        description: "The reservation record has been permanently deleted.",
      });
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: error?.message || "Failed to delete reservation.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Batch Delete Trigger (Opens Dialog)
  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    setIsBatchDeleteOpen(true);
  };

  // Confirmed Batch Delete
  const handleConfirmBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBatchDeleteOpen(false);
    setIsProcessing(true);
    try {
      await Promise.all(selectedIds.map((id) => deleteBooking(id)));
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({
        title: "Reservations Deleted",
        description: `${selectedIds.length} reservation(s) deleted successfully.`,
      });
      setSelectedIds([]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Batch Delete Failed",
        description: error?.message || "Could not delete selected items.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (roleLoading || bookingsLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!canApproveRoomReservation) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto mt-20 bg-card p-6 rounded-2xl border border-border/60 shadow-card-dark text-center space-y-4">
          <XCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold font-headline">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            You do not have the required administrative permissions to access
            all reservations.
          </p>
          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => (window.location.href = "/dashboard")}
          >
            Return to Dashboard
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="w-full space-y-6 pb-12">
        {/* Header Section */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">
            All Reservations
          </h1>
          <p className="text-sm text-muted-foreground">
            Administrative manifest and approval management for all facility reservations.
          </p>
        </div>

        {/* Main Card Container */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card-dark p-5 sm:p-6 overflow-hidden flex flex-col min-h-[520px] animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Top Controls Row - Single Row Layout */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-1">
            {/* Left: Search input (reduced width to fit in single line) */}
            <div className="relative w-full lg:w-72 shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search ID, requester, room..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-8 h-10 text-xs font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 border border-slate-200/90 dark:border-border rounded-2xl bg-background dark:bg-muted/30 shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar w-full transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Right: Filter Controls (Responsive wrap on mobile, single row on sm+) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full lg:w-auto shrink-0">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="h-4 w-4 text-slate-400 hidden xl:block shrink-0 mr-0.5" />

                {/* Status Select */}
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 flex-1 sm:w-36 text-xs text-slate-700 dark:text-slate-200 font-medium rounded-2xl border-slate-200/90 dark:border-border bg-background dark:bg-muted/30 shadow-2xs px-3">
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

                {/* Floor / Room Select */}
                <Select
                  value={roomFilter}
                  onValueChange={(v) => {
                    setRoomFilter(v);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 flex-1 sm:w-40 text-xs text-slate-700 dark:text-slate-200 font-medium rounded-2xl border-slate-200/90 dark:border-border bg-background dark:bg-muted/30 shadow-2xs px-3">
                    <SelectValue placeholder="All Floor/Room" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="all" className="text-xs font-semibold">
                      All Floor/Room
                    </SelectItem>
                    {areas?.map((area) => {
                      const areaRooms = (rooms || []).filter(
                        (r) => r.areaId === area.id || r.areaId === area.areaId
                      );
                      return (
                        <SelectGroup key={area.id}>
                          <SelectLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-1.5 px-2 bg-slate-50 dark:bg-muted/40">
                            {area.name}
                          </SelectLabel>
                          {areaRooms.map((room) => (
                            <SelectItem
                              key={room.id}
                              value={room.id}
                              className="text-xs pl-4"
                            >
                              {room.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filter — drops below on mobile, inline on desktop */}
              <div className="w-full sm:w-36 shrink-0">
                <DatePicker
                  value={dateFilter}
                  onChange={(d) => {
                    setDateFilter(d);
                    setCurrentPage(1);
                  }}
                  className="w-full text-slate-700 dark:text-slate-200 font-medium"
                  align="start"
                />
              </div>
            </div>
          </div>

          {/* Batch Action Bar */}
          {selectedIds.length > 0 && (
            <div className="bg-slate-50 dark:bg-muted/40 rounded-2xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 border border-slate-200/80 dark:border-border my-4 shadow-xs transition-all animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sidebar animate-pulse" />
                <span className="text-xs font-bold text-foreground">
                  {selectedIds.length} Reservation{selectedIds.length > 1 ? "s" : ""} Selected
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline ml-2 cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleBatchDelete}
                  className="border border-slate-200 dark:border-border text-slate-700 dark:text-slate-200 bg-card hover:bg-slate-100 dark:hover:bg-muted rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Table Container */}
          <div className="border border-border/60 rounded-2xl mt-4 overflow-hidden flex-grow flex flex-col bg-card">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-28 gap-3 flex-grow">
                <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground font-medium">
                  Loading all reservations...
                </p>
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="py-24 text-center text-muted-foreground flex-grow flex flex-col items-center justify-center">
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-muted/50 mb-3 text-slate-400">
                  <Search className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-foreground">No reservations match your filters.</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Try clearing some filters or searching with a different term.
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetFilters}
                    className="mt-4 rounded-xl text-xs font-medium"
                  >
                    Reset All Filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* ── MOBILE CARD LIST (below lg) ── */}
                <div className="lg:hidden divide-y divide-border/60 flex-grow">
                  {paginatedBookings.map((booking) => {
                    const room = getRoom(booking.roomId);
                    const area = getArea(room?.areaId);
                    const requesterName = getRequesterName(booking);
                    const initials = getInitials(requesterName);
                    const startTime = toJsDate(booking.start);
                    const endTime = toJsDate(booking.end);
                    const createdDate = booking.dateRequested
                      ? toJsDate(booking.dateRequested)
                      : startTime;
                    const reqId =
                      booking.requestId || `REQ-${booking.id?.slice(0, 4)}`;
                    const isChecked = selectedIds.includes(booking.id);
                    const isApproved = booking.status === "Approved";
                    const isPending = booking.status
                      ?.toLowerCase()
                      .startsWith("pending");

                    return (
                      <div
                        key={booking.id}
                        className={cn(
                          "overflow-hidden rounded-none border-b border-border/60 transition-colors",
                          isChecked ? "bg-sidebar/5 dark:bg-sidebar/10" : "bg-card"
                        )}
                      >
                        {/* Blue header: Checkbox + ID + Status + Actions */}
                        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-sidebar">
                          <div className="flex items-center gap-2.5">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(c) => handleSelectRow(booking.id, !!c)}
                              className="h-[17px] w-[17px] rounded-[4px] border-[1.5px] border-white/90 bg-transparent data-[state=checked]:bg-white data-[state=checked]:border-white [&_svg]:text-sidebar focus-visible:ring-0 cursor-pointer shadow-xs transition-colors"
                            />
                            <span className="text-xs font-mono font-bold text-white">
                              {reqId}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isApproved ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Approved
                              </span>
                            ) : isPending ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-400/20 text-amber-200 border border-amber-400/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                Pending
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-400/20 text-rose-200 border border-rose-400/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                {booking.status}
                              </span>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white data-[state=open]:bg-white/10 transition-colors cursor-pointer"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-card-dark">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedBooking(booking);
                                    setIsDetailsOpen(true);
                                  }}
                                  className="text-xs cursor-pointer font-medium gap-2"
                                >
                                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteBooking(booking.id)}
                                  className="text-xs cursor-pointer font-medium text-destructive gap-2"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        <div className="p-4">
                          {/* Requester */}
                          <div className="flex items-center gap-2.5 mb-2.5">
                            <div className="w-7 h-7 rounded-full bg-sidebar/10 text-sidebar dark:bg-sidebar/30 dark:text-sidebar-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                            <span className="text-xs font-semibold text-foreground">
                              {requesterName}
                            </span>
                          </div>

                          {/* Event Title & Purpose */}
                          <div className="mb-3">
                            <p className="text-sm font-bold text-foreground">
                              {booking.title}
                            </p>
                            {booking.purpose && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {booking.purpose}
                              </p>
                            )}
                          </div>

                          {/* Details grid */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs bg-slate-50/70 dark:bg-muted/30 p-2.5 rounded-xl border border-border/40">
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                Room
                              </p>
                              <p className="font-semibold text-foreground">
                                {room?.name || "—"}
                              </p>
                              <p className="text-muted-foreground text-[11px]">
                                {area?.name || "First Floor"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                Date & Time
                              </p>
                              <p className="font-semibold text-foreground">
                                {format(startTime, "MMM d, yyyy")}
                              </p>
                              <p className="text-muted-foreground text-[11px]">
                                {format(startTime, "h:mm a")} – {format(endTime, "h:mm a")}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                Headcount
                              </p>
                              <p className="font-semibold text-foreground">
                                {booking.pax || 0} pax
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                Created
                              </p>
                              <p className="font-semibold text-foreground">
                                {format(createdDate, "MMM d, yyyy")}
                              </p>
                            </div>
                          </div>
                        </div>{/* end body padding */}
                      </div>
                    );
                  })}
                </div>

                {/* ── DESKTOP TABLE (lg and above) ── */}
                <div className="hidden lg:block overflow-x-auto flex-grow">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-sidebar hover:bg-sidebar border-b border-sidebar-border/40">
                        <TableHead className="w-12 px-4 py-3 text-center bg-sidebar">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={isAllCurrentPageSelected}
                              onCheckedChange={(c) => handleSelectAll(!!c)}
                              className="h-[17px] w-[17px] rounded-[4px] border-[1.5px] border-white/90 bg-transparent data-[state=checked]:bg-white data-[state=checked]:border-white [&_svg]:text-sidebar focus-visible:ring-0 cursor-pointer shadow-xs transition-colors"
                            />
                          </div>
                        </TableHead>
                        <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-4 text-center whitespace-nowrap">
                          ID
                        </TableHead>
                        <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-5 text-left whitespace-nowrap">
                          Requester
                        </TableHead>
                        <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-4 text-left whitespace-nowrap">
                          Floor / Room
                        </TableHead>
                        <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-4 text-left whitespace-nowrap">
                          Date
                        </TableHead>
                        <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-4 text-left whitespace-nowrap">
                          Time
                        </TableHead>
                        <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-3 text-center whitespace-nowrap">
                          Pax
                        </TableHead>
                        <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-4 text-center whitespace-nowrap">
                          Status
                        </TableHead>
                        <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-4 text-center whitespace-nowrap">
                          Created
                        </TableHead>
                        <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-4 pr-6 sm:pr-8 text-center whitespace-nowrap">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedBookings.map((booking) => {
                        const room = getRoom(booking.roomId);
                        const area = getArea(room?.areaId);
                        const requesterName = getRequesterName(booking);
                        const initials = getInitials(requesterName);
                        const startTime = toJsDate(booking.start);
                        const endTime = toJsDate(booking.end);
                        const createdDate = booking.dateRequested
                          ? toJsDate(booking.dateRequested)
                          : startTime;

                        const reqId =
                          booking.requestId || `REQ-${booking.id?.slice(0, 4)}`;
                        const isChecked = selectedIds.includes(booking.id);

                        const isApproved = booking.status === "Approved";
                        const isPending = booking.status
                          ?.toLowerCase()
                          .startsWith("pending");

                        return (
                          <TableRow
                            key={booking.id}
                            className={cn(
                              "border-b border-border/40 transition-colors",
                              isChecked
                                ? "bg-sidebar/5 dark:bg-sidebar/10 hover:bg-sidebar/10"
                                : "hover:bg-muted/20"
                            )}
                          >
                            {/* Checkbox */}
                            <TableCell className="px-4 py-3.5 text-center align-middle">
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(c) =>
                                    handleSelectRow(booking.id, !!c)
                                  }
                                  className="h-[17px] w-[17px] rounded-[4px] border-slate-300 dark:border-slate-600 data-[state=checked]:bg-sidebar data-[state=checked]:border-sidebar cursor-pointer transition-colors"
                                />
                              </div>
                            </TableCell>

                            {/* ID */}
                            <TableCell className="py-3.5 px-4 text-center align-middle font-mono font-bold text-xs text-foreground">
                              {reqId}
                            </TableCell>

                            {/* Requester with Initials Avatar */}
                            <TableCell className="py-3.5 px-5 align-middle">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-sidebar/10 text-sidebar dark:bg-sidebar/30 dark:text-sidebar-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-foreground block truncate">
                                    {requesterName}
                                  </span>
                                  {booking.title && (
                                    <span className="text-[11px] text-muted-foreground block truncate max-w-[150px]">
                                      {booking.title}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>

                            {/* Floor / Room */}
                            <TableCell className="py-3.5 px-4 align-middle whitespace-nowrap">
                              <div>
                                <p className="text-xs text-foreground font-semibold">
                                  {room?.name || "Sapphire"}
                                </p>
                                <p className="text-[11px] text-muted-foreground font-normal">
                                  {area?.name || "5th Floor"}
                                </p>
                              </div>
                            </TableCell>

                            {/* Date */}
                            <TableCell className="py-3.5 px-4 align-middle text-xs text-foreground font-medium whitespace-nowrap">
                              {format(startTime, "MMMM d, yyyy")}
                            </TableCell>

                            {/* Time */}
                            <TableCell className="py-3.5 px-4 align-middle text-xs text-muted-foreground font-medium whitespace-nowrap">
                              {format(startTime, "h:mm a")} – {format(endTime, "h:mm a")}
                            </TableCell>

                            {/* Pax */}
                            <TableCell className="py-3.5 px-3 text-center align-middle text-xs font-bold text-foreground whitespace-nowrap">
                              {booking.pax || 0}
                            </TableCell>

                            {/* Status */}
                            <TableCell className="py-3.5 px-4 text-center align-middle whitespace-nowrap">
                              {isApproved ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Approved
                                </span>
                              ) : isPending ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  Pending
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 whitespace-nowrap">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  {booking.status}
                                </span>
                              )}
                            </TableCell>

                            {/* Created Date */}
                            <TableCell className="py-3.5 px-4 text-center align-middle text-xs text-muted-foreground font-medium whitespace-nowrap">
                              {format(createdDate, "MMM d, yyyy")}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="py-3.5 px-4 pr-6 sm:pr-8 text-center align-middle">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-card-dark">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedBooking(booking);
                                      setIsDetailsOpen(true);
                                    }}
                                    className="text-xs cursor-pointer font-medium gap-2"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                    View Details
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => handleDeleteBooking(booking.id)}
                                    className="text-xs cursor-pointer font-medium text-destructive gap-2"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Footer */}
                <div className="mt-auto p-4 px-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4 bg-card">
                  <p className="text-xs text-muted-foreground">
                    Showing{" "}
                    {totalRecords > 0
                      ? `${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(
                        currentPage * ITEMS_PER_PAGE,
                        totalRecords
                      )}`
                      : "0"}{" "}
                    of {totalRecords} records
                  </p>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8 flex items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-2xs cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4 stroke-[2.25]" />
                    </button>

                    {visiblePageNumbers.map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                          "h-8 w-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-all cursor-pointer",
                          currentPage === page
                            ? "bg-sidebar text-white font-bold shadow-xs"
                            : "border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 shadow-2xs"
                        )}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="h-8 w-8 flex items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-2xs cursor-pointer"
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
        requesterName={
          selectedBooking ? getRequesterName(selectedBooking) : "System Admin"
        }
        venueElements={(venueElements as any[]) || []}
        ministries={(ministries as any[]) || []}
        onDelete={async (id) => {
          setIsDetailsOpen(false);
          handleDeleteBooking(id);
        }}
      />

      {/* Single Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={!!deleteBookingId}
        onClose={() => setDeleteBookingId(null)}
        onConfirm={handleConfirmDeleteSingle}
        title="Delete Reservation"
        itemName={allBookings?.find((b: any) => b.id === deleteBookingId)?.title || "this reservation"}
        confirmLabel="Delete Reservation"
        isLoading={isProcessing}
        description={
          allBookings?.find((b: any) => b.id === deleteBookingId)?.title ? (
            <>
              Are you sure you want to delete <strong className="text-foreground font-semibold">{allBookings?.find((b: any) => b.id === deleteBookingId)?.title}</strong>? All associated details will be permanently removed.
            </>
          ) : undefined
        }
      />

      {/* Batch Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={isBatchDeleteOpen}
        onClose={() => setIsBatchDeleteOpen(false)}
        onConfirm={handleConfirmBatchDelete}
        title="Delete Selected Reservations"
        confirmLabel={`Delete All (${selectedIds.length})`}
        isLoading={isProcessing}
        description={
          <>
            Are you sure you want to permanently delete <strong className="text-foreground font-semibold">{selectedIds.length}</strong> selected reservation(s)? This action cannot be undone.
          </>
        }
      />
    </AppLayout>
  );
}
