"use client";

import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, Button } from "@studio/ui";
import {
  Info,
  UserPlus,
  Calendar,
  UserCog,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  X,
  Building2,
  ShieldCheck,
  Sparkles,
  Tv,
  Mic,
  Speaker,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getBookingById } from "@/actions/db";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { ApprovalRequest, Worker } from "@studio/types";

function getTypeTheme(type: ApprovalRequest["type"]) {
  switch (type) {
    case "Room Booking":
      return {
        icon: Calendar,
        iconBg: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
        badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
      };
    case "Ministry Change":
      return {
        icon: ArrowRightLeft,
        iconBg: "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400",
        badge: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800",
      };
    case "Profile Update":
      return {
        icon: UserCog,
        iconBg: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
        badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
      };
    case "New Worker":
    default:
      return {
        icon: UserPlus,
        iconBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
        badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
      };
  }
}

function getStatusBadge(status: ApprovalRequest["status"]) {
  if (status === "Approved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        Approved
      </span>
    );
  }
  if (status === "Rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 whitespace-nowrap shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
        Rejected
      </span>
    );
  }
  if (status === "Pending Admin Approval" || status === "Pending Incoming Approval") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
        Pending Admin Approval
      </span>
    );
  }
  if (
    status === "Pending Ministry Approval" ||
    status === "Pending Outgoing Approval" ||
    (status as string) === "Pending Ministry" ||
    (status as string) === "Pending Ministry Head"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 whitespace-nowrap shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
        Pending Ministry Head
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap shadow-2xs">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
      Pending
    </span>
  );
}

function getStatusDescription(type: ApprovalRequest["type"], status: ApprovalRequest["status"]) {
  if (type === "Room Booking") {
    switch (status) {
      case "Pending Ministry Approval":
        return "Awaiting initial approval from Ministry Head. Room is not yet reserved.";
      case "Pending Admin Approval":
        return "Ministry Head approved. Awaiting final approval from Admin to officially reserve the room.";
      case "Approved":
        return "Room reservation is officially approved and confirmed.";
      case "Rejected":
        return "Room reservation request was rejected.";
    }
  }
  return null;
}

interface ApprovalDetailsDialogProps {
  request: ApprovalRequest | null;
  booking?: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requesterWorker?: Worker | null;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  canManage?: boolean;
  isAdmin?: boolean;
  isMinistryHead?: boolean;
  currentWorkerId?: string;
  currentWorkerName?: string;
}

export function ApprovalDetailsDialog({
  request,
  booking,
  open,
  onOpenChange,
  requesterWorker,
  onApprove,
  onReject,
  canManage = false,
  isAdmin = false,
  isMinistryHead = false,
  currentWorkerId,
  currentWorkerName,
}: ApprovalDetailsDialogProps) {
  const { data: fetchedBooking } = useQuery({
    queryKey: ["approval-booking", request?.reservationId],
    queryFn: () => (request?.reservationId ? getBookingById(request.reservationId) : null),
    enabled: Boolean(request?.type === "Room Booking" && request?.reservationId && !booking && open),
    staleTime: 30_000,
  });

  const activeBooking = booking || fetchedBooking;

  if (!request) return null;

  const reqDate = request.date ? new Date(request.date as any) : null;
  const typeTheme = getTypeTheme(request.type);
  const IconComponent = typeTheme.icon;

  const isRequesterAdmin = Boolean(
    (requesterWorker as any)?.role === "Administrator" ||
    (requesterWorker as any)?.role === "Super Admin" ||
    (requesterWorker as any)?.role?.name?.toLowerCase().includes("admin") ||
    (requesterWorker as any)?.role?.isSuperAdmin ||
    request.requester?.toLowerCase().includes("admin")
  );

  const isRequesterMH = Boolean(
    !isRequesterAdmin &&
    ((requesterWorker as any)?.role === "Ministry Head" ||
      (requesterWorker as any)?.role?.name?.toLowerCase().includes("head") ||
      (requesterWorker as any)?.isMinistryHead)
  );

  const isSelfRequested = Boolean(
    (currentWorkerId && (request.workerId === currentWorkerId || requesterWorker?.id === currentWorkerId)) ||
    (currentWorkerName && request.requester?.trim().toLowerCase() === currentWorkerName.toLowerCase()) ||
    (currentWorkerName && requesterWorker && `${requesterWorker.firstName || ""} ${requesterWorker.lastName || ""}`.trim().toLowerCase() === currentWorkerName.toLowerCase())
  );

  const contextDescription = (() => {
    if (request.type === "Room Booking") {
      if (request.status === "Pending Admin Approval") {
        if (isRequesterAdmin) {
          return "Submitted by Admin. Admin confirmation required to officially reserve the room (bypasses Ministry Head).";
        }
        if (isRequesterMH) {
          return "Submitted by Ministry Head. Awaiting final approval from Admin to officially reserve the room.";
        }
        return "Ministry Head approved. Awaiting final approval from Admin to officially reserve the room.";
      }
      return getStatusDescription(request.type, request.status);
    }
    return getStatusDescription(request.type, request.status);
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-2xl border-border/80 shadow-2xl gap-0">
        <DialogTitle className="sr-only">{request.type} Request Details</DialogTitle>
        <DialogDescription className="sr-only">Approval request details and submission overview</DialogDescription>

        {/* Modal Header */}
        <div className="p-5 pr-12 pb-4 border-b border-border/70 bg-card/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className={cn(
                  "h-11 w-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-xs",
                  typeTheme.iconBg
                )}
              >
                <IconComponent className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold font-headline tracking-tight text-foreground">
                    {request.type}
                  </h2>
                  {getStatusBadge(request.status)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Approval request details and submission overview
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto">
          {/* 1. Submitted By Card */}
          <div className="p-4 rounded-2xl border border-border/70 bg-card/60 shadow-2xs">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Submitted By
              </p>
              <p className="text-sm font-bold text-foreground leading-tight truncate mt-0.5">
                {request.requester}
              </p>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                {reqDate ? format(reqDate, "MMM d, yyyy • h:mm a") : "—"}
              </p>
            </div>
          </div>

          {/* 2. Context Alert Banner */}
          {contextDescription && (
            <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/25 border border-blue-200/70 dark:border-blue-900/40 text-blue-900 dark:text-blue-200 text-xs leading-relaxed flex items-start gap-2.5 shadow-2xs">
              <Info className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="font-medium">
                {contextDescription}
              </span>
            </div>
          )}

          {/* 2b. Alert when non-admin Ministry Head views self-submitted booking */}
          {request.type === "Room Booking" && !isAdmin && isMinistryHead && isSelfRequested && !canManage && (
            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs leading-relaxed flex items-start gap-2.5 shadow-2xs">
              <Info className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="font-medium">
                You submitted this room reservation request. Only an Admin can approve it.
              </span>
            </div>
          )}

          {/* 3. Approval Progress Card (For Multi-step) */}
          {request.type === "Room Booking" && request.status === "Pending Admin Approval" && (
            <div className="p-4 rounded-2xl border border-border/70 bg-card/60 space-y-2.5 shadow-2xs">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Approval Progress
              </p>
              <div className="flex items-center gap-2">
                {isRequesterAdmin ? (
                  <div className="flex items-center gap-2.5 flex-1 p-2.5 rounded-xl bg-purple-50/90 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/60 shadow-2xs">
                    <ShieldCheck className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-purple-900 dark:text-purple-200 leading-tight">
                        Admin Submission
                      </p>
                      <p className="text-[10px] font-semibold text-purple-700 dark:text-purple-400">
                        Direct (No MH needed)
                      </p>
                    </div>
                  </div>
                ) : isRequesterMH ? (
                  <div className="flex items-center gap-2.5 flex-1 p-2.5 rounded-xl bg-blue-50/90 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 shadow-2xs">
                    <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-blue-900 dark:text-blue-200 leading-tight">
                        Ministry Head
                      </p>
                      <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400">
                        Submitted
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 flex-1 p-2.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 leading-tight">
                        Ministry Head
                      </p>
                      <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                        Approved
                      </p>
                    </div>
                  </div>
                )}
                <div className="h-0.5 w-3 bg-border shrink-0 rounded-full" />
                <div className="flex items-center gap-2.5 flex-1 p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-200 leading-tight">
                      Admin
                    </p>
                    <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                      Awaiting Final Approval
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. Description / Room & Purpose Block */}
          {request.type === "Room Booking" ? (
            <div className="p-4 rounded-2xl border border-border/70 bg-card/60 space-y-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>Reservation Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(() => {
                  let purpose = activeBooking?.purpose || request.details;
                  let room = activeBooking?.room?.name || "";
                  if (!room && request.details) {
                    const match = request.details.match(/^"?(.*?)"?\s+for room:\s*(.*)$/i);
                    if (match) {
                      purpose = match[1];
                      room = match[2];
                    }
                  }

                  const requestedList: string[] = Array.isArray(activeBooking?.requestedElements)
                    ? activeBooking.requestedElements
                    : [];
                  const hasTv = Boolean(activeBooking?.equipment_TV);
                  const hasMic = Boolean(activeBooking?.equipment_Mic);
                  const hasSpeakers = Boolean(activeBooking?.equipment_Speakers);
                  const hasAnyAvOrElements = requestedList.length > 0 || hasTv || hasMic || hasSpeakers;

                  return (
                    <>
                      {room && (
                        <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Room
                          </p>
                          <p className="text-xs font-bold text-foreground mt-0.5">
                            {room}
                          </p>
                        </div>
                      )}
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Purpose
                        </p>
                        <p className="text-xs font-semibold text-foreground mt-0.5">
                          {purpose || "—"}
                        </p>
                      </div>

                      {activeBooking?.start && (
                        <div className="p-3 rounded-xl bg-muted/30 border border-border/60 sm:col-span-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Schedule
                          </p>
                          <p className="text-xs font-semibold text-foreground mt-0.5">
                            {format(new Date(activeBooking.start), "MMM d, yyyy • h:mm a")}
                            {activeBooking.end ? ` - ${format(new Date(activeBooking.end), "h:mm a")}` : ""}
                          </p>
                        </div>
                      )}

                      {(activeBooking?.pax || activeBooking?.numTables || activeBooking?.numChairs) && (
                        <div className="p-3 rounded-xl bg-muted/30 border border-border/60 sm:col-span-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Attendance &amp; Setup
                          </p>
                          <p className="text-xs font-semibold text-foreground mt-0.5">
                            {activeBooking.pax ? `${activeBooking.pax} pax` : ""}
                            {activeBooking.numTables ? ` • ${activeBooking.numTables} tables` : ""}
                            {activeBooking.numChairs ? ` • ${activeBooking.numChairs} chairs` : ""}
                          </p>
                        </div>
                      )}

                      {/* Request & AV Section */}
                      <div className="col-span-full p-3.5 rounded-xl bg-slate-50/80 dark:bg-muted/30 border border-border/70 space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <span>Request &amp; AV</span>
                        </div>

                        {hasAnyAvOrElements ? (
                          <div className="space-y-2">
                            {(hasTv || hasMic || hasSpeakers) && (
                              <div className="flex flex-wrap gap-1.5">
                                {hasTv && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    <Tv className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                    Television / Presentation
                                  </span>
                                )}
                                {hasMic && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                    <Mic className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                    Microphone &amp; Audio
                                  </span>
                                )}
                                {hasSpeakers && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                    <Speaker className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                                    Sound System / Speakers
                                  </span>
                                )}
                              </div>
                            )}

                            {requestedList.map((item: string, idx: number) => (
                              <div
                                key={idx}
                                className="p-2.5 rounded-lg bg-background border border-border/60 text-xs font-medium text-foreground whitespace-pre-wrap leading-relaxed shadow-2xs"
                              >
                                {item}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            No special AV or equipment requested.
                          </p>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl border border-border/70 bg-card/60 space-y-2 shadow-2xs">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>Request Details</span>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 text-xs font-medium text-foreground leading-relaxed whitespace-pre-wrap">
                {request.details || "No additional details provided."}
              </div>
            </div>
          )}

          {/* 5. Approve / Reject Actions */}
          {/* canManage is already computed by the parent (checkCanManage) which handles all role/self-request guards */}
          {canManage && request.status.startsWith("Pending") && (onApprove || onReject) && (() => {
            const statusStr = request.status as string;
            const isWaitingForMinistryHead =
              request.type === "Room Booking" &&
              (
                request.status === "Pending Ministry Approval" ||
                request.status === "Pending" ||
                statusStr === "Pending Ministry" ||
                statusStr === "Pending Ministry Head" ||
                statusStr.toLowerCase().includes("ministry")
              );
            // Pure admins (not ministry heads) cannot approve until Ministry Head gives initial approval.
            const isActionDisabled = Boolean(
              isAdmin && !isMinistryHead && isWaitingForMinistryHead
            );

            return (
              <div className="pt-1 grid grid-cols-2 gap-3">
                {onReject && (
                  <button
                    type="button"
                    disabled={isActionDisabled}
                    onClick={() => {
                      if (isActionDisabled) return;
                      onReject(request.id!);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex items-center justify-center h-11 rounded-xl border-2 border-rose-500 text-rose-600 dark:text-rose-400 font-bold text-sm bg-rose-50/50 dark:bg-rose-950/20 transition-all",
                      isActionDisabled
                        ? "opacity-50 cursor-not-allowed pointer-events-none"
                        : "hover:bg-rose-100 dark:hover:bg-rose-950/40 active:scale-95 cursor-pointer"
                    )}
                    title={isActionDisabled ? "Awaiting Ministry Head response" : undefined}
                  >
                    Reject
                  </button>
                )}
                {onApprove && (
                  <button
                    type="button"
                    disabled={isActionDisabled}
                    onClick={() => {
                      if (isActionDisabled) return;
                      onApprove(request.id!);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex items-center justify-center h-11 rounded-xl border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold text-sm bg-emerald-50/50 dark:bg-emerald-950/20 transition-all",
                      isActionDisabled
                        ? "opacity-50 cursor-not-allowed pointer-events-none"
                        : "hover:bg-emerald-100 dark:hover:bg-emerald-950/40 active:scale-95 cursor-pointer"
                    )}
                    title={isActionDisabled ? "Awaiting Ministry Head response" : undefined}
                  >
                    Approve
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
