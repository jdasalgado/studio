"use client";

import React, { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useSearchParams } from "next/navigation";
import {
  LoaderCircle, Download, Users, UtensilsCrossed,
  CalendarCheck, CheckCircle2, Clock, XCircle, TrendingUp,
  Search, ChevronLeft, ChevronRight, X, AlertCircle,
  Building2,
} from "lucide-react";
import { useUserRole } from "@/hooks/use-user-role";
import { useQuery } from "@tanstack/react-query";
import {
  format, startOfDay, startOfWeek,
  startOfMonth, endOfMonth, isSunday,
  differenceInMinutes,
} from "date-fns";
import type { Worker } from "@studio/types";
import { cn, toJsDate } from "@/lib/utils";
import {
  getAttendanceRecords, getBookings,
  getMealStubs, getMinistries, getRooms, getWorkers,
} from "@/actions/db";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@studio/ui";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { exportToExcel } from "@/lib/export-excel";
import { ExportConfirmDialog } from "@/components/common/export-confirm-dialog";
import { saveFileUniversal } from "@/lib/save-file-native";
import { useToast } from "@/hooks/use-toast";

// ── Helpers ───────────────────────────────────────────────────────────────────
function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  saveFileUniversal(blob, filename, "text/csv");
}

function WorkerInitials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const init = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  return (
    <span className="w-8 h-8 rounded-full bg-sidebar/10 text-sidebar dark:bg-sidebar/30 dark:text-sidebar-foreground text-[11px] font-bold flex items-center justify-center shrink-0">
      {init}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "present" || s === "approved" || s === "claimed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span className="capitalize">{status}</span>
      </span>
    );
  }
  if (s === "late" || s.startsWith("pending") || s === "issued" || s === "unclaimed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        <span className="capitalize">{(s === "issued" || s === "unclaimed") ? "Unclaimed" : status}</span>
      </span>
    );
  }
  if (s === "absent" || s === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        <span className="capitalize">{status}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
      <span className="capitalize">{status}</span>
    </span>
  );
}

function HeaderStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "present" || s === "approved" || s === "claimed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span className="capitalize">{status}</span>
      </span>
    );
  }
  if (s === "late" || s.startsWith("pending") || s === "issued" || s === "unclaimed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-200 border border-amber-400/30 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span className="capitalize">{(s === "issued" || s === "unclaimed") ? "Unclaimed" : status}</span>
      </span>
    );
  }
  if (s === "absent" || s === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-400/20 text-rose-200 border border-rose-400/30 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
        <span className="capitalize">{status}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-400/20 text-blue-200 border border-blue-400/30 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
      <span className="capitalize">{status}</span>
    </span>
  );
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

const ITEMS_PER_PAGE = 8;

const fmtId = (id: string | null | undefined) => {
  if (!id) return "—";
  const clean = String(id).replace(/^COG-?/i, "").trim();
  const num = parseInt(clean, 10);
  return isNaN(num) ? id : String(num).padStart(6, "0");
};

// ── Department Scoping Helpers ────────────────────────────────────────────────
export const WORDA_DEPARTMENTS: Record<string, string[]> = {
  Worship: ["whitelight", "white light", "dance", "pmt", "crusade", "singers", "musicians", "audio"],
  Outreach: ["cluster", "weyj", "tapat"],
  Relationship: ["sports", "gem", "ushering", "mens", "men's", "ladies", "youth empowered", "young adults", "worker"],
  Discipleship: ["j12", "oneliner", "one liner", "cldp", "kid", "children", "life institute", "kca"],
  Administration: ["arts", "engineering", "finance", "in house", "in-house", "linkages", "security and shuttle", "security & shuttle", "technology", "ventures"],
};

export function resolveMinistryDepartment(min: any): string | null {
  if (!min) return null;
  const deptCode = (min.departmentCode || min.department?.code || (typeof min.department === 'string' ? min.department : min.department?.name) || "").toLowerCase().trim();
  if (deptCode === "w" || deptCode.includes("worship")) return "Worship";
  if (deptCode === "o" || deptCode.includes("outreach")) return "Outreach";
  if (deptCode === "r" || deptCode.includes("relationship")) return "Relationship";
  if (deptCode === "d" || deptCode.includes("discipleship")) return "Discipleship";
  if (deptCode === "a" || deptCode.includes("admin")) return "Administration";

  const name = (min.name || "").toLowerCase().trim();
  for (const [dept, keywords] of Object.entries(WORDA_DEPARTMENTS)) {
    if (keywords.some(k => name.includes(k) || name.startsWith(k))) {
      return dept;
    }
  }
  return null;
}

export function resolveUserHeadDepartment(workerProfile: any, allMinistries: any[]): string | null {
  if (!workerProfile) return null;
  const direct = (workerProfile.department || workerProfile.departmentCode || "").toLowerCase().trim();
  if (direct === "w" || direct.includes("worship")) return "Worship";
  if (direct === "o" || direct.includes("outreach")) return "Outreach";
  if (direct === "r" || direct.includes("relationship")) return "Relationship";
  if (direct === "d" || direct.includes("discipleship")) return "Discipleship";
  if (direct === "a" || direct.includes("admin")) return "Administration";

  const roleName = ((workerProfile.role?.name || '') + ' ' + (workerProfile.roles?.map((r: any) => r.role?.name || '').join(' ') || '')).toLowerCase();
  if (roleName.includes("worship")) return "Worship";
  if (roleName.includes("outreach")) return "Outreach";
  if (roleName.includes("relationship")) return "Relationship";
  if (roleName.includes("discipleship")) return "Discipleship";
  if (roleName.includes("admin")) return "Administration";

  const userMins = (allMinistries || []).filter(m =>
    m.id === workerProfile.majorMinistryId ||
    m.id === workerProfile.minorMinistryId ||
    m.headId === workerProfile.id ||
    (Array.isArray(workerProfile.assignedMinistryIds) && workerProfile.assignedMinistryIds.includes(m.id))
  );
  for (const m of userMins) {
    const dept = resolveMinistryDepartment(m);
    if (dept) return dept;
  }
  return null;
}

// ── Attendance Tab ────────────────────────────────────────────────────────────
function AttendanceTab() {
  const { workerProfile, isSuperAdmin } = useUserRole();
  const actorId = workerProfile?.id;
  const monthStart = useMemo(() => startOfMonth(new Date()), []);
  const monthEnd = useMemo(() => endOfMonth(new Date()), []);

  const { data: workers } = useQuery({ queryKey: ["workers", actorId], queryFn: () => getWorkers({ actorId }) });
  const { data: ministries } = useQuery({ queryKey: ["ministries", actorId], queryFn: () => getMinistries(actorId) });
  const { data: attendance, isLoading } = useQuery({
    queryKey: ["attendance-report-month", actorId],
    queryFn: () => getAttendanceRecords({ dateFrom: monthStart, dateTo: monthEnd, actorId }),
  });

  const [search, setSearch] = useState("");
  const [ministryFilter, setMinistryFilter] = useState("all");
  const [workerTypeFilter, setWorkerTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [range, setRange] = useState<"today" | "this-week" | "this-month" | "all-time">("this-month");
  const [page, setPage] = useState(1);

  const headDept = useMemo(() => {
    if (isSuperAdmin) return null;
    return resolveUserHeadDepartment(workerProfile, ministries as any[]);
  }, [isSuperAdmin, workerProfile, ministries]);

  const filteredMinistries = useMemo(() => {
    if (!ministries) return [];
    if (headDept) {
      return (ministries as any[]).filter(m => resolveMinistryDepartment(m) === headDept);
    }
    return ministries as any[];
  }, [ministries, headDept]);

  const scopedWorkers = useMemo(() => {
    if (!workers) return [];
    if (headDept) {
      return workers.filter(w => {
        const min = (ministries as any[])?.find(m => m.id === w.majorMinistryId || m.id === w.minorMinistryId);
        const wDept = min ? resolveMinistryDepartment(min) : resolveUserHeadDepartment(w, ministries as any[]);
        return wDept === headDept;
      });
    }
    return workers;
  }, [workers, headDept, ministries]);

  const scopedAttendance = useMemo(() => {
    if (!attendance) return [];
    if (headDept) {
      const vIds = new Set(scopedWorkers.map(w => w.id));
      return attendance.filter(r => vIds.has(r.workerProfileId));
    }
    return attendance;
  }, [attendance, scopedWorkers, headDept]);

  // Ministry distribution chart
  const ministryChartData = useMemo(() => {
    if (!scopedAttendance || !scopedWorkers || !filteredMinistries) return [];
    const counts: Record<string, number> = {};
    for (const rec of scopedAttendance) {
      if (rec.type !== "Clock In") continue;
      const w = scopedWorkers.find(x => x.id === rec.workerProfileId);
      if (!w) continue;
      const min = filteredMinistries.find(m => m.id === w.majorMinistryId);
      if (min) counts[min.name] = (counts[min.name] || 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 15);
  }, [scopedAttendance, scopedWorkers, filteredMinistries]);

  // Stats
  const totalTimeIns = useMemo(() => scopedAttendance?.filter(a => a.type === "Clock In").length ?? 0, [scopedAttendance]);
  const totalTimeOuts = useMemo(() => scopedAttendance?.filter(a => a.type === "Clock Out").length ?? 0, [scopedAttendance]);
  const uniqueWorkers = useMemo(() => new Set(scopedAttendance?.map(a => a.workerProfileId)).size ?? 0, [scopedAttendance]);
  const avgRate = useMemo(() => {
    if (!scopedWorkers?.length) return "0%";
    const pct = Math.round((uniqueWorkers / scopedWorkers.length) * 100);
    return `${pct}%`;
  }, [uniqueWorkers, scopedWorkers]);

  // Build per-worker per-day rows
  const rows = useMemo(() => {
    if (!scopedAttendance || !scopedWorkers) return [];
    const workerMap: Record<string, any[]> = {};
    for (const r of scopedAttendance) {
      if (!workerMap[r.workerProfileId]) workerMap[r.workerProfileId] = [];
      workerMap[r.workerProfileId].push({ ...r, _t: toJsDate(r.time) });
    }
    const result: any[] = [];
    for (const [wId, recs] of Object.entries(workerMap)) {
      const w = scopedWorkers.find(x => x.id === wId);
      if (!w) continue;
      const dayMap: Record<string, any[]> = {};
      for (const r of recs) {
        const day = format(r._t, "yyyy-MM-dd");
        if (!dayMap[day]) dayMap[day] = [];
        dayMap[day].push(r);
      }
      for (const [day, dayRecs] of Object.entries(dayMap)) {
        const sorted = dayRecs.sort((a, b) => a._t.getTime() - b._t.getTime());
        const inRec = sorted.find(r => r.type === "Clock In");
        const outRec = [...sorted].reverse().find(r => r.type === "Clock Out");
        const timeIn = inRec ? inRec._t : null;
        const timeOut = outRec ? outRec._t : null;
        const hours = timeIn && timeOut ? differenceInMinutes(timeOut, timeIn) : null;
        let status = "absent";
        if (!timeIn) status = "absent";
        else if (!timeOut) status = "incomplete";
        else if (timeIn.getHours() > 8 || (timeIn.getHours() === 8 && timeIn.getMinutes() > 30)) status = "late";
        else status = "present";
        result.push({ worker: w, date: new Date(day), timeIn, timeOut, hours, status });
      }
    }
    return result.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [scopedAttendance, scopedWorkers]);

  // Filter based on range
  const rangeFilteredRows = useMemo(() => {
    const today = startOfDay(new Date());
    const week = startOfWeek(new Date(), { weekStartsOn: 1 });
    return rows.filter(r => {
      if (range === "today") return r.date >= today;
      if (range === "this-week") return r.date >= week;
      return true;
    });
  }, [rows, range]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: rangeFilteredRows.length,
      present: rangeFilteredRows.filter(r => r.status === "present").length,
      late: rangeFilteredRows.filter(r => r.status === "late").length,
      absent: rangeFilteredRows.filter(r => r.status === "absent").length,
      incomplete: rangeFilteredRows.filter(r => r.status === "incomplete").length,
    };
  }, [rangeFilteredRows]);

  const filteredRows = useMemo(() => {
    return rangeFilteredRows.filter(r => {
      const name = `${r.worker.firstName} ${r.worker.lastName}`.toLowerCase();
      const q = search.trim().toLowerCase();
      if (q && !name.includes(q) && !fmtId(r.worker.workerId).toLowerCase().includes(q)) return false;
      if (ministryFilter !== "all" && r.worker.majorMinistryId !== ministryFilter) return false;
      if (workerTypeFilter !== "all" && r.worker.employmentType !== workerTypeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [rangeFilteredRows, search, ministryFilter, workerTypeFilter, statusFilter]);

  const totalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE) || 1;
  const paginatedRows = filteredRows.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const { toast } = useToast();
  const [showExportConfirm, setShowExportConfirm] = useState(false);

  useEffect(() => {
    const onExport = () => setShowExportConfirm(true);
    window.addEventListener("reports:trigger-export", onExport);
    return () => window.removeEventListener("reports:trigger-export", onExport);
  }, []);

  const handleExport = () => {
    const recordsHeaders = ["Worker", "Worker ID", "Ministry", "Date", "Time In", "Time Out", "Hours", "Status"];
    const recordsRows = filteredRows.map(r => [
      `${r.worker.firstName} ${r.worker.lastName}`,
      fmtId(r.worker.workerId),
      (ministries as any[])?.find(m => m.id === r.worker.majorMinistryId)?.name || "—",
      format(r.date, "MMM d, yyyy"),
      r.timeIn ? format(r.timeIn, "H:mm") : "—",
      r.timeOut ? format(r.timeOut, "H:mm") : "—",
      r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : "—",
    ]);

    const statusCounts: Record<string, number> = {};
    filteredRows.forEach(r => {
      const s = r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : "Unknown";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    const summaryRows = Object.entries(statusCounts).map(([status, count]) => [
      status,
      count,
      filteredRows.length > 0 ? `${Math.round((count / filteredRows.length) * 100)}%` : "0%",
    ]);

    exportToExcel(`attendance-report_${format(new Date(), "yyyyMMdd")}.xlsx`, [
      {
        name: "Attendance Records",
        data: [recordsHeaders, ...recordsRows],
        colWidths: [24, 14, 24, 16, 12, 12, 12, 14],
      },
      {
        name: "Attendance Summary",
        data: [
          ["Total Records", filteredRows.length],
          [],
          ["Status", "Count", "Percentage"],
          ...summaryRows,
        ],
        colWidths: [20, 14, 14],
      },
    ]);

    toast({ title: "Attendance Exported", description: `Exported ${filteredRows.length} records to Excel.` });
  };

  if (isLoading) return <div className="flex justify-center py-16"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Time Ins"
          value={totalTimeIns}
          sub="this month"
          icon={CheckCircle2}
          accentColor="bg-sidebar"
          iconClass="text-sidebar"
          iconBgClass="bg-sidebar/10"
        />
        <StatCard
          label="Total Time Outs"
          value={totalTimeOuts}
          sub="this month"
          icon={XCircle}
          accentColor="bg-emerald-500"
          iconClass="text-emerald-600"
          iconBgClass="bg-emerald-50 dark:bg-emerald-950/40"
        />
        <StatCard
          label="Unique Workers"
          value={uniqueWorkers}
          sub="who clocked in"
          icon={Users}
          accentColor="bg-orange-400"
          iconClass="text-orange-500"
          iconBgClass="bg-orange-50 dark:bg-orange-950/40"
        />
        <StatCard
          label="Avg. Attendance Rate"
          value={avgRate}
          sub="of total workforce"
          icon={TrendingUp}
          accentColor="bg-blue-500"
          iconClass="text-blue-600"
          iconBgClass="bg-blue-50 dark:bg-blue-950/40"
        />
      </div>

      {/* Ministry Distribution Chart */}
      {ministryChartData.length > 0 && (
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-200/80 dark:border-border shadow-xs p-6">
          <h2 className="text-base font-bold text-foreground font-headline mb-0.5">Attendance by Ministry</h2>
          <p className="text-xs text-muted-foreground mb-5">Logs per ministry this month.</p>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ministryChartData} margin={{ top: 4, right: 4, left: -20, bottom: 5 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="name"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#6b7280" }}
                  interval={0}
                />
                <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: "#9ca3af" }} />
                <Tooltip
                  contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", fontSize: "12px" }}
                  cursor={{ fill: "rgba(17,46,126,0.06)" }}
                />
                <Bar dataKey="count" name="Clock Ins" fill="#112e7e" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Main Table & Unified Controls Container */}
      <div className="bg-white dark:bg-card rounded-2xl border border-gray-200/80 dark:border-border shadow-xs p-5 sm:p-6 overflow-hidden">
        {/* Section Header */}
        <div className="mb-4">
          <h3 className="text-base font-bold font-headline text-foreground">Attendance Records</h3>
          <p className="text-xs text-muted-foreground">Detailed logs and time tracking records this month.</p>
        </div>

        {/* Top Controls Row: Search + Ministry + Worker Type + Range */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] sm:min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search worker or ID..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-8 h-10 rounded-2xl border border-slate-200/90 dark:border-border bg-slate-50/50 dark:bg-muted/30 text-xs font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs focus:outline-none focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(""); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Equalized Dropdowns Grid */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full sm:w-auto">
            {/* Ministry */}
            <Select value={ministryFilter} onValueChange={v => { setMinistryFilter(v); setPage(1); }}>
              <SelectTrigger className="h-10 w-full sm:w-[150px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                <SelectValue placeholder="All Ministries" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover max-h-72">
                <SelectItem value="all" className="text-xs font-medium cursor-pointer">All Ministries</SelectItem>
                {filteredMinistries.map(m => (
                  <SelectItem key={m.id} value={m.id} className="text-xs font-medium cursor-pointer">{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Worker Type */}
            <Select value={workerTypeFilter} onValueChange={v => { setWorkerTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="h-10 w-full sm:w-[130px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                <SelectValue placeholder="Worker Type" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover">
                <SelectItem value="all" className="text-xs font-medium cursor-pointer">All Types</SelectItem>
                <SelectItem value="Full-Time" className="text-xs font-medium cursor-pointer">Full-Time</SelectItem>
                <SelectItem value="Part-Time" className="text-xs font-medium cursor-pointer">Part-Time</SelectItem>
                <SelectItem value="Volunteer" className="text-xs font-medium cursor-pointer">Volunteer</SelectItem>
                <SelectItem value="On-Call" className="text-xs font-medium cursor-pointer">On-Call</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter Dropdown */}
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
              <SelectTrigger className="h-10 w-full sm:w-[165px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover">
                <SelectItem value="all" className="text-xs font-medium cursor-pointer">All Statuses ({tabCounts.all})</SelectItem>
                <SelectItem value="present" className="text-xs font-medium cursor-pointer">Present ({tabCounts.present})</SelectItem>
                <SelectItem value="late" className="text-xs font-medium cursor-pointer">Late ({tabCounts.late})</SelectItem>
                <SelectItem value="absent" className="text-xs font-medium cursor-pointer">Absent ({tabCounts.absent})</SelectItem>
                <SelectItem value="incomplete" className="text-xs font-medium cursor-pointer">Incomplete ({tabCounts.incomplete})</SelectItem>
              </SelectContent>
            </Select>

            {/* Range */}
            <Select value={range} onValueChange={(v: any) => { setRange(v); setPage(1); }}>
              <SelectTrigger className="h-10 w-full sm:w-[125px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover">
                <SelectItem value="today" className="text-xs font-medium cursor-pointer">Today</SelectItem>
                <SelectItem value="this-week" className="text-xs font-medium cursor-pointer">This Week</SelectItem>
                <SelectItem value="this-month" className="text-xs font-medium cursor-pointer">This Month</SelectItem>
                <SelectItem value="all-time" className="text-xs font-medium cursor-pointer">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table Container */}
        <div className="border border-gray-200/80 dark:border-border rounded-2xl mt-5 overflow-hidden">
          {/* Mobile card view */}
          <div className="md:hidden p-3 sm:p-4 space-y-3 bg-slate-50/50 dark:bg-muted/10">
            {paginatedRows.length === 0 ? (
              <div className="py-14 text-center text-xs font-medium text-muted-foreground bg-white dark:bg-card rounded-2xl border border-border/40">No attendance records found.</div>
            ) : paginatedRows.map((row, i) => {
              const ministry = (ministries as any[] || []).find(m => m.id === row.worker.majorMinistryId);
              return (
                <div key={i} className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs transition-colors">
                  {/* Navy blue header: Date + Status Badge */}
                  <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-sidebar text-white">
                    <span className="text-xs font-medium text-white/90 font-mono">
                      {format(row.date, "EEE, MMM d, yyyy")}
                    </span>
                    <HeaderStatusBadge status={row.status} />
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <WorkerInitials name={`${row.worker.firstName} ${row.worker.lastName}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{row.worker.firstName} {row.worker.lastName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {ministry?.name || "—"}{row.worker.workerId ? ` · ${fmtId(row.worker.workerId)}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Details Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50/70 dark:bg-muted/30 p-2.5 rounded-xl border border-border/40">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Time In</p>
                        <p className="font-semibold font-mono text-foreground">{row.timeIn ? format(row.timeIn, "H:mm") : "——"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Time Out</p>
                        <p className="font-semibold font-mono text-foreground">{row.timeOut ? format(row.timeOut, "H:mm") : "——"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Hours</p>
                        <p className="font-semibold font-mono text-foreground">{row.hours != null ? `${(row.hours / 60).toFixed(1)}h` : "——"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table view */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full">
              <thead className="bg-sidebar">
                <tr className="bg-sidebar hover:bg-sidebar border-b border-sidebar-border/40">
                  {["Worker", "Worker ID", "Ministry", "Time In", "Time Out", "Total Hours", "Date", "Status"].map(h => (
                    <th key={h} className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr><td colSpan={8} className="py-14 text-center text-xs font-medium text-muted-foreground">No attendance records found.</td></tr>
                ) : paginatedRows.map((row, i) => {
                  const ministry = (ministries as any[] || []).find(m => m.id === row.worker.majorMinistryId);
                  return (
                    <tr key={i} className="border-b border-gray-100 dark:border-border/60 hover:bg-slate-50/70 dark:hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex items-center gap-2.5">
                          <WorkerInitials name={`${row.worker.firstName} ${row.worker.lastName}`} />
                          <div>
                            <span className="text-xs font-semibold text-foreground leading-tight block">{row.worker.firstName} {row.worker.lastName}</span>
                            <span className="text-[11px] text-muted-foreground truncate block">{row.worker.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-mono font-bold text-foreground align-middle whitespace-nowrap">
                        {fmtId(row.worker.workerId)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium align-middle whitespace-nowrap">
                        {ministry?.name || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground font-medium align-middle whitespace-nowrap">
                        {row.timeIn ? format(row.timeIn, "H:mm") : "——"}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground font-medium align-middle whitespace-nowrap">
                        {row.timeOut ? format(row.timeOut, "H:mm") : "——"}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-foreground font-medium align-middle whitespace-nowrap">
                        {row.hours != null ? `${(row.hours / 60).toFixed(1)}h` : "——"}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium align-middle whitespace-nowrap">
                        {format(row.date, "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="px-2 py-4 mt-2 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground font-medium">
            Showing {filteredRows.length > 0 ? `${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, filteredRows.length)}` : "0"} of {filteredRows.length} records
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 w-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-border text-muted-foreground hover:bg-slate-50 dark:hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 5 && page > 3) {
                pageNum = page - 3 + i;
                if (pageNum + (5 - i) > totalPages) pageNum = totalPages - 4 + i;
              }
              if (pageNum <= 0 || pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    "h-8 w-8 flex items-center justify-center rounded-xl text-xs font-semibold transition-all cursor-pointer",
                    page === pageNum
                      ? "bg-sidebar text-white font-bold shadow-xs"
                      : "border border-slate-200/90 dark:border-border text-foreground hover:bg-slate-50 dark:hover:bg-muted/40"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="h-8 w-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-border text-muted-foreground hover:bg-slate-50 dark:hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <ExportConfirmDialog
        open={showExportConfirm}
        onOpenChange={setShowExportConfirm}
        title="Export Attendance Report?"
        description="Do you want to export the attendance records and summary as an Excel file (.xlsx) with clean, organized formatting?"
        onConfirm={handleExport}
      />
    </div>
  );
}

// ── Meal Stub Claims Tab ──────────────────────────────────────────────────────
function MealStubClaimsTab() {
  const { workerProfile, isSuperAdmin } = useUserRole();
  const actorId = workerProfile?.id;
  const monthStart = useMemo(() => startOfMonth(new Date()), []);
  const monthEnd = useMemo(() => endOfMonth(new Date()), []);

  const { data: mealstubs, isLoading } = useQuery({
    queryKey: ["mealstubs-report", actorId],
    queryFn: () => getMealStubs({ dateFrom: monthStart, dateTo: monthEnd, actorId }),
  });
  const { data: workers } = useQuery({ queryKey: ["workers", actorId], queryFn: () => getWorkers({ actorId }) });
  const { data: ministries } = useQuery({ queryKey: ["ministries", actorId], queryFn: () => getMinistries(actorId) });

  const [search, setSearch] = useState("");
  const [ministryFilter, setMinistryFilter] = useState("all");
  const [workerTypeFilter, setWorkerTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const headDept = useMemo(() => {
    if (isSuperAdmin) return null;
    return resolveUserHeadDepartment(workerProfile, ministries as any[]);
  }, [isSuperAdmin, workerProfile, ministries]);

  const filteredMinistries = useMemo(() => {
    if (!ministries) return [];
    if (headDept) {
      return (ministries as any[]).filter(m => resolveMinistryDepartment(m) === headDept);
    }
    return ministries as any[];
  }, [ministries, headDept]);

  const rows = useMemo(() => {
    return (mealstubs || []).map(s => {
      const w = workers?.find(x => x.id === s.workerId);
      const min = w ? (ministries as any[] || []).find(m => m.id === w.majorMinistryId) : null;
      return { ...s, worker: w, ministry: min };
    }).filter(r => {
      if (headDept) {
        const wDept = r.ministry ? resolveMinistryDepartment(r.ministry) : resolveUserHeadDepartment(r.worker, ministries as any[]);
        return wDept === headDept;
      }
      return true;
    });
  }, [mealstubs, workers, ministries, headDept]);

  const stats = useMemo(() => {
    const claimed = rows.filter(s => s.status === "Claimed").length;
    const unclaimed = rows.length - claimed;
    return {
      issued: rows.length,
      claimed,
      unclaimed,
      claimRate: rows.length > 0 ? `${Math.round((claimed / rows.length) * 100)}%` : "0%",
    };
  }, [rows]);

  const tabCounts = useMemo(() => {
    return {
      all: rows.length,
      claimed: rows.filter(r => r.status === "Claimed").length,
      unclaimed: rows.filter(r => r.status !== "Claimed").length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (q && !r.workerName.toLowerCase().includes(q)) return false;
      if (ministryFilter !== "all" && r.ministry?.id !== ministryFilter) return false;
      if (workerTypeFilter !== "all" && r.worker?.employmentType !== workerTypeFilter) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "Claimed" && r.status !== "Claimed") return false;
        if (statusFilter === "Issued" && r.status === "Claimed") return false;
      }
      return true;
    });
  }, [rows, search, ministryFilter, workerTypeFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const { toast } = useToast();
  const [showExportConfirm, setShowExportConfirm] = useState(false);

  useEffect(() => {
    const onExport = () => setShowExportConfirm(true);
    window.addEventListener("reports:trigger-export", onExport);
    return () => window.removeEventListener("reports:trigger-export", onExport);
  }, []);

  const handleExport = () => {
    const claimsHeaders = ["Worker", "Ministry", "Date Issued", "Date Claimed", "Status", "Claim Type"];
    const claimsRows = filtered.map(s => [
      s.workerName,
      s.ministry?.name || "—",
      format(toJsDate(s.date), "MMM d, yyyy"),
      (s as any).claimedAt ? format(toJsDate((s as any).claimedAt), "MMM d, yyyy") : "——",
      s.status === "Issued" ? "Unclaimed" : s.status,
      (s as any).stubType || "Daily",
    ]);

    exportToExcel(`mealstub-claims_${format(new Date(), "yyyyMMdd")}.xlsx`, [
      {
        name: "Meal Claims",
        data: [claimsHeaders, ...claimsRows],
        colWidths: [24, 24, 16, 16, 14, 14],
      },
      {
        name: "Claims Summary",
        data: [
          ["Metric", "Value"],
          ["Total Issued", stats.issued],
          ["Claimed", stats.claimed],
          ["Unclaimed", stats.unclaimed],
          ["Claim Rate", stats.claimRate],
        ],
        colWidths: [20, 16],
      },
    ]);

    toast({ title: "Meal Claims Exported", description: `Exported ${filtered.length} claims records to Excel.` });
  };

  // Donut chart data
  const donutData = [
    { name: "Claimed", value: stats.claimed, color: "#10b981" },
    { name: "Unclaimed", value: stats.unclaimed, color: "#f59e0b" },
  ];

  if (isLoading) return <div className="flex justify-center py-16"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Issued"
          value={stats.issued.toLocaleString()}
          sub="this month"
          icon={UtensilsCrossed}
          accentColor="bg-sidebar"
          iconClass="text-sidebar"
          iconBgClass="bg-sidebar/10"
        />
        <StatCard
          label="Total Claimed"
          value={stats.claimed.toLocaleString()}
          sub="this month"
          icon={CheckCircle2}
          accentColor="bg-emerald-500"
          iconClass="text-emerald-600"
          iconBgClass="bg-emerald-50 dark:bg-emerald-950/40"
        />
        <StatCard
          label="Total Unclaimed"
          value={stats.unclaimed.toLocaleString()}
          sub="this month"
          icon={XCircle}
          accentColor="bg-amber-500"
          iconClass="text-amber-600"
          iconBgClass="bg-amber-50 dark:bg-amber-950/40"
        />
        <StatCard
          label="Claim Rate"
          value={stats.claimRate}
          sub="of issued stubs"
          icon={TrendingUp}
          accentColor="bg-blue-500"
          iconClass="text-blue-600"
          iconBgClass="bg-blue-50 dark:bg-blue-950/40"
        />
      </div>

      {/* Main Table + Donut Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
        {/* Table Card */}
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-200/80 dark:border-border shadow-xs p-5 sm:p-6 overflow-hidden">
          {/* Section Header */}
          <div className="mb-4">
            <h3 className="text-base font-bold font-headline text-foreground">Meal Stub Claims</h3>
            <p className="text-xs text-muted-foreground">Track claimed and unclaimed meal vouchers across ministries.</p>
          </div>

          {/* Top Controls Row: Search + Ministry + Worker Type */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] sm:min-w-[220px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search worker..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-8 h-10 rounded-2xl border border-slate-200/90 dark:border-border bg-slate-50/50 dark:bg-muted/30 text-xs font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs focus:outline-none focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Equalized Dropdowns Grid */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full sm:w-auto">
              {/* Ministry */}
              <Select value={ministryFilter} onValueChange={v => { setMinistryFilter(v); setPage(1); }}>
                <SelectTrigger className="h-10 w-full sm:w-[140px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                  <SelectValue placeholder="All Ministries" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover max-h-72">
                  <SelectItem value="all" className="text-xs font-medium cursor-pointer">All Ministries</SelectItem>
                  {filteredMinistries.map(m => (
                    <SelectItem key={m.id} value={m.id} className="text-xs font-medium cursor-pointer">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Worker Type */}
              <Select value={workerTypeFilter} onValueChange={v => { setWorkerTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="h-10 w-full sm:w-[125px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                  <SelectValue placeholder="Worker Type" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover">
                  <SelectItem value="all" className="text-xs font-medium cursor-pointer">All Types</SelectItem>
                  <SelectItem value="Full-Time" className="text-xs font-medium cursor-pointer">Full-Time</SelectItem>
                  <SelectItem value="Part-Time" className="text-xs font-medium cursor-pointer">Part-Time</SelectItem>
                  <SelectItem value="Volunteer" className="text-xs font-medium cursor-pointer">Volunteer</SelectItem>
                  <SelectItem value="On-Call" className="text-xs font-medium cursor-pointer">On-Call</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter Dropdown */}
              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
                <SelectTrigger className="h-10 w-full sm:w-[165px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover">
                  <SelectItem value="all" className="text-xs font-medium cursor-pointer">All Statuses ({tabCounts.all})</SelectItem>
                  <SelectItem value="Claimed" className="text-xs font-medium cursor-pointer">Claimed ({tabCounts.claimed})</SelectItem>
                  <SelectItem value="Issued" className="text-xs font-medium cursor-pointer">Unclaimed ({tabCounts.unclaimed})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="border border-gray-200/80 dark:border-border rounded-2xl mt-5 overflow-hidden">

            {/* Mobile card view */}
            <div className="md:hidden p-3 sm:p-4 space-y-3 bg-slate-50/50 dark:bg-muted/10">
              {paginated.length === 0 ? (
                <div className="py-14 text-center text-xs font-medium text-muted-foreground bg-white dark:bg-card rounded-2xl border border-border/40">No records found.</div>
              ) : paginated.map((s, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs transition-colors">
                  {/* Navy blue header: Date Issued + Status Badge */}
                  <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-sidebar text-white">
                    <span className="text-xs font-medium text-white/90 font-mono">
                      {format(toJsDate(s.date), "MMM d, yyyy")}
                    </span>
                    <HeaderStatusBadge status={s.status} />
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <WorkerInitials name={s.workerName} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground truncate">{s.workerName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{s.ministry?.name || "—"}</p>
                      </div>
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs bg-slate-50/70 dark:bg-muted/30 p-2.5 rounded-xl border border-border/40">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Date Issued</p>
                        <p className="font-semibold text-foreground">{format(toJsDate(s.date), "MMM d, yyyy")}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Date Claimed</p>
                        <p className="font-semibold text-foreground">
                          {(s as any).claimedAt ? format(toJsDate((s as any).claimedAt), "MMM d, yyyy") : "——"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Claim Type</p>
                        <p className="font-semibold text-foreground">{(s as any).stubType ? (((s as any).stubType.charAt(0).toUpperCase() + (s as any).stubType.slice(1))) : "Daily"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Ministry</p>
                        <p className="font-semibold text-foreground truncate">{s.ministry?.name || "—"}</p>
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
                    {["Worker", "Ministry", "Date Issued", "Date Claimed", "Status", "Claim Type"].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={6} className="py-14 text-center text-xs font-medium text-muted-foreground">No records found.</td></tr>
                  ) : paginated.map((s, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-border/60 hover:bg-slate-50/70 dark:hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex items-center gap-2.5">
                          <WorkerInitials name={s.workerName} />
                          <span className="text-xs font-semibold text-foreground">{s.workerName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium align-middle whitespace-nowrap">{s.ministry?.name || "—"}</td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium align-middle whitespace-nowrap">{format(toJsDate(s.date), "MMM d, yyyy")}</td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium align-middle whitespace-nowrap">
                        {(s as any).claimedAt ? format(toJsDate((s as any).claimedAt), "MMM d, yyyy") : "——"}
                      </td>
                      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-muted dark:text-slate-300 border border-slate-200 dark:border-border capitalize">
                          {(s as any).stubType ? ((s as any).stubType.charAt(0).toUpperCase() + (s as any).stubType.slice(1)) : "Daily"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="px-2 py-4 mt-2 flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground font-medium">
              Showing {filtered.length > 0 ? `${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, filtered.length)}` : "0"} of {filtered.length} records
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-border text-muted-foreground hover:bg-slate-50 dark:hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"><ChevronLeft className="h-4 w-4" /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let n = i + 1;
                if (totalPages > 5 && page > 3) { n = page - 3 + i; if (n + (5 - i) > totalPages) n = totalPages - 4 + i; }
                if (n <= 0 || n > totalPages) return null;
                return <button key={n} onClick={() => setPage(n)} className={cn("h-8 w-8 flex items-center justify-center rounded-xl text-xs font-semibold transition-all cursor-pointer", page === n ? "bg-sidebar text-white font-bold shadow-xs" : "border border-slate-200/90 dark:border-border text-foreground hover:bg-slate-50 dark:hover:bg-muted/40")}>{n}</button>;
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0} className="h-8 w-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-border text-muted-foreground hover:bg-slate-50 dark:hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        {/* Donut Chart Card */}
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-200/80 dark:border-border shadow-xs p-5">
          <h3 className="text-sm font-bold font-headline text-foreground mb-0.5">Claimed vs Unclaimed</h3>
          <p className="text-xs text-muted-foreground mb-4">This month ratio.</p>
          <div className="h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {donutData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2">
            {donutData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                {d.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ExportConfirmDialog
        open={showExportConfirm}
        onOpenChange={setShowExportConfirm}
        title="Export Meal Claims Report?"
        description="Do you want to export the meal claims and claims summary as an Excel file (.xlsx) with clean, organized formatting?"
        onConfirm={handleExport}
      />
    </div>
  );
}

// ── Allocations Tab ───────────────────────────────────────────────────────────
function AllocationsTab() {
  const { workerProfile, isSuperAdmin } = useUserRole();
  const actorId = workerProfile?.id;
  const monthStart = useMemo(() => startOfMonth(new Date()), []);
  const monthEnd = useMemo(() => endOfMonth(new Date()), []);

  const { data: workers, isLoading: wL } = useQuery({ queryKey: ["workers", actorId], queryFn: () => getWorkers({ actorId }) });
  const { data: ministries, isLoading: mL } = useQuery({ queryKey: ["ministries", actorId], queryFn: () => getMinistries(actorId) });
  const { data: mealstubs, isLoading: msL } = useQuery({
    queryKey: ["mealstubs-alloc", actorId],
    queryFn: () => getMealStubs({ dateFrom: monthStart, dateTo: monthEnd, actorId }),
  });

  const [search, setSearch] = useState("");
  const [ministryFilter, setMinistryFilter] = useState("all");
  const [workerTypeFilter, setWorkerTypeFilter] = useState("all");
  const [page, setPage] = useState(1);

  const headDept = useMemo(() => {
    if (isSuperAdmin) return null;
    return resolveUserHeadDepartment(workerProfile, ministries as any[]);
  }, [isSuperAdmin, workerProfile, ministries]);

  const filteredMinistries = useMemo(() => {
    if (!ministries) return [];
    if (headDept) {
      return (ministries as any[]).filter(m => resolveMinistryDepartment(m) === headDept);
    }
    return ministries as any[];
  }, [ministries, headDept]);

  const getMinistry = useCallback((id: string) => (filteredMinistries || []).find(m => m.id === id), [filteredMinistries]);

  const eligibleWorkers = useMemo(() => {
    return (workers || []).filter(w => {
      if (headDept) {
        const min = (ministries as any[])?.find(m => m.id === w.majorMinistryId || m.id === w.minorMinistryId);
        const wDept = min ? resolveMinistryDepartment(min) : resolveUserHeadDepartment(w, ministries as any[]);
        if (wDept !== headDept) return false;
      }
      return w.employmentType === "Full-Time" || w.employmentType === "On-Call" || w.employmentType === "Part-Time" || w.employmentType === "Volunteer";
    });
  }, [workers, headDept, ministries]);

  const scopedMealStubs = useMemo(() => {
    if (!mealstubs) return [];
    if (headDept) {
      const vIds = new Set(eligibleWorkers.map(w => w.id));
      return mealstubs.filter(s => vIds.has(s.workerId));
    }
    return mealstubs;
  }, [mealstubs, eligibleWorkers, headDept]);

  const getStats = useCallback((wId: string) => {
    const stubs = scopedMealStubs.filter(s => s.workerId === wId);
    const weekday = stubs.filter(s => !isSunday(toJsDate(s.date))).length;
    const sunday = stubs.filter(s => isSunday(toJsDate(s.date))).length;
    const weekdayLimit = 5;
    const sundayLimit = 2;
    const remaining = Math.max(0, (weekdayLimit - weekday) + (sundayLimit - sunday));
    return { weekday, sunday, weekdayLimit, sundayLimit, remaining };
  }, [scopedMealStubs]);

  // Summary stats
  const totalAllocations = useMemo(() => scopedMealStubs.length, [scopedMealStubs]);
  const fullTimeCount = useMemo(() => eligibleWorkers.filter(w => w.employmentType === "Full-Time").length, [eligibleWorkers]);
  const onCallCount = useMemo(() => eligibleWorkers.filter(w => w.employmentType === "On-Call").length, [eligibleWorkers]);
  const remainingAllocations = useMemo(() => {
    const maxPerWorker = 7;
    const total = eligibleWorkers.length * maxPerWorker;
    return Math.max(0, total - totalAllocations);
  }, [eligibleWorkers, totalAllocations]);

  // Allocation usage
  const weekdayUsed = useMemo(() => scopedMealStubs.filter(s => !isSunday(toJsDate(s.date))).length, [scopedMealStubs]);
  const sundayUsed = useMemo(() => scopedMealStubs.filter(s => isSunday(toJsDate(s.date))).length, [scopedMealStubs]);
  const weekdayMax = eligibleWorkers.length * 5;
  const sundayMax = eligibleWorkers.length * 2;
  const ftAllocated = useMemo(() => scopedMealStubs.filter(s => { const w = eligibleWorkers.find(x => x.id === s.workerId); return w?.employmentType === "Full-Time"; }).length, [scopedMealStubs, eligibleWorkers]);
  const ftMax = fullTimeCount * 7;
  const ocAllocated = useMemo(() => scopedMealStubs.filter(s => { const w = eligibleWorkers.find(x => x.id === s.workerId); return w?.employmentType === "On-Call"; }).length, [scopedMealStubs, eligibleWorkers]);
  const ocMax = onCallCount * 7;

  const tabCounts = useMemo(() => {
    return {
      all: eligibleWorkers.length,
      "Full-Time": eligibleWorkers.filter(w => w.employmentType === "Full-Time").length,
      "Part-Time": eligibleWorkers.filter(w => w.employmentType === "Part-Time").length,
      "Volunteer": eligibleWorkers.filter(w => w.employmentType === "Volunteer").length,
      "On-Call": eligibleWorkers.filter(w => w.employmentType === "On-Call").length,
    };
  }, [eligibleWorkers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return eligibleWorkers.filter(w => {
      const name = `${w.firstName} ${w.lastName}`.toLowerCase();
      if (q && !name.includes(q)) return false;
      if (ministryFilter !== "all" && w.majorMinistryId !== ministryFilter) return false;
      if (workerTypeFilter !== "all" && w.employmentType !== workerTypeFilter) return false;
      return true;
    });
  }, [eligibleWorkers, search, ministryFilter, workerTypeFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const { toast } = useToast();
  const [showExportConfirm, setShowExportConfirm] = useState(false);

  useEffect(() => {
    const onExport = () => setShowExportConfirm(true);
    window.addEventListener("reports:trigger-export", onExport);
    return () => window.removeEventListener("reports:trigger-export", onExport);
  }, []);

  const handleExport = () => {
    const headers = ["Worker", "Ministry", "Worker Type", "Weekday Used", "Sunday Used", "Remaining"];
    const rows = filtered.map(w => {
      const s = getStats(w.id);
      return [`${w.firstName} ${w.lastName}`, getMinistry(w.majorMinistryId)?.name || "—", w.employmentType || "—", `${s.weekday}/${s.weekdayLimit}`, `${s.sunday}/${s.sundayLimit}`, s.remaining];
    });

    exportToExcel(`meal-allocations_${format(new Date(), "yyyyMMdd")}.xlsx`, [
      {
        name: "Allocations",
        data: [headers, ...rows],
        colWidths: [24, 24, 18, 16, 16, 14],
      },
    ]);

    toast({ title: "Allocations Exported", description: `Exported ${filtered.length} worker allocations to Excel.` });
  };

  if (wL || mL || msL) return <div className="flex justify-center py-16"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /></div>;

  function UsageBar({ label, used, max, color }: { label: string; used: number; max: number; color: string }) {
    const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground font-mono">{used.toLocaleString()} / {max.toLocaleString()}</span>
        </div>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Allocations" value={totalAllocations.toLocaleString()} sub="this month" icon={UtensilsCrossed} accentColor="bg-sidebar" iconClass="text-sidebar" iconBgClass="bg-sidebar/10" />
        <StatCard label="Full-Time Workers" value={fullTimeCount.toLocaleString()} sub="eligible" icon={CheckCircle2} accentColor="bg-emerald-500" iconClass="text-emerald-600" iconBgClass="bg-emerald-50 dark:bg-emerald-950/40" />
        <StatCard label="On-Call Workers" value={onCallCount.toLocaleString()} sub="eligible" icon={Users} accentColor="bg-orange-400" iconClass="text-orange-500" iconBgClass="bg-orange-50 dark:bg-orange-950/40" />
        <StatCard label="Remaining Allocations" value={remainingAllocations.toLocaleString()} sub="available" icon={TrendingUp} accentColor="bg-blue-500" iconClass="text-blue-600" iconBgClass="bg-blue-50 dark:bg-blue-950/40" />
      </div>

      {/* Main Table + Usage Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
        {/* Table Card */}
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-200/80 dark:border-border shadow-xs p-5 sm:p-6 overflow-hidden">
          {/* Section Header */}
          <div className="mb-4">
            <h3 className="text-base font-bold font-headline text-foreground">Worker Allocations</h3>
            <p className="text-xs text-muted-foreground">Monthly allocation limits and usage breakdown per worker.</p>
          </div>

          {/* Top Controls Row: Search + Ministry + Worker Type */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] sm:min-w-[220px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search worker..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-8 h-10 rounded-2xl border border-slate-200/90 dark:border-border bg-slate-50/50 dark:bg-muted/30 text-xs font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs focus:outline-none focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Equalized Dropdowns Grid */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full sm:w-auto">
              {/* Ministry */}
              <Select value={ministryFilter} onValueChange={v => { setMinistryFilter(v); setPage(1); }}>
                <SelectTrigger className="h-10 w-full sm:w-[145px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                  <SelectValue placeholder="All Ministries" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover max-h-72">
                  <SelectItem value="all" className="text-xs font-medium cursor-pointer">All Ministries</SelectItem>
                  {filteredMinistries.map(m => (
                    <SelectItem key={m.id} value={m.id} className="text-xs font-medium cursor-pointer">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Worker Type Filter */}
              <Select value={workerTypeFilter} onValueChange={(val) => { setWorkerTypeFilter(val); setPage(1); }}>
                <SelectTrigger className="h-10 w-full sm:w-[165px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover">
                  <SelectItem value="all" className="text-xs font-medium cursor-pointer">All Types ({tabCounts.all})</SelectItem>
                  <SelectItem value="Full-Time" className="text-xs font-medium cursor-pointer">Full-Time ({tabCounts["Full-Time"]})</SelectItem>
                  <SelectItem value="Part-Time" className="text-xs font-medium cursor-pointer">Part-Time ({tabCounts["Part-Time"]})</SelectItem>
                  <SelectItem value="Volunteer" className="text-xs font-medium cursor-pointer">Volunteer ({tabCounts["Volunteer"]})</SelectItem>
                  <SelectItem value="On-Call" className="text-xs font-medium cursor-pointer">On-Call ({tabCounts["On-Call"]})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="border border-gray-200/80 dark:border-border rounded-2xl mt-5 overflow-hidden">

            {/* Mobile card view */}
            <div className="md:hidden p-3 sm:p-4 space-y-3 bg-slate-50/50 dark:bg-muted/10">
              {paginated.length === 0 ? (
                <div className="py-14 text-center text-xs font-medium text-muted-foreground bg-white dark:bg-card rounded-2xl border border-border/40">No workers found.</div>
              ) : paginated.map((worker, i) => {
                const s = getStats(worker.id);
                const min = getMinistry(worker.majorMinistryId);
                return (
                  <div key={i} className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs transition-colors">
                    {/* Navy blue header: Type/Title + Remaining Badge */}
                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-sidebar text-white">
                      <span className="text-xs font-medium text-white/90">
                        {worker.employmentType || "Worker"} Allocation
                      </span>
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                        s.remaining > 0
                          ? "bg-emerald-400/20 text-emerald-200 border-emerald-400/30"
                          : "bg-rose-400/20 text-rose-200 border-rose-400/30"
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", s.remaining > 0 ? "bg-emerald-400" : "bg-rose-400")} />
                        {s.remaining} Remaining
                      </span>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2.5">
                        <WorkerInitials name={`${worker.firstName} ${worker.lastName}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground truncate">{worker.firstName} {worker.lastName}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {min?.name || "—"}{worker.workerId ? ` · ${fmtId(worker.workerId)}` : ""}
                          </p>
                        </div>
                      </div>

                      {/* Details metrics */}
                      <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50/70 dark:bg-muted/30 p-2.5 rounded-xl border border-border/40">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Weekday</p>
                          <p className="font-semibold font-mono text-foreground">{s.weekday}/{s.weekdayLimit}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Sunday</p>
                          <p className="font-semibold font-mono text-foreground">{s.sunday}/{s.sundayLimit}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Used</p>
                          <p className="font-semibold font-mono text-foreground">{s.weekday + s.sunday}/{s.weekdayLimit + s.sundayLimit}</p>
                        </div>
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
                    {["Worker", "Ministry", "Worker Type", "Weekday Used", "Sunday Used", "Remaining"].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={6} className="py-14 text-center text-xs font-medium text-muted-foreground">No workers found.</td></tr>
                  ) : paginated.map((worker, i) => {
                    const s = getStats(worker.id);
                    const min = getMinistry(worker.majorMinistryId);
                    return (
                      <tr key={i} className="border-b border-gray-100 dark:border-border/60 hover:bg-slate-50/70 dark:hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex items-center gap-2.5">
                            <WorkerInitials name={`${worker.firstName} ${worker.lastName}`} />
                            <span className="text-xs font-semibold text-foreground">{worker.firstName} {worker.lastName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium align-middle whitespace-nowrap">{min?.name || "—"}</td>
                        <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-muted dark:text-slate-300 border border-slate-200 dark:border-border">{worker.employmentType || "—"}</span>
                        </td>
                        <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground font-medium align-middle whitespace-nowrap">{s.weekday}/{s.weekdayLimit}</td>
                        <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground font-medium align-middle whitespace-nowrap">{s.sunday}/{s.sundayLimit}</td>
                        <td className="px-4 py-3.5 text-xs font-mono font-bold text-foreground align-middle whitespace-nowrap">{s.remaining}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="px-2 py-4 mt-2 flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground font-medium">
              Showing {filtered.length > 0 ? `${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, filtered.length)}` : "0"} of {filtered.length} records
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-border text-muted-foreground hover:bg-slate-50 dark:hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"><ChevronLeft className="h-4 w-4" /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let n = i + 1;
                if (totalPages > 5 && page > 3) { n = page - 3 + i; if (n + (5 - i) > totalPages) n = totalPages - 4 + i; }
                if (n <= 0 || n > totalPages) return null;
                return <button key={n} onClick={() => setPage(n)} className={cn("h-8 w-8 flex items-center justify-center rounded-xl text-xs font-semibold transition-all cursor-pointer", page === n ? "bg-sidebar text-white font-bold shadow-xs" : "border border-slate-200/90 dark:border-border text-foreground hover:bg-slate-50 dark:hover:bg-muted/40")}>{n}</button>;
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0} className="h-8 w-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-border text-muted-foreground hover:bg-slate-50 dark:hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        {/* Allocation Usage Sidebar */}
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-200/80 dark:border-border shadow-xs p-5 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-bold font-headline text-foreground">Allocation Usage</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Used vs available this month.</p>
          </div>
          <div className="flex flex-col gap-4">
            <UsageBar label="Weekday Allocation" used={weekdayUsed} max={weekdayMax} color="#112e7e" />
            <UsageBar label="Sunday Allocation" used={sundayUsed} max={sundayMax} color="#10b981" />
            <UsageBar label="Full-Time Allocations" used={ftAllocated} max={ftMax} color="#f97316" />
            <UsageBar label="On-Call Allocations" used={ocAllocated} max={ocMax} color="#f59e0b" />
          </div>
        </div>
      </div>

      <ExportConfirmDialog
        open={showExportConfirm}
        onOpenChange={setShowExportConfirm}
        title="Export Meal Allocations Report?"
        description="Do you want to export the worker meal allocations as an Excel file (.xlsx) with clean, organized formatting?"
        onConfirm={handleExport}
      />
    </div>
  );
}

// ── Reservations Tab ──────────────────────────────────────────────────────────
function ReservationsTab() {
  const { workerProfile, isSuperAdmin } = useUserRole();
  const actorId = workerProfile?.id;
  const monthStart = useMemo(() => startOfMonth(new Date()), []);
  const monthEnd = useMemo(() => endOfMonth(new Date()), []);
  const { data: workers } = useQuery({ queryKey: ["workers", actorId], queryFn: () => getWorkers({ actorId }) });
  const { data: rooms } = useQuery({ queryKey: ["rooms"], queryFn: () => getRooms() });
  const { data: ministries } = useQuery({ queryKey: ["ministries", actorId], queryFn: () => getMinistries(actorId) });
  const { data: reservations, isLoading } = useQuery({
    queryKey: ["bookings-report", actorId],
    queryFn: () => getBookings({ dateFrom: monthStart, dateTo: monthEnd, actorId }),
  });

  const [search, setSearch] = useState("");
  const [ministryFilter, setMinistryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const headDept = useMemo(() => {
    if (isSuperAdmin) return null;
    return resolveUserHeadDepartment(workerProfile, ministries as any[]);
  }, [isSuperAdmin, workerProfile, ministries]);

  const filteredMinistries = useMemo(() => {
    if (!ministries) return [];
    if (headDept) {
      return (ministries as any[]).filter(m => resolveMinistryDepartment(m) === headDept);
    }
    return ministries as any[];
  }, [ministries, headDept]);

  const scopedReservations = useMemo(() => {
    if (!reservations) return [];
    if (headDept) {
      return reservations.filter(r => {
        const min = (ministries as any[])?.find(m => m.id === r.ministryId);
        const w = (workers as any[])?.find((x: any) => x.id === r.workerProfileId);
        const wMin = w ? (ministries as any[])?.find(m => m.id === w.majorMinistryId) : null;
        const targetDept = min ? resolveMinistryDepartment(min) : (wMin ? resolveMinistryDepartment(wMin) : resolveUserHeadDepartment(w, ministries as any[]));
        return targetDept === headDept;
      });
    }
    return reservations;
  }, [reservations, workers, ministries, headDept]);

  const getWorkerName = useCallback((id: string) => { const w = (workers as any[])?.find((x: any) => x.id === id); return w ? `${w.firstName} ${w.lastName}` : "Unknown"; }, [workers]);
  const getRoomName = useCallback((id: string) => rooms?.find(r => r.id === id)?.name ?? "Unknown", [rooms]);
  const getWorkerMinistry = useCallback((wId: string) => {
    const w = (workers as any[])?.find((x: any) => x.id === wId);
    if (!w) return null;
    return (filteredMinistries || []).find(m => m.id === w.majorMinistryId);
  }, [workers, filteredMinistries]);

  const stats = useMemo(() => {
    if (!scopedReservations) return { total: 0, approved: 0, pending: 0, rejected: 0 };
    return {
      total: scopedReservations.length,
      approved: scopedReservations.filter(r => r.status === "Approved").length,
      pending: scopedReservations.filter(r => r.status?.startsWith("Pending")).length,
      rejected: scopedReservations.filter(r => r.status === "Rejected").length,
    };
  }, [scopedReservations]);

  const donutData = [
    { name: "Approved", value: stats.approved, color: "#10b981" },
    { name: "Pending",  value: stats.pending,  color: "#f59e0b" },
    { name: "Rejected", value: stats.rejected,  color: "#ef4444" },
  ];

  const topRooms = useMemo(() => {
    if (!scopedReservations || !rooms) return [];
    const counts: Record<string, number> = {};
    for (const r of scopedReservations) {
      counts[r.roomId] = (counts[r.roomId] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([roomId, count]) => ({ name: getRoomName(roomId), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [scopedReservations, rooms, getRoomName]);

  const maxRoomCount = topRooms[0]?.count || 1;

  const tabCounts = useMemo(() => {
    const res = scopedReservations || [];
    return {
      all: res.length,
      approved: res.filter(r => r.status === "Approved").length,
      pending: res.filter(r => r.status?.startsWith("Pending")).length,
      rejected: res.filter(r => r.status === "Rejected").length,
    };
  }, [scopedReservations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (scopedReservations || []).filter(r => {
      if (q && !r.title.toLowerCase().includes(q) && !getWorkerName(r.workerProfileId).toLowerCase().includes(q)) return false;
      if (ministryFilter !== "all") {
        const min = r.workerProfileId ? getWorkerMinistry(r.workerProfileId) : null;
        if (min?.id !== ministryFilter) return false;
      }
      if (statusFilter !== "all") {
        if (statusFilter === "pending" && !r.status?.startsWith("Pending")) return false;
        if (statusFilter === "approved" && r.status !== "Approved") return false;
        if (statusFilter === "rejected" && r.status !== "Rejected") return false;
      }
      return true;
    });
  }, [scopedReservations, search, ministryFilter, statusFilter, getWorkerName, getWorkerMinistry]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const { toast } = useToast();
  const [showExportConfirm, setShowExportConfirm] = useState(false);

  useEffect(() => {
    const onExport = () => setShowExportConfirm(true);
    window.addEventListener("reports:trigger-export", onExport);
    return () => window.removeEventListener("reports:trigger-export", onExport);
  }, []);

  const handleExport = () => {
    const headers = ["Worker", "Ministry", "Facility", "Date", "Time", "Purpose", "Status"];
    const rows = filtered.map(r => {
      const start = toJsDate(r.start);
      const end = toJsDate(r.end);
      const min = r.workerProfileId ? getWorkerMinistry(r.workerProfileId) : null;
      return [
        r.workerProfileId ? getWorkerName(r.workerProfileId) : "N/A",
        min?.name || "—",
        getRoomName(r.roomId),
        format(start, "MMM d, yyyy"),
        `${format(start, "H:mm")} - ${format(end, "H:mm")}`,
        r.purpose || r.title || "—",
        r.status,
      ];
    });

    const statusCounts: Record<string, number> = {};
    filtered.forEach(r => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });

    const summaryRows = Object.entries(statusCounts).map(([status, count]) => [
      status,
      count,
      filtered.length > 0 ? `${Math.round((count / filtered.length) * 100)}%` : "0%",
    ]);

    exportToExcel(`facility-reservations_${format(new Date(), "yyyyMMdd")}.xlsx`, [
      {
        name: "Reservations",
        data: [headers, ...rows],
        colWidths: [24, 24, 22, 16, 18, 30, 14],
      },
      {
        name: "Summary by Status",
        data: [
          ["Total Reservations", filtered.length],
          [],
          ["Status", "Count", "Percentage"],
          ...summaryRows,
        ],
        colWidths: [20, 14, 14],
      },
    ]);

    toast({ title: "Reservations Exported", description: `Exported ${filtered.length} reservations to Excel.` });
  };

  if (isLoading) return <div className="flex justify-center py-16"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Requests" value={stats.total.toLocaleString()} sub="this month" icon={CalendarCheck} accentColor="bg-sidebar" iconClass="text-sidebar" iconBgClass="bg-sidebar/10" />
        <StatCard label="Approved" value={stats.approved.toLocaleString()} sub="confirmed" icon={CheckCircle2} accentColor="bg-emerald-500" iconClass="text-emerald-600" iconBgClass="bg-emerald-50 dark:bg-emerald-950/40" />
        <StatCard label="Pending" value={stats.pending.toLocaleString()} sub="awaiting" icon={Clock} accentColor="bg-amber-500" iconClass="text-amber-600" iconBgClass="bg-amber-50 dark:bg-amber-950/40" />
        <StatCard label="Rejected" value={stats.rejected.toLocaleString()} sub="declined" icon={XCircle} accentColor="bg-red-500" iconClass="text-red-600" iconBgClass="bg-red-50 dark:bg-red-950/40" />
      </div>

      {/* Main Table + Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
        {/* Table Card */}
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-200/80 dark:border-border shadow-xs p-5 sm:p-6 overflow-hidden">
          {/* Section Header with Export Button */}
          <div className="mb-4">
            <h3 className="text-base font-bold font-headline text-foreground">Facility Reservations</h3>
            <p className="text-xs text-muted-foreground">Monitor venue bookings and approvals across facilities.</p>
          </div>

          {/* Top Controls Row: Search + Ministry + Status */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] sm:min-w-[220px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search reservation or worker..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-8 h-10 rounded-2xl border border-slate-200/90 dark:border-border bg-slate-50/50 dark:bg-muted/30 text-xs font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs focus:outline-none focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Equalized Dropdowns Grid */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full sm:w-auto">
              {/* Ministry */}
              <Select value={ministryFilter} onValueChange={v => { setMinistryFilter(v); setPage(1); }}>
                <SelectTrigger className="h-10 w-full sm:w-[145px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                  <SelectValue placeholder="All Ministries" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover max-h-72">
                  <SelectItem value="all" className="text-xs font-medium cursor-pointer">All Ministries</SelectItem>
                  {filteredMinistries.map(m => (
                    <SelectItem key={m.id} value={m.id} className="text-xs font-medium cursor-pointer">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
                <SelectTrigger className="h-10 w-full sm:w-[165px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border border-border shadow-lg bg-popover">
                  <SelectItem value="all" className="text-xs font-medium cursor-pointer">All Statuses ({tabCounts.all})</SelectItem>
                  <SelectItem value="approved" className="text-xs font-medium cursor-pointer">Approved ({tabCounts.approved})</SelectItem>
                  <SelectItem value="pending" className="text-xs font-medium cursor-pointer">Pending ({tabCounts.pending})</SelectItem>
                  <SelectItem value="rejected" className="text-xs font-medium cursor-pointer">Rejected ({tabCounts.rejected})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="border border-gray-200/80 dark:border-border rounded-2xl mt-5 overflow-hidden">

            {/* Mobile card view */}
            <div className="md:hidden p-3 sm:p-4 space-y-3 bg-slate-50/50 dark:bg-muted/10">
              {paginated.length === 0 ? (
                <div className="py-14 text-center text-xs font-medium text-muted-foreground bg-white dark:bg-card rounded-2xl border border-border/40">No records found.</div>
              ) : paginated.map((r, i) => {
                const start = toJsDate(r.start);
                const end = toJsDate(r.end);
                const name = getWorkerName(r.workerProfileId);
                const min = r.workerProfileId ? getWorkerMinistry(r.workerProfileId) : null;
                const reqId = r.id ? `REQ-${r.id.slice(-4).toUpperCase()}` : "REQ-——";
                return (
                  <div key={i} className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs transition-colors">
                    {/* Navy blue header: Req ID + Status Badge */}
                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-sidebar text-white">
                      <span className="text-xs font-mono font-bold text-white">
                        {reqId}
                      </span>
                      <HeaderStatusBadge status={r.status} />
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-3">
                      {(r.title || r.purpose) && (
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            {r.title || r.purpose}
                          </p>
                          {r.title && r.purpose && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {r.purpose}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2.5">
                        <WorkerInitials name={name} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground truncate">{name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{min?.name || "—"}</p>
                        </div>
                      </div>

                      {/* Details grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs bg-slate-50/70 dark:bg-muted/30 p-2.5 rounded-xl border border-border/40">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Room</p>
                          <p className="font-semibold text-foreground truncate">{getRoomName(r.roomId)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Date & Time</p>
                          <p className="font-semibold text-foreground">{format(start, "MMM d, yyyy")}</p>
                          <p className="text-muted-foreground text-[11px] font-mono">{format(start, "H:mm")}–{format(end, "H:mm")}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Ministry</p>
                          <p className="font-semibold text-foreground truncate">{min?.name || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Status</p>
                          <p className="font-semibold capitalize text-foreground">{r.status}</p>
                        </div>
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
                    {["Worker", "Ministry", "Facility", "Date", "Time", "Purpose", "Status"].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={7} className="py-14 text-center text-xs font-medium text-muted-foreground">No records found.</td></tr>
                  ) : paginated.map((r, i) => {
                    const start = toJsDate(r.start);
                    const end = toJsDate(r.end);
                    const name = getWorkerName(r.workerProfileId);
                    const min = r.workerProfileId ? getWorkerMinistry(r.workerProfileId) : null;
                    return (
                      <tr key={i} className="border-b border-gray-100 dark:border-border/60 hover:bg-slate-50/70 dark:hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex items-center gap-2.5">
                            <WorkerInitials name={name} />
                            <span className="text-xs font-semibold text-foreground">{name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium align-middle whitespace-nowrap">{min?.name || "—"}</td>
                        <td className="px-4 py-3.5 text-xs text-foreground font-medium align-middle whitespace-nowrap">{getRoomName(r.roomId)}</td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium align-middle whitespace-nowrap">{format(start, "MMM d, yyyy")}</td>
                        <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground font-medium align-middle whitespace-nowrap">{format(start, "H:mm")} - {format(end, "H:mm")}</td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium align-middle">{r.purpose || r.title || "—"}</td>
                        <td className="px-4 py-3.5 align-middle whitespace-nowrap"><StatusBadge status={r.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="px-2 py-4 mt-2 flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground font-medium">
              Showing {filtered.length > 0 ? `${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, filtered.length)}` : "0"} of {filtered.length} records
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-border text-muted-foreground hover:bg-slate-50 dark:hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"><ChevronLeft className="h-4 w-4" /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let n = i + 1;
                if (totalPages > 5 && page > 3) { n = page - 3 + i; if (n + (5 - i) > totalPages) n = totalPages - 4 + i; }
                if (n <= 0 || n > totalPages) return null;
                return <button key={n} onClick={() => setPage(n)} className={cn("h-8 w-8 flex items-center justify-center rounded-xl text-xs font-semibold transition-all cursor-pointer", page === n ? "bg-sidebar text-white font-bold shadow-xs" : "border border-slate-200/90 dark:border-border text-foreground hover:bg-slate-50 dark:hover:bg-muted/40")}>{n}</button>;
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0} className="h-8 w-8 flex items-center justify-center rounded-xl border border-slate-200 dark:border-border text-muted-foreground hover:bg-slate-50 dark:hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-5">
          {/* Status Distribution Donut */}
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200/80 dark:border-border shadow-xs p-5">
            <h3 className="text-sm font-bold font-headline text-foreground mb-0.5">Status Distribution</h3>
            <p className="text-xs text-muted-foreground mb-3">All reservation requests</p>
            <div className="h-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {donutData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-3 mt-1">
              {donutData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                  {d.name}
                </div>
              ))}
            </div>
          </div>

          {/* Most Utilized Rooms */}
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200/80 dark:border-border shadow-xs p-5">
            <h3 className="text-sm font-bold font-headline text-foreground mb-0.5">Most Utilized Rooms</h3>
            <p className="text-xs text-muted-foreground mb-4">Top 5 facilities this month.</p>
            <div className="flex flex-col gap-3">
              {topRooms.map((room, i) => (
                <div key={room.name} className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground truncate">{room.name}</span>
                      <span className="text-[11px] text-muted-foreground ml-2 shrink-0 font-mono">{room.count}</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-sidebar transition-all" style={{ width: `${Math.round((room.count / maxRoomCount) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
              {topRooms.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No data.</p>}
            </div>
          </div>
        </div>
      </div>

      <ExportConfirmDialog
        open={showExportConfirm}
        onOpenChange={setShowExportConfirm}
        title="Export Reservations Report?"
        description="Do you want to export facility reservations and status summary as an Excel file (.xlsx) with clean, organized formatting?"
        onConfirm={handleExport}
      />
    </div>
  );
}

// ── Main Content ──────────────────────────────────────────────────────────────
function ReportsContent() {
  const { canViewReports, isLoading } = useUserRole();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") || "attendance") as "attendance" | "meal-stubs" | "allocations" | "reservations";

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!canViewReports) {
    return (
      <AppLayout>
        <div className="p-12 text-center text-sm text-muted-foreground">
          Access Denied. You do not have permission to view reports.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-7 pb-12 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight text-foreground">
              {activeTab === "attendance"
                ? "Attendance"
                : activeTab === "meal-stubs"
                ? "Meal Stub Claims"
                : activeTab === "allocations"
                ? "Allocations"
                : activeTab === "reservations"
                ? "Room Reservations"
                : "Reports & Analytics"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {activeTab === "attendance"
                ? "Detailed logs, service attendance breakdowns, and exportable records."
                : activeTab === "meal-stubs"
                ? "Historical meal stub claims, worker disbursements, and status tracking."
                : activeTab === "allocations"
                ? "Aggregated food allocation reports, ministry budget oversight, and analytics."
                : activeTab === "reservations"
                ? "Room reservation summaries, facility usage rates, and event logs."
                : "Monitor attendance, meal stub usage, allocations, and room reservations across the organization."}
            </p>
          </div>
          <div className="flex items-center self-end sm:self-auto sm:ml-auto shrink-0">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("reports:trigger-export"))}
              className="h-9 sm:h-10 px-3.5 sm:px-4 flex items-center gap-2 rounded-2xl bg-sidebar hover:bg-sidebar/90 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Download className="h-4 w-4" /> Export
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === "attendance"   && <AttendanceTab />}
          {activeTab === "meal-stubs"   && <MealStubClaimsTab />}
          {activeTab === "allocations"  && <AllocationsTab />}
          {activeTab === "reservations" && <ReservationsTab />}
        </div>
      </div>
    </AppLayout>
  );
}

export default function ReportsPage() {
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
      <ReportsContent />
    </Suspense>
  );
}
