"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Input,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
} from "@studio/ui";
import { useUserRole } from "@/hooks/use-user-role";
import { useQuery } from "@tanstack/react-query";
import { getTransactionLogs } from "@/actions/db";
import { format, formatDistanceToNow, isToday, isYesterday, subDays, isAfter } from "date-fns";
import {
  LoaderCircle,
  Search,
  ShieldAlert,
  Clock,
  History,
  Pencil,
  RefreshCw,
  LogIn,
  X,
  Package,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Mail,
  Activity,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Non-Tech Human Friendly Formatters ─────────────────────────────────────────
function formatActionName(rawAction?: string | null): string {
  if (!rawAction) return "Unknown Activity";

  const clean = rawAction.replace(/\s*\(SQL\)/gi, "").trim();
  const lower = clean.toLowerCase();

  if (lower === "legacy_login_failed" || lower === "login_failed") return "Failed Login Attempt";
  if (lower === "legacy_login") return "Worker Login";
  if (lower === "user_login") return "User Login";
  if (lower === "user_logout") return "User Logout";
  if (lower === "batch deleted workers") return "Deleted Multiple Workers";
  if (lower === "updated meal stub settings") return "Updated Meal Stub Settings";
  if (lower === "requested ministry change") return "Requested Ministry Change";

  if (clean.includes("_")) {
    return clean
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  return clean;
}

function formatLogDetails(details?: string | null): string {
  if (!details) return "Activity completed without extra metadata.";
  return details
    .replace(/Failed legacy login for workerId\s*([^:]+):\s*worker not found/gi, "Failed login attempt for $1 (Worker account not found)")
    .replace(/Failed legacy login for workerId\s*([^:]+):\s*invalid credentials/gi, "Failed login attempt for $1 (Incorrect password)")
    .replace(/legacy login/gi, "Worker login")
    .replace(/Initial inventory stock creation/gi, "Initial stock creation")
    .replace(/inventory stock/gi, "stock")
    .replace(/inventory/gi, "stock")
    .replace(/\s*\(SQL\)/gi, "");
}

// ── Action Badge Styling ──────────────────────────────────────────────────────
function ActionBadge({ action }: { action: string }) {
  const displayAction = formatActionName(action);
  const lower = (action || "").toLowerCase();

  let colorClasses = "bg-muted text-muted-foreground border-border/70";

  // Check failures/errors first so failed logins are shown in red warning
  if (lower.includes("fail") || lower.includes("error") || lower.includes("denied") || lower.includes("block")) {
    colorClasses = "bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
  } else if (lower.includes("login") || lower.includes("sign in")) {
    colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
  } else if (lower.includes("logout") || lower.includes("sign out")) {
    colorClasses = "bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  } else if (lower.includes("stock in") || lower.includes("create item")) {
    colorClasses = "bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
  } else if (lower.includes("stock out") || lower.includes("borrow") || lower.includes("checkout")) {
    colorClasses = "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
  } else if (lower.includes("return")) {
    colorClasses = "bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800";
  } else if (lower.includes("delete") || lower.includes("remov")) {
    colorClasses = "bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
  } else if (lower.includes("creat") || lower.includes("add")) {
    colorClasses = "bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800";
  } else if (lower.includes("updat") || lower.includes("edit") || lower.includes("adjust") || lower.includes("change")) {
    colorClasses = "bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800";
  } else if (lower.includes("activat")) {
    colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
  } else if (lower.includes("deactivat")) {
    colorClasses = "bg-orange-50 text-orange-700 border-orange-200/80 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800";
  }

  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap border shadow-2xs", colorClasses)}>
      {displayAction}
    </span>
  );
}

// ── User Display with Avatar ──────────────────────────────────────────────────
function UserDisplay({ name, email, details }: { name?: string | null; email?: string | null; details?: string | null }) {
  let fallbackName = "System";
  let fallbackEmail = "";

  if (!name && !email && details) {
    const match = details.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (match) {
      fallbackName = match[0].split("@")[0];
      fallbackEmail = match[0];
    } else if (details.toLowerCase().includes("login")) {
      fallbackName = "Unauthenticated User";
    }
  }

  const displayName = name || fallbackName;
  const displayEmail = email || fallbackEmail;
  const isDuplicate = displayName.toLowerCase() === displayEmail.toLowerCase();

  const parts = displayName.trim().split(" ");
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : displayName.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 rounded-full bg-sidebar/10 text-sidebar dark:text-sky-400 border border-sidebar/20 flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-foreground truncate" title={displayName}>
          {displayName}
        </p>
        {!isDuplicate && displayEmail && (
          <p className="text-[11px] text-muted-foreground truncate" title={displayEmail}>
            {displayEmail}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Stat Card Component ───────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  accentColor,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  accentColor: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/80 shadow-xs bg-white dark:bg-card">
      <div className={cn("h-1.5 w-full", accentColor)} />
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              {label}
            </p>
            <p className="text-3xl sm:text-4xl font-black tracking-tight text-foreground leading-none mt-2 sm:mt-2.5 font-headline">
              {value}
            </p>
            {sub && <p className="text-xs text-muted-foreground mt-2 font-medium truncate">{sub}</p>}
          </div>
          <div className={cn("p-2.5 rounded-xl flex items-center justify-center shrink-0 shadow-xs", iconBg)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>
  );
}

type CategoryTab = "ALL" | "AUTH" | "WORKERS";

export default function ActivityLogsPage() {
  const { isSuperAdmin, isLoading: isRoleLoading } = useUserRole();
  const [search, setSearch] = useState("");
  const [categoryTab, setCategoryTab] = useState<CategoryTab>("ALL");
  const [dateFilter, setDateFilter] = useState("all");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const {
    data: rawLogs,
    isLoading: isLogsLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["transaction-logs"],
    queryFn: () => getTransactionLogs(1000),
    enabled: isSuperAdmin,
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    staleTime: 0,
  });

  // Dedicated background interval + focus & visibility listeners so logs auto-refresh without manual click
  useEffect(() => {
    const timer = setInterval(() => {
      refetch();
    }, 2000);

    const onWakeup = () => {
      refetch();
    };

    window.addEventListener("focus", onWakeup);
    document.addEventListener("visibilitychange", onWakeup);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onWakeup);
      document.removeEventListener("visibilitychange", onWakeup);
    };
  }, [refetch]);

  // Strictly exclude navigation logs and failed logins
  const allLogs = useMemo(() => {
    return (rawLogs || []).filter((l) => {
      const act = (l.action || "").toLowerCase();
      const mod = (l.module || "").toLowerCase();
      const det = (l.details || "").toLowerCase();

      // Exclude navigation logs
      if (act === "view navigation" || mod === "navigation" || det.includes("navigated to")) {
        return false;
      }

      // Exclude failed login attempts (only successful logins & logouts)
      if (
        act.includes("fail") ||
        act === "legacy_login_failed" ||
        det.includes("failed login") ||
        det.includes("failed legacy login")
      ) {
        return false;
      }

      return true;
    });
  }, [rawLogs]);

  // Statistics calculation
  const stats = useMemo(() => {
    const todayLogs = allLogs.filter((l) => l.timestamp && isToday(new Date(l.timestamp)));

    const stockEvents = allLogs.filter(
      (l) =>
        (l.module || "").toLowerCase().includes("stock") ||
        (l.module || "").toLowerCase() === "inventory" ||
        (l.action || "").toLowerCase().includes("stock") ||
        (l.action || "").toLowerCase().includes("borrow") ||
        (l.action || "").toLowerCase().includes("item") ||
        (l.action || "").toLowerCase().includes("checkout") ||
        (l.action || "").toLowerCase().includes("return")
    );

    const authEvents = todayLogs.filter(
      (l) =>
        (l.action || "").toLowerCase().includes("login") ||
        (l.action || "").toLowerCase().includes("logout")
    );

    const crudEvents = allLogs.filter(
      (l) =>
        (l.action || "").toLowerCase().includes("creat") ||
        (l.action || "").toLowerCase().includes("updat") ||
        (l.action || "").toLowerCase().includes("delet") ||
        (l.action || "").toLowerCase().includes("edit") ||
        (l.action || "").toLowerCase().includes("activat")
    );

    return {
      todayCount: todayLogs.length,
      stockCount: stockEvents.length,
      authTodayCount: authEvents.length,
      crudCount: crudEvents.length,
    };
  }, [allLogs]);

  // Filtered List
  const filteredLogs = useMemo(() => {
    let result = allLogs;

    // 1. Category Tab Filter
    if (categoryTab === "AUTH") {
      result = result.filter(
        (l) =>
          (l.module || "").toLowerCase() === "auth" ||
          (l.action || "").toLowerCase().includes("login") ||
          (l.action || "").toLowerCase().includes("logout")
      );
    } else if (categoryTab === "WORKERS") {
      result = result.filter(
        (l) =>
          (l.module || "").toLowerCase() === "workers" ||
          (l.module || "").toLowerCase() === "roles"
      );
    }


    // 2. Date Filter
    if (dateFilter !== "all") {
      const now = new Date();
      if (dateFilter === "today") {
        result = result.filter((l) => l.timestamp && isToday(new Date(l.timestamp)));
      } else if (dateFilter === "yesterday") {
        result = result.filter((l) => l.timestamp && isYesterday(new Date(l.timestamp)));
      } else if (dateFilter === "7days") {
        const threshold = subDays(now, 7);
        result = result.filter((l) => l.timestamp && isAfter(new Date(l.timestamp), threshold));
      } else if (dateFilter === "30days") {
        const threshold = subDays(now, 30);
        result = result.filter((l) => l.timestamp && isAfter(new Date(l.timestamp), threshold));
      }
    }

    // 3. Search Query
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          (l.userName || "").toLowerCase().includes(q) ||
          (l.userEmail || "").toLowerCase().includes(q) ||
          (l.action || "").toLowerCase().includes(q) ||
          (l.module || "").toLowerCase().includes(q) ||
          (l.targetName || "").toLowerCase().includes(q) ||
          (l.details || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [allLogs, categoryTab, dateFilter, search]);

  // Reset pagination on filter change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [categoryTab, dateFilter, search]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ["Date & Time", "User", "Email", "Action Taken", "Details"];
    const rows = filteredLogs.map((l) => [
      l.timestamp ? new Date(l.timestamp).toISOString() : "",
      `"${(l.userName || "").replace(/"/g, '""')}"`,
      `"${(l.userEmail || "").replace(/"/g, '""')}"`,
      `"${formatActionName(l.action).replace(/"/g, '""')}"`,
      `"${formatLogDetails(l.details).replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Activity_Audit_Logs_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isAnyFilterActive =
    categoryTab !== "ALL" || dateFilter !== "all" || Boolean(search);

  const resetAllFilters = () => {
    setCategoryTab("ALL");
    setDateFilter("all");
    setSearch("");
  };

  if (isRoleLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center py-28">
          <LoaderCircle className="h-8 w-8 animate-spin text-sidebar" />
        </div>
      </AppLayout>
    );
  }

  if (!isSuperAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <ShieldAlert className="h-16 w-16 text-destructive opacity-80" />
          <h2 className="text-2xl font-bold font-headline">Access Restricted</h2>
          <p className="text-muted-foreground max-w-sm text-xs">
            Overall Activity and Audit logs are restricted to Administrators only.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 pb-12 w-full">
        {/* ── HEADER ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-sidebar/10 text-sidebar dark:text-sky-400 border border-sidebar/20 flex items-center justify-center font-bold shrink-0 shadow-xs">
              <History className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight text-foreground">
                Activity Logs & Audit Trail
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Official real-time record of user logins, logouts, stock movements, and system changes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-10 px-4 rounded-xl text-xs font-semibold gap-2 shadow-2xs cursor-pointer hover:bg-muted/60"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isFetching && "animate-spin text-sidebar")} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className="h-10 px-4 rounded-xl text-xs font-semibold gap-2 shadow-2xs cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-300 transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </Button>
            <Link
              href="/settings"
              className="flex items-center gap-1.5 h-10 px-3.5 sm:px-4 rounded-xl border border-border/60 bg-white dark:bg-card text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors shrink-0 shadow-2xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
          </div>
        </div>

        {/* ── STAT CARDS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <StatCard
            label="TODAY'S ACTIVITIES"
            value={stats.todayCount}
            sub="All actions logged today"
            icon={Clock}
            iconBg="bg-blue-50 text-blue-600 dark:bg-blue-950/40"
            accentColor="bg-blue-500"
          />
          <StatCard
            label="STOCK MONITORING"
            value={stats.stockCount}
            sub="Ins, outs & adjustments"
            icon={Package}
            iconBg="bg-amber-50 text-amber-600 dark:bg-amber-950/40"
            accentColor="bg-amber-500"
          />
          <StatCard
            label="LOGINS TODAY"
            value={stats.authTodayCount}
            sub="User sign-ins & sign-outs"
            icon={LogIn}
            iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40"
            accentColor="bg-emerald-500"
          />
          <StatCard
            label="RECORD CHANGES"
            value={stats.crudCount}
            sub="Creations, edits & removals"
            icon={Pencil}
            iconBg="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40"
            accentColor="bg-indigo-500"
          />
        </div>

        {/* ── MAIN CONTENT CONTAINER CARD ── */}
        <div className="bg-white dark:bg-card rounded-2xl md:rounded-3xl border border-border/80 shadow-card-dark p-4 sm:p-6 overflow-hidden flex flex-col gap-4">
          {/* CATEGORY TABS (Segmented Control Style - Equal Grid on Mobile to Maximize Space) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap items-center gap-2 pb-2.5 border-b border-border/60">
            {[
              { id: "ALL", label: "All Activities", count: allLogs.length },
              { id: "AUTH", label: "Logins & Logouts" },
              { id: "WORKERS", label: "Workers & Accounts" },
            ].map((tab) => {
              const isActive = categoryTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCategoryTab(tab.id as CategoryTab)}
                  className={cn(
                    "w-full lg:w-auto px-2 py-2.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 select-none text-center shadow-2xs",
                    isActive
                      ? "bg-sidebar text-white shadow-xs"
                      : "bg-slate-100/70 hover:bg-slate-200/60 dark:bg-muted/40 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="truncate">{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={cn(
                        "text-[10px] sm:text-[10.5px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold leading-none shrink-0",
                        isActive ? "bg-white/25 text-white" : "bg-slate-200/80 dark:bg-muted text-foreground"
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* CONTROLS & FILTER ROW */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
            {/* Search Bar */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search by user, email, action, item name, or details..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8 h-10 text-xs rounded-xl bg-background border-slate-200/90 dark:border-border shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full cursor-pointer"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Date Filter */}
              <div className="w-full sm:w-[135px]">
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="h-10 text-xs rounded-xl bg-background border-slate-200/90 dark:border-border shadow-2xs font-medium cursor-pointer">
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-border shadow-xl">
                    <SelectItem value="all" className="text-xs">All Time</SelectItem>
                    <SelectItem value="today" className="text-xs">Today</SelectItem>
                    <SelectItem value="yesterday" className="text-xs">Yesterday</SelectItem>
                    <SelectItem value="7days" className="text-xs">Past 7 Days</SelectItem>
                    <SelectItem value="30days" className="text-xs">Past 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>



              {isAnyFilterActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetAllFilters}
                  className="h-10 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-xl cursor-pointer"
                  title="Reset all filters"
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>

          {/* TABLE CONTAINER */}
          <div className="rounded-2xl border border-border/80 overflow-hidden shadow-2xs bg-background">
            {/* MOBILE VIEW (Card Layout matching Inquiries style with Navy Blue top header) */}
            <div className="block md:hidden p-2 sm:p-4 space-y-3.5">
              {isLogsLoading ? (
                <div className="text-center py-16 px-4 bg-background rounded-2xl border border-border/70">
                  <LoaderCircle className="h-8 w-8 animate-spin mx-auto text-sidebar mb-2.5" />
                  <p className="text-xs text-muted-foreground font-semibold">Loading activity logs...</p>
                </div>
              ) : paginatedLogs.length === 0 ? (
                <div className="text-center py-16 px-4 bg-background rounded-2xl border border-border/70">
                  <div className="w-12 h-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto mb-3">
                    <History className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-foreground font-headline">No activity records found</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    No activity logs matched your current filters. Try selecting "All Activities" or clearing search filters.
                  </p>
                  {isAnyFilterActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetAllFilters}
                      className="mt-3.5 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                paginatedLogs.map((log) => {
                  const isExpanded = expandedRowId === log.id;
                  const dateObj = log.timestamp ? new Date(log.timestamp) : null;
                  const formattedDate = dateObj ? format(dateObj, "MMM d, yyyy · h:mm:ss a") : "—";
                  const relativeTime = dateObj ? formatDistanceToNow(dateObj, { addSuffix: true }) : "";

                  const displayName = log.userName || log.userEmail?.split("@")[0] || "System Admin";
                  const displayEmail = log.userEmail || "";
                  const parts = displayName.trim().split(" ");
                  const initials =
                    parts.length >= 2
                      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                      : displayName.slice(0, 2).toUpperCase();

                  const actionName = formatActionName(log.action);
                  const isStockAction = actionName.toLowerCase().includes("stock");
                  const isLoginAction = actionName.toLowerCase().includes("login") || actionName.toLowerCase().includes("logout");

                  return (
                    <div
                      key={log.id}
                      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xs hover:shadow-xs transition-all"
                    >
                      {/* 1. Navy Blue Header: Action Name + Pill Badge */}
                      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-sidebar text-white">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-white tracking-wide truncate">
                            {actionName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold text-white/90 bg-white/20 border border-white/20 px-2.5 py-0.5 rounded-full">
                            {isStockAction ? "Stock Monitoring" : isLoginAction ? "Authentication" : (log.module || "General")}
                          </span>
                        </div>
                      </div>

                      {/* 2. Card Body */}
                      <div className="p-3.5 space-y-3 bg-white dark:bg-card">
                        {/* User row: Avatar + Name + Date with Clock */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-sidebar/10 text-sidebar dark:bg-sidebar/30 dark:text-sky-400 font-bold text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs text-foreground truncate">{displayName}</p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{formattedDate}</span>
                            </p>
                          </div>
                        </div>

                        {/* Email box (if email exists) */}
                        {displayEmail && (
                          <div className="text-xs bg-slate-50/70 dark:bg-muted/30 p-2.5 rounded-xl border border-border/40">
                            <div className="flex items-center gap-1.5 truncate">
                              <Mail className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                              <span className="text-[11px] text-muted-foreground truncate select-text">
                                {displayEmail}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Details / Message Preview Box */}
                        <div
                          onClick={() => setExpandedRowId(isExpanded ? null : log.id)}
                          className="p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors border border-border/50 cursor-pointer text-xs text-foreground leading-relaxed"
                        >
                          <p className={cn(!isExpanded && "line-clamp-2")}>
                            {formatLogDetails(log.details)}
                          </p>
                          {log.details && log.details.length > 80 && (
                            <button
                              type="button"
                              className="text-[10px] font-bold text-sidebar hover:underline inline-flex items-center gap-0.5 cursor-pointer mt-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRowId(isExpanded ? null : log.id);
                              }}
                            >
                              {isExpanded ? (
                                <>Show less <ChevronUp className="h-3 w-3" /></>
                              ) : (
                                <>Show details <ChevronDown className="h-3 w-3" /></>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Footer: Relative Time */}
                        <div className="text-[11px] text-muted-foreground font-medium pt-0.5">
                          {relativeTime}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* DESKTOP TABLE VIEW (Full width, balanced columns) */}
            <div className="hidden md:block">
              <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-muted/40 border-b border-border/80">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[18%] min-w-[180px] text-xs font-bold text-foreground py-4 pl-5 sm:pl-6">
                    Date & Time
                  </TableHead>
                  <TableHead className="w-[24%] min-w-[220px] text-xs font-bold text-foreground py-4 px-3 sm:px-4">
                    User
                  </TableHead>
                  <TableHead className="w-[22%] min-w-[200px] text-xs font-bold text-foreground py-4 px-3 sm:px-4">
                    Action Taken
                  </TableHead>
                  <TableHead className="w-[36%] min-w-[300px] text-xs font-bold text-foreground py-4 pr-5 sm:pr-6">
                    Details
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/60">
                {isLogsLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20">
                      <LoaderCircle className="h-8 w-8 animate-spin mx-auto text-sidebar mb-2.5" />
                      <p className="text-xs text-muted-foreground font-semibold">Loading activity logs...</p>
                    </TableCell>
                  </TableRow>
                ) : paginatedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20">
                      <div className="w-12 h-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto mb-3">
                        <History className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-bold text-foreground font-headline">No activity records found</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        No activity logs matched your current filters. Try selecting "All Activities" or clearing search filters.
                      </p>
                      {isAnyFilterActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetAllFilters}
                          className="mt-3.5 rounded-xl text-xs font-semibold cursor-pointer"
                        >
                          Clear Filters
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLogs.map((log) => {
                    const isExpanded = expandedRowId === log.id;
                    const dateObj = log.timestamp ? new Date(log.timestamp) : null;
                    const formattedDate = dateObj ? format(dateObj, "MMM d, yyyy · h:mm:ss a") : "—";
                    const relativeTime = dateObj ? formatDistanceToNow(dateObj, { addSuffix: true }) : "";

                    return (
                      <TableRow
                        key={log.id}
                        className={cn(
                          "hover:bg-slate-50/70 dark:hover:bg-muted/30 transition-colors cursor-pointer",
                          isExpanded && "bg-slate-50/90 dark:bg-muted/40"
                        )}
                        onClick={() => setExpandedRowId(isExpanded ? null : log.id)}
                      >
                        {/* Date & Time */}
                        <TableCell className="align-middle py-4 pl-5 sm:pl-6">
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-foreground whitespace-nowrap">{formattedDate}</p>
                            <span className="inline-block text-[10px] font-semibold text-muted-foreground bg-muted/50 px-1.5 py-0.2 rounded-md">
                              {relativeTime}
                            </span>
                          </div>
                        </TableCell>

                        {/* User */}
                        <TableCell className="align-middle py-4 px-3 sm:px-4">
                          <UserDisplay name={log.userName} email={log.userEmail} details={log.details} />
                        </TableCell>

                        {/* Action Taken */}
                        <TableCell className="align-middle py-4 px-3 sm:px-4">
                          <ActionBadge action={log.action} />
                        </TableCell>

                        {/* Details */}
                        <TableCell className="align-middle py-4 pr-5 sm:pr-6">
                          <div className="space-y-1 min-w-0">
                            <p
                              className={cn(
                                "text-xs text-foreground leading-relaxed",
                                !isExpanded && "line-clamp-2"
                              )}
                            >
                              {formatLogDetails(log.details)}
                            </p>
                            {log.details && log.details.length > 90 && (
                              <button
                                type="button"
                                className="text-[10px] font-bold text-sidebar hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedRowId(isExpanded ? null : log.id);
                                }}
                              >
                                {isExpanded ? (
                                  <>Show less <ChevronUp className="h-3 w-3" /></>
                                ) : (
                                  <>Show details <ChevronDown className="h-3 w-3" /></>
                                )}
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            </div>
          </div>

          {/* ── FOOTER & PAGINATION ── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 px-1">
            <p className="text-xs text-muted-foreground font-medium">
              Showing{" "}
              <span className="font-bold text-foreground">
                {filteredLogs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-bold text-foreground">
                {Math.min(currentPage * pageSize, filteredLogs.length)}
              </span>{" "}
              of <span className="font-bold text-foreground">{filteredLogs.length}</span> activity logs
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-2.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-0.5" /> Previous
                </Button>
                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((p, idx, arr) => {
                      const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                      return (
                        <React.Fragment key={p}>
                          {showEllipsis && <span className="px-1 text-xs text-muted-foreground">...</span>}
                          <button
                            onClick={() => setCurrentPage(p)}
                            className={cn(
                              "h-8 min-w-[32px] px-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                              currentPage === p
                                ? "bg-sidebar text-white shadow-2xs"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 px-2.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Next <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
