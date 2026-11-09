"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Button,
  Label,
} from "@studio/ui";
import {
  CalendarDays,
  Calendar as CalendarIcon,
  Clock,
  Users,
  MapPin,
  User,
  CheckCircle2,
  Tv,
  Mic,
  Speaker,
  X,
  Check,
  Building,
  ArrowLeft,
  FileText,
} from "lucide-react";
import { cn, toJsDate } from "@/lib/utils";
import { format } from "date-fns";
import type { Booking, Ministry, VenueElement, Worker } from "@studio/types";

export interface ReservationDetailsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  booking: any | null;
  roomName: string;
  areaName: string;
  requesterName?: string;
  venueElements?: any[];
  ministries?: any[];
  workers?: Worker[];
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  hideRequesterInfo?: boolean;
}

export function ReservationDetailsSheet({
  isOpen,
  onClose,
  onBack,
  booking,
  roomName,
  areaName,
  requesterName,
  venueElements = [],
  ministries = [],
  workers = [],
  onApprove,
  onReject,
  onDelete,
  hideRequesterInfo = false,
}: ReservationDetailsSheetProps) {
  if (!booking) return null;

  const startTime = toJsDate(booking.start);
  const endTime = toJsDate(booking.end);

  // Resolve requester name if not explicitly passed
  let resolvedRequester = requesterName;
  if (!resolvedRequester) {
    const worker = workers?.find((w) => w.id === booking.workerProfileId);
    resolvedRequester = worker
      ? `${worker.firstName} ${worker.lastName}`
      : booking.name || "System Admin";
  }

  const ministry = ministries?.find((m) => m.id === booking.ministryId);
  const isPending = booking.status?.toLowerCase().startsWith("pending");
  const isApproved = booking.status === "Approved";
  const reqId = booking.requestId || `REQ-${booking.id?.slice(0, 4)}`;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        className="max-h-[calc(100svh-8rem)] md:max-h-[92vh] overflow-y-auto overflow-x-hidden p-0 rounded-2xl gap-0 border-border/80 shadow-2xl [&>button]:hidden"
        style={{ width: "min(calc(100vw - 2rem), 36rem)", maxHeight: "min(calc(100svh - 8rem), 92vh)" }}
      >
        {/* ── MODAL HEADER ── */}
        <SheetHeader className="p-5 pb-4 border-b border-border/70 bg-card/80 backdrop-blur-md sticky top-0 z-10 text-left space-y-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-lg font-bold font-headline tracking-tight text-foreground flex items-center gap-2.5 flex-nowrap">
                  <span className="font-mono text-base font-bold text-foreground shrink-0">
                    {reqId}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-2xs border shrink-0",
                      isApproved
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        : isPending
                        ? (booking.status === "Pending Ministry Approval" || booking.status === "Pending Ministry Head"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800")
                        : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                    )}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        isApproved
                          ? "bg-emerald-500"
                          : isPending
                          ? (booking.status === "Pending Ministry Approval" || booking.status === "Pending Ministry Head"
                              ? "bg-blue-500 animate-pulse"
                              : "bg-amber-500 animate-pulse")
                          : "bg-rose-500"
                      )}
                    />
                    {booking.status === "Pending Ministry Approval" ? "Pending Ministry Head" : booking.status}
                  </span>
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  Reservation detail summary, requester info, and equipment requirements
                </SheetDescription>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 -mt-1 -mr-1">
              {onBack ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onBack}
                  className="h-8 px-2.5 rounded-xl gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground border-border/80 hover:bg-muted/80 cursor-pointer shadow-2xs"
                  title="Back to list"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer"
                  title="Close modal"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* ── MODAL BODY ── */}
        <div className="p-6 space-y-5">
          {/* 1. Schedule & Attendance Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-headline">
                Schedule &amp; Attendance
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground">Date</Label>
                <div className="h-9 px-3 text-xs rounded-xl bg-muted/30 border border-border/70 flex items-center gap-2 font-medium text-foreground">
                  <CalendarIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate whitespace-nowrap">{format(startTime, "MMM d, yyyy")}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground">Schedule Time</Label>
                <div className="h-9 px-3 text-xs rounded-xl bg-muted/30 border border-border/70 flex items-center gap-2 font-medium text-foreground">
                  <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate whitespace-nowrap">
                    {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground">Headcount</Label>
                <div className="h-9 px-3 text-xs rounded-xl bg-muted/30 border border-border/70 flex items-center gap-2 font-medium text-foreground">
                  <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate whitespace-nowrap">{booking.pax || 0} pax</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Location & Venue Card */}
          <div className="rounded-2xl border border-border/70 bg-card/60 p-4 space-y-3.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-primary/10 text-primary">
                <MapPin className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-foreground font-headline">
                Location &amp; Venue
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground">Assigned Room</Label>
                <div className="h-9 px-3 text-xs rounded-xl bg-background border border-border/70 flex items-center font-bold text-foreground truncate">
                  {roomName || "Unassigned"}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground">Floor / Area</Label>
                <div className="h-9 px-3 text-xs rounded-xl bg-background border border-border/70 flex items-center font-medium text-muted-foreground truncate">
                  {areaName || "Main Facility"}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Requester & Ministry Card */}
          {!hideRequesterInfo && (
          <div className="rounded-2xl border border-border/70 bg-card/60 p-4 space-y-3.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-primary/10 text-primary">
                <User className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-foreground font-headline">
                Requester &amp; Ministry
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground">Requested By</Label>
                <div className="h-9 px-3 text-xs rounded-xl bg-background border border-border/70 flex items-center font-bold text-foreground truncate">
                  {resolvedRequester}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground">Ministry / Department</Label>
                <div className="h-9 px-3 text-xs rounded-xl bg-background border border-border/70 flex items-center font-medium text-foreground truncate">
                  {ministry?.name || "General"}
                </div>
              </div>
            </div>
          </div>
          )}

          {/* 4. Purpose & Event Details */}
          <div className="space-y-2 pt-1 border-t border-border/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-headline">
                Purpose &amp; Event Details
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/70 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
              {booking.purpose || "No specific purpose provided for this reservation."}
            </div>
          </div>

          {/* 5. Requested Elements & AV */}
          <div className="space-y-3 pt-1 border-t border-border/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-headline">
                Requested Elements &amp; AV
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(() => {
                const requestedList: string[] = Array.isArray(booking.requestedElements)
                  ? booking.requestedElements
                  : [];

                const knownElements = requestedList
                  .map((elId: string) => ({
                    id: elId,
                    el: venueElements?.find((v: any) => v.id === elId),
                  }))
                  .filter((item: any) => Boolean(item.el));

                const customNotes = requestedList.filter(
                  (elId: string) => !venueElements?.some((v: any) => v.id === elId)
                );

                const hasTv = Boolean(booking.equipment_TV);
                const hasMic = Boolean(booking.equipment_Mic);
                const hasSpeakers = Boolean(booking.equipment_Speakers);
                const hasElements = knownElements.length > 0;
                const hasNotes = customNotes.length > 0;

                if (!hasTv && !hasMic && !hasSpeakers && !hasElements && !hasNotes) {
                  return (
                    <div className="col-span-full p-3.5 text-xs text-muted-foreground italic bg-muted/20 border border-border/40 rounded-xl text-center">
                      No additional elements or AV equipment requested.
                    </div>
                  );
                }

                return (
                  <>
                    {hasTv && (
                      <div className="flex items-center justify-between p-3 rounded-xl border bg-blue-50/50 border-blue-100 text-blue-900 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-300">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-card shadow-2xs shrink-0">
                            <Tv className="h-4 w-4 text-blue-500" />
                          </div>
                          <span className="text-xs font-bold">Television / Presentation</span>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                          Requested
                        </span>
                      </div>
                    )}

                    {hasMic && (
                      <div className="flex items-center justify-between p-3 rounded-xl border bg-emerald-50/50 border-emerald-100 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-300">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-card shadow-2xs shrink-0">
                            <Mic className="h-4 w-4 text-emerald-500" />
                          </div>
                          <span className="text-xs font-bold">Microphone &amp; Audio</span>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                          Requested
                        </span>
                      </div>
                    )}

                    {hasSpeakers && (
                      <div className="flex items-center justify-between p-3 rounded-xl border bg-purple-50/50 border-purple-100 text-purple-900 dark:bg-purple-950/20 dark:border-purple-900/40 dark:text-purple-300">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-card shadow-2xs shrink-0">
                            <Speaker className="h-4 w-4 text-purple-500" />
                          </div>
                          <span className="text-xs font-bold">Sound System / Speakers</span>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">
                          Requested
                        </span>
                      </div>
                    )}

                    {knownElements.map(({ id, el }: any) => (
                      <div
                        key={id}
                        className="flex items-center justify-between p-3 rounded-xl border bg-emerald-50/50 border-emerald-100 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-300"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-card shadow-2xs shrink-0">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold block truncate">
                              {el.name}
                            </span>
                            {el.category && (
                              <span className="text-[9px] text-emerald-600/70 dark:text-emerald-400 font-semibold uppercase tracking-wider block truncate">
                                {el.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
                          Requested
                        </span>
                      </div>
                    ))}

                    {customNotes.map((note: string, idx: number) => (
                      <div
                        key={idx}
                        className="col-span-full p-3.5 rounded-xl border bg-slate-50/80 border-slate-200/80 dark:bg-muted/20 dark:border-border/70 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <span>Special AV &amp; Equipment Request</span>
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-primary shrink-0 ml-2">
                            Requested
                          </span>
                        </div>
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed pl-6">
                          {note}
                        </p>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>

          {/* 6. Action Buttons */}
          {isPending && onApprove && onReject && (
            <div className="pt-3 border-t border-border/60 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onReject(booking.id)}
                  className="w-full rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold gap-1.5 h-10 shadow-xs cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  Reject
                </Button>
                <Button
                  type="button"
                  onClick={() => onApprove(booking.id)}
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 h-10 shadow-xs cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  Approve Reservation
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
