"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@studio/ui";
import { Building2, UserCog, LoaderCircle, Users, Utensils, ArrowRight, ArrowLeft, X } from "lucide-react";
import type { Department, Worker } from "@studio/types";
import { useUserRole } from "@/hooks/use-user-role";
import { useAuditLog } from "@/hooks/use-audit-log";
import { useToast } from "@/hooks/use-toast";
import { useWorkers } from "@/hooks/use-workers";
import { useDepartments } from "@/hooks/use-departments";
import { useMinistries } from "@/hooks/use-ministries";
import { useMealStubs } from "@/hooks/use-meal-stubs";
import { Button } from "@studio/ui";
import { Input } from "@studio/ui";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@studio/ui";
import { Label } from "@studio/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@studio/ui";
import { Textarea } from "@studio/ui";
import { cn } from "@/lib/utils";
import { subDays } from "date-fns";
import { useMemo } from "react";

type DepartmentData = {
  id: string;
  headId?: string | null;
  description?: string | null;
  mealStubWeekdayAllocation?: number;
  mealStubSundayAllocation?: number;
};

// ── Manage Department Dialog ────────────────────────────────────────────────────
function ManageDepartmentDialog({ departmentName, departmentData, workers, onSave, onClose }: {
  departmentName: Department;
  departmentData: DepartmentData | null;
  workers: Worker[];
  onSave: (id: string, headId: string | null, desc: string, weekday: number, sunday: number) => void;
  onClose: () => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState<string>(departmentData?.headId || "none");
  const [description, setDescription] = useState(departmentData?.description || "");
  const [weekdayAlloc, setWeekdayAlloc] = useState(departmentData?.mealStubWeekdayAllocation || 0);
  const [sundayAlloc, setSundayAlloc] = useState(departmentData?.mealStubSundayAllocation || 0);

  const sorted = [...workers].sort((a, b) => a.firstName.localeCompare(b.firstName));
  const deptColor = DEPT_COLORS[departmentName] || {
    stripe: "bg-sidebar",
    iconBadge: "bg-sidebar/10 text-sidebar dark:text-sky-400 border border-sidebar/20",
    progress: "bg-sidebar",
  };

  return (
    <div className="flex flex-col h-full max-h-[90vh] overflow-hidden">
      {/* ── MODAL HEADER ── */}
      <div className="p-5 pb-4 border-b border-border/70 bg-card/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 shadow-xs", deptColor.iconBadge)}>
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground font-headline">
                Manage {departmentName}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                Assign a department head and update allocations for the {departmentName} department.
              </DialogDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer shrink-0 -mt-1 -mr-1"
            title="Close modal"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div className="p-5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
        {/* Card 1: Department Overview */}
        <div className="rounded-2xl border border-border/70 bg-slate-50/60 dark:bg-muted/20 p-4 sm:p-5 space-y-3.5 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sidebar dark:text-sky-400">
            <Building2 className="h-4 w-4" />
            <span>Department Information</span>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Description</Label>
            <Textarea
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the department's purpose..."
              className="rounded-xl border-slate-200/90 dark:border-border text-xs min-h-[90px] focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar bg-background resize-none transition-all"
            />
          </div>
        </div>

        {/* Card 2: Meal Stub Allocation */}
        <div className="rounded-2xl border border-border/70 bg-slate-50/60 dark:bg-muted/20 p-4 sm:p-5 space-y-3.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Utensils className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sidebar dark:text-sky-400">
                Meal Stub Allocation
              </p>
              <p className="text-[11px] text-muted-foreground">
                Set the weekly quota limit for weekday & Sunday services.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm font-bold text-foreground">
                Weekday Pool
              </Label>
              <Input
                type="number"
                min="0"
                value={weekdayAlloc}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (!raw) {
                    setWeekdayAlloc(0);
                    return;
                  }
                  const parsed = parseInt(raw, 10);
                  setWeekdayAlloc(isNaN(parsed) ? 0 : Math.min(10000, Math.max(0, parsed)));
                }}
                className="h-11 rounded-xl border-slate-200/90 dark:border-border text-base font-bold text-foreground bg-background shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm font-bold text-foreground">
                Sunday Pool
              </Label>
              <Input
                type="number"
                min="0"
                value={sundayAlloc}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (!raw) {
                    setSundayAlloc(0);
                    return;
                  }
                  const parsed = parseInt(raw, 10);
                  setSundayAlloc(isNaN(parsed) ? 0 : Math.min(10000, Math.max(0, parsed)));
                }}
                className="h-11 rounded-xl border-slate-200/90 dark:border-border text-base font-bold text-foreground bg-background shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar"
              />
            </div>
          </div>
        </div>

        {/* Card 3: Department Head Group */}
        <div className="rounded-2xl border border-border/70 bg-slate-50/60 dark:bg-muted/20 p-4 sm:p-5 space-y-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <UserCog className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Department Head</p>
              <p className="text-[11px] text-muted-foreground">
                Designate the overarching head responsible for this department.
              </p>
            </div>
          </div>

          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="h-11 rounded-xl border-slate-200/90 dark:border-border text-xs bg-background shadow-2xs focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar cursor-pointer">
              <SelectValue placeholder="Select a department head" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-border shadow-xl max-h-64">
              <SelectItem value="none" className="text-xs font-medium cursor-pointer text-muted-foreground">
                None (Remove Department Head)
              </SelectItem>
              {sorted.map((w) => (
                <SelectItem key={w.id} value={w.id} className="text-xs font-medium cursor-pointer">
                  <div className="flex items-center gap-2 py-0.5">
                    <span className="w-5 h-5 rounded-full bg-sidebar/10 text-sidebar dark:text-sky-400 text-[9px] font-black flex items-center justify-center shrink-0">
                      {w.firstName?.[0]}
                      {w.lastName?.[0]}
                    </span>
                    <span>
                      {w.firstName} {w.lastName}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── MODAL FOOTER ── */}
      <div className="p-4 sm:p-5 border-t border-border/70 bg-card/95 backdrop-blur-md sticky bottom-0 z-10 flex flex-row items-center justify-end gap-2.5 shrink-0">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="rounded-xl h-10 px-4 sm:px-5 text-xs font-semibold hover:bg-muted/60 transition-colors cursor-pointer flex-1 sm:flex-initial"
        >
          Cancel
        </Button>
        <Button
          onClick={() =>
            onSave(
              departmentName,
              selectedUserId === "none" ? null : selectedUserId,
              description,
              weekdayAlloc,
              sundayAlloc
            )
          }
          className="bg-sidebar hover:bg-sidebar/90 text-white rounded-xl h-10 px-5 sm:px-6 text-xs font-bold shadow-xs transition-all active:scale-[0.99] cursor-pointer flex-1 sm:flex-initial"
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// ── Worker initials ────────────────────────────────────────────────────────────
function WorkerInitials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const init = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  return <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-[11px] font-black shrink-0">{init}</span>;
}

const DEPT_COLORS: Record<string, { stripe: string; iconBadge: string; progress: string }> = {
  Worship: {
    stripe: "bg-blue-600",
    iconBadge: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800",
    progress: "bg-blue-600",
  },
  Outreach: {
    stripe: "bg-amber-500",
    iconBadge: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800",
    progress: "bg-amber-500",
  },
  Relationship: {
    stripe: "bg-rose-500",
    iconBadge: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800",
    progress: "bg-rose-500",
  },
  Discipleship: {
    stripe: "bg-emerald-500",
    iconBadge: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800",
    progress: "bg-emerald-500",
  },
  Administration: {
    stripe: "bg-slate-900 dark:bg-slate-700",
    iconBadge: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700",
    progress: "bg-slate-900 dark:bg-slate-500",
  },
};

// ── Main page ──────────────────────────────────────────────────────────────────
export default function DepartmentManagementPage() {
  const { canManageMinistries, isLoading: isRoleLoading } = useUserRole();
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [deptToManage, setDeptToManage] = useState<Department | null>(null);

  const { workers, isLoading: workersLoading } = useWorkers({ limit: 999999 });
  const { departments: deptDataList, isLoading: deptsLoading, upsertDepartment } = useDepartments();
  const { ministries } = useMinistries({ all: true });

  const monthAgo = useMemo(() => subDays(new Date(), 30), []);
  const { mealStubs } = useMealStubs({ dateFrom: monthAgo });

  const isLoading = workersLoading || deptsLoading || isRoleLoading;

  const departments: Department[] = ["Worship", "Outreach", "Relationship", "Discipleship", "Administration"];

  const getDeptData = (name: string): DepartmentData | null =>
    (deptDataList as any[])?.find(d => d.id === name) || null;

  const getWorker = (id: string) => workers?.find(w => w.id === id);

  const getMinistryCount = (deptName: string) =>
    (ministries as any[] || []).filter(m => m.department === deptName || m.departmentCode === deptName.toUpperCase()).length;

  // Compute used meal stubs per department from mealstubs this month
  const getUsedPool = (deptName: string) => {
    const deptMinistryIds = (ministries as any[] || [])
      .filter(m => m.department === deptName || m.departmentCode === deptName.toUpperCase())
      .map(m => m.id);
    const deptWorkerIds = (workers || [])
      .filter(w => deptMinistryIds.includes(w.majorMinistryId))
      .map(w => w.id);
    return (mealStubs as any[] || []).filter(s => deptWorkerIds.includes(s.workerId)).length;
  };

  const handleSave = async (id: string, headId: string | null, desc: string, weekday: number, sunday: number) => {
    try {
      const assignedHead = workers?.find(w => w.id === headId);
      const headName = assignedHead ? `${assignedHead.firstName} ${assignedHead.lastName}`.trim() : "None";
      await upsertDepartment({ id, data: { headId, description: desc, mealStubWeekdayAllocation: weekday, mealStubSundayAllocation: sunday } });
      await logAction(
        "Updated Department",
        "Departments",
        `Updated ${id} department (Head: ${headName}, Weekday: ${weekday}, Sunday: ${sunday})`,
        id,
        id
      );
      toast({ title: "Department Updated", description: `${id} department updated successfully.` });
      setSheetOpen(false);
    } catch {
      toast({ variant: "destructive", title: "Update Failed" });
    }
  };

  if (isLoading) return <AppLayout><div className="flex justify-center py-10"><LoaderCircle className="h-8 w-8 animate-spin" /></div></AppLayout>;
  if (!canManageMinistries) return <AppLayout><Card><CardHeader><CardTitle>Access Denied</CardTitle><CardDescription>No permission.</CardDescription></CardHeader></Card></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 pb-12 w-full">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight text-foreground">
              Department Management
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Manage overarching departments and assign department heads.
            </p>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 h-9 px-3.5 sm:px-4 rounded-xl border border-border/60 bg-white dark:bg-card text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors shrink-0 shadow-2xs self-end sm:self-auto sm:ml-auto"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>

        {/* Department cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {departments.map(deptName => {
            const data = getDeptData(deptName);
            const head = data?.headId ? getWorker(data.headId) : null;
            const weekday = data?.mealStubWeekdayAllocation || 0;
            const sunday = data?.mealStubSundayAllocation || 0;
            const total = weekday + sunday;
            const used = getUsedPool(deptName);
            const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
            const ministryCount = getMinistryCount(deptName);

            const deptColor = DEPT_COLORS[deptName] || {
              stripe: "bg-sidebar",
              iconBadge: "bg-sidebar/10 text-sidebar dark:text-sky-400 border border-sidebar/20",
              progress: "bg-sidebar",
            };

            return (
              <div key={deptName} className="bg-white dark:bg-card rounded-2xl border border-border/60 shadow-card-dark overflow-hidden flex flex-col justify-between">
                {/* Top Accent Stripe */}
                <div className={cn("h-1.5 w-full", deptColor.stripe)} />

                <div className="p-5 flex flex-col gap-4 flex-1 justify-between">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-foreground font-headline">{deptName}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{data?.description || "Description"}</p>
                    </div>
                    <div className={cn("p-2 rounded-xl shrink-0", deptColor.iconBadge)}>
                      <Building2 className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Meal Stub Pool progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-muted-foreground">Meal Stub Pool</span>
                      <span className="text-muted-foreground font-mono">{used.toLocaleString()} / {total.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", deptColor.progress)} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{pct}% allocated</p>
                  </div>

                  {/* Weekday / Sunday boxes */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border/60 bg-muted/[0.12] px-3 py-2.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Weekday
                      </p>
                      <p className="text-2xl font-black text-foreground leading-none">{weekday}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/[0.12] px-3 py-2.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Sunday
                      </p>
                      <p className="text-2xl font-black text-foreground leading-none">{sunday}</p>
                    </div>
                  </div>

                  {/* Department Head */}
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/[0.12] px-3 py-2.5">
                    {head ? (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <WorkerInitials name={`${head.firstName} ${head.lastName}`} />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{head.firstName} {head.lastName}</p>
                            <p className="text-[10px] text-muted-foreground">Department Head</p>
                          </div>
                        </div>
                        {ministryCount > 0 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">{ministryCount} ministr{ministryCount !== 1 ? "ies" : "y"}</span>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span className="text-xs italic">No head assigned</span>
                      </div>
                    )}
                  </div>

                  {/* Manage button */}
                  <button
                    type="button"
                    onClick={() => { setDeptToManage(deptName); setSheetOpen(true); }}
                    className="flex items-center justify-between w-full rounded-xl border border-border/60 bg-muted/[0.08] hover:bg-muted/[0.22] px-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground transition-colors group cursor-pointer shadow-2xs"
                  >
                    <span>Manage department</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="sm:max-w-xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl border border-border/80 shadow-2xl bg-card [&>button:last-child]:hidden">
          {deptToManage && workers && (
            <ManageDepartmentDialog
              departmentName={deptToManage}
              departmentData={getDeptData(deptToManage)}
              workers={workers}
              onSave={handleSave}
              onClose={() => setSheetOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
