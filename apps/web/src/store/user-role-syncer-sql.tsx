"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useAuthStore,
  useImpersonationStore,
  usePermissionsStore,
} from "@studio/store";
import {
  getWorkerById,
  getWorkerByEmail,
  getRoles,
  getMinistries,
} from "@/actions/db";

const SUPER_ADMIN_EMAILS = new Set(["admin@system.com", "pacleb@gmail.com"]);

/** Aggregate all module:action permission strings from a worker's roles. */
function aggregatePermissions(worker: any): Set<string> {
  const perms = new Set<string>();
  if (!worker) return perms;

  // Primary: WorkerRole join table (new RBAC)
  if (worker.roles && worker.roles.length > 0) {
    for (const wr of worker.roles) {
      if (wr.role?.rolePermissions) {
        for (const rp of wr.role.rolePermissions) {
          if (rp.permission) {
            perms.add(`${rp.permission.module}:${rp.permission.action}`);
          }
        }
      }
    }
  }

  // Fallback: legacy Role.permissions string[] (old flat strings)
  if (worker.role?.permissions) {
    for (const p of worker.role.permissions) {
      perms.add(p);
    }
  }

  return perms;
}

/** Check if any of the worker's roles has isSuperAdmin = true. */
function hasSuperAdminRole(worker: any): boolean {
  if (!worker) return false;
  if (worker.roles?.some((wr: any) => wr.role?.isSuperAdmin)) return true;
  if (worker.role?.isSuperAdmin) return true;
  // Legacy: role id 'admin' is treated as super admin
  if (worker.role?.id === 'admin' || worker.roleId === 'admin') return true;
  return false;
}

export function UserRoleSyncerSQL() {
  const { user, isUserLoading } = useAuthStore();
  const { impersonatedWorkerId } = useImpersonationStore();
  const _setPermissions = usePermissionsStore((s) => s._setPermissions);

  // ── 1. Real worker profile ────────────────────────────────────────────────
  const { data: realWorkerProfile, isLoading: isRealProfileLoading } = useQuery({
    queryKey: ["worker", user?.uid, user?.email],
    queryFn: async () => {
      if (!user) return null;
      let worker = await getWorkerById(user.uid);
      if (!worker && user.email) {
        worker = await getWorkerByEmail(user.email);
      }
      return worker;
    },
    enabled: !!user,
    staleTime: 2 * 60_000,
  });

  // ── 2. Super-admin determination ──────────────────────────────────────────
  const isSuperAdmin = useMemo(() => {
    const normalizedEmail = user?.email?.trim().toLowerCase();
    const isWhitelisted = !!normalizedEmail && SUPER_ADMIN_EMAILS.has(normalizedEmail);
    return isWhitelisted || hasSuperAdminRole(realWorkerProfile);
  }, [user, realWorkerProfile]);

  const viewAsWorkerId = isSuperAdmin ? impersonatedWorkerId : null;
  const idToFetch = viewAsWorkerId ?? user?.uid;

  // ── 3. "View As" profile (impersonated worker) ────────────────────────────
  const { data: workerProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["worker-view-as", idToFetch],
    queryFn: async () => {
      if (!idToFetch) return null;
      let w = await getWorkerById(idToFetch);
      if (!w && !viewAsWorkerId && user?.email) {
        w = await getWorkerByEmail(user.email);
      }
      return w;
    },
    enabled: !!idToFetch,
    staleTime: 2 * 60_000,
  });

  // ── 4. Roles (for allRoles in store) ──────────────────────────────────────
  const { data: allRoles, isLoading: areRolesLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => getRoles(),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const needsSeeding =
    !!user && !areRolesLoading && (!allRoles || allRoles.length === 0);

  // ── 5. Ministries ─────────────────────────────────────────────────────────
  const { data: allMinistries, isLoading: areMinistriesLoading } = useQuery<any[]>({
    queryKey: ["ministries"],
    queryFn: () => getMinistries(),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  // ── 6. Effective profile (impersonated or real) ───────────────────────────
  const isImpersonating = !!viewAsWorkerId;
  const effectiveProfile = isImpersonating ? workerProfile : realWorkerProfile;
  const effectiveIsSuperAdmin = isImpersonating ? false : isSuperAdmin;

  // Aggregate permissions from all roles of the effective profile
  const effectivePermissions = useMemo(
    () => aggregatePermissions(effectiveProfile),
    [effectiveProfile],
  );

  const hasPerm = (key: string) => effectivePermissions.has(key);

  // Ministry-level flags
  const isMealStubAssigner = useMemo(() => {
    if (!user || !allMinistries || !effectiveProfile) return false;
    return allMinistries.some((m: any) => m.mealStubAssignerId === effectiveProfile.id);
  }, [user, allMinistries, effectiveProfile]);

  const isMinistryHead = useMemo(() => {
    if (!user || !effectiveProfile) return false;
    const roleName = ((effectiveProfile.role?.name || '') + ' ' + (effectiveProfile.roles?.map((r: any) => r.role?.name || '').join(' ') || '')).toLowerCase();
    const hasHeadRole = roleName.includes('head') || roleName.includes('coordinator');
    const isExplicitHead = allMinistries?.some((m: any) => m.headId === effectiveProfile.id);
    return Boolean(isExplicitHead || hasHeadRole);
  }, [user, allMinistries, effectiveProfile]);

  const isMinistryApprover = useMemo(() => {
    if (!user || !allMinistries || !effectiveProfile) return false;
    return allMinistries.some((m: any) => m.approverId === effectiveProfile.id);
  }, [user, allMinistries, effectiveProfile]);

  const myMinistryIdsRaw = useMemo(() => {
    if (!user || !effectiveProfile) return [];
    const ids = new Set<string>();

    // 1. Explicit leadership / staff assignments on Ministry records
    if (allMinistries && allMinistries.length > 0) {
      for (const m of allMinistries) {
        if (
          m.headId === effectiveProfile.id ||
          m.approverId === effectiveProfile.id ||
          m.leaderId === effectiveProfile.id ||
          m.schedulerId === effectiveProfile.id ||
          m.mealStubAssignerId === effectiveProfile.id
        ) {
          if (m.id) ids.add(m.id);
        }
      }
    }

    // 2. Profile major and minor ministries
    if (effectiveProfile.majorMinistryId && effectiveProfile.majorMinistryId.trim() !== '') {
      ids.add(effectiveProfile.majorMinistryId.trim());
    }
    if (effectiveProfile.minorMinistryId && effectiveProfile.minorMinistryId.trim() !== '') {
      ids.add(effectiveProfile.minorMinistryId.trim());
    }

    // 3. Multi-ministry assignments in assignedMinistryIds
    if (Array.isArray(effectiveProfile.assignedMinistryIds)) {
      for (const mid of effectiveProfile.assignedMinistryIds) {
        if (mid && mid.trim() !== '') {
          ids.add(mid.trim());
        }
      }
    }

    // 4. If Ministry Head with department, include all ministries under that department
    const roleName = ((effectiveProfile.role?.name || '') + ' ' + (effectiveProfile.roles?.map((r: any) => r.role?.name || '').join(' ') || '')).toLowerCase();
    const isHead = roleName.includes('head') || roleName.includes('coordinator') || (allMinistries && allMinistries.some((m: any) => m.headId === effectiveProfile.id));
    if (isHead && allMinistries && allMinistries.length > 0) {
      const userMinistryList = allMinistries.filter(
        (m: any) =>
          m.headId === effectiveProfile.id ||
          m.approverId === effectiveProfile.id ||
          m.id === effectiveProfile.majorMinistryId ||
          m.id === effectiveProfile.minorMinistryId ||
          (Array.isArray(effectiveProfile.assignedMinistryIds) && effectiveProfile.assignedMinistryIds.includes(m.id))
      );

      const deptCodes = new Set<string>();
      for (const m of userMinistryList) {
        if (m.departmentCode) deptCodes.add(m.departmentCode.toLowerCase());
        if (typeof m.department === 'string') deptCodes.add(m.department.toLowerCase());
        if (m.department?.code) deptCodes.add(m.department.code.toLowerCase());
        if (m.department?.name) deptCodes.add(m.department.name.toLowerCase());
      }
      const directDept = (effectiveProfile as any).department || (effectiveProfile as any).departmentCode;
      if (directDept) deptCodes.add(String(directDept).toLowerCase());

      if (deptCodes.size === 0) {
        deptCodes.add('o');
        deptCodes.add('outreach');
      }

      if (deptCodes.size > 0) {
        for (const m of allMinistries) {
          const code = m.departmentCode?.toLowerCase();
          const deptStr = typeof m.department === 'string' ? m.department.toLowerCase() : undefined;
          const deptName = m.department?.name?.toLowerCase();
          const deptCode = m.department?.code?.toLowerCase();
          const name = m.name?.toLowerCase() || '';

          const matchesDept =
            (code && deptCodes.has(code)) ||
            (deptStr && deptCodes.has(deptStr)) ||
            (deptName && deptCodes.has(deptName)) ||
            (deptCode && deptCodes.has(deptCode));

          const isOutreachMinistry =
            (deptCodes.has('o') || deptCodes.has('outreach')) &&
            (name.startsWith('cluster') || name === 'weyj' || name === 'tapat');

          if (matchesDept || isOutreachMinistry) {
            if (m.id) ids.add(m.id);
          }
        }
      }
    }

    return Array.from(ids).sort();
  }, [user, allMinistries, effectiveProfile]);

  const stableMinistryIdsRef = useRef<string[]>([]);
  const myMinistryIds = useMemo(() => {
    const prev = stableMinistryIdsRef.current;
    if (prev.length === myMinistryIdsRaw.length && prev.every((id, idx) => id === myMinistryIdsRaw[idx])) {
      return prev;
    }
    stableMinistryIdsRef.current = myMinistryIdsRaw;
    return myMinistryIdsRaw;
  }, [myMinistryIdsRaw]);

  const isLoading =
    isUserLoading ||
    isRealProfileLoading ||
    isProfileLoading ||
    areRolesLoading ||
    areMinistriesLoading;

  // ── 7. Build permissions payload and sync to store ────────────────────────
  const permissionsPayload = useMemo(() => {
    const sa = effectiveIsSuperAdmin;

    return {
      isLoading,
      needsSeeding,
      workerProfile: effectiveProfile ?? null,
      allRoles: (allRoles as any) ?? [],
      myMinistryIds,
      isSuperAdmin: effectiveIsSuperAdmin, // use effective — false during impersonation
      isMinistryHead: sa || isMinistryHead,
      isMinistryApprover: sa || isMinistryApprover,
      isMealStubAssigner: sa || isMealStubAssigner,

      // module:action checks (with legacy string fallback)
      canManageWorkers:
        sa || hasPerm('workers:create') || hasPerm('workers:update') || hasPerm('manage_workers') ||
        isMinistryHead || isMinistryApprover,
      canManageRoles:
        sa || hasPerm('roles:update') || hasPerm('manage_roles'),
      canManageMinistries:
        sa || hasPerm('ministries:manage') || hasPerm('manage_ministries'),
      canManageFacilities:
        sa || hasPerm('facilities:manage') || hasPerm('manage_facilities') ||
        isMinistryApprover || isMinistryHead,
      canCreateRoomReservation:
        sa || hasPerm('venues:create') || hasPerm('create_room_reservation'),
      canEditRoomReservation:
        sa || hasPerm('venues:update') || hasPerm('edit_room_reservation'),
      canDeleteRoomReservation:
        sa || hasPerm('venues:delete') || hasPerm('delete_room_reservation'),
      canApproveRoomReservation:
        sa || hasPerm('venues:approve') || hasPerm('approve_room_reservation') ||
        isMinistryApprover || isMinistryHead,
      canManageApprovals:
        sa || hasPerm('approvals:manage') || hasPerm('manage_approvals') ||
        isMinistryApprover || isMinistryHead,
      canApproveAllRequests:
        sa || hasPerm('approvals:manage') || hasPerm('manage_approvals'),
      canOperateScanner:
        sa || hasPerm('attendance:scan') || hasPerm('operate_scanner'),
      canViewAttendance:
        sa || hasPerm('attendance:view') || hasPerm('view_attendance_log') || !!effectiveProfile,
      canViewMealStubs:
        sa || hasPerm('meals:view') || hasPerm('view_meal_stubs') || !!effectiveProfile,
      canManageAllMealStubs:
        sa || hasPerm('meals:manage') || hasPerm('manage_all_mealstubs'),
      canViewReports:
        sa || hasPerm('reports:view') || hasPerm('view_reports'),
      canAppointApprovers:
        sa || hasPerm('ministries:manage') || hasPerm('manage_ministries'),
      canManageC2S:
        sa || hasPerm('mentorship:manage') || hasPerm('manage_c2s') || isMinistryHead || !!effectiveProfile,
      canViewC2SAnalytics:
        sa || hasPerm('mentorship:view_reports') || hasPerm('view_c2s_analytics') || isMinistryHead,

      canViewScheduleMasterview:
        sa || hasPerm('venues:view_calendar') || hasPerm('view_schedule_masterview'),
      canViewTransactionLogs:
        sa || hasPerm('system:view_audit_logs') || hasPerm('view_transaction_logs'),
      canManageOrsSync:
        sa || hasPerm('system:manage_ors_sync') || hasPerm('manage_ors_sync'),
      canManageVenueAssistance:
        sa || hasPerm('venue_assistance:manage') || hasPerm('manage_venue_assistance'),
      canManageOwnMinistryAssistance:
        sa || hasPerm('venue_assistance:manage_own_ministry') ||
        hasPerm('manage_own_ministry_assistance'),
      canManageSchedule:
        sa || hasPerm('schedule:manage'),
      canConfirmSchedule:
        sa || hasPerm('schedule:confirm') || hasPerm('schedule:manage'),
      canAssignSchedulers:
        sa || hasPerm('schedule:assign_schedulers'),
      canAccessInventory:
        sa || hasPerm('inventory:access'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isLoading,
    needsSeeding,
    workerProfile,
    allRoles,
    myMinistryIds,
    isSuperAdmin,
    effectiveIsSuperAdmin,
    effectivePermissions,
    isMinistryHead,
    isMinistryApprover,
    isMealStubAssigner,
  ]);

  useEffect(() => {
    _setPermissions(permissionsPayload);
  }, [permissionsPayload, _setPermissions]);

  return null;
}
