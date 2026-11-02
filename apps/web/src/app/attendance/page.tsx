"use client";

import React, { useMemo, useState, useCallback, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import {
  LoaderCircle, ShieldAlert, Search, Download, Upload,
  RefreshCw, CheckCircle2, Clock, QrCode, SlidersHorizontal,
  LogIn, LogOut, MoreHorizontal, Users, XCircle, AlertCircle, RotateCcw, X, ScanLine, Eye,
} from "lucide-react";
import { useAuthStore } from "@studio/store";
import { format, differenceInMinutes, startOfWeek } from "date-fns";
import { useUserRole } from "@/hooks/use-user-role";
import { useToast } from "@/hooks/use-toast";
import { useAttendance } from "@/hooks/use-attendance";
import { useWorkers } from "@/hooks/use-workers";
import { useMealStubs } from "@/hooks/use-meal-stubs";
import { useRoles } from "@/hooks/use-roles";
import { useMinistries } from "@/hooks/use-ministries";
import {
  Card, CardHeader, CardTitle, CardDescription,
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Dialog,
  DialogContent,
  DialogTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@studio/ui";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { regenerateWorkerQrToken } from "@/actions/db";
import { exportToExcel } from "@/lib/export-excel";
import { ExportConfirmDialog } from "@/components/common/export-confirm-dialog";

// Helpers
function generateToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function WorkerInitials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const init = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  return (
    <span className="w-7 h-7 rounded-full bg-sidebar/10 text-sidebar dark:bg-sidebar/30 dark:text-sidebar-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
      {init}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const displayRole = role.toLowerCase() === "super admin" ? "Admin" : role;
  const lower = displayRole.toLowerCase();
  if (lower.includes("admin"))
    return <span className="inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800 whitespace-nowrap">{displayRole}</span>;
  if (lower.includes("head") || lower.includes("pastor") || lower.includes("ministry"))
    return <span className="inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 whitespace-nowrap">{role}</span>;
  return <span className="inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-muted dark:text-slate-300 border border-slate-200 dark:border-border whitespace-nowrap">{role}</span>;
}

function StatCard({ label, value, sub, icon: Icon, accentColor, iconClass, iconBgClass }: {
  label: string; value: number | string; sub?: string;
  icon: React.ElementType; accentColor: string;
  iconClass: string; iconBgClass: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 dark:border-border shadow-xs bg-white dark:bg-card h-full">
      <div className={cn("h-1.5 w-full", accentColor)} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <div className="mt-3">
              <span className="text-4xl font-black tracking-tight font-headline text-foreground leading-none">{value}</span>
            </div>
            {sub && <p className="text-xs text-muted-foreground mt-2">{sub}</p>}
          </div>
          <div className={cn("p-2.5 rounded-xl flex items-center justify-center shrink-0 shadow-xs", iconBgClass)}>
            <Icon className={cn("h-5 w-5", iconClass)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function pairSessions(records: any[]) {
  const sorted = [...records].sort((a, b) => {
    const da = a.time instanceof Date ? a.time : new Date(a.time);
    const db = b.time instanceof Date ? b.time : new Date(b.time);
    return da.getTime() - db.getTime();
  });
  const sessions: { date: Date; timeIn: Date; timeOut: Date | null; totalMinutes: number | null; isLate: boolean }[] = [];
  const ins: Date[] = [];
  for (const r of sorted) {
    const t = r.time instanceof Date ? r.time : new Date(r.time);
    if (r.type === "Clock In") {
      ins.push(t);
    } else if (r.type === "Clock Out" && ins.length > 0) {
      const tin = ins.shift()!;
      sessions.push({ date: tin, timeIn: tin, timeOut: t, totalMinutes: differenceInMinutes(t, tin), isLate: tin.getHours() > 8 || (tin.getHours() === 8 && tin.getMinutes() > 30) });
    }
  }
  for (const tin of ins) {
    sessions.push({ date: tin, timeIn: tin, timeOut: null, totalMinutes: null, isLate: tin.getHours() > 8 || (tin.getHours() === 8 && tin.getMinutes() > 30) });
  }
  return sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function formatHours(mins: number | null) {
  if (mins === null) return "--";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}.${Math.round((m / 60) * 10)}h` : `${h}h`;
}

function StatusPill({ isLate, hasOut }: { isLate: boolean; hasOut: boolean }) {
  if (!hasOut) return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" /> Active</span>;
  if (isLate) return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" /> Late</span>;
  return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" /> Present</span>;
}

function AttendanceStatusBadge({ status }: { status: "timed-in" | "timed-out" | "not-yet" }) {
  if (status === "timed-in") return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Timed In</span>;
  if (status === "timed-out") return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-muted dark:text-slate-300 border border-slate-200 dark:border-border"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Timed Out</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Not Yet Timed In</span>;
}

// Main Content
function AttendanceContent() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { canViewAttendance, workerProfile, isLoading: isRoleLoading, isMinistryHead, isSuperAdmin, canManageWorkers, canOperateScanner } = useUserRole();
  const isMinistryHeadOnly = isMinistryHead && !isSuperAdmin;
  const { toast } = useToast();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [localToken, setLocalToken] = useState<string | null>(null);
  const isAssigner = Boolean(isSuperAdmin || isMinistryHead || canManageWorkers || canOperateScanner);
  const requestedTab = (searchParams.get("tab") || "personal") as "personal" | "manual" | "records";
  const activeTab = (requestedTab === "manual" || requestedTab === "records") && !isAssigner ? "personal" : requestedTab;

  // Manual tab state
  const [assignSearch, setAssignSearch] = useState("");
  const [ministryFilter, setMinistryFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Records tab state
  const [recordsSearch, setRecordsSearch] = useState("");
  const [recordsMinistryFilter, setRecordsMinistryFilter] = useState("all");
  const [recordsRoleFilter, setRecordsRoleFilter] = useState("all");
  const [recordsStatusFilter, setRecordsStatusFilter] = useState("all");
  const [recordsRange, setRecordsRange] = useState<"today" | "yesterday" | "this-week" | "this-month" | "all-time">("today");

  const [attendanceConfirm, setAttendanceConfirm] = useState<{
    worker: any;
    type: "Clock In" | "Clock Out";
    status?: any;
  } | null>(null);
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);
  const [selectedSession, setSelectedSession] = useState<{
    date: Date;
    timeIn: Date;
    timeOut: Date | null;
    totalMinutes: number | null;
    isLate: boolean;
  } | null>(null);

  const handleConfirmAttendance = async () => {
    if (!attendanceConfirm) return;
    const { worker, type } = attendanceConfirm;
    setIsSubmittingAttendance(true);
    try {
      let actionError = null as string | null;
      try {
        await createAttendanceRecord({ workerProfileId: worker.id, type });
      } catch (serverErr: any) {
        let msg: string = serverErr?.message || serverErr?.digest || "Failed to record attendance";
        if (typeof msg === "string" && msg.startsWith("Error: ")) msg = msg.slice(7).trim();
        actionError = msg;
      }
      if (actionError) {
        toast({ title: "Error", description: actionError, variant: "destructive" });
        setIsSubmittingAttendance(false);
        return;
      }
      if (type === "Clock In") {
        const hasStub = assignedStubs?.some((s: any) => {
          const sd = s.date instanceof Date ? s.date : new Date(s.date);
          return s.workerId === worker.id && sd >= todayStart;
        });
        if (!hasStub) {
          try {
            await createMealStub({
              workerId: worker.id,
              workerName: `${worker.firstName} ${worker.lastName}`,
              status: "Issued",
              assignedBy: workerProfile?.id || user?.id,
              assignedByName: workerProfile ? `${workerProfile.firstName} ${workerProfile.lastName}` : (user?.email || "System"),
              stubType: "daily",
            });
          } catch { }
        }
        toast({ title: "Timed In", description: `${worker.firstName} ${worker.lastName}` });
      } else {
        toast({ title: "Timed Out", description: `${worker.firstName} ${worker.lastName}` });
      }
      setAttendanceConfirm(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to record attendance",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  const { workers: allWorkers } = useWorkers({ enabled: isAssigner, limit: 999999 });
  const { createAttendanceRecord } = useAttendance({ enabled: false });
  const { roles } = useRoles();
  const { ministries } = useMinistries();

  const todayStart = useMemo(() => new Date(new Date().setHours(0, 0, 0, 0)), []);
  const { createMealStub, mealStubs: assignedStubs } = useMealStubs({ dateFrom: todayStart, enabled: isAssigner });
  const { updateWorker: updateWorkerSql } = useWorkers();

  const { attendanceRecords: todayAttendance } = useAttendance(
    isAssigner ? { dateFrom: todayStart } : { enabled: false }
  );

  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const personalRecordsStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const currentWorkerId = workerProfile?.id || user?.id;
  const { attendanceRecords: allAttendance, isLoading: attendanceLoading } = useAttendance(
    currentWorkerId ? { workerProfileId: currentWorkerId, dateFrom: personalRecordsStart } : { enabled: false }
  );

  // Records tab date range
  const recordsDateFrom = useMemo(() => {
    const now = new Date();
    if (recordsRange === "today") { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
    if (recordsRange === "yesterday") { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0); return d; }
    if (recordsRange === "this-week") return startOfWeek(new Date(), { weekStartsOn: 1 });
    if (recordsRange === "this-month") { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }
    return undefined;
  }, [recordsRange]);

  const { attendanceRecords: allRecords, isLoading: recordsLoading } = useAttendance(
    activeTab === "records" && isAssigner ? { dateFrom: recordsDateFrom } : { enabled: false }
  );

  const isLoading = (attendanceLoading || isRoleLoading) && !allAttendance;

  const activeToken = localToken ?? workerProfile?.qrToken ?? workerProfile?.id ?? "";
  const qrData = workerProfile?.id ? `COG_USER:${workerProfile.id}:${activeToken}` : "";
  const userQrCodeUrl = qrData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=230x230&data=${encodeURIComponent(qrData)}&bgcolor=ffffff&color=000000&margin=8`
    : "";

  const queryClient = useQueryClient();
  const handleRegenerateQR = useCallback(async () => {
    const targetId = workerProfile?.id || user?.id || user?.email;
    if (!targetId) return;
    setIsRegenerating(true);
    try {
      const newToken = generateToken();
      await regenerateWorkerQrToken(targetId, newToken);
      setLocalToken(newToken);
      queryClient.invalidateQueries({ queryKey: ["worker"] });
      queryClient.invalidateQueries({ queryKey: ["worker-view-as"] });
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast({ title: "QR Code Regenerated", description: "Your old QR is now invalid." });
    } catch {
      toast({ variant: "destructive", title: "Failed to regenerate QR" });
    } finally {
      setIsRegenerating(false);
    }
  }, [workerProfile?.id, user?.id, user?.email, queryClient, toast]);

  const [showExportConfirm, setShowExportConfirm] = useState(false);

  const handleExportAttendance = () => {
    if (activeTab === "manual") {
      if (filteredWorkers.length === 0) {
        toast({ variant: "destructive", title: "No data to export" });
        return;
      }

      const headers = [
        "Worker Name",
        "Worker ID",
        "Role",
        "Ministry",
        "Today Status",
        "Last Activity Time",
        "Last Activity Type",
      ];

      const rows = filteredWorkers.map((w) => {
        const ws = workerStatusMap[w.id];
        const statusLabel =
          ws?.status === "timed-in"
            ? "Timed In"
            : ws?.status === "timed-out"
              ? "Timed Out"
              : "Not Yet Timed In";

        return [
          `${w.firstName} ${w.lastName}`,
          fmtId(w.workerId),
          getRoleName(w),
          ministries.find((m) => m.id === w.majorMinistryId)?.name || "--",
          statusLabel,
          ws?.lastType === "time-in" ? "Time In" : ws?.lastType === "time-out" ? "Time Out" : (ws?.lastType ? ws.lastType.charAt(0).toUpperCase() + ws.lastType.slice(1) : "--"),
        ];
      });

      exportToExcel(`attendance_manual_${format(new Date(), "yyyyMMdd")}.xlsx`, [
        {
          name: "Today Attendance",
          data: [
            ["ATTENDANCE - TODAY'S WORKER STATUS"],
            ["Generated Date", format(new Date(), "yyyy-MM-dd HH:mm:ss")],
            [],
            headers,
            ...rows,
          ],
          colWidths: [24, 16, 20, 24, 18, 20, 20],
        },
        {
          name: "Status Summary",
          data: [
            ["Metric", "Count", "Percentage"],
            [
              "Timed In",
              manualStatusCounts["timed-in"],
              manualStatusCounts.all > 0
                ? `${Math.round((manualStatusCounts["timed-in"] / manualStatusCounts.all) * 100)}%`
                : "0%",
            ],
            [
              "Timed Out",
              manualStatusCounts["timed-out"],
              manualStatusCounts.all > 0
                ? `${Math.round((manualStatusCounts["timed-out"] / manualStatusCounts.all) * 100)}%`
                : "0%",
            ],
            [
              "Not Yet Timed In",
              manualStatusCounts["not-yet"],
              manualStatusCounts.all > 0
                ? `${Math.round((manualStatusCounts["not-yet"] / manualStatusCounts.all) * 100)}%`
                : "0%",
            ],
            ["Total Workers", manualStatusCounts.all, "100%"],
          ],
          colWidths: [22, 14, 14],
        },
      ]);

      toast({
        title: "Attendance Exported",
        description: `Exported ${filteredWorkers.length} worker statuses to Excel.`,
      });
    } else if (activeTab === "records") {
      if (filteredRecordRows.length === 0) {
        toast({ variant: "destructive", title: "No data to export" });
        return;
      }

      const headers = [
        "Worker Name",
        "Worker ID",
        "Ministry",
        "Date",
        "Time In",
        "Time Out",
        "Total Hours",
        "Status",
      ];

      const rows = filteredRecordRows.map((r) => [
        `${r.worker.firstName} ${r.worker.lastName}`,
        fmtId(r.worker.workerId),
        ministries.find((m) => m.id === r.worker.majorMinistryId)?.name || "--",
        format(r.date, "yyyy-MM-dd"),
        r.timeIn ? format(r.timeIn, "h:mm a") : "--",
        r.timeOut ? format(r.timeOut, "h:mm a") : "--",
        r.hours != null ? `${Math.floor(r.hours / 60)}h ${r.hours % 60}m` : "--",
        r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : "--",
      ]);

      exportToExcel(`attendance_records_${format(new Date(), "yyyyMMdd")}.xlsx`, [
        {
          name: "Attendance History",
          data: [
            ["ATTENDANCE - HISTORICAL RECORDS"],
            ["Generated Date", format(new Date(), "yyyy-MM-dd HH:mm:ss")],
            [],
            headers,
            ...rows,
          ],
          colWidths: [24, 16, 24, 14, 14, 14, 14, 14],
        },
        {
          name: "Summary",
          data: [
            ["Metric", "Count", "Percentage"],
            [
              "Present",
              recordStats.present,
              recordStats.total > 0
                ? `${Math.round((recordStats.present / recordStats.total) * 100)}%`
                : "0%",
            ],
            [
              "Late",
              recordStats.late,
              recordStats.total > 0
                ? `${Math.round((recordStats.late / recordStats.total) * 100)}%`
                : "0%",
            ],
            [
              "Absent",
              recordStats.absent,
              recordStats.total > 0
                ? `${Math.round((recordStats.absent / recordStats.total) * 100)}%`
                : "0%",
            ],
            [
              "Incomplete",
              recordStats.incomplete,
              recordStats.total > 0
                ? `${Math.round((recordStats.incomplete / recordStats.total) * 100)}%`
                : "0%",
            ],
            ["Total Records", recordStats.total, "100%"],
          ],
          colWidths: [20, 14, 14],
        },
      ]);

      toast({
        title: "Attendance Records Exported",
        description: `Exported ${filteredRecordRows.length} attendance records to Excel.`,
      });
    }
  };

  const userPersonalAttendance = useMemo(() => {
    if (!allAttendance) return [];
    if (isSuperAdmin || isMinistryHead) return allAttendance;
    return allAttendance.filter(r => r.workerProfileId === currentWorkerId);
  }, [allAttendance, currentWorkerId, isSuperAdmin, isMinistryHead]);

  const sessions = useMemo(() => pairSessions(userPersonalAttendance), [userPersonalAttendance]);
  const presentCount = sessions.filter(s => s.timeOut !== null).length;
  const lateCount = sessions.filter(s => s.isLate && s.timeOut !== null).length;

  const workerStatusMap = useMemo(() => {
    const map: Record<string, {
      status: "timed-in" | "timed-out" | "not-yet";
      lastTime: Date | null;
      lastType: string | null;
      timeIn: Date | null;
      timeOut: Date | null;
    }> = {};
    if (!todayAttendance) return map;
    const sorted = [...todayAttendance].sort((a, b) => {
      const da = a.time instanceof Date ? a.time : new Date(a.time);
      const db = b.time instanceof Date ? b.time : new Date(b.time);
      return da.getTime() - db.getTime();
    });
    for (const r of sorted) {
      const t = r.time instanceof Date ? r.time : new Date(r.time);
      const entry = map[r.workerProfileId] || {
        status: "not-yet",
        lastTime: null,
        lastType: null,
        timeIn: null,
        timeOut: null,
      };
      if (r.type === "Clock In") {
        if (!entry.timeIn) entry.timeIn = t;
        entry.status = "timed-in";
      } else if (r.type === "Clock Out") {
        entry.timeOut = t;
        entry.status = "timed-out";
      }
      entry.lastTime = t;
      entry.lastType = r.type;
      map[r.workerProfileId] = entry;
    }
    return map;
  }, [todayAttendance]);

  const fmtId = (id: string | null | undefined) => {
    if (!id) return "--";
    const clean = String(id).replace(/^COG-?/i, "").trim();
    const n = parseInt(clean, 10);
    return isNaN(n) ? id : String(n).padStart(6, "0");
  };

  const getRoleName = (w: any) => {
    let name = "Worker";
    if (w.roles?.length > 0) name = w.roles[0]?.role?.name || w.roles[0]?.roleId || "Worker";
    else name = (roles as any[]).find(r => r.id === w.roleId)?.name || "Worker";
    if (name.toLowerCase() === "super admin") return "Admin";
    return name;
  };

  // For Ministry Head, restrict visible workers strictly to those with the "Worker" role
  const visibleWorkers = useMemo(() => {
    if (!allWorkers) return [];
    if (isMinistryHeadOnly) {
      return allWorkers.filter(w => {
        const rn = getRoleName(w).toLowerCase();
        return rn === "worker" || (!rn.includes("head") && !rn.includes("admin"));
      });
    }
    return allWorkers;
  }, [allWorkers, isMinistryHeadOnly, roles]);

  const manualStatusCounts = useMemo(() => {
    let timedIn = 0, timedOut = 0, notYet = 0;
    for (const w of visibleWorkers) {
      const st = workerStatusMap[w.id]?.status ?? "not-yet";
      if (st === "timed-in") timedIn++;
      else if (st === "timed-out") timedOut++;
      else notYet++;
    }
    return {
      all: visibleWorkers.length,
      "timed-in": timedIn,
      "timed-out": timedOut,
      "not-yet": notYet,
    };
  }, [visibleWorkers, workerStatusMap]);

  const filteredWorkers = useMemo(() => {
    if (!visibleWorkers) return [];
    return visibleWorkers.filter(w => {
      const name = `${w.firstName} ${w.lastName}`.toLowerCase();
      const wId = fmtId(w.workerId).toLowerCase();
      const q = assignSearch.trim().toLowerCase();
      if (q && !name.includes(q) && !wId.includes(q)) return false;
      if (ministryFilter !== "all" && w.majorMinistryId !== ministryFilter) return false;
      if (!isMinistryHeadOnly && roleFilter !== "all") {
        const rn = getRoleName(w).toLowerCase();
        if (!rn.includes(roleFilter.toLowerCase())) return false;
      }
      const ws = workerStatusMap[w.id];
      const cs = ws?.status ?? "not-yet";
      if (statusFilter !== "all" && cs !== statusFilter) return false;
      return true;
    });
  }, [visibleWorkers, assignSearch, ministryFilter, roleFilter, statusFilter, workerStatusMap, isMinistryHeadOnly, roles]);

  // Records tab: build rows
  const recordRows = useMemo(() => {
    const workerRecordsMap: Record<string, any[]> = {};
    for (const r of (allRecords || [])) {
      if (!workerRecordsMap[r.workerProfileId]) workerRecordsMap[r.workerProfileId] = [];
      workerRecordsMap[r.workerProfileId].push(r);
    }
    const rows: { worker: any; date: Date; timeIn: Date | null; timeOut: Date | null; hours: number | null; status: "present" | "late" | "absent" | "incomplete" }[] = [];
    for (const [wId, recs] of Object.entries(workerRecordsMap)) {
      const w = visibleWorkers?.find(x => x.id === wId);
      if (!w) continue;
      const dayMap: Record<string, any[]> = {};
      for (const r of recs) {
        const t = r.time instanceof Date ? r.time : new Date(r.time);
        const day = format(t, "yyyy-MM-dd");
        if (!dayMap[day]) dayMap[day] = [];
        dayMap[day].push({ ...r, _t: t });
      }
      for (const [day, dayRecs] of Object.entries(dayMap)) {
        const sorted = dayRecs.sort((a, b) => a._t.getTime() - b._t.getTime());
        const inRec = sorted.find(r => r.type === "Clock In");
        const outRec = [...sorted].reverse().find(r => r.type === "Clock Out");
        const timeIn = inRec ? inRec._t as Date : null;
        const timeOut = outRec ? outRec._t as Date : null;
        const hours = timeIn && timeOut ? differenceInMinutes(timeOut, timeIn) : null;
        let status: "present" | "late" | "absent" | "incomplete" = "absent";
        if (!timeIn) status = "absent";
        else if (!timeOut) status = "incomplete";
        else if (timeIn.getHours() > 8 || (timeIn.getHours() === 8 && timeIn.getMinutes() > 30)) status = "late";
        else status = "present";
        rows.push({ worker: w, date: new Date(day), timeIn, timeOut, hours, status });
      }
    }
    return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [allRecords, allWorkers]);

  const baseFilteredRecordRows = useMemo(() => {
    return recordRows.filter(r => {
      const name = `${r.worker.firstName} ${r.worker.lastName}`.toLowerCase();
      const wId = fmtId(r.worker.workerId).toLowerCase();
      const q = recordsSearch.trim().toLowerCase();
      if (q && !name.includes(q) && !wId.includes(q)) return false;
      if (recordsMinistryFilter !== "all" && r.worker.majorMinistryId !== recordsMinistryFilter) return false;
      if (recordsRoleFilter !== "all") {
        const rn = getRoleName(r.worker).toLowerCase();
        if (!rn.includes(recordsRoleFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [recordRows, recordsSearch, recordsMinistryFilter, recordsRoleFilter]);

  const recordStats = useMemo(() => ({
    total: baseFilteredRecordRows.length,
    present: baseFilteredRecordRows.filter(r => r.status === "present").length,
    late: baseFilteredRecordRows.filter(r => r.status === "late").length,
    absent: baseFilteredRecordRows.filter(r => r.status === "absent").length,
    incomplete: baseFilteredRecordRows.filter(r => r.status === "incomplete").length,
  }), [baseFilteredRecordRows]);

  const filteredRecordRows = useMemo(() => {
    const rows = recordsStatusFilter === "all" ? baseFilteredRecordRows : baseFilteredRecordRows.filter(r => r.status === recordsStatusFilter);
    if (isSuperAdmin || isMinistryHead) return rows;
    return rows.filter(r => r.worker.id === currentWorkerId);
  }, [baseFilteredRecordRows, recordsStatusFilter, isSuperAdmin, isMinistryHead, currentWorkerId]);

  if (isLoading) return <AppLayout><div className="flex justify-center py-10"><LoaderCircle className="h-8 w-8 animate-spin" /></div></AppLayout>;
  if (!canViewAttendance) return <AppLayout><Card><CardHeader><CardTitle>Access Denied</CardTitle><CardDescription>No permission.</CardDescription></CardHeader></Card></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-7 pb-12 w-full">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">
              {activeTab === "personal"
                ? "Personal Log"
                : activeTab === "manual"
                ? "Manual Attendance"
                : activeTab === "records"
                ? "Attendance Records"
                : "Attendance"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "personal"
                ? "View your personal daily clock-in and clock-out logs."
                : activeTab === "manual"
                ? "Manually record and manage time-ins and time-outs for workers."
                : activeTab === "records"
                ? "Comprehensive attendance history, exportable logs, and filtering."
                : "Scan, monitor, and manage attendance across every ministry -- in one workforce command center."}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {isAssigner && activeTab !== "personal" && activeTab !== "manual" && (
              <Link href="/attendance/scanner">
                <button className="h-10 px-4 flex items-center gap-2 rounded-2xl border border-border/80 bg-white dark:bg-card hover:bg-muted/40 text-foreground text-xs font-bold shadow-xs transition-colors cursor-pointer">
                  <ScanLine className="h-4 w-4 text-primary" /> Scanner
                </button>
              </Link>
            )}
            {isAssigner && (activeTab === "manual" || activeTab === "records") && (
              <button
                onClick={() => setShowExportConfirm(true)}
                className="h-10 px-4 flex items-center gap-2 rounded-2xl bg-sidebar hover:bg-sidebar/90 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Download className="h-4 w-4 text-white" /> Export Excel
              </button>
            )}
          </div>
        </div>

        <div className="space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Personal Log */}
          {activeTab === "personal" && (
            <div className="flex flex-col gap-6 w-full">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard
                  label="PRESENT COUNT"
                  value={presentCount}
                  sub="this week"
                  icon={CheckCircle2}
                  accentColor="bg-emerald-500"
                  iconClass="text-emerald-600"
                  iconBgClass="bg-emerald-50 dark:bg-emerald-950/40"
                />
                <StatCard
                  label="LATE COUNT"
                  value={lateCount}
                  sub="this week"
                  icon={Clock}
                  accentColor="bg-amber-500"
                  iconClass="text-amber-600"
                  iconBgClass="bg-amber-50 dark:bg-amber-950/40"
                />
              </div>

              {/* Attendance Table */}
              <div className="bg-white dark:bg-card rounded-2xl border border-border/60 shadow-card-dark p-5 sm:p-6 overflow-hidden flex flex-col gap-4">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-foreground font-headline">This week&apos;s personal log</h3>
                  <p className="text-xs text-muted-foreground">Recent attendance history.</p>
                </div>

                {/* Inner Table Container */}
                <div className="bg-card rounded-2xl border border-border/60 overflow-hidden flex flex-col">

                  {/* Mobile card view */}
                  <div className="md:hidden p-3.5 space-y-3 bg-slate-50/50 dark:bg-muted/10">
                    {sessions.length === 0 ? (
                      <div className="py-14 text-center text-xs font-medium text-muted-foreground bg-white dark:bg-card rounded-2xl border border-border/40">No records this week.</div>
                    ) : sessions.map((s, i) => (
                      <div key={i} className="rounded-2xl border border-border/60 overflow-hidden shadow-2xs bg-card flex flex-col">
                        {/* Navy Header: Date & Actions */}
                        <div className="bg-sidebar px-4 py-2 flex items-center justify-between text-white">
                          <span className="text-xs font-mono font-bold text-white tracking-wide truncate">
                            {format(s.date, "EEE, MMM d, yyyy")}
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
                            <DropdownMenuContent align="end" className="w-40 p-1 rounded-xl shadow-lg border border-border bg-popover text-popover-foreground">
                              <DropdownMenuItem
                                onSelect={() => setSelectedSession(s)}
                                onClick={() => setSelectedSession(s)}
                                className="text-xs cursor-pointer font-medium gap-2 py-2 rounded-lg"
                              >
                                <Eye className="h-3.5 w-3.5 text-muted-foreground" /> View Details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Card Body */}
                        <div className="p-3.5 sm:p-4 space-y-3 bg-white dark:bg-card">
                          {/* Worker info + Status pill on the right */}
                          <div className="flex items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-full bg-sidebar/10 text-sidebar dark:bg-sidebar/30 dark:text-sky-300 text-xs font-bold flex items-center justify-center shrink-0 border border-sidebar/20">
                                {workerProfile?.firstName?.[0] || "W"}{workerProfile?.lastName?.[0] || ""}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-bold text-foreground leading-tight truncate">
                                  {workerProfile ? `${workerProfile.firstName} ${workerProfile.lastName}` : (user?.email || "Worker")}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {(workerProfile as any)?.ministry || ministries.find(m => m.id === workerProfile?.majorMinistryId)?.name || "Worker"}
                                </p>
                              </div>
                            </div>

                            {/* Status pill on right side (matching reference) */}
                            <div className="shrink-0">
                              <StatusPill isLate={s.isLate} hasOut={s.timeOut !== null} />
                            </div>
                          </div>

                          {/* 2x2 Details Grid */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs bg-slate-50/70 dark:bg-muted/30 p-3 rounded-xl border border-border/40">
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                Time In
                              </p>
                              <p className="font-semibold text-foreground">
                                {format(s.timeIn, "h:mm a")}
                              </p>
                            </div>

                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                Time Out
                              </p>
                              <p className="font-semibold text-foreground">
                                {s.timeOut ? format(s.timeOut, "h:mm a") : "--"}
                              </p>
                            </div>

                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                Total Hours
                              </p>
                              <p className="font-semibold text-foreground">
                                {formatHours(s.totalMinutes)}
                              </p>
                            </div>

                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                Date
                              </p>
                              <p className="font-semibold text-foreground">
                                {format(s.date, "MMM d, yyyy")}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table view */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-sidebar">
                        <tr className="bg-sidebar hover:bg-sidebar border-b border-sidebar-border/40">
                          <th className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-12 px-6 text-left w-[25%]">DATE</th>
                          <th className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-12 px-6 text-left w-[20%]">TIME IN</th>
                          <th className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-12 px-6 text-left w-[20%]">TIME OUT</th>
                          <th className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-12 px-6 text-left w-[18%]">TOTAL HOURS</th>
                          <th className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-12 px-6 text-center w-[17%]">STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-14 text-center text-xs font-medium text-muted-foreground">No records this week.</td>
                          </tr>
                        ) : (
                          sessions.map((s, i) => (
                            <tr key={i} className="border-b border-gray-100 dark:border-border/60 hover:bg-gray-50/60 dark:hover:bg-muted/30 transition-colors">
                              <td className="py-4 px-6 font-bold text-xs text-foreground whitespace-nowrap align-middle">{format(s.date, "EEE, MMM d, yyyy")}</td>
                              <td className="py-4 px-6 text-xs text-muted-foreground font-medium whitespace-nowrap align-middle">{format(s.timeIn, "h:mm a")}</td>
                              <td className="py-4 px-6 text-xs text-muted-foreground font-medium whitespace-nowrap align-middle">{s.timeOut ? format(s.timeOut, "h:mm a") : "--"}</td>
                              <td className="py-4 px-6 text-xs text-muted-foreground font-medium whitespace-nowrap align-middle">{formatHours(s.totalMinutes)}</td>
                              <td className="py-4 px-6 text-center align-middle whitespace-nowrap"><StatusPill isLate={s.isLate} hasOut={s.timeOut !== null} /></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Manual Attendance */}
          {activeTab === "manual" && isAssigner && (
            <div className="bg-white dark:bg-card rounded-2xl border border-border/60 shadow-card-dark p-5 sm:p-6 overflow-hidden flex flex-col gap-4">
              {/* Top Controls Row */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Search Bar */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search ID, worker name..."
                    value={assignSearch}
                    onChange={e => setAssignSearch(e.target.value)}
                    className="w-full pl-9 pr-8 h-10 rounded-2xl border border-slate-200/90 dark:border-border bg-slate-50/50 dark:bg-muted/30 text-xs font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs focus:outline-none focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all"
                  />
                  {assignSearch && (
                    <button
                      type="button"
                      onClick={() => setAssignSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Right: Ministries, Roles, and Status Filter Tabs */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Select value={ministryFilter} onValueChange={setMinistryFilter}>
                    <SelectTrigger className="h-10 w-[145px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                      <SelectValue placeholder="All Ministries" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover max-h-72">
                      <SelectItem value="all" className="text-xs font-medium cursor-pointer">All Ministries</SelectItem>
                      {(ministries as any[]).map(m => (
                        <SelectItem key={m.id} value={m.id} className="text-xs font-medium cursor-pointer">{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!isMinistryHeadOnly && (
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="h-10 w-[130px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                        <SelectValue placeholder="All Roles" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover max-h-72">
                        <SelectItem value="all" className="text-xs font-medium cursor-pointer">All Roles</SelectItem>
                        {(roles as any[]).map(r => (
                          <SelectItem key={r.id} value={r.name} className="text-xs font-medium cursor-pointer">{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Status Filter Dropdown */}
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 w-[165px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover">
                      {[
                        { id: "all", label: "All Statuses", count: manualStatusCounts.all },
                        { id: "timed-in", label: "Timed In", count: manualStatusCounts["timed-in"] },
                        { id: "timed-out", label: "Timed Out", count: manualStatusCounts["timed-out"] },
                        { id: "not-yet", label: "Not Yet Timed In", count: manualStatusCounts["not-yet"] },
                      ].map(tab => (
                        <SelectItem key={tab.id} value={tab.id} className="text-xs font-medium cursor-pointer">
                          {tab.label} ({tab.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Table */}
              <div className="border border-border/60 rounded-2xl overflow-hidden flex flex-col bg-card">

                {/* Mobile card view */}
                <div className="md:hidden p-3 sm:p-4 space-y-3 flex-grow bg-slate-50/50 dark:bg-muted/10">
                  {filteredWorkers.length === 0 ? (
                    <div className="py-14 text-center text-xs font-medium text-muted-foreground bg-white dark:bg-card rounded-2xl border border-border/60">
                      No workers found.
                    </div>
                  ) : (
                    filteredWorkers.map(w => {
                      const ws = workerStatusMap[w.id];
                      const timeInStr = ws?.timeIn ? format(ws.timeIn, "h:mm a") : null;
                      const timeOutStr = ws?.timeOut ? format(ws.timeOut, "h:mm a") : null;
                      const ministry = (ministries as any[]).find(m => m.id === w.majorMinistryId);
                      const initials = (() => {
                        const parts = `${w.firstName} ${w.lastName}`.trim().split(" ");
                        return parts.length >= 2
                          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                          : `${w.firstName}`.slice(0, 2).toUpperCase();
                      })();

                      return (
                        <div
                          key={w.id}
                          className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xs hover:shadow-xs transition-shadow flex flex-col"
                        >
                          {/* Blue header: Avatar + Worker Name + Ministry + Status Badge */}
                          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-sidebar text-white">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-8 h-8 rounded-full bg-white/20 text-white text-xs font-bold flex items-center justify-center shrink-0 border border-white/25">
                                {initials}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-bold font-headline text-white leading-tight truncate">
                                  {w.firstName} {w.lastName}
                                </p>
                                <p className="text-[10px] text-white/70 truncate">
                                  {ministry?.name || "No Ministry"}
                                </p>
                              </div>
                            </div>

                            {/* Status Badge in Header */}
                            <div className="shrink-0">
                              {timeInStr && !timeOutStr ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-400/20 text-blue-100 border border-blue-400/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                  Incomplete
                                </span>
                              ) : timeInStr && timeOutStr ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/20 text-emerald-100 border border-emerald-400/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  Completed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400/20 text-amber-100 border border-amber-400/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                  Not Yet Timed In
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Body: Details Grid */}
                          <div className="p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs bg-slate-50/70 dark:bg-muted/30 p-2.5 rounded-xl border border-border/40">
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                  Date
                                </p>
                                <p className="font-semibold text-foreground truncate">
                                  {format(new Date(), "MMM d, yyyy")}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                  Worker ID
                                </p>
                                <p className="font-mono text-xs text-muted-foreground truncate">
                                  {w.workerId ? String(w.workerId).replace(/^COG-?/i, "").padStart(6, "0") : "--"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                  Time In
                                </p>
                                <p className="font-semibold text-foreground truncate">
                                  {timeInStr || "--"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                  Time Out
                                </p>
                                <p className="font-semibold text-foreground truncate">
                                  {timeOutStr || "--"}
                                </p>
                              </div>
                            </div>

                            {/* Action Buttons at the Bottom */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                type="button"
                                disabled={Boolean(ws?.timeIn)}
                                onClick={() => setAttendanceConfirm({ worker: w, type: "Clock In", status: ws })}
                                className={cn(
                                  "h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer",
                                  Boolean(ws?.timeIn) && "opacity-40 cursor-not-allowed pointer-events-none bg-slate-200 dark:bg-muted text-muted-foreground hover:bg-slate-200"
                                )}
                              >
                                <LogIn className="h-3.5 w-3.5" /> {Boolean(ws?.timeIn) ? "Timed In" : "Time In"}
                              </button>
                              <button
                                type="button"
                                disabled={!ws?.timeIn || Boolean(ws?.timeOut)}
                                onClick={() => setAttendanceConfirm({ worker: w, type: "Clock Out", status: ws })}
                                className={cn(
                                  "h-9 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer",
                                  (!ws?.timeIn || Boolean(ws?.timeOut)) && "opacity-40 cursor-not-allowed pointer-events-none"
                                )}
                              >
                                <LogOut className="h-3.5 w-3.5" /> {Boolean(ws?.timeOut) ? "Timed Out" : "Time Out"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop table view */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-sidebar">
                      <tr className="bg-sidebar hover:bg-sidebar border-b border-sidebar-border/40">
                        {["Worker", "Worker ID", "Role", "Ministry", "Current Status", "Last Activity", "Actions"].map(h => (
                          <th key={h} className={cn("px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap", "text-left")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWorkers.length === 0 ? (
                        <tr><td colSpan={7} className="py-14 text-center text-xs font-medium text-muted-foreground">No workers found.</td></tr>
                      ) : filteredWorkers.map(w => {
                        const ws = workerStatusMap[w.id];
                        const currentStatus = ws?.status ?? "not-yet";
                        const lastTime = ws?.lastTime ? format(ws.lastTime, "h:mm a") : null;
                        const lastType = ws?.lastType;
                        const ministry = (ministries as any[]).find(m => m.id === w.majorMinistryId);
                        const roleName = getRoleName(w);
                        return (
                          <tr key={w.id} className="border-b border-gray-100 dark:border-border/60 hover:bg-slate-50/70 dark:hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3.5 align-middle">
                              <div className="flex items-center gap-2.5">
                                <WorkerInitials name={`${w.firstName} ${w.lastName}`} />
                                <span className="text-xs font-semibold text-foreground whitespace-nowrap">{w.firstName} {w.lastName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-xs font-mono font-bold text-foreground align-middle whitespace-nowrap">{fmtId(w.workerId)}</td>
                            <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                              <RoleBadge role={roleName} />
                            </td>
                            <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium align-middle whitespace-nowrap">{ministry?.name || "--"}</td>
                            <td className="px-4 py-3.5 align-middle whitespace-nowrap"><AttendanceStatusBadge status={currentStatus} /></td>
                            <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium align-middle whitespace-nowrap">
                              {lastTime ? (
                                <span className="inline-flex items-center gap-1.5 font-medium">
                                  <span className={lastType === "Clock In" ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-blue-600 dark:text-blue-400 font-semibold"}>
                                    {lastType === "Clock In" ? "In" : "Out"}
                                  </span>
                                  <span className="text-muted-foreground/40 font-bold">&bull;</span>
                                  <span className="text-foreground font-medium">{lastTime}</span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50 font-mono">--</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 align-middle whitespace-nowrap text-center">
                              <div className="flex items-center justify-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-lg border border-border bg-popover">
                                    {!ws?.timeIn && (
                                      <DropdownMenuItem
                                        onClick={() => setAttendanceConfirm({ worker: w, type: "Clock In", status: ws })}
                                        className="cursor-pointer text-xs font-medium text-emerald-600 dark:text-emerald-400 focus:text-emerald-700"
                                      >
                                        <LogIn className="h-3.5 w-3.5 mr-2" /> Time In
                                      </DropdownMenuItem>
                                    )}
                                    {Boolean(ws?.timeIn) && !ws?.timeOut && (
                                      <DropdownMenuItem
                                        onClick={() => setAttendanceConfirm({ worker: w, type: "Clock Out", status: ws })}
                                        className="cursor-pointer text-xs font-medium text-blue-600 dark:text-blue-400 focus:text-blue-700"
                                      >
                                        <LogOut className="h-3.5 w-3.5 mr-2" /> Time Out
                                      </DropdownMenuItem>
                                    )}
                                    {Boolean(ws?.timeIn) && Boolean(ws?.timeOut) && (
                                      <div className="px-3 py-2 text-[11px] text-muted-foreground font-medium text-center select-none">
                                        Shift Completed
                                      </div>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Attendance Records */}
          {activeTab === "records" && isAssigner && (
            <div className="flex flex-col gap-6">
              {/* Stat Cards with top accent stripes (matching Workers page) */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard
                  label="TOTAL TODAY"
                  value={recordStats.total}
                  sub="records"
                  icon={Users}
                  accentColor="bg-sidebar"
                  iconClass="text-sidebar"
                  iconBgClass="bg-sidebar/10"
                />
                <StatCard
                  label="PRESENT"
                  value={recordStats.present}
                  sub="on time"
                  icon={CheckCircle2}
                  accentColor="bg-emerald-500"
                  iconClass="text-emerald-600"
                  iconBgClass="bg-emerald-50 dark:bg-emerald-950/40"
                />
                <StatCard
                  label="LATE"
                  value={recordStats.late}
                  sub="after 8:30"
                  icon={Clock}
                  accentColor="bg-amber-500"
                  iconClass="text-amber-600"
                  iconBgClass="bg-amber-50 dark:bg-amber-950/40"
                />
                <StatCard
                  label="ABSENT"
                  value={recordStats.absent}
                  sub="no time in"
                  icon={XCircle}
                  accentColor="bg-red-500"
                  iconClass="text-red-600"
                  iconBgClass="bg-red-50 dark:bg-red-950/40"
                />
                <StatCard
                  label="INCOMPLETE"
                  value={recordStats.incomplete}
                  sub="missing time out"
                  icon={AlertCircle}
                  accentColor="bg-blue-500"
                  iconClass="text-blue-600"
                  iconBgClass="bg-blue-50 dark:bg-blue-950/40"
                />
              </div>

              {/* Main Unified Table & Controls Container (Matching Room Reservations & Workers) */}
              <div className="bg-white dark:bg-card rounded-2xl border border-border/60 shadow-card-dark p-5 sm:p-6 overflow-hidden flex flex-col gap-4">
                {/* Top Controls Row */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Search */}
                  <div className="relative w-full sm:w-60">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search ID, worker name..."
                      value={recordsSearch}
                      onChange={e => setRecordsSearch(e.target.value)}
                      className="w-full pl-9 pr-8 h-10 rounded-2xl border border-slate-200/90 dark:border-border bg-slate-50/50 dark:bg-muted/30 text-xs font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs focus:outline-none focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all"
                    />
                    {recordsSearch && (
                      <button
                        type="button"
                        onClick={() => setRecordsSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Right Controls: Ministry + Role + Range + Status Dropdown */}
                  <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full sm:w-auto">
                    {/* Ministry */}
                    <Select value={recordsMinistryFilter} onValueChange={setRecordsMinistryFilter}>
                      <SelectTrigger className="h-10 w-full sm:w-[140px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                        <SelectValue placeholder="All Ministries" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover max-h-72">
                        <SelectItem value="all" className="text-xs font-medium cursor-pointer">All Ministries</SelectItem>
                        {(ministries as any[]).map(m => (
                          <SelectItem key={m.id} value={m.id} className="text-xs font-medium cursor-pointer">{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Role */}
                    {!isMinistryHeadOnly && (
                      <Select value={recordsRoleFilter} onValueChange={setRecordsRoleFilter}>
                        <SelectTrigger className="h-10 w-full sm:w-[130px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                          <SelectValue placeholder="All Roles" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover max-h-72">
                          <SelectItem value="all" className="text-xs font-medium cursor-pointer">All Roles</SelectItem>
                          {(roles as any[])
                            .filter(r => r.name?.trim().toLowerCase() !== "new role")
                            .map(r => {
                              const displayName = r.name.toLowerCase() === "super admin" ? "Admin" : r.name;
                              return (
                                <SelectItem key={r.id} value={r.name} className="text-xs font-medium cursor-pointer">
                                  {displayName}
                                </SelectItem>
                              );
                            })}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Range */}
                    <Select value={recordsRange} onValueChange={(val: any) => setRecordsRange(val)}>
                      <SelectTrigger className="h-10 w-full sm:w-[125px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                        <SelectValue placeholder="Range" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover">
                        <SelectItem value="today" className="text-xs font-medium cursor-pointer">Today</SelectItem>
                        <SelectItem value="yesterday" className="text-xs font-medium cursor-pointer">Yesterday</SelectItem>
                        <SelectItem value="this-week" className="text-xs font-medium cursor-pointer">This week</SelectItem>
                        <SelectItem value="this-month" className="text-xs font-medium cursor-pointer">This month</SelectItem>
                        <SelectItem value="all-time" className="text-xs font-medium cursor-pointer">All time</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Status */}
                    <Select value={recordsStatusFilter} onValueChange={setRecordsStatusFilter}>
                      <SelectTrigger className="h-10 w-full sm:w-[165px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover">
                        {[
                          { id: "all", label: "All Statuses", count: recordStats.total },
                          { id: "present", label: "Present", count: recordStats.present },
                          { id: "late", label: "Late", count: recordStats.late },
                          { id: "absent", label: "Absent", count: recordStats.absent },
                          { id: "incomplete", label: "Incomplete", count: recordStats.incomplete },
                        ].map(tab => (
                          <SelectItem key={tab.id} value={tab.id} className="text-xs font-medium cursor-pointer">
                            {tab.label} ({tab.count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Table Container */}
                <div className="border border-border/60 rounded-2xl overflow-hidden flex flex-col bg-card">

                  {/* Mobile card view */}
                  <div className="md:hidden p-3.5 sm:p-4 space-y-3 bg-muted/20">
                    {recordsLoading ? (
                      <div className="py-12 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-sidebar" /></div>
                    ) : filteredRecordRows.length === 0 ? (
                      <div className="py-14 text-center text-xs font-medium text-muted-foreground">No records found.</div>
                    ) : filteredRecordRows.map((row, i) => {
                      const ministry = (ministries as any[]).find(m => m.id === row.worker.majorMinistryId);
                      const initials = (() => {
                        const parts = `${row.worker.firstName} ${row.worker.lastName}`.trim().split(/\s+/);
                        return parts.length >= 2
                          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                          : `${row.worker.firstName}`.slice(0, 2).toUpperCase();
                      })();
                      const dateStr = format(row.date, "MMM d, yyyy");
                      const timeInStr = row.timeIn ? format(row.timeIn, "h:mm a") : "";
                      const timeOutStr = row.timeOut ? format(row.timeOut, "h:mm a") : "";
                      const workerIdFmt = row.worker.workerId ? String(row.worker.workerId).replace(/^COG-?/i, "").padStart(6, "0") : "--";

                      return (
                        <div
                          key={i}
                          className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xs hover:shadow-xs transition-shadow flex flex-col"
                        >
                          {/* Blue header: Avatar + Worker Name + Ministry + Status Badge */}
                          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-sidebar text-white">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-8 h-8 rounded-full bg-white/20 text-white text-xs font-bold flex items-center justify-center shrink-0 border border-white/25">
                                {initials}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-bold font-headline text-white leading-tight truncate">
                                  {row.worker.firstName} {row.worker.lastName}
                                </p>
                                <p className="text-[10px] text-white/70 truncate">
                                  {ministry?.name || "No Ministry"}
                                </p>
                              </div>
                            </div>

                            {/* Status Badge in Header */}
                            <div className="shrink-0">
                              {row.status === "present" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/20 text-emerald-100 border border-emerald-400/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  Present
                                </span>
                              )}
                              {row.status === "late" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400/20 text-amber-100 border border-amber-400/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                  Late
                                </span>
                              )}
                              {row.status === "absent" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-400/20 text-rose-100 border border-rose-400/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                  Absent
                                </span>
                              )}
                              {row.status === "incomplete" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-400/20 text-blue-100 border border-blue-400/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                  Incomplete
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Body: Details Grid */}
                          <div className="p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs bg-slate-50/70 dark:bg-muted/30 p-2.5 rounded-xl border border-border/40">
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                  Date
                                </p>
                                <p className="font-semibold text-foreground truncate">
                                  {dateStr}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                  Worker ID
                                </p>
                                <p className="font-mono text-xs text-muted-foreground truncate">
                                  {workerIdFmt}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                  Time In
                                </p>
                                <p className="font-semibold text-foreground truncate">
                                  {timeInStr || "--"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                  Time Out
                                </p>
                                <p className="font-semibold text-foreground truncate">
                                  {timeOutStr || "--"}
                                </p>
                              </div>
                            </div>

                            {/* Action Buttons at the Bottom */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setAttendanceConfirm({ worker: row.worker, type: "Clock In" })}
                                className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                              >
                                <LogIn className="h-3.5 w-3.5" /> Time In
                              </button>
                              <button
                                type="button"
                                disabled={!timeInStr}
                                onClick={() => setAttendanceConfirm({ worker: row.worker, type: "Clock Out" })}
                                className={cn(
                                  "h-9 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer",
                                  !timeInStr && "opacity-40 cursor-not-allowed pointer-events-none"
                                )}
                              >
                                <LogOut className="h-3.5 w-3.5" /> Time Out
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop table view */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-sidebar">
                        <tr className="bg-sidebar hover:bg-sidebar border-b border-sidebar-border/40">
                          {["Worker", "Worker ID", "Role", "Ministry", "Date", "Time In", "Time Out", "Hours", "Status"].map(h => (
                            <th key={h} className={cn("px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap", "text-left")}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recordsLoading ? (
                          <tr><td colSpan={9} className="py-12 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-sidebar" /></td></tr>
                        ) : filteredRecordRows.length === 0 ? (
                          <tr><td colSpan={9} className="py-14 text-center text-xs font-medium text-muted-foreground">No records found.</td></tr>
                        ) : filteredRecordRows.map((row, i) => {
                          const ministry = (ministries as any[]).find(m => m.id === row.worker.majorMinistryId);
                          return (
                            <tr key={i} className="border-b border-gray-100 dark:border-border/60 hover:bg-slate-50/70 dark:hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3.5 align-middle">
                                <div className="flex items-center gap-2.5">
                                  <WorkerInitials name={`${row.worker.firstName} ${row.worker.lastName}`} />
                                  <span className="text-xs font-semibold text-foreground whitespace-nowrap">{row.worker.firstName} {row.worker.lastName}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-xs font-mono font-bold text-foreground align-middle whitespace-nowrap">{fmtId(row.worker.workerId)}</td>
                              <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                                <RoleBadge role={getRoleName(row.worker)} />
                              </td>
                              <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium align-middle whitespace-nowrap">{ministry?.name || "--"}</td>
                              <td className="px-4 py-3.5 text-xs font-semibold text-foreground align-middle whitespace-nowrap">{format(row.date, "EEE, MMM d, yyyy")}</td>
                              <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium align-middle whitespace-nowrap">{row.timeIn ? format(row.timeIn, "h:mm a") : "--"}</td>
                              <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium align-middle whitespace-nowrap">{row.timeOut ? format(row.timeOut, "h:mm a") : "--"}</td>
                              <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium align-middle whitespace-nowrap">{formatHours(row.hours)}</td>
                              <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                                {row.status === "present" && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Present</span>}
                                {row.status === "late" && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Late</span>}
                                {row.status === "absent" && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Absent</span>}
                                {row.status === "incomplete" && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Incomplete</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table Footer */}
                <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
                  <span>Showing <strong className="text-foreground">{filteredRecordRows.length}</strong> record{filteredRecordRows.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ExportConfirmDialog
        open={showExportConfirm}
        onOpenChange={setShowExportConfirm}
        title={activeTab === "manual" ? "Export Today's Attendance?" : "Export Attendance Records?"}
        description={
          activeTab === "manual"
            ? "Do you want to export today's worker attendance statuses and summary as an Excel file (.xlsx)?"
            : "Do you want to export the attendance history records and summary as an Excel file (.xlsx)?"
        }
        onConfirm={handleExportAttendance}
      />

      {/* Confirmation & Validation Dialog for Time In / Time Out */}
      <AlertDialog open={!!attendanceConfirm} onOpenChange={(open) => !open && !isSubmittingAttendance && setAttendanceConfirm(null)}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-3xl p-6 text-center border-border/80 shadow-2xl relative">
          <button
            type="button"
            disabled={isSubmittingAttendance}
            onClick={() => setAttendanceConfirm(null)}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground/80 hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>

          <div
            className={cn(
              "w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3 border shadow-xs",
              attendanceConfirm?.type === "Clock In"
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                : "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800"
            )}
          >
            {attendanceConfirm?.type === "Clock In" ? (
              <LogIn className="h-7 w-7 stroke-[2]" />
            ) : (
              <LogOut className="h-7 w-7 stroke-[2]" />
            )}
          </div>

          <AlertDialogHeader className="space-y-1.5 text-center">
            <AlertDialogTitle className="text-lg font-bold text-center text-foreground font-headline">
              {attendanceConfirm?.type === "Clock In" ? "Confirm Time In" : "Confirm Time Out"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-xs sm:text-sm text-center text-muted-foreground leading-relaxed">
                <p>
                  Are you sure you want to record{" "}
                  <strong className="text-foreground font-semibold">
                    {attendanceConfirm?.type === "Clock In" ? "Time In" : "Time Out"}
                  </strong>{" "}
                  for{" "}
                  <strong className="text-foreground font-semibold">
                    {attendanceConfirm?.worker?.firstName} {attendanceConfirm?.worker?.lastName}
                  </strong>
                  ?
                </p>
                {(() => {
                  const ws = attendanceConfirm ? (attendanceConfirm.status || workerStatusMap[attendanceConfirm.worker?.id]) : null;
                  const hasTimeIn = Boolean(ws?.timeIn);

                  return (
                    <>
                      {attendanceConfirm?.type === "Clock In" && hasTimeIn && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2 mt-2.5 text-left">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                          <span>Notice: This worker already timed in today at {ws?.timeIn ? format(ws.timeIn, "h:mm a") : ""}.</span>
                        </div>
                      )}
                      {attendanceConfirm?.type === "Clock Out" && !hasTimeIn && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2 mt-2.5 text-left">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                          <span>Notice: This worker has no recorded Time In today.</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex flex-row gap-2.5 sm:justify-center mt-5">
            <AlertDialogCancel
              disabled={isSubmittingAttendance}
              className="flex-1 rounded-xl h-10 text-xs font-semibold cursor-pointer border-slate-200 dark:border-border hover:bg-slate-50 dark:hover:bg-muted mt-0"
            >
              Cancel
            </AlertDialogCancel>
            {(() => {
              const ws = attendanceConfirm ? (attendanceConfirm.status || workerStatusMap[attendanceConfirm.worker?.id]) : null;
              const hasTimeIn = Boolean(ws?.timeIn);
              const isTimeOutBlocked = attendanceConfirm?.type === "Clock Out" && !hasTimeIn;
              const isTimeInBlocked = attendanceConfirm?.type === "Clock In" && hasTimeIn;
              const isBlocked = isTimeOutBlocked || isTimeInBlocked;

              return (
                <AlertDialogAction
                  disabled={isSubmittingAttendance || isBlocked}
                  onClick={(e) => {
                    e.preventDefault();
                    if (!isBlocked) {
                      handleConfirmAttendance();
                    }
                  }}
                  className={cn(
                    "flex-1 rounded-xl h-10 text-xs font-bold text-white shadow-xs cursor-pointer transition-all mt-0",
                    attendanceConfirm?.type === "Clock In"
                      ? "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                      : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500",
                    isBlocked && "opacity-40 cursor-not-allowed pointer-events-none"
                  )}
                >
                  {isSubmittingAttendance ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : null}
                  Confirm {attendanceConfirm?.type === "Clock In" ? "Time In" : "Time Out"}
                </AlertDialogAction>
              );
            })()}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Attendance Session Details Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent
          className="w-[calc(100%-2.5rem)] max-w-md p-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 shadow-2xl gap-0 bg-background flex flex-col"
          style={{ maxHeight: "min(520px, calc(100dvh - 120px))" }}
        >
          <DialogTitle className="sr-only">Attendance Details</DialogTitle>
          {selectedSession && (
            <>
              {/* Header */}
              <div className="p-4 sm:p-5 pr-12 border-b border-border/70 bg-card/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-2xl border border-sidebar/20 bg-sidebar/10 text-sidebar dark:text-sky-400 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-bold font-headline tracking-tight text-foreground whitespace-nowrap">
                        Attendance Details
                      </h2>
                      <StatusPill isLate={selectedSession.isLate} hasOut={selectedSession.timeOut !== null} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(selectedSession.date, "EEEE, MMMM d, yyyy")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
                {/* Worker Card */}
                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-sidebar/10 text-sidebar dark:bg-sidebar/30 dark:text-sky-300 text-xs font-bold flex items-center justify-center shrink-0 border border-sidebar/20">
                    {workerProfile?.firstName?.[0] || "W"}{workerProfile?.lastName?.[0] || ""}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground leading-tight truncate">
                      {workerProfile ? `${workerProfile.firstName} ${workerProfile.lastName}` : (user?.email || "Worker")}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {(workerProfile as any)?.ministry || ministries.find(m => m.id === workerProfile?.majorMinistryId)?.name || "Worker"}
                    </p>
                  </div>
                </div>

                {/* Grid details */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50/80 dark:bg-muted/20 border border-border/60 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Time In
                    </span>
                    <span className="font-bold text-foreground text-sm block">
                      {format(selectedSession.timeIn, "h:mm a")}
                    </span>
                    {selectedSession.isLate && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium block">
                        Clocked in late
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Time Out
                    </span>
                    <span className="font-bold text-foreground text-sm block">
                      {selectedSession.timeOut ? format(selectedSession.timeOut, "h:mm a") : "--"}
                    </span>
                    {!selectedSession.timeOut && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium block">
                        Currently clocked in
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 pt-2 border-t border-border/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Total Hours
                    </span>
                    <span className="font-bold text-foreground text-sm block">
                      {formatHours(selectedSession.totalMinutes)}
                    </span>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-border/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Status
                    </span>
                    <span className="font-bold text-foreground text-sm block">
                      {!selectedSession.timeOut ? "Active Shift" : selectedSession.isLate ? "Late" : "Present"}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

export default function AttendancePage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="flex justify-center items-center py-24">
            <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
          </div>
        </AppLayout>
      }
    >
      <AttendanceContent />
    </Suspense>
  );
}
