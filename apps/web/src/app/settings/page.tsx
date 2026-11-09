"use client";

import React from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import {
  LoaderCircle, AlertTriangle, Settings, Shield, Building2,
  Building, Utensils, MapPin, Clock, ArrowRight, History,
  Users, UtensilsCrossed, ScanLine,
} from "lucide-react";
import { useAuthStore } from "@studio/store";
import { useUserRole } from "@/hooks/use-user-role";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { upsertRole, updateWorker, getRoles, getWorkers, getMinistries, getRooms, getDepartmentSettings } from "@/actions/db";
import { Card, CardHeader, CardTitle, CardDescription } from "@studio/ui";
import { Button } from "@studio/ui";
import { cn } from "@/lib/utils";

// ── Stat card (Consistent with Connect2Souls & Dashboard) ──────────────────────
function StatCard({ label, value, sub, icon: Icon, accentColor, iconClass, iconBgClass }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accentColor: string;
  iconClass: string;
  iconBgClass: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 dark:border-border shadow-xs bg-white dark:bg-card h-full">
      <div className={cn("h-1.5 w-full", accentColor)} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <div className="mt-3">
              <span className="text-4xl font-black tracking-tight font-headline text-foreground leading-none">{value}</span>
            </div>
            {sub && <p className="text-xs text-muted-foreground mt-2 font-medium">{sub}</p>}
          </div>
          <div className={cn("p-2.5 rounded-xl flex items-center justify-center shrink-0 shadow-xs", iconBgClass)}>
            <Icon className={cn("h-5 w-5", iconClass)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Module card ────────────────────────────────────────────────────────────────
function ModuleCard({ href, icon: Icon, iconBg, title, description, badge }: {
  href: string; icon: React.ElementType; iconBg: string;
  title: string; description: string; badge?: string;
}) {
  return (
    <Link href={href}
      className="group bg-white dark:bg-card rounded-2xl border border-gray-200/80 dark:border-border shadow-sm p-6 flex flex-col gap-4 hover:shadow-lg hover:border-sidebar/40 hover:-translate-y-0.5 transition-all cursor-pointer">
      <div className="flex items-start justify-between">
        <div className={cn("p-3.5 rounded-xl transition-all group-hover:scale-110", iconBg)}>
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-sidebar group-hover:translate-x-1 transition-all" />
      </div>
      <div className="flex-1">
        <h3 className="text-base font-bold text-foreground group-hover:text-sidebar transition-colors mb-2">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      {badge && (
        <div className="pt-3 border-t border-gray-100 dark:border-border/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{badge}</p>
        </div>
      )}
    </Link>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { isLoading, needsSeeding, workerProfile, canManageRoles, canManageMinistries, canManageFacilities } = useUserRole();
  const { user } = useAuthStore();
  const { toast } = useToast();

  // Live counts from DB
  const { data: roles } = useQuery({ queryKey: ["roles"], queryFn: () => getRoles() });
  const { data: workers } = useQuery({ queryKey: ["workers-all"], queryFn: () => getWorkers() });
  const { data: ministries } = useQuery({ queryKey: ["ministries"], queryFn: () => getMinistries() });
  const { data: rooms } = useQuery({ queryKey: ["rooms"], queryFn: () => getRooms() });
  const { data: deptSettings } = useQuery({ queryKey: ["department-settings"], queryFn: () => getDepartmentSettings() });

  const roleCount = roles?.length ?? 0;
  const systemRoles = (roles as any[] || []).filter(r => r.isSystemRole).length;
  const customRoles = roleCount - systemRoles;
  const totalMembers = workers?.length ?? 0;
  const ministryCount = (ministries as any[] || []).length;
  const deptCount = (deptSettings as any[] || []).length;
  const facilityCount = rooms?.length ?? 0;
  const weeklyMealPool = (ministries as any[] || []).reduce((sum, m) => sum + (m.mealStubWeeklyLimit || 0), 0);
  const activeWorkers = (workers as any[] || []).filter(w => w.status === "Active").length;

  const initializeSystem = async () => {
    if (!user) { toast({ variant: "destructive", title: "Not Logged In" }); return; }
    try {
      const rolesData = [
        { id: "admin", name: "Admin", permissions: [], isSuperAdmin: true, isSystemRole: true },
        { id: "approver", name: "Approver", permissions: ["manage_approvals"], isSystemRole: true },
        { id: "editor", name: "Editor", permissions: ["manage_ministries", "manage_rooms"], isSystemRole: true },
        { id: "viewer", name: "Viewer", permissions: [], isSystemRole: true },
      ];
      for (const role of rolesData) {
        await upsertRole(role.id, { name: role.name, permissions: role.permissions, isSuperAdmin: role.isSuperAdmin, isSystemRole: role.isSystemRole });
      }
      await updateWorker(user.uid, { roleId: "admin", status: "Active" });
      toast({ title: "System Initialized", description: "Default roles created. Please refresh." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Initialization Failed", description: e.message });
    }
  };

  const canAccess = canManageRoles || canManageMinistries || canManageFacilities || needsSeeding || (workerProfile && !workerProfile.roleId);

  if (isLoading) return <AppLayout><div className="flex justify-center py-10"><LoaderCircle className="h-8 w-8 animate-spin" /></div></AppLayout>;
  if (!user) return <AppLayout><Card><CardHeader><CardTitle>Not Logged In</CardTitle></CardHeader></Card></AppLayout>;
  if (!canAccess) return <AppLayout><Card><CardHeader><CardTitle>Access Denied</CardTitle><CardDescription>You do not have permission to view this page.</CardDescription></CardHeader></Card></AppLayout>;

  return (
    <AppLayout>
      <div className="flex flex-col space-y-6 pb-12 w-full">

        {/* ── TOP HEADER ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">
              Configuration
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage every part of your COG App configuration from one place.
            </p>
          </div>
        </div>

        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Seeding banner */}
        {needsSeeding && (
          <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
            <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30 shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-1">Initial Setup Required</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">Your application has not been initialized. Create default roles and set your account as master administrator.</p>
            </div>
            <Button onClick={initializeSystem} size="sm" className="shrink-0 bg-sidebar hover:bg-sidebar/90 text-white shadow-sm">
              Initialize System
            </Button>
          </div>
        )}

        {/* ── TOP KPI SUMMARY CARDS (CONNECT2SOULS STYLE) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="ACTIVE ROLES"
            value={roleCount}
            sub={`${systemRoles} system · ${customRoles} custom`}
            icon={Shield}
            accentColor="bg-sidebar"
            iconClass="text-sidebar dark:text-blue-400"
            iconBgClass="bg-blue-50 dark:bg-blue-950/40"
          />
          <StatCard
            label="TOTAL MEMBERS"
            value={totalMembers.toLocaleString()}
            sub={`Across ${ministryCount} ministries`}
            icon={Users}
            accentColor="bg-blue-500"
            iconClass="text-blue-600 dark:text-blue-400"
            iconBgClass="bg-blue-50 dark:bg-blue-950/40"
          />
          <StatCard
            label="WEEKLY MEAL POOL"
            value={weeklyMealPool.toLocaleString()}
            sub={`${activeWorkers} allocated`}
            icon={UtensilsCrossed}
            accentColor="bg-emerald-500"
            iconClass="text-emerald-600 dark:text-emerald-400"
            iconBgClass="bg-emerald-50 dark:bg-emerald-950/40"
          />
          <StatCard
            label="FACILITIES"
            value={facilityCount}
            sub={`${deptCount} departments`}
            icon={Building}
            accentColor="bg-purple-500"
            iconClass="text-purple-600 dark:text-purple-400"
            iconBgClass="bg-purple-50 dark:bg-purple-950/40"
          />
        </div>

        {/* Modules */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Configuration Modules</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <ModuleCard
              href="/settings/general"
              icon={Settings}
              iconBg="bg-sidebar/10 text-sidebar"
              title="General"
              description="Application name, system preferences and global defaults."
              badge="12 preferences"
            />
            <ModuleCard
              href="/settings/attendance"
              icon={Clock}
              iconBg="bg-sidebar/10 text-sidebar"
              title="Attendance & Shifts"
              description="Configure shift hours, grace periods and scanner rules."
              badge="Auto Shift Rules"
            />
            {canManageRoles && (
              <ModuleCard
                href="/settings/scanner"
                icon={ScanLine}
                iconBg="bg-sidebar/10 text-sidebar"
                title="Scanner Configuration"
                description="Manage scanner master lock passwords and operational security rules."
                badge="Lock & Security"
              />
            )}
            {canManageRoles && (
              <ModuleCard
                href="/settings/roles"
                icon={Shield}
                iconBg="bg-sidebar/10 text-sidebar"
                title="Role Management"
                description="Define roles and fine-grained permissions across the app."
                badge={`${roleCount} role${roleCount !== 1 ? "s" : ""}`}
              />
            )}
            {canManageMinistries && (
              <ModuleCard
                href="/settings/departments"
                icon={Building2}
                iconBg="bg-sidebar/10 text-sidebar"
                title="Department Management"
                description="Organise departments, heads and meal stub pools."
                badge={`${deptCount} department${deptCount !== 1 ? "s" : ""}`}
              />
            )}
            {canManageMinistries && (
              <ModuleCard
                href="/settings/ministries"
                icon={Building}
                iconBg="bg-sidebar/10 text-sidebar"
                title="Ministry Management"
                description="Manage ministries, leaders and weekly allocations."
                badge={`${ministryCount} ministr${ministryCount !== 1 ? "ies" : "y"}`}
              />
            )}
            {canManageMinistries && (
              <ModuleCard
                href="/settings/meal-stubs"
                icon={Utensils}
                iconBg="bg-sidebar/10 text-sidebar"
                title="Meal Stub Allocation"
                description="Distribute the weekly meal stub pool across teams."
                badge={`${weeklyMealPool.toLocaleString()} / week`}
              />
            )}
            {canManageFacilities && (
              <ModuleCard
                href="/settings/rooms"
                icon={MapPin}
                iconBg="bg-sidebar/10 text-sidebar"
                title="Facilities Management"
                description="Rooms, areas and satellite campuses in one place."
                badge={`${facilityCount} facilit${facilityCount !== 1 ? "ies" : "y"}`}
              />
            )}
            {canManageRoles && (
              <ModuleCard
                href="/activity-logs"
                icon={History}
                iconBg="bg-sidebar/10 text-sidebar"
                title="Activity Logs"
                description="Live audit trail of user logins, logouts, and stock monitoring movements."
                badge="Live"
              />
            )}

          </div>
        </div>
        </div>
      </div>
    </AppLayout>
  );
}
