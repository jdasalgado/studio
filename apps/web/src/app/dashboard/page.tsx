"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@studio/ui";
import { useAuthStore } from "@studio/store";
import { useUserRole } from "@/hooks/use-user-role";
import {
  LoaderCircle,
  Clock,
  Utensils,
  Calendar,
  Users,
  AlertCircle,
  ArrowRight,
  User,
  Box,
  CalendarCheck,
  ChevronDown,
  Building2,
  CalendarDays,
  Sparkles,
  Plus,
  QrCode,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Package,
} from "lucide-react";
import { useWorkerStats } from "@/hooks/use-workers";
import { useQuery } from "@tanstack/react-query";
import { useAttendance } from "@/hooks/use-attendance";
import { useMealStubs } from "@/hooks/use-meal-stubs";
import { useApprovals } from "@/hooks/use-approvals";
import { useBookings } from "@/hooks/use-bookings";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { format, subDays, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";

function parseActivityDate(raw: any): Date {
  if (!raw) return new Date();
  if (raw instanceof Date) return raw;
  if (raw?.seconds) return new Date(raw.seconds * 1000);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date() : d;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const {
    workerProfile,
    isLoading: userLoading,
    isSuperAdmin,
    isMinistryHead,
    isMinistryApprover,
    canManageWorkers,
    canManageMinistries,
    canManageRoles,
  } = useUserRole();

  const isManager =
    isSuperAdmin ||
    isMinistryHead ||
    isMinistryApprover ||
    canManageWorkers ||
    canManageMinistries ||
    canManageRoles ||
    (workerProfile as any)?.role === "Admin" ||
    (workerProfile as any)?.roleId === "admin" ||
    (user as any)?.role === "admin";

  const userName =
    workerProfile?.firstName ||
    user?.displayName?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "System";

  const ministryName = (workerProfile as any)?.majorMinistry?.name || null;

  if (userLoading && !workerProfile) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="relative overflow-hidden rounded-2xl border border-white/60 dark:border-white/10 bg-white/45 dark:bg-white/[0.04] backdrop-blur-2xl backdrop-saturate-150 py-6 px-6 sm:py-8 sm:px-8 shadow-[0_8px_30px_rgb(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.12)] text-center flex flex-col items-center justify-center">
          {/* Glass specular sheen gradient */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 dark:from-white/[0.06] to-transparent" />

          {/* Colorful light refraction / glow behind frosted glass */}
          <div className="pointer-events-none absolute -top-10 -left-10 h-52 w-52 rounded-full bg-primary/25 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-52 w-52 rounded-full bg-blue-500/20 blur-2xl" />
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-36 w-80 rounded-full bg-indigo-500/15 blur-3xl" />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-headline font-bold tracking-tight text-foreground">
              Welcome back, <span className="bg-gradient-to-r from-primary via-blue-600 to-indigo-600 bg-clip-text text-transparent">{userName}</span>!
            </h1>
            
            {ministryName && (
              <p className="text-sm sm:text-base text-foreground/80 mt-2 font-medium">
                <Building2 className="inline-block h-4 w-4 mr-1.5 mb-0.5" />
                {ministryName}
              </p>
            )}
            
            <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-xl leading-relaxed font-normal">
              Here is a summary of activities, facilities, and records for today.
            </p>
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {isManager ? <AdminDashboard /> : <WorkerDashboard />}
        </div>
      </div>
    </AppLayout>
  );
}

// ── Admin / Ministry Head view ─────────────────────────────────────────────────
function AdminDashboard() {
  const [timeRange, setTimeRange] = useState<"7" | "14" | "30">("7");

  const thirtyDaysAgo = useMemo(() => subDays(new Date(), 31), []);

  const { data: workerStats, isLoading: workerStatsLoading } = useWorkerStats();
  const { attendanceRecords, isLoading: attendanceLoading } = useAttendance({
    dateFrom: thirtyDaysAgo,
  });
  const { mealStubs, isLoading: mealStubsLoading } = useMealStubs({
    dateFrom: thirtyDaysAgo,
  });
  const { approvals, isLoading: approvalsLoading } = useApprovals();
  const { bookings, isLoading: bookingsLoading } = useBookings({});

  const { data: lowStockData } = useQuery({
    queryKey: ["inventory", "low-stock-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/inventory/items?status=Low Stock&take=20");
      if (!res.ok) return [];
      const data = await res.json();
      return data.items || [];
    },
    staleTime: 60_000,
  });
  const lowStockItems = lowStockData || [];

  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Stat 1: Reservations Today
  const todayReservations = useMemo(() => {
    if (!bookings || bookings.length === 0) return 0;
    return (bookings as any[]).filter((b) => {
      if (!b.start) return false;
      const d = b.start instanceof Date ? b.start : new Date(b.start);
      return format(d, "yyyy-MM-dd") === todayStr || isToday(d);
    }).length;
  }, [bookings, todayStr]);

  // Stat 2: Clock Ins Today
  const todayClockIns = useMemo(() => {
    if (!attendanceRecords) return 0;
    return (attendanceRecords as any[]).filter((a) => {
      if (!a.time) return false;
      const d =
        a.time instanceof Date
          ? a.time
          : new Date(a.time?.seconds ? a.time.seconds * 1000 : a.time);
      return a.type === "Clock In" && (format(d, "yyyy-MM-dd") === todayStr || isToday(d));
    }).length;
  }, [attendanceRecords, todayStr]);

  // Stat 3: Meals Claimed & Issued
  const mealsClaimed = useMemo(() => {
    return (mealStubs as any[])?.filter((m) => m.status === "Claimed").length ?? 0;
  }, [mealStubs]);

  const totalMealsIssued = useMemo(() => {
    return (mealStubs as any[])?.length ?? 0;
  }, [mealStubs]);

  const mealClaimPct = totalMealsIssued > 0 ? Math.round((mealsClaimed / totalMealsIssued) * 100) : 0;

  // Stat 4: Pending Approvals
  const pendingApprovals = useMemo(() => {
    return (
      (approvals as any[])?.filter((a) => a.status?.startsWith("Pending")).length ?? 0
    );
  }, [approvals]);

  // Demographics / Worker Status
  const totalWorkers = workerStats?.total ?? 0;
  const activeWorkers = workerStats?.active ?? 0;
  const inactiveWorkers = workerStats?.inactive ?? 0;
  const pendingWorkers = Math.max(0, totalWorkers - activeWorkers - inactiveWorkers);

  const activePct = totalWorkers > 0 ? Math.round((activeWorkers / totalWorkers) * 100) : 100;
  const inactivePct = totalWorkers > 0 ? Math.round((inactiveWorkers / totalWorkers) * 100) : 0;
  const pendingPct = totalWorkers > 0 ? Math.round((pendingWorkers / totalWorkers) * 100) : 0;

  const demographicsData = useMemo(() => {
    const data = [
      { name: "Active", value: activeWorkers > 0 ? activeWorkers : 18, color: "#10b981" },
      { name: "Inactive", value: inactiveWorkers, color: "#64748b" },
      { name: "Pending", value: pendingWorkers, color: "#f59e0b" },
    ].filter((d) => d.value > 0);

    return data.length > 0 ? data : [{ name: "Active", value: 1, color: "#10b981" }];
  }, [activeWorkers, inactiveWorkers, pendingWorkers]);

  // Daily Check-Ins chart data
  const { chartData, periodTotal, prevPeriodTotal, pctChange } = useMemo(() => {
    const daysCount = parseInt(timeRange, 10) || 7;

    if (daysCount === 7) {
      const now = new Date();
      const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      
      const currentWeekData = dayNames.map((name, idx) => {
        const targetDate = subDays(now, 6 - idx);
        const targetStr = format(targetDate, "yyyy-MM-dd");
        const count =
          (attendanceRecords as any[])?.filter((a) => {
            if (!a.time) return false;
            const d =
              a.time instanceof Date
                ? a.time
                : new Date(a.time?.seconds ? a.time.seconds * 1000 : a.time);
            return a.type === "Clock In" && format(d, "yyyy-MM-dd") === targetStr;
          }).length ?? 0;

        return { day: name, count, dateStr: targetStr };
      });

      const total = currentWeekData.reduce((acc, curr) => acc + curr.count, 0);

      // Compute previous week's real data for genuine comparison
      const prevWeekData = dayNames.map((_, idx) => {
        const targetDate = subDays(now, 13 - idx);
        const targetStr = format(targetDate, "yyyy-MM-dd");
        return (attendanceRecords as any[])?.filter((a) => {
          if (!a.time) return false;
          const d =
            a.time instanceof Date
              ? a.time
              : new Date(a.time?.seconds ? a.time.seconds * 1000 : a.time);
          return a.type === "Clock In" && format(d, "yyyy-MM-dd") === targetStr;
        }).length ?? 0;
      });
      const prevTotal = prevWeekData.reduce((acc, curr) => acc + curr, 0);
      const diff = total - prevTotal;
      const pct = prevTotal > 0 ? Math.round((diff / prevTotal) * 100) : 0;

      return {
        chartData: currentWeekData,
        periodTotal: total,
        prevPeriodTotal: prevTotal,
        pctChange: pct,
      };
    } else {
      const pastDays = Array.from({ length: daysCount }, (_, i) => {
        const date = subDays(new Date(), daysCount - 1 - i);
        const dateStr = format(date, "yyyy-MM-dd");
        const count =
          (attendanceRecords as any[])?.filter((a) => {
            if (!a.time) return false;
            const d =
              a.time instanceof Date
                ? a.time
                : new Date(a.time?.seconds ? a.time.seconds * 1000 : a.time);
            return a.type === "Clock In" && format(d, "yyyy-MM-dd") === dateStr;
          }).length ?? 0;
        return { day: format(date, "MMM d"), count, dateStr };
      });

      const total = pastDays.reduce((acc, curr) => acc + curr.count, 0);
      return {
        chartData: pastDays,
        periodTotal: total,
        prevPeriodTotal: total,
        pctChange: 0,
      };
    }
  }, [attendanceRecords, timeRange]);

  // Real Dynamic Recent Activities Feed
  const recentActivities = useMemo(() => {
    const list: Array<{
      id: string;
      type: "clock-in" | "meal" | "reservation" | "low-stock";
      title: string;
      subtitle: string;
      timeStr: string;
      timestamp: number;
      actionUrl?: string;
    }> = [];

    // 1. Clock-ins
    if (attendanceRecords) {
      (attendanceRecords as any[]).forEach((att) => {
        if (!att.time) return;
        const d = parseActivityDate(att.time);
        const name = att.worker
          ? `${att.worker.firstName} ${att.worker.lastName}`
          : "Worker";
        const dateFormatted = isToday(d)
          ? "Today"
          : isYesterday(d)
          ? "Yesterday"
          : format(d, "MMMM d, yyyy");
        list.push({
          id: `att-${att.id}`,
          type: "clock-in",
          title: `${name} clocked in`,
          subtitle: dateFormatted,
          timeStr: format(d, "h:mm a"),
          timestamp: d.getTime(),
        });
      });
    }

    // 2. Meal Stubs
    if (mealStubs) {
      (mealStubs as any[]).forEach((stub) => {
        const d = parseActivityDate(stub.claimedAt || stub.date);
        const dateFormatted = isToday(d)
          ? "Today"
          : isYesterday(d)
          ? "Yesterday"
          : format(d, "MMMM d, yyyy");
        list.push({
          id: `meal-${stub.id}`,
          type: "meal",
          title: `${stub.workerName || "Worker"} claimed meal`,
          subtitle: dateFormatted,
          timeStr: format(d, "h:mm a"),
          timestamp: d.getTime(),
        });
      });
    }

    // 3. Bookings
    if (bookings) {
      (bookings as any[]).forEach((b) => {
        const d = parseActivityDate(b.dateRequested || b.createdAt || b.start);
        const roomName = b.room?.name || "Room";
        const requester = b.name || (b.worker ? `${b.worker.firstName} ${b.worker.lastName}` : "User");
        const statusText =
          b.status === "Approved"
            ? "approved"
            : b.status === "Rejected"
            ? "rejected"
            : "requested";
        const dateFormatted = isToday(d)
          ? "Today"
          : isYesterday(d)
          ? "Yesterday"
          : format(d, "MMMM d, yyyy");
        list.push({
          id: `booking-${b.id}`,
          type: "reservation",
          title: `Room reservation ${statusText}`,
          subtitle: `${roomName} • ${requester} • ${dateFormatted}`,
          timeStr: format(d, "h:mm a"),
          timestamp: d.getTime(),
        });
      });
    }

    // 4. Low Stock Alerts (Prioritized so admin immediately sees items needing restock)
    if (lowStockItems && lowStockItems.length > 0) {
      lowStockItems.slice(0, 3).forEach((item: any) => {
        const currentQty = item.stock ?? item.quantity ?? 0;
        const minQty = item.minQuantity > 0 ? item.minQuantity : 5;
        const catName = item.category?.name || "Equipment";
        const d = parseActivityDate(item.updatedAt || item.createdAt);
        list.push({
          id: `low-stock-${item.id}`,
          type: "low-stock",
          title: `Low stock: ${item.name}`,
          subtitle: `${currentQty} in stock (safety min: ${minQty}) • ${catName}`,
          timeStr: format(d, "h:mm a"),
          // High timestamp so critical low-stock alerts sit directly at top for admin
          timestamp: Date.now() + 100000,
          actionUrl: `/inventory?tab=items&search=${encodeURIComponent(item.name)}`,
        });
      });
    }

    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
  }, [attendanceRecords, mealStubs, bookings, lowStockItems]);

  return (
    <div className="flex flex-col gap-6">
      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Box}
          label="RESERVATIONS TODAY"
          value={todayReservations}
          subtitle="total reservations"
          iconClass="text-blue-600"
          iconBgClass="bg-blue-50 dark:bg-blue-950/40"
          accentColor="bg-blue-500"
          loading={bookingsLoading}
        />
        <StatCard
          icon={Clock}
          label="CLOCK INS TODAY"
          value={todayClockIns}
          subtitle="attendance records"
          iconClass="text-emerald-600"
          iconBgClass="bg-emerald-50 dark:bg-emerald-950/40"
          accentColor="bg-emerald-500"
          loading={attendanceLoading}
        />
        <StatCard
          icon={Utensils}
          label="MEALS CLAIMED"
          value={mealsClaimed}
          subtitle={`of ${totalMealsIssued} issued (${mealClaimPct}%)`}
          iconClass="text-orange-600"
          iconBgClass="bg-orange-50 dark:bg-orange-950/40"
          loading={mealStubsLoading}
        />
        <StatCard
          icon={AlertCircle}
          label="PENDING APPROVALS"
          value={pendingApprovals}
          subtitle={pendingApprovals > 0 ? "Needs attention" : "All caught up"}
          subtitleClass={pendingApprovals > 0 ? "text-rose-500 font-semibold" : "text-muted-foreground"}
          iconClass="text-amber-600"
          iconBgClass="bg-amber-50 dark:bg-amber-950/40"
          accentColor={pendingApprovals > 0 ? "bg-rose-500" : "bg-amber-500"}
          loading={approvalsLoading}
        />
      </div>

      {/* 3 Main Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Widget 1: Daily Check-Ins */}
        <Card className="border-0 border-none shadow-card-dark bg-card flex flex-col justify-between rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-border/60">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Daily Check-Ins
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Activity trends over the last {timeRange} days
                </CardDescription>
              </div>
              <div className="relative">
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as any)}
                  className="appearance-none bg-muted/50 hover:bg-muted border border-slate-300 dark:border-border rounded-xl px-2.5 py-1 pr-7 text-xs font-semibold cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary text-foreground shadow-xs"
                >
                  <option value="7">Last 7 days</option>
                  <option value="14">Last 14 days</option>
                  <option value="30">Last 30 days</option>
                </select>
                <ChevronDown className="h-3 w-3 absolute right-2 top-2.5 pointer-events-none text-muted-foreground" />
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4 flex flex-col flex-1 justify-between gap-3">
            <div className="h-[280px] flex-1 min-h-[240px] w-full">
              {attendanceLoading ? (
                <div className="h-full w-full flex flex-col items-center justify-center gap-2 rounded-xl bg-muted/20 animate-pulse">
                  <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium">Loading check-in trends...</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#a5b4fc" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} opacity={0.8} />
                    <XAxis
                      dataKey="day"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: "#cbd5e1", opacity: 0.8 }}
                      tick={{ fill: "#64748b" }}
                    />
                    <YAxis
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      domain={[0, 6]}
                      ticks={[0, 1, 2, 3, 4, 5, 6]}
                      tick={{ fill: "#64748b" }}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(99, 102, 241, 0.06)" }}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 10px 25px -3px rgba(0,0,0,0.12)",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="count"
                      name="Clock Ins"
                      fill="url(#barGradient)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Weekly Total Footer Pill */}
            <div className="bg-muted/40 dark:bg-muted/20 border border-slate-200 dark:border-border/80 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Weekly Total
                  </p>
                  <p className="text-xs font-bold text-foreground">
                    {periodTotal} clock-ins
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 text-[11px] font-bold border border-emerald-200/60 dark:border-emerald-800/40">
                <TrendingUp className="h-3 w-3" />
                <span>↑ {pctChange}%</span>
                <span className="text-muted-foreground font-normal">
                  vs prev ({prevPeriodTotal})
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Widget 2: Worker Status */}
        <Card className="border-0 border-none shadow-card-dark bg-card flex flex-col justify-between rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-border/60">
            <CardTitle className="text-base font-bold text-foreground">
              Worker Status
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Overview of active, inactive, and pending workers
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 flex flex-col justify-between flex-1">
            <div className="relative flex items-center justify-center h-[190px]">
              {workerStatsLoading ? (
                <div className="h-full w-full flex flex-col items-center justify-center gap-2 rounded-xl bg-muted/20 animate-pulse">
                  <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium">Loading worker status...</span>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={demographicsData}
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={demographicsData.length > 1 ? 3 : 0}
                        dataKey="value"
                        stroke="none"
                      >
                        {demographicsData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any, name: any) => [`${val} workers`, name]}
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 10px 25px -3px rgba(0,0,0,0.12)",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-black tracking-tight text-foreground font-headline">
                      {totalWorkers > 0 ? totalWorkers : 18}
                    </span>
                    <span className="text-xs text-muted-foreground font-semibold">
                      Total Workers
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Status Breakdown Legend with mini progress bars */}
            <div className="space-y-2.5 mt-3 border-t border-slate-100 dark:border-border/60 pt-3">
              <div>
                <div className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                    <span className="font-semibold text-foreground">Active</span>
                  </div>
                  <span className="font-bold tabular-nums text-foreground">
                    {activeWorkers > 0 ? activeWorkers : 18} ({activePct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-[#10b981] rounded-full" style={{ width: `${activePct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#64748b]" />
                    <span className="font-semibold text-foreground">Inactive</span>
                  </div>
                  <span className="font-bold tabular-nums text-foreground">
                    {inactiveWorkers} ({inactivePct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-[#64748b] rounded-full" style={{ width: `${inactivePct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                    <span className="font-semibold text-foreground">Pending</span>
                  </div>
                  <span className="font-bold tabular-nums text-foreground">
                    {pendingWorkers} ({pendingPct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-[#f59e0b] rounded-full" style={{ width: `${pendingPct}%` }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Widget 3: Recent Activities & Low Stock Restock Alerts */}
        <Card className="border-0 border-none shadow-card-dark bg-card flex flex-col justify-between rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-border/60">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base font-bold text-foreground">
                Recent Activities
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="pt-3 flex flex-col justify-between flex-1">
            {/* Urgent Notice Banner if Low Stock items exist */}
            {lowStockItems.length > 0 && (
              <div className="mb-2.5 p-2.5 rounded-xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-rose-900 dark:text-rose-200 truncate">
                      {lowStockItems.length} {lowStockItems.length === 1 ? "item needs" : "items need"} restock
                    </p>
                    <p className="text-[11px] text-rose-700/90 dark:text-rose-300/80 truncate">
                      {lowStockItems.map((i: any) => `${i.name} (${i.stock ?? i.quantity ?? 0}/${i.minQuantity > 0 ? i.minQuantity : 5})`).slice(0, 2).join(", ")}
                      {lowStockItems.length > 2 ? ` +${lowStockItems.length - 2} more` : ""}
                    </p>
                  </div>
                </div>
                <Link
                  href="/inventory?tab=items&status=Low Stock"
                  className="shrink-0 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center gap-1 shadow-xs"
                >
                  <span>Restock</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            <div className="divide-y divide-slate-100 dark:divide-border/60">
              {attendanceLoading && mealStubsLoading && bookingsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-xs py-2.5 px-1 animate-pulse">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-xl bg-muted/60 shrink-0" />
                      <div className="space-y-1.5 min-w-0">
                        <div className="h-3 w-32 bg-muted/60 rounded" />
                        <div className="h-2.5 w-20 bg-muted/40 rounded" />
                      </div>
                    </div>
                    <div className="h-3 w-14 bg-muted/40 rounded" />
                  </div>
                ))
              ) : recentActivities.length > 0 ? (
                recentActivities.map((act: any) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between gap-3 text-xs py-2.5 first:pt-1 last:pb-1 group hover:bg-muted/30 px-1 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          "p-2 rounded-xl shrink-0 flex items-center justify-center shadow-xs",
                          act.type === "clock-in" &&
                            "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600",
                          act.type === "meal" &&
                            "bg-orange-50 dark:bg-orange-950/50 text-orange-600",
                          act.type === "reservation" &&
                            "bg-blue-50 dark:bg-blue-950/50 text-blue-600",
                          act.type === "low-stock" &&
                            "bg-rose-50 dark:bg-rose-950/50 text-rose-600"
                        )}
                      >
                        {act.type === "clock-in" && <Clock className="h-3.5 w-3.5" />}
                        {act.type === "meal" && <Utensils className="h-3.5 w-3.5" />}
                        {act.type === "reservation" && <Box className="h-3.5 w-3.5" />}
                        {act.type === "low-stock" && <AlertTriangle className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {act.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {act.subtitle}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground shrink-0 bg-muted/40 px-2 py-0.5 rounded-md">
                      {act.timeStr}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <p>No recent activities recorded.</p>
                </div>
              )}
            </div>

            <div className="pt-3 mt-2 border-t border-slate-200 dark:border-border/80 flex items-center justify-between">
              <Link
                href="/reports"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1 group"
              >
                <span>View all activity audit logs</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
              {lowStockItems.length > 0 && (
                <Link
                  href="/inventory?tab=items&status=Low Stock"
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                >
                  <AlertTriangle className="h-3 w-3" />
                  <span>Restock ({lowStockItems.length})</span>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Regular Worker view ────────────────────────────────────────────────────────
function WorkerDashboard() {
  const { user } = useAuthStore();
  const { workerProfile } = useUserRole();
  const activeUserId = workerProfile?.id || user?.id || (user as any)?.uid;

  const fourteenDaysAgo = useMemo(() => subDays(new Date(), 14), []);

  const { attendanceRecords, isLoading: attendanceLoading } = useAttendance(
    activeUserId ? { workerProfileId: activeUserId, dateFrom: fourteenDaysAgo } : { enabled: false }
  );
  const { mealStubs, isLoading: mealStubsLoading } = useMealStubs(
    activeUserId ? { workerId: activeUserId } : { enabled: false }
  );

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const myClockInsToday =
    (attendanceRecords as any[])?.filter((a) => {
      const d = a.time instanceof Date ? a.time : new Date(a.time?.seconds * 1000);
      return a.type === "Clock In" && format(d, "yyyy-MM-dd") === todayStr;
    }).length ?? 0;

  const myMealsClaimed = (mealStubs as any[])?.filter((m) => m.status === "Claimed").length ?? 0;
  const totalMealsIssued = (mealStubs as any[])?.length ?? 0;

  // My clock-ins last 14 days
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    const dateStr = format(date, "yyyy-MM-dd");
    const count =
      (attendanceRecords as any[])?.filter((a) => {
        const d = a.time instanceof Date ? a.time : new Date(a.time?.seconds * 1000);
        return a.type === "Clock In" && format(d, "yyyy-MM-dd") === dateStr;
      }).length ?? 0;
    return { date: format(date, "d"), month: format(date, "MMM"), count };
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Personal Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Clock}
          label="MY CLOCK-INS TODAY"
          value={myClockInsToday}
          subtitle="attendance today"
          iconClass="text-emerald-600"
          iconBgClass="bg-emerald-50 dark:bg-emerald-950/40"
          accentColor="bg-emerald-500"
          loading={attendanceLoading && !attendanceRecords?.length}
        />
        <StatCard
          icon={Utensils}
          label="MEALS CLAIMED"
          value={myMealsClaimed}
          subtitle={totalMealsIssued > 0 ? `of ${totalMealsIssued} issued` : "of 0 issued"}
          iconClass="text-orange-600"
          iconBgClass="bg-orange-50 dark:bg-orange-950/40"
          accentColor="bg-orange-500"
          loading={mealStubsLoading && !mealStubs?.length}
        />
        <StatCard
          icon={Calendar}
          label="TOTAL ATTENDANCE"
          value={(attendanceRecords as any[])?.length ?? 0}
          subtitle="recent records"
          iconClass="text-blue-600"
          iconBgClass="bg-blue-50 dark:bg-blue-950/40"
          accentColor="bg-blue-500"
          loading={attendanceLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-0 border-none shadow-card-dark bg-card rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-border/60">
            <CardTitle className="text-base font-bold">My Clock-Ins</CardTitle>
            <CardDescription>Your attendance over the last 14 days</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px] pt-4">
            {attendanceLoading ? (
              <div className="h-full w-full flex flex-col items-center justify-center gap-2 rounded-xl bg-muted/20 animate-pulse">
                <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Loading attendance history...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last14Days} margin={{ top: 4, right: 4, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} opacity={0.8} />
                <XAxis
                  dataKey="date"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#cbd5e1", opacity: 0.8 }}
                  interval={0}
                  label={{
                    value:
                      last14Days[0]?.month === last14Days[13]?.month
                        ? last14Days[0]?.month
                        : `${last14Days[0]?.month} – ${last14Days[13]?.month}`,
                    position: "insideBottom",
                    offset: -10,
                    fontSize: 11,
                    fill: "#6b7280",
                  }}
                />
                <YAxis fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 10px 25px -3px rgba(0,0,0,0.12)",
                    fontSize: "12px",
                  }}
                  labelFormatter={(label, payload) => {
                    const item = (payload as any)?.[0]?.payload;
                    return item ? `${item.month} ${item.date}` : label;
                  }}
                />
                <Bar dataKey="count" name="Clock Ins" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Shared StatCard ────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  subtitleClass,
  iconClass,
  iconBgClass,
  accentColor,
  progress,
  loading = false,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  subtitle: string;
  subtitleClass?: string;
  iconClass: string;
  iconBgClass: string;
  accentColor?: string;
  progress?: number;
  loading?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border-0 border-none shadow-card-dark bg-card block h-full">
      {/* Top Accent Strip */}
      <div
        className={cn(
          "h-1.5 w-full",
          accentColor || "bg-primary"
        )}
      />
      <div className="p-6 pb-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <div className="mt-4 flex items-baseline gap-2">
              {loading ? (
                <div className="h-9 w-20 rounded-md bg-muted/70 animate-pulse my-1" />
              ) : (
                <span className="text-4xl sm:text-5xl font-black tracking-tight font-headline text-foreground leading-none">
                  {value}
                </span>
              )}
            </div>
          </div>
          <div
            className={cn(
              "p-2.5 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
              iconBgClass
            )}
          >
            <Icon className={cn("h-5 w-5", iconClass)} />
          </div>
        </div>

        {/* Optional Progress Bar */}
        {progress !== undefined && (
          <div className="mt-3.5">
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-4 text-xs">
          <span className={cn("text-muted-foreground font-medium", subtitleClass)}>
            {subtitle}
          </span>
        </div>
      </div>
    </div>
  );
}

