"use server";

import path from 'path';
import fs from 'fs';
import { prisma } from '@studio/database/prisma';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { NotificationService } from '@/services/notification-service';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { EmailService } from '@/services/email-service';
import { type AttendanceShiftSettings, DEFAULT_ATTENDANCE_SETTINGS } from '@/lib/attendance-config';
import { type ScannerSettings, DEFAULT_SCANNER_SETTINGS } from '@/lib/scanner-config';

const DEPARTMENT_NAME_TO_CODE: Record<string, string> = {
    Worship: 'W',
    Outreach: 'O',
    Relationship: 'R',
    Discipleship: 'D',
    Administration: 'A',
};

const DEPARTMENT_CODE_TO_NAME: Record<string, string> = {
    W: 'Worship',
    O: 'Outreach',
    R: 'Relationship',
    D: 'Discipleship',
    A: 'Administration',
};

function normalizeDepartmentCode(input: string | null | undefined): string {
    if (!input) return 'D';
    const trimmed = input.trim();
    if (!trimmed) return 'D';

    if (trimmed.length === 1) {
        const code = trimmed.toUpperCase();
        return DEPARTMENT_CODE_TO_NAME[code] ? code : 'D';
    }

    return DEPARTMENT_NAME_TO_CODE[trimmed] || 'D';
}

function mapMinistryForClient(ministry: any) {
    const departmentCode = ministry.departmentCode;
    return {
        ...ministry,
        department: DEPARTMENT_CODE_TO_NAME[departmentCode] || 'Discipleship',
        departmentCode,
    };
}

// ── FAST IN-MEMORY SERVER CACHE (TTL) ──
interface CacheEntry<T> {
    data: T;
    expiry: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
        memoryCache.delete(key);
        return null;
    }
    return entry.data;
}

function setCached<T>(key: string, data: T, ttlMs: number): void {
    memoryCache.set(key, { data, expiry: Date.now() + ttlMs });
}

export async function invalidateServerCache(prefix?: string): Promise<void> {
    if (!prefix) {
        memoryCache.clear();
        return;
    }
    for (const key of memoryCache.keys()) {
        if (key.startsWith(prefix)) {
            memoryCache.delete(key);
        }
    }
}

/**
 * Resolves the ministry access level for an actor on the server side.
 * - Super admin: { isSuperAdmin: true, isMinistryHead: false, allowedMinistryIds: null }
 * - Ministry head: { isSuperAdmin: false, isMinistryHead: true, allowedMinistryIds: string[] }
 * - Worker / other: { isSuperAdmin: false, isMinistryHead: false, allowedMinistryIds: string[] }
 */
export async function getActorMinistryAccess(actorId?: string): Promise<{
    isSuperAdmin: boolean;
    isMinistryHead: boolean;
    allowedMinistryIds: string[] | null;
}> {
    if (!actorId) {
        return { isSuperAdmin: false, isMinistryHead: false, allowedMinistryIds: null };
    }

    const cacheKey = `actor_access:${actorId}`;
    const cached = getCached<{
        isSuperAdmin: boolean;
        isMinistryHead: boolean;
        allowedMinistryIds: string[] | null;
    }>(cacheKey);
    if (cached) return cached;

    const actor = await prisma.worker.findUnique({
        where: { id: actorId },
        include: {
            role: true,
            roles: { include: { role: true } },
        },
    });

    if (!actor) {
        const notFound = { isSuperAdmin: false, isMinistryHead: false, allowedMinistryIds: [] };
        setCached(cacheKey, notFound, 15_000);
        return notFound;
    }

    const superAdminEmails = new Set(['admin@admin.com', 'admin@system.com', 'pacleb@gmail.com']);
    const isSuperAdmin =
        superAdminEmails.has(actor.email?.toLowerCase() ?? '') ||
        actor.role?.isSuperAdmin === true ||
        actor.roles?.some(r => r.role?.isSuperAdmin === true) ||
        actor.roleId === 'admin' ||
        actor.role?.id === 'admin' ||
        actor.role?.name?.toLowerCase().includes('admin') ||
        actor.roles?.some(r => r.role?.name?.toLowerCase().includes('admin'));

    if (isSuperAdmin) {
        const adminResult = { isSuperAdmin: true, isMinistryHead: false, allowedMinistryIds: null };
        setCached(cacheKey, adminResult, 60_000);
        return adminResult;
    }

    // Pool all actual assigned ministries for this user (Workers and Heads alike)
    const ministryIds = new Set<string>();

    // 1. Leadership / staff assignments on Ministry records
    const ministries = await prisma.ministry.findMany({
        where: {
            OR: [
                { headId: actor.id },
                { approverId: actor.id },
                { leaderId: actor.id },
                { schedulerId: actor.id },
                { mealStubAssignerId: actor.id },
            ],
        },
        select: { id: true, headId: true, approverId: true },
    });

    for (const m of ministries) {
        if (m.id) ministryIds.add(m.id);
    }

    const isExplicitHeadOrApprover = ministries.some(m => m.headId === actor.id || m.approverId === actor.id);

    // 2. Profile major and minor ministries
    if (actor.majorMinistryId && actor.majorMinistryId.trim() !== '') {
        ministryIds.add(actor.majorMinistryId.trim());
    }
    if (actor.minorMinistryId && actor.minorMinistryId.trim() !== '') {
        ministryIds.add(actor.minorMinistryId.trim());
    }

    // 3. Multi-ministry assignments in assignedMinistryIds
    try {
        const rawRes = await prisma.$queryRaw<Array<{ assignedMinistryIds: string[] | null }>>`
            SELECT "assignedMinistryIds" FROM "Worker" WHERE id = ${actor.id} LIMIT 1
        `;
        if (rawRes && rawRes.length > 0 && Array.isArray(rawRes[0]?.assignedMinistryIds)) {
            for (const mid of rawRes[0].assignedMinistryIds) {
                if (mid && mid.trim() !== '') ministryIds.add(mid.trim());
            }
        }
    } catch {
        if (Array.isArray((actor as any).assignedMinistryIds)) {
            for (const mid of (actor as any).assignedMinistryIds) {
                if (mid && mid.trim() !== '') ministryIds.add(mid.trim());
            }
        }
    }

    // Check role name for Ministry Head
    const roleName = (actor.role?.name || '').toLowerCase();
    const hasHeadRole =
        roleName.includes('head') ||
        actor.roles?.some(r => (r.role?.name || '').toLowerCase().includes('head'));

    const isMinistryHead = isExplicitHeadOrApprover || Boolean(hasHeadRole);

    // 4. If Ministry Head with department, include all ministries under that department
    if (isMinistryHead) {
        const actorMinistries = await prisma.ministry.findMany({
            where: {
                OR: [
                    { id: { in: Array.from(ministryIds) } },
                    { headId: actor.id },
                    { approverId: actor.id },
                ],
            },
            select: { departmentCode: true, department: { select: { code: true, name: true } } },
        });

        const deptCodes = new Set<string>();
        for (const m of actorMinistries) {
            if (m.departmentCode) deptCodes.add(m.departmentCode);
            if (m.department?.code) deptCodes.add(m.department.code);
            if (m.department?.name) deptCodes.add(m.department.name);
        }
        if ((actor as any).department) {
            deptCodes.add((actor as any).department);
        }

        // Infer department from actor email, role, or assigned ministries if not explicitly tagged
        const actorStr = `${actor.email || ''} ${actor.firstName || ''} ${actor.lastName || ''} ${actor.role?.name || ''}`.toLowerCase();
        const hasIdPrefix = (prefix: string) => Array.from(ministryIds).some(id => id.toUpperCase().startsWith(prefix));

        if (actorStr.includes('worship') || hasIdPrefix('W-')) {
            deptCodes.add('W'); deptCodes.add('Worship');
        } else if (actorStr.includes('relationship') || hasIdPrefix('R-')) {
            deptCodes.add('R'); deptCodes.add('Relationship');
        } else if (actorStr.includes('discipleship') || hasIdPrefix('D-')) {
            deptCodes.add('D'); deptCodes.add('Discipleship');
        } else if (actorStr.includes('admin') || hasIdPrefix('A-')) {
            deptCodes.add('A'); deptCodes.add('Administration');
        } else if (actorStr.includes('outreach') || hasIdPrefix('O-') || deptCodes.size === 0) {
            deptCodes.add('O'); deptCodes.add('Outreach');
        }

        if (deptCodes.size > 0) {
            const deptMinistries = await prisma.ministry.findMany({
                where: {
                    OR: [
                        { departmentCode: { in: Array.from(deptCodes) } },
                        { department: { name: { in: Array.from(deptCodes) } } },
                        { department: { code: { in: Array.from(deptCodes) } } },
                        { name: { startsWith: 'Cluster' } },
                        { name: { equals: 'WEYJ', mode: 'insensitive' } },
                        { name: { equals: 'TAPAT', mode: 'insensitive' } },
                    ],
                },
                select: { id: true },
            });
            for (const m of deptMinistries) {
                if (m.id) ministryIds.add(m.id);
            }
        }
    }

    const accessResult = {
        isSuperAdmin: false,
        isMinistryHead,
        allowedMinistryIds: Array.from(ministryIds),
    };
    setCached(`actor_access:${actorId}`, accessResult, 30_000);
    return accessResult;
}

// --- Roles ---

export async function getRoles() {
    const cacheKey = 'roles:all';
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    const roles = await prisma.role.findMany({
        include: {
            rolePermissions: {
                include: { permission: true },
            },
        },
        orderBy: { name: 'asc' },
    });
    const cleaned = roles
        .filter(r => r.name?.trim().toLowerCase() !== 'new role')
        .map(r => r.name?.trim().toLowerCase() === 'super admin' ? { ...r, name: 'Admin' } : r);
    setCached(cacheKey, cleaned, 60_000);
    return cleaned;
}

export async function getRoleById(id: string) {
    return await prisma.role.findUnique({
        where: { id },
        include: {
            rolePermissions: {
                include: { permission: true },
            },
        },
    });
}

// --- Permissions ---

export async function getPermissions() {
    return await prisma.permission.findMany({
        orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
}

export async function setRolePermissions(roleId: string, permissionIds: string[]) {
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    if (permissionIds.length > 0) {
        await prisma.rolePermission.createMany({
            data: permissionIds.map(permissionId => ({ roleId, permissionId })),
        });
    }
    revalidatePath('/settings/roles');
}

/** Set permissions using "module:action" strings instead of UUIDs. */
export async function setRolePermissionsByKeys(roleId: string, permKeys: string[]) {
    if (permKeys.length === 0) {
        // Just clear all permissions for this role
        await prisma.rolePermission.deleteMany({ where: { roleId } });
        revalidatePath('/settings/roles');
        return;
    }

    // Fetch all permissions from DB
    const allPerms = await prisma.permission.findMany();
    const permMap = new Map(allPerms.map(p => [`${p.module}:${p.action}`, p.id]));

    // Upsert any permissions that don't exist yet (e.g. newly added inventory:manage)
    const missing = permKeys.filter(k => !permMap.has(k));
    for (const key of missing) {
        const [module, ...actionParts] = key.split(':');
        const action = actionParts.join(':');
        if (!module || !action) continue;
        const created = await prisma.permission.upsert({
            where: { module_action: { module, action } },
            update: {},
            create: { module, action },
        });
        permMap.set(key, created.id);
    }

    const ids = permKeys.map(k => permMap.get(k)).filter(Boolean) as string[];
    return await setRolePermissions(roleId, ids);
}

// --- WorkerRole ---

export async function getWorkerRoles(workerId: string) {
    return await prisma.workerRole.findMany({
        where: { workerId },
        include: {
            role: {
                include: {
                    rolePermissions: { include: { permission: true } },
                },
            },
        },
    });
}

export async function assignRolesToWorker(workerId: string, roleIds: string[], assignedBy?: string) {
    // Remove roles not in the new list
    await prisma.workerRole.deleteMany({
        where: { workerId, roleId: { notIn: roleIds } },
    });
    // Add any new roles
    for (const roleId of roleIds) {
        await prisma.workerRole.upsert({
            where: { workerId_roleId: { workerId, roleId } },
            update: {},
            create: { workerId, roleId, assignedBy },
        });
    }
    // Keep legacy roleId in sync (use first role as primary)
    if (roleIds.length > 0) {
        await prisma.worker.update({
            where: { id: workerId },
            data: { roleId: roleIds[0] },
        });
    }
    revalidatePath('/workers');
}

export async function createRole(data: any) {
    const role = await prisma.role.create({ data });
    revalidatePath('/settings/roles');
    return role;
}

export async function upsertRole(id: string, data: { name: string; permissions: string[]; isSuperAdmin?: boolean; isSystemRole?: boolean }) {
    return prisma.role.upsert({
        where: { id },
        update: data,
        create: { id, ...data },
    });
}

export async function updateRole(id: string, data: any) {
    const role = await prisma.role.update({
        where: { id },
        data,
    });
    revalidatePath('/settings/roles');
    return role;
}

export async function deleteRole(id: string) {
    await prisma.role.delete({ where: { id } });
    revalidatePath('/settings/roles');
}

// --- Workers ---

export async function getWorkers(filters?: { ministryIds?: string[]; actorId?: string } | any) {
    const cacheKey = `workers:${JSON.stringify(filters || {})}`;
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    const where: any = {};

    if (filters?.actorId) {
        const access = await getActorMinistryAccess(filters.actorId);
        if (!access.isSuperAdmin && access.allowedMinistryIds !== null) {
            const effectiveIds = filters.ministryIds && filters.ministryIds.length > 0
                ? filters.ministryIds.filter((id: string) => access.allowedMinistryIds!.includes(id))
                : access.allowedMinistryIds;

            if (effectiveIds.length === 0) {
                return [];
            }
            let extraIds: string[] = [];
            try {
                const rawMatches = await prisma.$queryRaw<Array<{ id: string }>>`
                    SELECT id FROM "Worker" WHERE "assignedMinistryIds" && ${effectiveIds}::text[]
                `;
                extraIds = rawMatches.map(r => r.id);
            } catch { }

            where.OR = [
                { majorMinistryId: { in: effectiveIds } },
                { minorMinistryId: { in: effectiveIds } },
                ...(extraIds.length > 0 ? [{ id: { in: extraIds } }] : []),
            ];
        } else if (filters.ministryIds && filters.ministryIds.length > 0) {
            let extraIds: string[] = [];
            try {
                const rawMatches = await prisma.$queryRaw<Array<{ id: string }>>`
                    SELECT id FROM "Worker" WHERE "assignedMinistryIds" && ${filters.ministryIds}::text[]
                `;
                extraIds = rawMatches.map(r => r.id);
            } catch { }

            where.OR = [
                { majorMinistryId: { in: filters.ministryIds } },
                { minorMinistryId: { in: filters.ministryIds } },
                ...(extraIds.length > 0 ? [{ id: { in: extraIds } }] : []),
            ];
        }
    } else if (filters?.ministryIds && filters.ministryIds.length > 0) {
        let extraIds: string[] = [];
        try {
            const rawMatches = await prisma.$queryRaw<Array<{ id: string }>>`
                SELECT id FROM "Worker" WHERE "assignedMinistryIds" && ${filters.ministryIds}::text[]
            `;
            extraIds = rawMatches.map(r => r.id);
        } catch { }

        where.OR = [
            { majorMinistryId: { in: filters.ministryIds } },
            { minorMinistryId: { in: filters.ministryIds } },
            ...(extraIds.length > 0 ? [{ id: { in: extraIds } }] : []),
        ];
    }

    const workers = await prisma.worker.findMany({
        where,
        include: {
            role: true,
            roles: { include: { role: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    setCached(cacheKey, workers, 30_000);
    return workers;
}

export async function getPaginatedWorkers(
    page: number = 1,
    limit: number = 25,
    filters: {
        search?: string;
        searchMode?: 'workerId' | 'name';
        ministryIds?: string[];
        sortField?: string;
        sortDir?: 'asc' | 'desc';
        actorId?: string;
    } = {}
) {
    let effectiveMinistryIds = filters.ministryIds;

    if (filters.actorId) {
        const access = await getActorMinistryAccess(filters.actorId);
        if (!access.isSuperAdmin && access.allowedMinistryIds !== null) {
            if (effectiveMinistryIds && effectiveMinistryIds.length > 0) {
                effectiveMinistryIds = effectiveMinistryIds.filter(id => access.allowedMinistryIds!.includes(id));
            } else {
                effectiveMinistryIds = access.allowedMinistryIds;
            }
            if (effectiveMinistryIds.length === 0) {
                return { total: 0, workers: [], page, limit, totalPages: 0 };
            }
        }
    }

    const sortField = filters.sortField || 'createdAt';
    const sortDir = filters.sortDir || 'desc';
    const offset = (page - 1) * limit;

    // Build ORDER BY — workerId sorts numerically via CAST to avoid "10 < 2" string ordering
    let orderByClause: string;
    if (sortField === 'workerId') {
        orderByClause = `NULLIF(regexp_replace("workerId", '[^0-9]', '', 'g'), '')::bigint ${sortDir.toUpperCase()} NULLS LAST`;
    } else if (sortField === 'name') {
        orderByClause = `"firstName" ${sortDir.toUpperCase()}, "lastName" ${sortDir.toUpperCase()}`;
    } else if (sortField === 'status') {
        orderByClause = `"status" ${sortDir.toUpperCase()}`;
    } else if (sortField === 'createdAt') {
        orderByClause = `"createdAt" ${sortDir.toUpperCase()}`;
    } else {
        orderByClause = `"createdAt" DESC`;
    }

    // Build WHERE conditions for raw query
    const conditions: string[] = [];
    const queryParams: any[] = [];
    let paramIdx = 1;

    if (effectiveMinistryIds && effectiveMinistryIds.length > 0) {
        const ids = effectiveMinistryIds;
        const majorPlaceholders = ids.map(() => `$${paramIdx++}`).join(', ');
        const minorPlaceholders = ids.map(() => `$${paramIdx++}`).join(', ');
        const arrayPlaceholder = `$${paramIdx++}`;
        conditions.push(`("majorMinistryId" IN (${majorPlaceholders}) OR "minorMinistryId" IN (${minorPlaceholders}) OR ("assignedMinistryIds" IS NOT NULL AND "assignedMinistryIds" && ${arrayPlaceholder}::text[]))`);
        queryParams.push(...ids, ...ids, ids);
    }

    if (filters.search) {
        const q = `%${filters.search.trim()}%`;
        if (filters.searchMode === 'name') {
            conditions.push(`("firstName" ILIKE $${paramIdx} OR "lastName" ILIKE $${paramIdx})`);
            queryParams.push(q);
            paramIdx++;
        } else {
            conditions.push(`"workerId" ILIKE $${paramIdx}`);
            queryParams.push(q);
            paramIdx++;
        }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Run count + paginated fetch in parallel
    const [countResult, workers] = await Promise.all([
        prisma.$queryRawUnsafe<[{ count: bigint }]>(
            `SELECT COUNT(*) as count FROM "Worker" ${whereClause}`,
            ...queryParams
        ),
        prisma.$queryRawUnsafe<any[]>(
            `SELECT id, "workerId", "firstName", "lastName", email, phone, "roleId", status,
                    "avatarUrl", "majorMinistryId", "minorMinistryId", "assignedMinistryIds", "employmentType",
                    "passwordChangeRequired", "qrToken", "isSeniorPastor", "isPastor", "createdAt"
             FROM "Worker"
             ${whereClause}
             ORDER BY ${orderByClause}
             LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
            ...queryParams, limit, offset
        ),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    return { total, workers, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getWorkerStats(ministryIds?: string[], actorId?: string) {
    const cacheKey = `worker_stats:${JSON.stringify(ministryIds || [])}:${actorId || 'all'}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return cached;

    let effectiveMinistryIds = ministryIds;

    if (actorId) {
        const access = await getActorMinistryAccess(actorId);
        if (!access.isSuperAdmin && access.allowedMinistryIds !== null) {
            if (effectiveMinistryIds && effectiveMinistryIds.length > 0) {
                effectiveMinistryIds = effectiveMinistryIds.filter(id => access.allowedMinistryIds!.includes(id));
            } else {
                effectiveMinistryIds = access.allowedMinistryIds;
            }
            if (effectiveMinistryIds.length === 0) {
                return { total: 0, active: 0, inactive: 0, secondary: 0, ministryStats: [] };
            }
        }
    }

    const where: any = {};
    if (effectiveMinistryIds && effectiveMinistryIds.length > 0) {
        where.OR = [
            { majorMinistryId: { in: effectiveMinistryIds } },
            { minorMinistryId: { in: effectiveMinistryIds } }
        ];
    }

    // Use DB-level counts — much faster than fetching all rows
    const [total, active, inactive] = await prisma.$transaction([
        prisma.worker.count({ where }),
        prisma.worker.count({ where: { ...where, status: 'Active' } }),
        prisma.worker.count({ where: { ...where, status: 'Inactive' } }),
    ]);
    const secondary = 0; // legacy field — skip expensive query

    let ministryStats: { ministryId: string; total: number; active: number; inactive: number; secondary: number }[] = [];

    if (effectiveMinistryIds?.length) {
        const [allW, activeW] = await prisma.$transaction([
            prisma.worker.findMany({
                where: { OR: [{ majorMinistryId: { in: effectiveMinistryIds } }, { minorMinistryId: { in: effectiveMinistryIds } }] },
                select: { majorMinistryId: true, minorMinistryId: true, status: true },
            }),
            prisma.worker.findMany({
                where: { OR: [{ majorMinistryId: { in: effectiveMinistryIds } }, { minorMinistryId: { in: effectiveMinistryIds } }], status: 'Active' },
                select: { majorMinistryId: true, minorMinistryId: true },
            }),
        ]);

        ministryStats = effectiveMinistryIds.map(id => {
            const mw = allW.filter((w: any) => w.majorMinistryId === id || w.minorMinistryId === id);
            const ma = activeW.filter((w: any) => w.majorMinistryId === id || w.minorMinistryId === id);
            return { ministryId: id, total: mw.length, active: ma.length, inactive: mw.length - ma.length, secondary: 0 };
        });
    }

    const result = { total, active, inactive, secondary, ministryStats };
    setCached(cacheKey, result, 30_000);
    return result;
}

async function attachWorkerAssignedMinistries(worker: any) {
    if (!worker) return null;
    if (!worker.assignedMinistryIds) {
        try {
            const raw = await prisma.$queryRaw<Array<{ assignedMinistryIds: string[] | null }>>`
                SELECT "assignedMinistryIds" FROM "Worker" WHERE id = ${worker.id} LIMIT 1
            `;
            if (raw && raw.length > 0 && Array.isArray(raw[0]?.assignedMinistryIds)) {
                worker.assignedMinistryIds = raw[0].assignedMinistryIds;
            } else {
                worker.assignedMinistryIds = [];
            }
        } catch {
            worker.assignedMinistryIds = [];
        }
    }
    return worker;
}

export async function getWorkerById(id: string) {
    try {
        const worker = await prisma.worker.findUnique({
            where: { id },
            include: {
                role: true,
                roles: {
                    include: {
                        role: {
                            include: {
                                rolePermissions: { include: { permission: true } },
                            },
                        },
                    },
                },
            },
        });
        return await attachWorkerAssignedMinistries(worker);
    } catch {
        // Fallback if rolePermissions table doesn't exist yet
        const worker = await prisma.worker.findUnique({
            where: { id },
            include: { role: true },
        });
        return await attachWorkerAssignedMinistries(worker);
    }
}

export async function getWorkerByIdOrWorkerId(identifier: string) {
    if (!identifier) return null;
    const clean = identifier.trim();
    try {
        const worker = await prisma.worker.findFirst({
            where: {
                OR: [
                    { id: clean },
                    { workerId: clean },
                    { workerId: clean.replace(/^COG-/i, '') },
                    { workerId: clean.replace(/^COG-/i, '').padStart(6, '0') },
                    { email: clean.toLowerCase() },
                ],
            },
            include: {
                role: true,
                roles: {
                    include: {
                        role: {
                            include: {
                                rolePermissions: { include: { permission: true } },
                            },
                        },
                    },
                },
            },
        });
        return worker ? await attachWorkerAssignedMinistries(worker) : null;
    } catch {
        const worker = await prisma.worker.findFirst({
            where: {
                OR: [
                    { id: clean },
                    { workerId: clean },
                    { workerId: clean.replace(/^COG-/i, '') },
                    { workerId: clean.replace(/^COG-/i, '').padStart(6, '0') },
                ],
            },
            include: { role: true },
        });
        return worker ? await attachWorkerAssignedMinistries(worker) : null;
    }
}

export async function getWorkerByEmail(email: string) {
    try {
        const worker = await prisma.worker.findUnique({
            where: { email },
            include: {
                role: true,
                roles: {
                    include: {
                        role: {
                            include: {
                                rolePermissions: { include: { permission: true } },
                            },
                        },
                    },
                },
            },
        });
        return await attachWorkerAssignedMinistries(worker);
    } catch {
        const worker = await prisma.worker.findUnique({
            where: { email },
            include: { role: true },
        });
        return await attachWorkerAssignedMinistries(worker);
    }
}

export async function createWorker(data: any) {
    const worker = await prisma.worker.create({
        data: {
            ...data,
            status: data.status || 'Active',
            createdAt: new Date(),
        },
    });
    invalidateServerCache('workers');
    invalidateServerCache('worker_stats');
    revalidatePath('/workers');
    return worker;
}

export async function createWorkerWithAuth(data: any, roleIds: string[], assignedBy?: string) {
    const email = data.email?.trim().toLowerCase();
    if (!email) {
        return { success: false, error: 'Email address is required.' };
    }

    // 1. Check if email already exists in DB
    const existingWorker = await prisma.worker.findUnique({
        where: { email },
        select: { id: true, firstName: true, lastName: true, workerId: true },
    });
    if (existingWorker) {
        return {
            success: false,
            error: `Email "${email}" is already registered to worker ${existingWorker.firstName} ${existingWorker.lastName} (Worker ID: ${existingWorker.workerId || 'N/A'}). Please use a different email or update their existing profile.`,
        };
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const defaultPassword = "COGDASMA2026";

    const termsVersion = data.termsAcceptedVersion || "1.0";
    const termsTimestamp = data.termsAcceptedAt || new Date().toISOString();

    // 2. Create or verify auth user
    let effectiveUserId: string;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: {
            firstName: data.firstName,
            lastName: data.lastName,
            termsAcceptedVersion: termsVersion,
            termsAcceptedAt: termsTimestamp,
        }
    });

    if (authError) {
        if (authError.message?.toLowerCase().includes('already') || (authError as any).status === 422) {
            const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
            const existingAuth = userList?.users?.find(u => u.email?.toLowerCase() === email);
            if (existingAuth) {
                const existingDbUser = await prisma.worker.findUnique({ where: { id: existingAuth.id } });
                if (existingDbUser) {
                    return {
                        success: false,
                        error: `Email "${email}" already has an active account (${existingDbUser.firstName} ${existingDbUser.lastName}). Please use a different email.`,
                    };
                }
                effectiveUserId = existingAuth.id;
            } else {
                return {
                    success: false,
                    error: `Email "${email}" is already registered in authentication. Please use a different email.`,
                };
            }
        } else {
            return {
                success: false,
                error: `Failed to create authentication account: ${authError.message}`,
            };
        }
    } else {
        effectiveUserId = authData.user.id;
    }

    // Now create in DB
    const {
        roleId, role, roles, approvals, attendanceRecords, bookings,
        venueBookings, InventoryBorrowing, InventoryLog, mealStubs,
        legacyMigratedAt, legacyMigratedFrom, createdAt, updatedAt,
        emergencyName, emergencyPhone, startDate,
        termsAcceptedVersion, termsAcceptedAt,
        ...dbData
    } = data;

    // Record governance acceptance in remarks
    const termsLog = `[Governance] Terms & Privacy v${termsVersion} accepted at ${termsTimestamp}`;
    dbData.remarks = dbData.remarks ? `${dbData.remarks}\n${termsLog}` : termsLog;

    // Format startYear and startMonth if startDate is provided
    if (startDate && typeof startDate === 'string') {
        const parts = startDate.split('-');
        if (parts.length >= 2) {
            dbData.startYear = parts[0];
            dbData.startMonth = parts[1];
        }
    }

    // Append emergency contact into remarks if present
    if (emergencyName || emergencyPhone) {
        const emergencyPart = `Emergency Contact: ${emergencyName || 'N/A'}${emergencyPhone ? ` (${emergencyPhone})` : ''}`;
        dbData.remarks = dbData.remarks ? `${dbData.remarks}\n${emergencyPart}` : emergencyPart;
    }

    // Check if majorMinistryId is a Department name (e.g. Worship, Outreach, Relationship, Discipleship, Administration)
    const DEPARTMENTS = ["Worship", "Outreach", "Relationship", "Discipleship", "Administration"];
    const isDeptSelection = typeof data.majorMinistryId === 'string' && DEPARTMENTS.includes(data.majorMinistryId);
    let deptMinistries: any[] = [];
    if (isDeptSelection) {
        try {
            deptMinistries = await prisma.ministry.findMany({
                where: {
                    OR: [
                        { department: { name: data.majorMinistryId } },
                        { departmentCode: data.majorMinistryId[0].toUpperCase() },
                    ]
                },
                orderBy: [{ weight: 'asc' }, { name: 'asc' }]
            });
            if (deptMinistries.length > 0) {
                dbData.majorMinistryId = deptMinistries[0].id;
                dbData.assignedMinistryIds = deptMinistries.map(m => m.id);
            }
        } catch (e) {
            console.error("Failed to query department ministries:", e);
        }
    }

    // Ensure majorMinistryId and minorMinistryId default safely
    dbData.majorMinistryId = dbData.majorMinistryId || "";
    dbData.minorMinistryId = dbData.minorMinistryId || "";

    const workerData = {
        ...dbData,
        email,
        status: dbData.status || 'Active',
        id: effectiveUserId,
        createdAt: new Date(),
    };
    if (roleIds && roleIds.length > 0) {
        workerData.roleId = roleIds[0];
    }

    let worker: any;
    try {
        worker = await prisma.worker.create({
            data: workerData,
        });
    } catch (createErr: any) {
        console.error('[createWorkerWithAuth] Failed to create worker record in database:', createErr);
        return {
            success: false,
            error: `Failed to save worker record in database: ${createErr?.message || String(createErr)}`,
        };
    }

    // If department selection was made, update headId for all ministries in this department
    if (isDeptSelection && deptMinistries.length > 0) {
        try {
            await prisma.ministry.updateMany({
                where: {
                    id: { in: deptMinistries.map(m => m.id) }
                },
                data: {
                    headId: worker.id
                }
            });
        } catch (e) {
            console.error("Failed to update ministry headId assignments:", e);
        }
    }

    // Assign roles
    if (roleIds && roleIds.length > 0) {
        await assignRolesToWorker(worker.id, roleIds, assignedBy);
    }

    // Look up ministry name and department
    let ministryName = "All Ministries";
    let departmentName = "All Departments";
    if (isDeptSelection) {
        departmentName = data.majorMinistryId;
        ministryName = `${data.majorMinistryId} (Head - All Ministries)`;
    } else if (data.majorMinistryId) {
        try {
            const min = await prisma.ministry.findUnique({
                where: { id: data.majorMinistryId },
                include: { department: true }
            });
            if (min) {
                ministryName = min.name;
                departmentName = min.department?.name || "";
            }
        } catch (e) {
            console.error("Failed to fetch ministry info for welcome email:", e);
        }
    }

    // Look up role name
    // Look up role name
    let roleName = "Worker";
    const primaryRoleId = (roleIds && roleIds.length > 0) ? roleIds[0] : data.roleId;
    if (primaryRoleId) {
        try {
            const roleRecord = await prisma.role.findUnique({
                where: { id: primaryRoleId }
            });
            if (roleRecord) {
                roleName = roleRecord.name;
            }
        } catch (e) {
            console.error("Failed to fetch role info for welcome email:", e);
        }
    }

    // Role display formatting: if Super Admin -> Admin
    if (roleName.toLowerCase() === "super admin") {
        roleName = "Admin";
    }

    const isSenior = Boolean(data.isSeniorPastor);
    const isPastor = Boolean(data.isPastor);
    const isPastoral = isSenior || isPastor;

    let assignedRoleDisplay = roleName;
    if (isSenior) {
        assignedRoleDisplay = `${roleName} (Senior Pastor)`;
    } else if (isPastor) {
        assignedRoleDisplay = `${roleName} (Pastor)`;
    }

    const welcomeGreeting = isPastoral
        ? `Welcome to Pastoral, ${data.firstName}!`
        : `Welcome to the ${ministryName}, ${data.firstName}!`;

    // Look up registeredBy user if assignedBy is provided
    let registeredByName = "";
    if (assignedBy) {
        try {
            const assigner = await prisma.worker.findUnique({
                where: { id: assignedBy },
                select: { firstName: true, lastName: true },
            });
            if (assigner) {
                registeredByName = `${assigner.firstName} ${assigner.lastName}`.trim();
            }
        } catch (e) {
            console.error("Failed to fetch assigner info for welcome email:", e);
        }
    }

    // Send welcome email with worker's details and credentials
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
    const loginUrl = `${appUrl}/login`;

    let emailSent = false;
    let emailErrorMsg: string | null = null;

    const possibleLogoPaths = [
        path.resolve(process.cwd(), 'public/church-logo.png'),
        path.resolve(process.cwd(), 'public/cog-logo.png'),
        path.resolve(process.cwd(), 'apps/web/public/church-logo.png'),
        path.resolve(process.cwd(), 'apps/web/public/cog-logo.png'),
    ];
    const logoPath = possibleLogoPaths.find((p) => fs.existsSync(p));
    const hasLogo = Boolean(logoPath);
    const attachments = logoPath
        ? [{
            filename: 'church-logo.png',
            content: fs.readFileSync(logoPath),
            contentType: 'image/png',
            cid: 'coglogo',
            contentDisposition: 'inline',
        }]
        : undefined;

    try {
        const sendResult = await EmailService.sendEmail({
            to: data.email.trim(),
            subject: `Welcome to COG App - Your Account Credentials & Registration Details`,
            attachments,
            html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Church of God Dasmariñas</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 32px 32px 28px; text-align: center;">
              ${hasLogo ? `
              <div style="margin-bottom: 12px;">
                <img src="cid:coglogo" alt="COG Logo" width="68" height="68" style="display: inline-block; border-radius: 50%; background-color: #ffffff; padding: 4px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);" />
              </div>` : ''}
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; text-transform: uppercase;">
                Church of God Dasmariñas
              </h1>
              <p style="margin: 6px 0 0; color: #bfdbfe; font-size: 14px; font-weight: 500;">
                COG App — Worker Account Registration
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <h2 style="margin: 0 0 12px; color: #0f172a; font-size: 20px; font-weight: 700;">
                ${welcomeGreeting}
              </h2>
              <p style="margin: 0 0 24px; color: #475569; font-size: 14px; line-height: 1.6;">
                Your worker account has been created by your Ministry Head / Administrator in the COG App portal. Below are your account login credentials and registered profile details.
              </p>

              <!-- Credentials Box -->
              <table role="presentation" width="100%" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; margin-bottom: 28px; border-collapse: separate;">
                <tr>
                  <td style="padding: 20px;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #1e40af; margin-bottom: 12px;">
                      Your Login Credentials
                    </div>
                    <table role="presentation" width="100%" style="font-size: 14px; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-weight: 500; width: 150px; white-space: nowrap; vertical-align: middle;">Email:</td>
                        <td style="padding: 6px 0; color: #0f172a; font-weight: 600; font-family: monospace; vertical-align: middle;">${data.email}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-weight: 500; width: 150px; white-space: nowrap; vertical-align: middle;">Worker ID:</td>
                        <td style="padding: 6px 0; vertical-align: middle;">
                          <span style="display: inline-block; background-color: #1e3a8a; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-family: monospace; font-size: 14px; letter-spacing: 0.05em; white-space: nowrap;">
                            ${worker.workerId || 'Pending'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-weight: 500; width: 150px; white-space: nowrap; vertical-align: middle;">Default Password:</td>
                        <td style="padding: 6px 0; vertical-align: middle;">
                          <span style="display: inline-block; background-color: #1e3a8a; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-family: monospace; font-size: 14px; letter-spacing: 0.05em; white-space: nowrap;">
                            ${defaultPassword}
                          </span>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 12px 0 0; font-size: 12px; color: #64748b; font-style: italic;">
                      Note: You can log in using either your email or your Worker ID with the default password above.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Profile Details -->
              <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                Registered Worker Information
              </div>

              <table role="presentation" width="100%" style="border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b; width: 38%; font-weight: 500;">Full Name</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${data.firstName} ${data.lastName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Assigned Role</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${assignedRoleDisplay}</td>
                </tr>
                ${isPastoral ? `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Designation</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${isSenior ? 'Senior Pastor' : 'Pastor'}</td>
                </tr>` : ''}
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Ministry</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${ministryName}</td>
                </tr>
                ${departmentName ? `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Department</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${departmentName}</td>
                </tr>` : ''}
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Worker Type</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${data.employmentType || 'Volunteer'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Mobile Number</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${data.phone || 'N/A'}</td>
                </tr>
                ${data.birthDate ? `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Birth Date</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${data.birthDate}</td>
                </tr>` : ''}
                ${data.address ? `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Address</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${data.address}</td>
                </tr>` : ''}
                ${startDate ? `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Start Date</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${startDate}</td>
                </tr>` : ''}
                ${(emergencyName || emergencyPhone) ? `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Emergency Contact</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${emergencyName || 'N/A'}${emergencyPhone ? ` (${emergencyPhone})` : ''}</td>
                </tr>` : ''}
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Account Status</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">
                    <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; ${data.status === 'Active' ? 'background-color: #dcfce7; color: #15803d;' : 'background-color: #fef3c7; color: #b45309;'}">
                      ${data.status || 'Pending Approval'}
                    </span>
                  </td>
                </tr>
                ${registeredByName ? `
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Registered By</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${registeredByName}</td>
                </tr>` : ''}
              </table>

              <!-- Next Steps Notice -->
              <div style="background-color: #f8fafc; border-radius: 8px; padding: 14px; font-size: 12px; color: #64748b; line-height: 1.5; border: 1px solid #e2e8f0;">
                <strong style="color: #334155;">Next Steps:</strong>
                <ol style="margin: 6px 0 0; padding-left: 18px;">
                  <li>Log in to the portal using your email and default password: <code style="background-color: #e2e8f0; padding: 2px 4px; border-radius: 4px; color: #0f172a; font-weight: bold;">COGDASMA2026</code>.</li>
                  <li>Coordinate with your Ministry Head for orientation and schedules.</li>
                </ol>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                Church of God Dasmariñas • COG App Management System
              </p>
              <p style="margin: 4px 0 0; font-size: 11px; color: #94a3b8;">
                This is an automated notification. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
            `,
            text: `
Welcome to Church of God Dasmariñas!

${welcomeGreeting}

Your worker account has been created in COG App.

LOGIN CREDENTIALS:
- Email: ${data.email}
- Worker ID: ${worker.workerId || 'Pending'}
- Default Password: ${defaultPassword}

REGISTERED INFORMATION:
- Name: ${data.firstName} ${data.lastName}
- Role: ${assignedRoleDisplay}
${isPastoral ? `- Designation: ${isSenior ? 'Senior Pastor' : 'Pastor'}\n` : ''}- Ministry: ${ministryName}${departmentName ? ` (${departmentName})` : ''}
- Worker Type: ${data.employmentType || 'Volunteer'}
- Mobile: ${data.phone || 'N/A'}
${data.birthDate ? `- Birth Date: ${data.birthDate}\n` : ''}${data.address ? `- Address: ${data.address}\n` : ''}${startDate ? `- Start Date: ${startDate}\n` : ''}${(emergencyName || emergencyPhone) ? `- Emergency Contact: ${emergencyName || 'N/A'}${emergencyPhone ? ` (${emergencyPhone})` : ''}\n` : ''}- Status: ${data.status || 'Pending Approval'}
${registeredByName ? `- Registered By: ${registeredByName}\n` : ''}

Next Steps:
1. Log in using your email and default password: ${defaultPassword}
2. Coordinate with your Ministry Head for orientation and schedules.
            `.trim(),
        });
        emailSent = true;
        console.log(`[createWorkerWithAuth] Welcome email sent successfully to ${data.email}`);
    } catch (emailError: any) {
        emailErrorMsg = emailError?.message || String(emailError);
        console.error(`[createWorkerWithAuth] Failed to send welcome email to ${data.email}:`, emailError);
    }

    invalidateServerCache('workers');
    invalidateServerCache('worker_stats');
    revalidatePath('/workers');
    return {
        success: true,
        ...worker,
        emailSent,
        emailError: emailErrorMsg,
    };
}

export async function updateWorker(id: string, data: any) {
    // Strip relation objects and fields not in the DB schema to avoid Prisma validation errors
    const {
        role, roles, approvals, attendanceRecords, bookings,
        venueBookings, InventoryBorrowing, InventoryLog, mealStubs,
        legacyMigratedAt, legacyMigratedFrom,
        createdAt, updatedAt,
        ...safeData
    } = data;

    // roleId may not exist in DB yet — use raw update to handle it gracefully
    const { roleId, assignedMinistryIds, ...dataWithoutRoleId } = safeData;

    const updateData: any = { ...dataWithoutRoleId };
    if (roleId !== undefined) updateData.roleId = roleId;

    const worker = await prisma.worker.update({
        where: { id },
        data: updateData,
    });

    if (Array.isArray(assignedMinistryIds)) {
        await prisma.$executeRawUnsafe(
            `UPDATE "Worker" SET "assignedMinistryIds" = $1::text[] WHERE id = $2`,
            assignedMinistryIds,
            id
        ).catch((e) => console.error('Failed to update assignedMinistryIds:', e));
    }

    // If worker is active and has an email, ensure an Auth account exists in Supabase so they can log in (only on email/status changes)
    if (worker.email && worker.status === 'Active' && (safeData.email !== undefined || safeData.status !== undefined)) {
        try {
            const supabaseAdmin = getSupabaseAdminClient();
            const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
            const existingAuth = authList?.users?.find(
                (u) => u.email?.toLowerCase() === worker.email.toLowerCase() || u.id === worker.id
            );
            if (!existingAuth) {
                await supabaseAdmin.auth.admin.createUser({
                    id: worker.id,
                    email: worker.email,
                    password: "COGDASMA2026",
                    email_confirm: true,
                    user_metadata: {
                        firstName: worker.firstName,
                        lastName: worker.lastName,
                    },
                });
            }
        } catch (authSyncErr) {
            console.error('Failed to ensure Supabase Auth user on update:', authSyncErr);
        }
    }

    invalidateServerCache('workers');
    invalidateServerCache('worker_stats');
    revalidatePath('/workers');
    revalidatePath('/workers/my-qr');
    revalidatePath('/attendance');
    revalidatePath('/meals');
    return worker;
}

export async function getEmailChangeStatus(workerId: string) {
    if (!workerId) return { remaining: 2, totalAllowed: 2, countThisMonth: 0 };
    const worker = await prisma.worker.findUnique({
        where: { id: workerId },
        select: { remarks: true, email: true },
    });
    if (!worker) return { remaining: 2, totalAllowed: 2, countThisMonth: 0 };

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const matches = (worker.remarks || '').match(/\[EMAIL_CHANGED:\s*([^\]]+)\]/g) || [];
    let count = 0;
    for (const m of matches) {
        const rawDate = m.replace(/\[EMAIL_CHANGED:\s*/, '').replace(/\].*/, '').trim().split(' to ')[0];
        const d = new Date(rawDate);
        if (!isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
            count++;
        }
    }
    const remaining = Math.max(0, 2 - count);
    return {
        remaining,
        totalAllowed: 2,
        countThisMonth: count,
        currentEmail: worker.email,
    };
}

export async function updateWorkerProfileSettings(workerId: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
}) {
    if (!workerId) {
        return { success: false, error: 'Worker profile ID is required.' };
    }

    let worker = await prisma.worker.findUnique({
        where: { id: workerId },
    });
    if (!worker && data.email) {
        worker = await prisma.worker.findFirst({
            where: { email: { equals: data.email.trim().toLowerCase(), mode: 'insensitive' } },
        });
    }
    if (!worker) {
        return { success: false, error: 'Worker profile not found.' };
    }

    let newEmail = worker.email;
    let isEmailChanging = false;
    let updatedRemarks = worker.remarks || '';

    if (data.email && data.email.trim().toLowerCase() !== worker.email.toLowerCase()) {
        const trimmedEmail = data.email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            return { success: false, error: 'Please enter a valid email address.' };
        }

        const conflict = await prisma.worker.findFirst({
            where: {
                email: { equals: trimmedEmail, mode: 'insensitive' },
                id: { not: worker.id },
            },
        });
        if (conflict) {
            return { success: false, error: 'This email is already in use by another worker.' };
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const matches = (worker.remarks || '').match(/\[EMAIL_CHANGED:\s*([^\]]+)\]/g) || [];
        let countThisMonth = 0;
        for (const m of matches) {
            const rawDate = m.replace(/\[EMAIL_CHANGED:\s*/, '').replace(/\].*/, '').trim().split(' to ')[0];
            const d = new Date(rawDate);
            if (!isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
                countThisMonth++;
            }
        }

        if (countThisMonth >= 2) {
            return {
                success: false,
                error: 'Email change limit reached. You can only change your email address 2 times per month.',
                remainingChanges: 0,
            };
        }

        const logEntry = `[EMAIL_CHANGED: ${now.toISOString()} to ${trimmedEmail}]`;
        updatedRemarks = updatedRemarks ? `${updatedRemarks}\n${logEntry}` : logEntry;
        newEmail = trimmedEmail;
        isEmailChanging = true;
    }

    const updatePayload: any = {
        remarks: updatedRemarks,
    };
    if (data.firstName?.trim()) updatePayload.firstName = data.firstName.trim().slice(0, 10);
    if (data.lastName?.trim()) updatePayload.lastName = data.lastName.trim().slice(0, 10);
    if (isEmailChanging) updatePayload.email = newEmail;

    const updatedWorker = await prisma.worker.update({
        where: { id: worker.id },
        data: updatePayload,
    });

    try {
        const supabaseAdmin = getSupabaseAdminClient();
        const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuth = authList?.users?.find(
            (u) => u.email?.toLowerCase() === worker.email.toLowerCase() || u.id === worker.id || u.id === workerId
        );
        if (existingAuth) {
            const authUpdatePayload: any = {
                user_metadata: {
                    ...(existingAuth.user_metadata || {}),
                    firstName: updatedWorker.firstName,
                    lastName: updatedWorker.lastName,
                },
            };
            if (isEmailChanging) {
                authUpdatePayload.email = newEmail;
                authUpdatePayload.email_confirm = true;
            }
            await supabaseAdmin.auth.admin.updateUserById(existingAuth.id, authUpdatePayload);
        }
    } catch (authErr) {
        console.error('[updateWorkerProfileSettings] Auth sync warning:', authErr);
    }

    invalidateServerCache('workers');
    invalidateServerCache('worker_stats');
    revalidatePath('/', 'layout');
    revalidatePath('/dashboard');
    revalidatePath('/workers');
    revalidatePath('/my-settings');
    revalidatePath('/profile');

    const status = await getEmailChangeStatus(worker.id);

    return {
        success: true,
        worker: updatedWorker,
        remainingChanges: status.remaining,
        emailChanged: isEmailChanging,
        message: isEmailChanging
            ? `Profile updated. You have ${status.remaining} email change${status.remaining === 1 ? '' : 's'} remaining this month.`
            : 'Profile updated successfully.',
    };
}

export async function regenerateWorkerQrToken(identifier: string, customToken?: string) {
    const newToken = customToken || (Math.random().toString(36).slice(2) + Date.now().toString(36));

    // Resolve worker by id, workerId, or email to ensure relationship workers and workers with differing auth UIDs succeed
    const worker = await prisma.worker.findFirst({
        where: {
            OR: [
                { id: identifier },
                { workerId: identifier },
                { email: identifier },
            ],
        },
        select: { id: true, email: true },
    });

    if (!worker) {
        throw new Error('Worker profile not found for QR regeneration.');
    }

    const updated = await prisma.worker.update({
        where: { id: worker.id },
        data: { qrToken: newToken },
        select: { id: true, qrToken: true },
    });

    invalidateServerCache('workers');
    invalidateServerCache('worker_stats');
    revalidatePath('/workers');
    revalidatePath('/workers/my-qr');
    revalidatePath('/attendance');
    revalidatePath('/meals');

    return updated.qrToken;
}

export async function deleteWorker(id: string) {
    const supabaseAdmin = getSupabaseAdminClient();
    try {
        await supabaseAdmin.auth.admin.deleteUser(id);
    } catch (e) {
        console.error('Failed to delete auth user:', e);
    }

    await prisma.worker.delete({
        where: { id },
    });
    invalidateServerCache('workers');
    invalidateServerCache('worker_stats');
    revalidatePath('/workers');
}

export async function deleteWorkers(ids: string[]) {
    const supabaseAdmin = getSupabaseAdminClient();
    for (const id of ids) {
        try {
            await supabaseAdmin.auth.admin.deleteUser(id);
        } catch (e) {
            console.error('Failed to delete auth user:', e);
        }
    }

    await prisma.worker.deleteMany({
        where: { id: { in: ids } },
    });
    invalidateServerCache('workers');
    invalidateServerCache('worker_stats');
    revalidatePath('/workers');
}

// --- Approvals ---

export async function createApproval(data: any) {
    const approval = await prisma.approvalRequest.create({
        data: {
            ...data,
            date: new Date(),
        },
    });

    // Trigger async notification in background (non-blocking)
    void NotificationService.notifyNewRequest(approval).catch(err => {
        console.error('[createApproval] Background notification error:', err);
    });

    return approval;
}

export async function getApprovals(filters?: { ministryIds?: string[]; actorId?: string }) {
    let allowedIds: string[] | null = null;

    if (filters?.actorId) {
        const access = await getActorMinistryAccess(filters.actorId);
        if (!access.isSuperAdmin && access.allowedMinistryIds !== null) {
            allowedIds = filters.ministryIds && filters.ministryIds.length > 0
                ? filters.ministryIds.filter(id => access.allowedMinistryIds!.includes(id))
                : access.allowedMinistryIds;
            if (allowedIds.length === 0) {
                return [];
            }
        }
    } else if (filters?.ministryIds && filters.ministryIds.length > 0) {
        allowedIds = filters.ministryIds;
    }

    const approvals = await prisma.approvalRequest.findMany({
        include: {
            worker: {
                select: {
                    id: true,
                    workerId: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                    majorMinistryId: true,
                    minorMinistryId: true,
                },
            },
        },
        orderBy: {
            date: 'desc',
        },
    });

    if (allowedIds === null) {
        return approvals;
    }

    // Resolve reservation IDs to their booking ministryId
    const reservationIds = approvals.map(a => a.reservationId).filter(Boolean) as string[];
    const bookings = reservationIds.length > 0
        ? await prisma.booking.findMany({
            where: { id: { in: reservationIds } },
            select: { id: true, ministryId: true },
        })
        : [];
    const bookingMinistryMap = new Map(bookings.map(b => [b.id, b.ministryId]));

    return approvals.filter(app => {
        const bookingMinistry = app.reservationId ? bookingMinistryMap.get(app.reservationId) : null;
        const workerMajor = app.worker?.majorMinistryId;
        const workerMinor = app.worker?.minorMinistryId;

        const matchesBooking = Boolean(bookingMinistry && allowedIds!.includes(bookingMinistry));
        const matchesWorker = Boolean(
            (workerMajor && allowedIds!.includes(workerMajor)) ||
            (workerMinor && allowedIds!.includes(workerMinor)) ||
            (app.oldMajorId && allowedIds!.includes(app.oldMajorId)) ||
            (app.newMajorId && allowedIds!.includes(app.newMajorId))
        );

        return matchesBooking || matchesWorker;
    });
}

export async function updateApproval(id: string, data: any, actorId?: string) {
    const currentApproval = await prisma.approvalRequest.findUnique({
        where: { id },
        include: { worker: true },
    });
    if (!currentApproval) {
        throw new Error('Approval request not found');
    }

    if (actorId) {
        const access = await getActorMinistryAccess(actorId);
        if (!access.isSuperAdmin && access.allowedMinistryIds !== null) {
            let bookingMinistry: string | null = null;
            if (currentApproval.reservationId) {
                const b = await prisma.booking.findUnique({
                    where: { id: currentApproval.reservationId },
                    select: { ministryId: true },
                });
                bookingMinistry = b?.ministryId || null;
            }

            const isAllowed =
                (currentApproval.worker?.majorMinistryId && access.allowedMinistryIds.includes(currentApproval.worker.majorMinistryId)) ||
                (currentApproval.worker?.minorMinistryId && access.allowedMinistryIds.includes(currentApproval.worker.minorMinistryId)) ||
                (bookingMinistry && access.allowedMinistryIds.includes(bookingMinistry)) ||
                (currentApproval.oldMajorId && access.allowedMinistryIds.includes(currentApproval.oldMajorId)) ||
                (currentApproval.newMajorId && access.allowedMinistryIds.includes(currentApproval.newMajorId));

            if (!isAllowed) {
                throw new Error('Unauthorized: You can only approve or modify requests for your assigned ministry.');
            }
        }
    }

    const previousStatus = currentApproval.status;
    const status = data.status;
    const rejectionReason = data.reason || data.rejectionReason;

    // Clean data of non-schema properties before sending to prisma
    const { reason: _reason, rejectionReason: _rejectionReason, ...prismaData } = data;

    const approval = await prisma.approvalRequest.update({
        where: { id },
        data: prismaData,
    });

    // Handle side-effects for Room Bookings
    if (approval.type === 'Room Booking' && approval.reservationId) {
        await prisma.booking.update({
            where: { id: approval.reservationId },
            data: { status },
        }).catch(err => {
            console.error('Failed to update booking status:', err);
        });
    }

    // Handle final approval side-effects for workers
    if (status === 'Approved') {
        if (approval.type === 'New Worker' && approval.workerId) {
            await prisma.worker.update({
                where: { id: approval.workerId },
                data: { status: 'Active' },
            }).catch(err => {
                console.error('Failed to activate worker status:', err);
            });
        }

        if (approval.type === 'Ministry Change' && approval.workerId) {
            await prisma.worker.update({
                where: { id: approval.workerId },
                data: {
                    majorMinistryId: approval.newMajorId || '',
                    minorMinistryId: approval.newMinorId || '',
                },
            }).catch(err => {
                console.error('Failed to update worker ministry:', err);
            });
        }
    }

    let emailNotificationSent = false;
    let emailNotificationError: string | null = null;

    // Send final approval email in the background (non-blocking) when room reservation is approved
    const isRoomReservation = approval.type === 'Room Booking' || Boolean(approval.reservationId) || approval.type?.toLowerCase().includes('room');

    if (status === 'Approved' && previousStatus !== 'Approved' && isRoomReservation) {
        console.log(`[updateApproval] Dispatching final approval email for approval ${approval.id}, booking ${approval.reservationId}...`);
        try {
            const emailResult = await NotificationService.notifyRoomReservationApproved(approval.id, approval.reservationId || undefined);
            if (emailResult && !emailResult.success) {
                console.warn('[updateApproval] notifyRoomReservationApproved failed:', emailResult.error);
                emailNotificationError = emailResult.error;
            } else {
                console.log('[updateApproval] notifyRoomReservationApproved succeeded.');
                emailNotificationSent = true;
            }
        } catch (emailErr: any) {
            console.error('[updateApproval] Failed to send approval email:', emailErr);
            emailNotificationError = emailErr?.message || String(emailErr);
        }
    }

    // Send rejection email when room reservation is rejected
    if (status === 'Rejected' && previousStatus !== 'Rejected' && isRoomReservation) {
        console.log(`[updateApproval] Dispatching rejection email for approval ${approval.id}, booking ${approval.reservationId}...`);
        try {
            const emailResult = await NotificationService.notifyRoomReservationRejected(approval.id, approval.reservationId || undefined, rejectionReason);
            if (emailResult && !emailResult.success) {
                console.warn('[updateApproval] notifyRoomReservationRejected failed:', emailResult.error);
                emailNotificationError = emailResult.error;
            } else {
                console.log('[updateApproval] notifyRoomReservationRejected succeeded.');
                emailNotificationSent = true;
            }
        } catch (emailErr: any) {
            console.error('[updateApproval] Failed to send rejection email:', emailErr);
            emailNotificationError = emailErr?.message || String(emailErr);
        }
    }

    try {
        revalidatePath('/approvals');
        revalidatePath('/dashboard');
        revalidatePath('/reservations');
    } catch { }

    return {
        ...approval,
        emailNotificationSent,
        emailNotificationError,
    };
}

export async function deleteApprovalRequest(id: string) {
    const approval = await prisma.approvalRequest.findUnique({ where: { id } });
    if (!approval) return { success: false };

    if (approval.reservationId) {
        await prisma.booking.delete({ where: { id: approval.reservationId } }).catch(() => {});
    }
    await prisma.approvalRequest.delete({ where: { id } });

    revalidatePath('/approvals');
    revalidatePath('/dashboard');
    revalidatePath('/reservations');
    return { success: true };
}

// --- Ministries ---

export async function getMinistries(actorId?: string | any): Promise<any[]> {
    const effectiveActorId = typeof actorId === 'string' ? actorId : undefined;
    const cacheKey = `ministries:${effectiveActorId || 'all'}`;
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    let allowedIds: string[] | null = null;
    if (effectiveActorId) {
        const access = await getActorMinistryAccess(effectiveActorId);
        if (!access.isSuperAdmin) {
            allowedIds = access.allowedMinistryIds;
            if (allowedIds && allowedIds.length === 0) {
                setCached(cacheKey, [], 60_000);
                return [];
            }
        }
    }

    const where: any = {};
    if (allowedIds !== null) {
        where.id = { in: allowedIds };
    }

    const ministries = await prisma.ministry.findMany({
        where,
        include: {
            department: true,
        },
        orderBy: [
            { weight: 'desc' },
            { name: 'asc' },
        ],
    });

    const result = ministries.map(mapMinistryForClient);
    setCached(cacheKey, result, 60_000);
    return result;
}

export async function createMinistry(data: any) {
    const departmentCode = normalizeDepartmentCode(data.departmentCode || data.department);
    const { department, departmentCode: _departmentCode, ...rest } = data;
    const weight = data.weight ?? Math.floor(Date.now() / 1000);
    const ministry = await prisma.ministry.create({
        data: {
            ...rest,
            weight,
            department: {
                connect: { code: departmentCode },
            },
        },
        include: {
            department: true,
        },
    });
    invalidateServerCache('ministries');
    revalidatePath('/settings/ministries');
    return mapMinistryForClient(ministry);
}

export async function updateMinistry(id: string, data: any) {
    const departmentCode = data.department || data.departmentCode
        ? normalizeDepartmentCode(data.departmentCode || data.department)
        : null;

    const { department, departmentCode: _departmentCode, ...rest } = data;
    const updateData: any = { ...rest };

    if (departmentCode) {
        updateData.department = {
            connect: { code: departmentCode },
        };
    }

    const ministry = await prisma.ministry.update({
        where: { id },
        data: updateData,
        include: {
            department: true,
        },
    });
    invalidateServerCache('ministries');
    revalidatePath('/settings/ministries');
    return mapMinistryForClient(ministry);
}

export async function createMinistries(data: any[]) {
    let createdCount = 0;

    for (const row of data) {
        const departmentCode = normalizeDepartmentCode(row.departmentCode || row.department);
        const { department, departmentCode: _departmentCode, ...rest } = row;

        const existing = await prisma.ministry.findFirst({
            where: {
                OR: [
                    { id: rest.id },
                    { name: { equals: rest.name, mode: 'insensitive' } },
                ],
            },
            select: { id: true },
        });

        if (existing) continue;

        await prisma.ministry.create({
            data: {
                ...rest,
                department: {
                    connect: { code: departmentCode },
                },
            },
        });
        createdCount++;
    }

    invalidateServerCache('ministries');
    revalidatePath('/settings/ministries');
    return { count: createdCount };
}

export async function deleteMinistry(id: string) {
    await prisma.ministry.delete({ where: { id } });
    invalidateServerCache('ministries');
    revalidatePath('/settings/ministries');
}

// --- Bookings ---

export async function getBookings(filters: {
    workerProfileId?: string;
    dateFrom?: Date | string;
    dateTo?: Date | string;
    roomId?: string;
    status?: string;
    ministryIds?: string[];
    actorId?: string;
    take?: number;
} = {}) {
    const where: any = {};
    if (filters.workerProfileId) {
        where.workerProfileId = filters.workerProfileId;
    }
    if (filters.roomId) {
        where.roomId = filters.roomId;
    }
    if (filters.status) {
        where.status = filters.status;
    }
    if (filters.dateFrom || filters.dateTo) {
        where.start = {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
        };
    }

    let allowedIds: string[] | null = null;

    if (filters.actorId) {
        const access = await getActorMinistryAccess(filters.actorId);
        if (!access.isSuperAdmin && access.allowedMinistryIds !== null) {
            allowedIds = filters.ministryIds && filters.ministryIds.length > 0
                ? filters.ministryIds.filter(id => access.allowedMinistryIds!.includes(id))
                : access.allowedMinistryIds;
            if (allowedIds.length === 0) {
                return [];
            }
        }
    } else if (filters.ministryIds && filters.ministryIds.length > 0) {
        allowedIds = filters.ministryIds;
    }

    if (allowedIds !== null) {
        where.OR = [
            { ministryId: { in: allowedIds } },
            {
                AND: [
                    { OR: [{ ministryId: '' }, { ministryId: 'none' }] },
                    {
                        OR: [
                            { worker: { majorMinistryId: { in: allowedIds } } },
                            { worker: { minorMinistryId: { in: allowedIds } } },
                        ],
                    },
                ],
            },
        ];
    }

    return await prisma.booking.findMany({
        where,
        include: {
            room: true,
            worker: {
                select: {
                    id: true,
                    workerId: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarUrl: true,
                    majorMinistryId: true,
                    minorMinistryId: true,
                },
            },
        },
        ...(filters.take ? { take: filters.take } : {}),
        orderBy: [
            { dateRequested: 'desc' },
            { start: 'desc' },
        ],
    });
}

export async function getBookingById(id: string) {
    if (!id) return null;
    return await prisma.booking.findUnique({
        where: { id },
        include: {
            room: true,
            worker: {
                select: {
                    id: true,
                    workerId: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarUrl: true,
                    majorMinistryId: true,
                    minorMinistryId: true,
                },
            },
        },
    });
}

export async function getBookingsForRoomOnDate(roomId: string, date: Date | string) {
    let year: number;
    let month: number;
    let day: number;

    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const parts = date.split('-').map(Number);
        year = parts[0];
        month = parts[1];
        day = parts[2];
    } else {
        const d = new Date(date);
        // Manila is UTC+8: compute calendar date in Asia/Manila
        const manilaTime = new Date(d.getTime() + 8 * 60 * 60 * 1000);
        year = manilaTime.getUTCFullYear();
        month = manilaTime.getUTCMonth() + 1;
        day = manilaTime.getUTCDate();
    }

    // Manila day range in UTC
    const startOfManilaDayUTC = new Date(Date.UTC(year, month - 1, day, 0 - 8, 0, 0, 0));
    const endOfManilaDayUTC = new Date(Date.UTC(year, month - 1, day, 23 - 8, 59, 59, 999));

    return prisma.booking.findMany({
        where: {
            roomId,
            status: { notIn: ['Rejected', 'Cancelled'] },
            start: { lt: endOfManilaDayUTC },
            end: { gt: startOfManilaDayUTC },
        },
        orderBy: {
            start: 'asc',
        },
    });
}

export async function createBooking(data: any) {
    const { workerProfileId, roomId, ...rest } = data;
    if (!workerProfileId) throw new Error('workerProfileId is required to create a booking');
    if (!roomId) throw new Error('roomId is required to create a booking');

    const targetRoom = await prisma.room.findUnique({
        where: { id: roomId },
        select: { id: true, name: true, status: true },
    });
    if (targetRoom && targetRoom.status === 'Maintenance') {
        throw new Error(`Room "${targetRoom.name}" is currently under maintenance and cannot be reserved.`);
    }

    const access = await getActorMinistryAccess(workerProfileId);
    if (!access.isSuperAdmin && access.allowedMinistryIds !== null) {
        if (access.allowedMinistryIds.length === 0) {
            throw new Error('No ministry assignment available to create a reservation.');
        }
        if (rest.ministryId && !access.allowedMinistryIds.includes(rest.ministryId)) {
            throw new Error('Unauthorized: cannot create a booking for another ministry.');
        }
    }

    if (rest.start) {
        const startDate = new Date(rest.start);
        if (startDate < new Date()) {
            throw new Error('Cannot reserve a room for a past date or time.');
        }
    }

    // Strip fields not in the Booking schema to avoid Prisma validation errors
    const {
        requesterEmail: _re, dateRequested: _dr,
        ...cleanRest
    } = rest;

    try {
        const booking = await prisma.booking.create({
            data: { ...cleanRest, workerProfileId, roomId },
        });
        try {
            revalidatePath('/reservations');
            revalidatePath('/dashboard');
        } catch { }
        return booking;
    } catch (err: any) {
        if (err.message?.includes('Unauthorized') || err.message?.includes('No ministry assignment')) {
            throw err;
        }
        console.error('[createBooking] Prisma error:', err);
        throw new Error(`Failed to create booking: ${err.message || 'Unknown error'}`);
    }
}

/**
 * Unified high-performance reservation submission action.
 * Performs database-level conflict check, creates booking and approval atomically,
 * fires background notification, and returns in ~100ms.
 */
export async function submitRoomReservation(data: {
    bookingData: any;
    approvalData?: any;
}) {
    const { bookingData, approvalData } = data;
    const { roomId, start, end } = bookingData;

    try {
        if (roomId) {
            const targetRoom = await prisma.room.findUnique({
                where: { id: roomId },
                select: { id: true, name: true, status: true },
            });
            if (targetRoom && targetRoom.status === 'Maintenance') {
                return {
                    success: false,
                    error: `Room "${targetRoom.name}" is currently under maintenance and cannot be reserved.`,
                };
            }
        }

        // 1. Fast database-indexed conflict check
        if (start && end && roomId) {
            const conflicting = await prisma.booking.findFirst({
                where: {
                    roomId,
                    status: { notIn: ['Rejected', 'Cancelled'] },
                    start: { lt: new Date(end) },
                    end: { gt: new Date(start) },
                },
                select: { id: true, name: true, status: true },
            });

            if (conflicting) {
                return {
                    success: false,
                    error: `This room is already reserved (${conflicting.status}) by ${conflicting.name || 'another user'} for this time slot.`,
                };
            }
        }

        // Check if requester is Admin or Ministry Head — if so, bypass MH approval and go directly to Admin approval
        if (bookingData.workerProfileId) {
            const access = await getActorMinistryAccess(bookingData.workerProfileId);
            if (access.isSuperAdmin || access.isMinistryHead) {
                bookingData.status = 'Pending Admin Approval';
                if (approvalData) {
                    approvalData.status = 'Pending Admin Approval';
                }
            }
        }

        // 2. Atomic create in single database transaction
        const { requesterEmail: _re, dateRequested: _dr, workerProfileId, roomId: _rmId, ...cleanRest } = bookingData;

        const [booking, approval] = await prisma.$transaction(async (tx) => {
            const b = await tx.booking.create({
                data: { ...cleanRest, workerProfileId, roomId },
            });
            let a = null;
            if (approvalData) {
                a = await tx.approvalRequest.create({
                    data: {
                        ...approvalData,
                        reservationId: b.id,
                        date: new Date(),
                    },
                });
            }
            return [b, a];
        });

        // 3. Fire email notification to approvers
        if (approval) {
            try {
                await NotificationService.notifyNewRequest(approval);
            } catch (err) {
                console.error('[submitRoomReservation] Approver notification error:', err);
            }
        }
        // Return immediately in milliseconds; client query cache handles instant state updates
        return { success: true, booking, approval };
    } catch (err: any) {
        console.error('[submitRoomReservation] Error:', err);
        return {
            success: false,
            error: err.message || 'Failed to submit reservation.',
        };
    }
}

export async function updateBooking(id: string, data: any, actorId?: string) {
    const existing = await prisma.booking.findUnique({
        where: { id },
        include: {
            worker: {
                select: {
                    id: true,
                    majorMinistryId: true,
                },
            },
        },
    });
    if (!existing) throw new Error('Booking not found');

    if (actorId) {
        const access = await getActorMinistryAccess(actorId);
        if (!access.isSuperAdmin && access.allowedMinistryIds !== null) {
            const bookingMinId = existing.ministryId || existing.worker?.majorMinistryId;
            if (!bookingMinId || !access.allowedMinistryIds.includes(bookingMinId)) {
                throw new Error('Unauthorized to modify bookings for another ministry');
            }
        }
    }

    const previousStatus = existing.status;
    const status = data.status;

    const booking = await prisma.booking.update({
        where: { id },
        data,
    });

    let emailNotificationSent = false;
    let emailNotificationError: string | null = null;

    // If transitioned to Approved from non-approved status
    if (status === 'Approved' && previousStatus !== 'Approved') {
        // Sync approval requests
        await prisma.approvalRequest.updateMany({
            where: { reservationId: id, status: { not: 'Approved' } },
            data: { status: 'Approved' },
        }).catch(err => console.error('Failed to sync approval request status from booking update:', err));

        // Send approval email
        console.log(`[updateBooking] Dispatching final approval email for booking ${id}...`);
        try {
            const emailResult = await NotificationService.notifyRoomReservationApproved(undefined, id);
            if (emailResult && !emailResult.success) {
                console.warn('[updateBooking] notifyRoomReservationApproved failed:', emailResult.error);
                emailNotificationError = emailResult.error;
            } else {
                console.log(`[updateBooking] notifyRoomReservationApproved succeeded for booking ${id}.`);
                emailNotificationSent = true;
            }
        } catch (emailErr: any) {
            console.error('[updateBooking] Failed to send approval email:', emailErr);
            emailNotificationError = emailErr?.message || String(emailErr);
        }
    }

    // If transitioned to Rejected from non-rejected status
    if (status === 'Rejected' && previousStatus !== 'Rejected') {
        // Sync approval requests
        await prisma.approvalRequest.updateMany({
            where: { reservationId: id, status: { not: 'Rejected' } },
            data: { status: 'Rejected' },
        }).catch(err => console.error('Failed to sync approval request status from booking rejection:', err));

        // Send rejection email
        console.log(`[updateBooking] Dispatching rejection email for booking ${id}...`);
        try {
            const emailResult = await NotificationService.notifyRoomReservationRejected(undefined, id, (data as any).reason || (data as any).rejectionReason);
            if (emailResult && !emailResult.success) {
                console.warn('[updateBooking] notifyRoomReservationRejected failed:', emailResult.error);
                emailNotificationError = emailResult.error;
            } else {
                console.log(`[updateBooking] notifyRoomReservationRejected succeeded for booking ${id}.`);
                emailNotificationSent = true;
            }
        } catch (emailErr: any) {
            console.error('[updateBooking] Failed to send rejection email:', emailErr);
            emailNotificationError = emailErr?.message || String(emailErr);
        }
    }

    try {
        revalidatePath('/reservations');
        revalidatePath('/approvals');
        revalidatePath('/dashboard');
    } catch { }

    return {
        ...booking,
        emailNotificationSent,
        emailNotificationError,
    };
}

export async function deleteBooking(id: string, actorId?: string) {
    if (actorId) {
        const access = await getActorMinistryAccess(actorId);
        if (!access.isSuperAdmin && access.allowedMinistryIds !== null) {
            const existing = await prisma.booking.findUnique({
                where: { id },
                include: {
                    worker: {
                        select: {
                            id: true,
                            majorMinistryId: true,
                        },
                    },
                },
            });
            if (!existing) throw new Error('Booking not found');
            const bookingMinId = existing.ministryId || existing.worker?.majorMinistryId;
            if (!bookingMinId || !access.allowedMinistryIds.includes(bookingMinId)) {
                throw new Error('Unauthorized to delete bookings for another ministry');
            }
        }
    }

    await prisma.booking.delete({ where: { id } });
    try {
        revalidatePath('/reservations');
        revalidatePath('/dashboard');
    } catch { }
}

// --- Meal Stubs ---

export async function getMealStubs(filters: {
    workerId?: string;
    dateFrom?: Date | string;
    dateTo?: Date | string;
    ministryIds?: string[];
    actorId?: string;
    take?: number;
    includeSelf?: boolean;
} = {}) {
    const where: any = {};
    if (filters.workerId) where.workerId = filters.workerId;
    if (filters.dateFrom || filters.dateTo) {
        where.date = {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
        };
    }

    let allowedIds: string[] | null = null;

    if (filters.actorId) {
        const isSelfQuery = Boolean(filters.workerId && filters.actorId === filters.workerId);
        if (!isSelfQuery) {
            const access = await getActorMinistryAccess(filters.actorId);
            if (!access.isSuperAdmin && access.allowedMinistryIds !== null) {
                allowedIds = filters.ministryIds && filters.ministryIds.length > 0
                    ? filters.ministryIds.filter(id => access.allowedMinistryIds!.includes(id))
                    : access.allowedMinistryIds;
                if (allowedIds.length === 0 && !filters.includeSelf) {
                    return [];
                }
            }
        }
    } else if (filters.ministryIds && filters.ministryIds.length > 0) {
        allowedIds = filters.ministryIds;
    }

    if (allowedIds !== null && allowedIds.length > 0) {
        const ministryConditions = [
            { majorMinistryId: { in: allowedIds } },
            { minorMinistryId: { in: allowedIds } },
        ];
        if (filters.includeSelf && filters.actorId) {
            where.OR = [
                { worker: { OR: ministryConditions } },
                { workerId: filters.actorId },
            ];
        } else {
            where.worker = {
                OR: ministryConditions,
            };
        }
    } else if (filters.includeSelf && filters.actorId) {
        where.workerId = filters.actorId;
    }

    return await prisma.mealStub.findMany({
        where,
        include: {
            worker: {
                select: {
                    id: true,
                    workerId: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                    majorMinistryId: true,
                    minorMinistryId: true,
                },
            },
        },
        ...(filters.take ? { take: filters.take } : {}),
        orderBy: {
            date: 'desc',
        },
    });
}

export async function createMealStub(data: {
    workerId: string;
    workerName: string;
    status: string;
    stubType?: string;
    assignedBy?: string;
    assignedByName?: string;
    date?: Date; // Optional: allow passing a custom date (e.g. for Sunday mode)
}) {
    return await prisma.mealStub.create({
        data: {
            ...data,
            date: data.date || new Date(),
        },
    });
}

export async function updateMealStub(id: string, data: any) {
    const stub = await prisma.mealStub.update({
        where: { id },
        data,
    });
    revalidatePath('/meals');
    return stub;
}

export async function deleteMealStub(id: string) {
    await prisma.mealStub.delete({ where: { id } });
    revalidatePath('/meals');
}

// --- Attendance ---

export async function getAttendanceRecords(filters: {
    workerProfileId?: string;
    dateFrom?: Date | string;
    dateTo?: Date | string;
    ministryIds?: string[];
    actorId?: string;
    take?: number;
} = {}) {
    const where: any = {};
    if (filters.workerProfileId) where.workerProfileId = filters.workerProfileId;
    if (filters.dateFrom || filters.dateTo) {
        where.time = {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
        };
    }

    let allowedIds: string[] | null = null;

    if (filters.actorId) {
        const access = await getActorMinistryAccess(filters.actorId);
        if (!access.isSuperAdmin && access.allowedMinistryIds !== null) {
            allowedIds = filters.ministryIds && filters.ministryIds.length > 0
                ? filters.ministryIds.filter(id => access.allowedMinistryIds!.includes(id))
                : access.allowedMinistryIds;
            if (allowedIds.length === 0) {
                return [];
            }
        }
    } else if (filters.ministryIds && filters.ministryIds.length > 0) {
        allowedIds = filters.ministryIds;
    }

    if (allowedIds !== null) {
        where.worker = {
            OR: [
                { majorMinistryId: { in: allowedIds } },
                { minorMinistryId: { in: allowedIds } },
            ],
        };
    }

    return await prisma.attendanceRecord.findMany({
        where,
        include: {
            worker: {
                select: {
                    id: true,
                    workerId: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                    majorMinistryId: true,
                    minorMinistryId: true,
                },
            },
        },
        ...(filters.take ? { take: filters.take } : {}),
        orderBy: {
            time: 'desc',
        },
    });
}

export async function seedAttendanceData() {
    const workers = await prisma.worker.findMany();
    if (!workers.length) return { count: 0 };

    const today = new Date();
    const currentDay = today.getDay();
    const diffToMonday = (currentDay + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);

    let inserted = 0;
    for (const worker of workers) {
        // Mon in/out (On Time: 7:45 AM - 5:15 PM)
        const monIn = new Date(monday); monIn.setHours(7, 45, 0, 0);
        const monOut = new Date(monday); monOut.setHours(17, 15, 0, 0);

        // Tue in/out (Late: 8:45 AM - 5:00 PM)
        const tueIn = new Date(monday); tueIn.setDate(monday.getDate() + 1); tueIn.setHours(8, 45, 0, 0);
        const tueOut = new Date(monday); tueOut.setDate(monday.getDate() + 1); tueOut.setHours(17, 0, 0, 0);

        // Wed in/out (On Time: 7:55 AM - 5:30 PM)
        const wedIn = new Date(monday); wedIn.setDate(monday.getDate() + 2); wedIn.setHours(7, 55, 0, 0);
        const wedOut = new Date(monday); wedOut.setDate(monday.getDate() + 2); wedOut.setHours(17, 30, 0, 0);

        await prisma.attendanceRecord.createMany({
            data: [
                { workerProfileId: worker.id, type: 'Clock In', time: monIn },
                { workerProfileId: worker.id, type: 'Clock Out', time: monOut },
                { workerProfileId: worker.id, type: 'Clock In', time: tueIn },
                { workerProfileId: worker.id, type: 'Clock Out', time: tueOut },
                { workerProfileId: worker.id, type: 'Clock In', time: wedIn },
                { workerProfileId: worker.id, type: 'Clock Out', time: wedOut },
            ]
        });
        inserted += 6;
    }

    revalidatePath('/attendance');
    return { count: inserted };
}

export async function createAttendanceRecord(data: { workerProfileId: string; type: string; allowPastShift?: boolean }) {
    if (data.type === 'Clock In' && !data.allowPastShift) {
        const settings = await getAttendanceSettings();
        const [endHStr, endMStr] = (settings.shiftEndTime || "17:00").split(':');
        const shiftEndHour = parseInt(endHStr, 10) || 17;
        const shiftEndMin = parseInt(endMStr, 10) || 0;
        const endCutoffTotalMinutes = shiftEndHour * 60 + shiftEndMin;

        const now = new Date();
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

        if (currentTotalMinutes >= endCutoffTotalMinutes) {
            const h = shiftEndHour % 12 || 12;
            const ampm = shiftEndHour >= 12 ? 'PM' : 'AM';
            const m = String(shiftEndMin).padStart(2, '0');
            throw new Error(`Cannot clock in because it is past working hours (${h}:${m} ${ampm}).`);
        }
    }

    const record = await prisma.attendanceRecord.create({
        data: {
            workerProfileId: data.workerProfileId,
            type: data.type,
            time: new Date(),
        },
    });

    if (data.type === 'Clock In') {
        const worker = await prisma.worker.findUnique({ where: { id: data.workerProfileId } });
        if (worker) {
            const today = new Date();
            const startOfDay = new Date(today);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);

            const existingStub = await prisma.mealStub.findFirst({
                where: {
                    workerId: worker.id,
                    date: { gte: startOfDay, lte: endOfDay }
                }
            });

            if (!existingStub) {
                await prisma.mealStub.create({
                    data: {
                        workerId: worker.id,
                        workerName: `${worker.firstName} ${worker.lastName}`,
                        status: 'Issued',
                        stubType: 'daily',
                        assignedBy: 'system',
                        assignedByName: 'Auto-Assigned (Clock In)',
                        date: new Date()
                    }
                });
            }
        }
    }

    revalidatePath('/attendance');
    revalidatePath('/meals');
    return record;
}

export async function getAttendanceSettings(): Promise<AttendanceShiftSettings> {
    try {
        const setting = await prisma.setting.findUnique({
            where: { id: 'attendance_shift_settings' },
        });
        if (setting?.data) {
            const data = typeof setting.data === 'string' ? JSON.parse(setting.data) : setting.data;
            return {
                ...DEFAULT_ATTENDANCE_SETTINGS,
                ...data,
            };
        }
    } catch (e) {
        console.error("Failed to load attendance settings from DB", e);
    }
    return DEFAULT_ATTENDANCE_SETTINGS;
}

export async function updateAttendanceSettings(data: Partial<AttendanceShiftSettings>) {
    const current = await getAttendanceSettings();
    const updated: AttendanceShiftSettings = {
        ...current,
        ...data,
    };
    await prisma.setting.upsert({
        where: { id: 'attendance_shift_settings' },
        update: { data: updated as any },
        create: { id: 'attendance_shift_settings', data: updated as any },
    });
    revalidatePath('/settings');
    revalidatePath('/settings/attendance');
    revalidatePath('/attendance/scanner');
    return updated;
}

export async function getScannerSettings(): Promise<ScannerSettings> {
    try {
        const setting = await prisma.setting.findUnique({
            where: { id: 'scanner_settings' },
        });
        if (setting?.data) {
            const data = typeof setting.data === 'string' ? JSON.parse(setting.data) : setting.data;
            return {
                ...DEFAULT_SCANNER_SETTINGS,
                ...data,
            };
        }
    } catch (e) {
        console.error("Failed to load scanner settings from DB", e);
    }
    return DEFAULT_SCANNER_SETTINGS;
}

export async function updateScannerSettings(data: Partial<ScannerSettings>) {
    const current = await getScannerSettings();
    const updated: ScannerSettings = {
        ...current,
        ...data,
    };
    await prisma.setting.upsert({
        where: { id: 'scanner_settings' },
        update: { data: updated as any },
        create: { id: 'scanner_settings', data: updated as any },
    });
    revalidatePath('/settings');
    revalidatePath('/settings/scanner');
    revalidatePath('/attendance/scanner');
    revalidatePath('/mealstub/scanner');
    return updated;
}

export async function recordAutoAttendance(workerProfileId: string) {
    const worker = await prisma.worker.findUnique({ where: { id: workerProfileId } });
    if (!worker) {
        throw new Error("Worker not found");
    }

    // Load dynamic shift settings from database
    const settings = await getAttendanceSettings();

    // Parse shift start time (e.g. "09:00" -> 9 hours, 0 mins)
    const [startHStr, startMStr] = (settings.shiftStartTime || "09:00").split(':');
    const shiftStartHour = parseInt(startHStr, 10) || 9;
    const shiftStartMin = parseInt(startMStr, 10) || 0;
    const graceMinutes = typeof settings.gracePeriodMinutes === 'number' ? settings.gracePeriodMinutes : 15;

    // Parse shift end time (e.g. "17:00" -> 17 hours, 0 mins)
    const [endHStr, endMStr] = (settings.shiftEndTime || "17:00").split(':');
    const shiftEndHour = parseInt(endHStr, 10) || 17;
    const shiftEndMin = parseInt(endMStr, 10) || 0;
    const cooldownMins = typeof settings.cooldownMinutes === 'number' ? settings.cooldownMinutes : 5;

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const todayRecords = await prisma.attendanceRecord.findMany({
        where: {
            workerProfileId: worker.id,
            time: { gte: startOfDay, lte: endOfDay }
        },
        orderBy: { time: 'desc' }
    });

    const latestRecord = todayRecords[0];
    const workerData = {
        id: worker.id,
        firstName: worker.firstName,
        lastName: worker.lastName,
        avatarUrl: worker.avatarUrl,
        roleId: worker.roleId,
        employmentType: worker.employmentType
    };

    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
    const startCutoffTotalMinutes = shiftStartHour * 60 + shiftStartMin + graceMinutes;
    const endCutoffTotalMinutes = shiftEndHour * 60 + shiftEndMin;

    // Case 1: No attendance record yet today -> CLOCK IN
    if (!latestRecord) {
        const isOnTime = currentTotalMinutes <= startCutoffTotalMinutes;
        const status = isOnTime ? 'On Time' : 'Late';
        const statusBadgeColor = isOnTime ? 'emerald' : 'amber';

        const record = await createAttendanceRecord({
            workerProfileId: worker.id,
            type: 'Clock In'
        });

        return {
            success: true,
            action: 'Clock In' as const,
            status,
            statusBadgeColor,
            record,
            time: now,
            message: `Timed In successfully (${status})`,
            worker: workerData
        };
    }

    // Check cooldown time from the latest record
    const diffMs = now.getTime() - new Date(latestRecord.time).getTime();
    const diffMinutes = diffMs / (1000 * 60);

    // Case 2: Latest record is Clock In
    if (latestRecord.type === 'Clock In') {
        // Dynamic cooldown check (default 5 minutes buffer)
        if (diffMinutes < cooldownMins) {
            const recordedTimeStr = new Date(latestRecord.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            return {
                success: false,
                action: 'Cooldown' as const,
                status: 'Cooldown',
                statusBadgeColor: 'amber',
                record: latestRecord,
                time: latestRecord.time,
                message: `Already Timed In at ${recordedTimeStr}.`,
                worker: workerData
            };
        }

        // Past cooldown -> CLOCK OUT
        const isCompleted = currentTotalMinutes >= endCutoffTotalMinutes;
        const status = isCompleted ? 'Shift Completed' : 'Undertime';
        const statusBadgeColor = isCompleted ? 'emerald' : 'amber';

        const record = await createAttendanceRecord({
            workerProfileId: worker.id,
            type: 'Clock Out'
        });

        return {
            success: true,
            action: 'Clock Out' as const,
            status,
            statusBadgeColor,
            record,
            time: now,
            message: `Timed Out successfully (${status})`,
            worker: workerData
        };
    }

    // Case 3: Latest record is Clock Out
    if (latestRecord.type === 'Clock Out') {
        // Cooldown check
        if (diffMinutes < cooldownMins) {
            const recordedTimeStr = new Date(latestRecord.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            return {
                success: false,
                action: 'Cooldown' as const,
                status: 'Cooldown',
                statusBadgeColor: 'amber',
                record: latestRecord,
                time: latestRecord.time,
                message: `Already Timed Out at ${recordedTimeStr}.`,
                worker: workerData
            };
        }

        // Past cooldown -> Re-entry or Overtime CLOCK IN
        const isOvertime = currentTotalMinutes >= endCutoffTotalMinutes;
        const status = isOvertime ? 'Overtime In' : 'Re-entry In';
        const statusBadgeColor = 'blue';

        const record = await createAttendanceRecord({
            workerProfileId: worker.id,
            type: 'Clock In'
        });

        return {
            success: true,
            action: 'Clock In' as const,
            status,
            statusBadgeColor,
            record,
            time: now,
            message: `Timed In for ${status}`,
            worker: workerData
        };
    }

    throw new Error('Unhandled attendance state');
}

// --- Rooms, Areas, Branches ---

export async function getRooms() {
    const cacheKey = 'rooms:all';
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    const rooms = await prisma.room.findMany({
        include: {
            area: {
                include: {
                    branch: true,
                },
            },
        },
        orderBy: {
            weight: 'desc',
        },
    });
    setCached(cacheKey, rooms, 60_000);
    return rooms;
}

export async function createRoom(data: any) {
    await invalidateServerCache('rooms');
    const weight = data.weight ?? Math.floor(Date.now() / 1000);
    const room = await prisma.room.create({
        data: {
            ...data,
            weight,
        },
    });
    revalidatePath('/settings/rooms');
    return room;
}

export async function updateRoom(id: string, data: any) {
    await invalidateServerCache('rooms');
    const { id: _ignored, area, bookings, venueBookings, assistanceConfigurations, ...cleanData } = data;
    const room = await prisma.room.update({
        where: { id },
        data: cleanData,
    });
    revalidatePath('/settings/rooms');
    return room;
}

export async function deleteRoom(id: string) {
    await invalidateServerCache('rooms');
    await prisma.room.delete({ where: { id } });
    revalidatePath('/settings/rooms');
}

export async function createRooms(data: any[]) {
    await invalidateServerCache('rooms');
    await prisma.room.createMany({ data });
    revalidatePath('/settings/rooms');
}

function getFloorRank(name: string): number {
    const lower = (name || '').toLowerCase().trim();
    if (lower.includes('basement 2') || lower.includes('b2')) return -2;
    if (lower.includes('basement') || lower.includes('b1')) return -1;
    if (lower.includes('ground') || lower.includes('lower ground') || lower.includes('ug') || lower.includes('lg') || lower.includes('g/f') || lower.includes('gf')) return 0;

    const ordinalMap: Record<string, number> = {
        'first': 1, '1st': 1, 'one': 1,
        'second': 2, '2nd': 2, 'two': 2,
        'third': 3, '3rd': 3, 'three': 3,
        'fourth': 4, '4th': 4, 'four': 4,
        'fifth': 5, '5th': 5, 'five': 5,
        'sixth': 6, '6th': 6, 'six': 6,
        'seventh': 7, '7th': 7, 'seven': 7,
        'eighth': 8, '8th': 8, 'eight': 8,
        'ninth': 9, '9th': 9, 'nine': 9,
        'tenth': 10, '10th': 10, 'ten': 10,
        'eleventh': 11, '11th': 11,
        'twelfth': 12, '12th': 12,
    };

    for (const [key, val] of Object.entries(ordinalMap)) {
        const regex = new RegExp(`\\b${key}\\b`, 'i');
        if (regex.test(lower)) return val;
    }

    const numMatch = lower.match(/(\d+)/);
    if (numMatch) {
        return parseInt(numMatch[1], 10);
    }

    if (lower.includes('roof') || lower.includes('deck') || lower.includes('penthouse')) return 999;
    return 100;
}

export async function getAreas() {
    const areas = await prisma.area.findMany({
        include: {
            branch: true,
        },
    });
    return areas.sort((a, b) => {
        const rankA = getFloorRank(a.name || a.areaId || '');
        const rankB = getFloorRank(b.name || b.areaId || '');
        if (rankA !== rankB) return rankA - rankB;
        return (a.name || '').localeCompare(b.name || '');
    });
}

export async function createArea(data: any) {
    const area = await prisma.area.create({ data });
    revalidatePath('/settings/rooms');
    return area;
}

export async function updateArea(id: string, data: any) {
    const area = await prisma.area.update({
        where: { id },
        data,
    });
    revalidatePath('/settings/rooms');
    return area;
}

export async function deleteArea(id: string) {
    await prisma.area.delete({ where: { id } });
    revalidatePath('/settings/rooms');
}

export async function createAreas(data: any[]) {
    await prisma.area.createMany({ data });
    revalidatePath('/settings/rooms');
}

export async function getBranches() {
    return await prisma.branch.findMany({
        orderBy: {
            name: 'asc',
        },
    });
}

export async function createBranch(data: any) {
    const branch = await prisma.branch.create({ data });
    revalidatePath('/settings/rooms');
    return branch;
}

export async function updateBranch(id: string, data: any) {
    const branch = await prisma.branch.update({
        where: { id },
        data,
    });
    revalidatePath('/settings/rooms');
    return branch;
}

export async function deleteBranch(id: string) {
    await prisma.branch.delete({ where: { id } });
    revalidatePath('/settings/rooms');
}

// --- Scan Logs ---

export async function getScanLogs(limit: number = 100, scanType?: string) {
    return await prisma.scanLog.findMany({
        where: scanType ? { scanType } : undefined,
        take: limit,
        orderBy: {
            timestamp: 'desc',
        },
    });
}

export async function createScanLog(data: any) {
    return await prisma.scanLog.create({
        data: {
            ...data,
            timestamp: new Date(),
        },
    });
}

// --- C2S ---

export async function getC2SGroups(params?: { ministryIds?: string[]; actorId?: string }) {
    try {
        let allowedIds: string[] | null = null;
        if (params?.actorId) {
            const access = await getActorMinistryAccess(params.actorId);
            if (!access.isSuperAdmin && access.allowedMinistryIds !== null) {
                allowedIds = params.ministryIds && params.ministryIds.length > 0
                    ? params.ministryIds.filter(id => access.allowedMinistryIds!.includes(id))
                    : access.allowedMinistryIds;
                if (allowedIds.length === 0) return [];
            }
        } else if (params?.ministryIds && params.ministryIds.length > 0) {
            allowedIds = params.ministryIds;
        }

        const where: any = {};
        if (allowedIds !== null) {
            const workers = await prisma.worker.findMany({
                where: {
                    OR: [
                        { majorMinistryId: { in: allowedIds } },
                        { minorMinistryId: { in: allowedIds } },
                    ],
                },
                select: { id: true },
            });
            const mentorIds = workers.map(w => w.id);
            where.mentorId = { in: mentorIds };
        }

        return await prisma.c2SGroup.findMany({
            where,
            include: {
                mentees: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    } catch (error) {
        console.error("Error fetching C2S groups:", error);
        return [];
    }
}

export async function getC2SMentees(params?: { ministryIds?: string[]; actorId?: string }) {
    try {
        let allowedIds: string[] | null = null;
        if (params?.actorId) {
            const access = await getActorMinistryAccess(params.actorId);
            if (!access.isSuperAdmin && access.allowedMinistryIds !== null) {
                allowedIds = params.ministryIds && params.ministryIds.length > 0
                    ? params.ministryIds.filter(id => access.allowedMinistryIds!.includes(id))
                    : access.allowedMinistryIds;
                if (allowedIds.length === 0) return [];
            }
        } else if (params?.ministryIds && params.ministryIds.length > 0) {
            allowedIds = params.ministryIds;
        }

        const where: any = {};
        if (allowedIds !== null) {
            const workers = await prisma.worker.findMany({
                where: {
                    OR: [
                        { majorMinistryId: { in: allowedIds } },
                        { minorMinistryId: { in: allowedIds } },
                        { assignedMinistryIds: { hasSome: allowedIds } },
                    ],
                },
                select: { id: true },
            });
            const mentorIds = Array.from(new Set([
                ...workers.map(w => w.id),
                ...(params?.actorId ? [params.actorId] : []),
            ]));
            where.OR = [
                { mentorId: { in: mentorIds } },
                { group: { mentorId: { in: mentorIds } } },
            ];
        }

        return await prisma.c2SMentee.findMany({
            where,
            include: {
                group: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    } catch (error) {
        console.error("Error fetching C2S mentees:", error);
        return [];
    }
}

export async function createC2SGroup(data: {
    name: string;
    mentorId: string;
    menteeIds?: string[];
}) {
    const group = await prisma.c2SGroup.create({
        data: {
            name: data.name,
            mentorId: data.mentorId,
            menteeIds: data.menteeIds ?? [],
        },
    });
    revalidatePath('/c2s');
    return group;
}

export async function updateC2SGroup(id: string, data: { name?: string; mentorId?: string; menteeIds?: string[] }) {
    const group = await prisma.c2SGroup.update({
        where: { id },
        data,
    });
    revalidatePath('/c2s');
    return group;
}

export async function deleteC2SGroup(id: string) {
    await prisma.c2SGroup.delete({ where: { id } });
    revalidatePath('/c2s');
}

export async function createC2SMentee(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    status: string;
    groupId?: string;
    mentorId: string;
}) {
    let finalGroupId = data.groupId;
    if (!finalGroupId) {
        let group = await prisma.c2SGroup.findFirst({
            where: { mentorId: data.mentorId },
        });
        if (!group) {
            let defaultName = "Sports";
            if (data.mentorId) {
                const mentor = await prisma.worker.findUnique({
                    where: { id: data.mentorId },
                    select: { majorMinistryId: true },
                });
                if (mentor?.majorMinistryId) {
                    const min = await prisma.ministry.findUnique({
                        where: { id: mentor.majorMinistryId },
                        select: { name: true },
                    });
                    if (min?.name) defaultName = min.name;
                }
            }
            group = await prisma.c2SGroup.create({
                data: {
                    name: defaultName,
                    mentorId: data.mentorId,
                    menteeIds: [],
                },
            });
        }
        finalGroupId = group.id;
    }

    const mentee = await prisma.c2SMentee.create({
        data: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            status: data.status,
            groupId: finalGroupId,
            mentorId: data.mentorId,
        },
    });
    revalidatePath('/c2s');
    return mentee;
}

export async function updateC2SMentee(id: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    status?: string;
    groupId?: string;
    mentorId?: string;
}) {
    let updateData: any = { ...data };

    if (data.mentorId) {
        const existing = await prisma.c2SMentee.findUnique({ where: { id } });

        let targetGroup: any = null;
        if (data.groupId) {
            targetGroup = await prisma.c2SGroup.findFirst({
                where: { id: data.groupId, mentorId: data.mentorId },
            });
        }
        if (!targetGroup) {
            targetGroup = await prisma.c2SGroup.findFirst({
                where: { mentorId: data.mentorId },
            });
        }
        if (!targetGroup) {
            let defaultName = "Sports";
            if (data.mentorId) {
                const mentor = await prisma.worker.findUnique({
                    where: { id: data.mentorId },
                    select: { majorMinistryId: true },
                });
                if (mentor?.majorMinistryId) {
                    const min = await prisma.ministry.findUnique({
                        where: { id: mentor.majorMinistryId },
                        select: { name: true },
                    });
                    if (min?.name) defaultName = min.name;
                }
            }
            targetGroup = await prisma.c2SGroup.create({
                data: {
                    name: defaultName,
                    mentorId: data.mentorId,
                    menteeIds: [id],
                },
            });
        }
        updateData.groupId = targetGroup.id;

        if (existing?.groupId && existing.groupId !== targetGroup.id) {
            const oldGroup = await prisma.c2SGroup.findUnique({ where: { id: existing.groupId } });
            if (oldGroup && oldGroup.menteeIds.includes(id)) {
                await prisma.c2SGroup.update({
                    where: { id: oldGroup.id },
                    data: {
                        menteeIds: oldGroup.menteeIds.filter((mId) => mId !== id),
                    },
                });
            }
        }

        if (!targetGroup.menteeIds.includes(id)) {
            await prisma.c2SGroup.update({
                where: { id: targetGroup.id },
                data: {
                    menteeIds: [...targetGroup.menteeIds, id],
                },
            });
        }
    }

    const mentee = await prisma.c2SMentee.update({
        where: { id },
        data: updateData,
    });
    revalidatePath('/c2s');
    return mentee;
}

export async function deleteC2SMentee(id: string) {
    // Remove mentee id from any group menteeIds array
    const groups = await prisma.c2SGroup.findMany({
        where: { menteeIds: { has: id } },
        select: { id: true, menteeIds: true },
    });
    if (groups.length > 0) {
        await Promise.all(
            groups.map((g) =>
                prisma.c2SGroup.update({
                    where: { id: g.id },
                    data: {
                        menteeIds: g.menteeIds.filter((mId) => mId !== id),
                    },
                })
            )
        );
    }

    await prisma.c2SMentee.delete({ where: { id } });
    revalidatePath('/c2s');
}

export async function getC2SDevotionRecords(params?: {
    mentorId?: string;
    groupId?: string;
    clusterName?: string;
    ministryIds?: string[];
    actorId?: string;
}) {
    try {
        const where: any = {};
        if (params?.mentorId) {
            where.mentorId = params.mentorId;
        }
        if (params?.groupId) {
            where.groupId = params.groupId;
        }
        if (params?.clusterName && params.clusterName !== 'all') {
            where.clusterName = params.clusterName;
        }

        let allowedIds: string[] | null = null;
        if (params?.actorId) {
            const access = await getActorMinistryAccess(params.actorId);
            if (!access.isSuperAdmin && access.allowedMinistryIds !== null) {
                allowedIds = params.ministryIds && params.ministryIds.length > 0
                    ? params.ministryIds.filter(id => access.allowedMinistryIds!.includes(id))
                    : access.allowedMinistryIds;
                if (allowedIds.length === 0) return [];
            }
        } else if (params?.ministryIds && params.ministryIds.length > 0) {
            allowedIds = params.ministryIds;
        }

        if (allowedIds !== null) {
            const workers = await prisma.worker.findMany({
                where: {
                    OR: [
                        { majorMinistryId: { in: allowedIds } },
                        { minorMinistryId: { in: allowedIds } },
                    ],
                },
                select: { id: true },
            });
            const mentorIds = workers.map(w => w.id);
            if (params?.mentorId) {
                if (!mentorIds.includes(params.mentorId)) {
                    return [];
                }
            } else {
                where.mentorId = { in: mentorIds };
            }
        }

        const records = await prisma.c2SDevotionRecord.findMany({
            where,
            orderBy: {
                createdAt: 'desc',
            },
        });
        return records || [];
    } catch (e: any) {
        console.error("Error fetching devotion records:", e);
        return [];
    }
}

export async function createC2SDevotionRecord(data: {
    manualType?: string;
    moduleName?: string;
    lessonName?: string;
    topic: string;
    scripture?: string;
    devotionDate?: Date | string;
    groupId?: string;
    clusterName: string;
    mentorId: string;
    mentorName?: string;
    mentorRole?: string;
    attendeeNames?: string[];
    attendeeCount?: number;
    reflectionNotes: string;
    prayerRequests?: string;
    photoUrl?: string;
    photoUrls?: string[];
    status?: string;
}) {
    const attendees = Array.isArray(data.attendeeNames)
        ? data.attendeeNames.filter((n: string) => n && n.trim())
        : [];
    if (attendees.length === 0) {
        throw new Error("Cannot submit devotion record without a participating mentee. Please select or add a mentee first.");
    }

    let validGroupId: string | null = null;
    if (data.groupId) {
        try {
            const groupExists = await prisma.c2SGroup.findUnique({
                where: { id: data.groupId },
            });
            if (groupExists) {
                validGroupId = data.groupId;
            }
        } catch (e) {
            validGroupId = null;
        }
    }

    // Upload photos to Supabase Storage if they are base64 strings
    let uploadedPhotoUrls: string[] = [];
    if (data.photoUrls && data.photoUrls.length > 0) {
        const { uploadBase64ToSupabase } = await import('@/lib/upload-to-supabase');
        uploadedPhotoUrls = await Promise.all(
            data.photoUrls.map(async (photoUrl) => {
                if (photoUrl.startsWith('data:image')) {
                    try {
                        return await uploadBase64ToSupabase(photoUrl, 'Devotion-Photos', 'c2s');
                    } catch (error) {
                        console.error('Error uploading photo to Supabase:', error);
                        return photoUrl;
                    }
                }
                return photoUrl;
            })
        );
    } else if (data.photoUrl && data.photoUrl.startsWith('data:image')) {
        // Upload single photo
        const { uploadBase64ToSupabase } = await import('@/lib/upload-to-supabase');
        try {
            const publicUrl = await uploadBase64ToSupabase(data.photoUrl, 'Devotion-Photos', 'c2s');
            uploadedPhotoUrls.push(publicUrl);
        } catch (error) {
            console.error('Error uploading photo to Supabase:', error);
            uploadedPhotoUrls.push(data.photoUrl);
        }
    }

    const finalPhotoUrl = uploadedPhotoUrls[0] || data.photoUrl || null;
    const finalPhotoUrls = uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : (data.photoUrls || (data.photoUrl ? [data.photoUrl] : []));

    const payload = {
        manualType: data.manualType || 'C2S Devotional Manual',
        moduleName: data.moduleName || null,
        lessonName: data.lessonName || null,
        topic: data.topic,
        scripture: data.scripture || null,
        devotionDate: data.devotionDate ? new Date(data.devotionDate) : new Date(),
        groupId: validGroupId,
        clusterName: data.clusterName || 'Cluster 1',
        mentorId: data.mentorId || 'mentor-default',
        mentorName: data.mentorName || null,
        mentorRole: data.mentorRole || 'Mentor',
        attendeeNames: data.attendeeNames || [],
        attendeeCount: data.attendeeCount ?? (data.attendeeNames ? data.attendeeNames.length : 0),
        reflectionNotes: data.reflectionNotes,
        prayerRequests: data.prayerRequests || null,
        photoUrl: finalPhotoUrl,
        photoUrls: finalPhotoUrls,
        status: data.status || 'Submitted',
    };

    try {
        const record = await prisma.c2SDevotionRecord.create({
            data: payload,
        });
        revalidatePath('/c2s');
        return record;
    } catch (err: any) {
        console.error("Error creating C2SDevotionRecord in DB:", err);
        console.error("Payload:", JSON.stringify(payload, null, 2));
        // Throw the error instead of returning a mock object
        throw new Error(`Failed to create devotion record: ${err.message}`);
    }
}

export async function updateC2SDevotionRecord(id: string, data: {
    manualType?: string;
    moduleName?: string;
    lessonName?: string;
    topic?: string;
    scripture?: string;
    devotionDate?: Date | string;
    groupId?: string;
    clusterName?: string;
    mentorId?: string;
    mentorName?: string;
    mentorRole?: string;
    attendeeNames?: string[];
    attendeeCount?: number;
    reflectionNotes?: string;
    prayerRequests?: string;
    photoUrl?: string | null;
    photoUrls?: string[];
    status?: string;
}) {
    // Upload photos to Supabase Storage if they are base64 strings
    let uploadedPhotoUrls: string[] = [];
    if (data.photoUrls && data.photoUrls.length > 0) {
        const { uploadBase64ToSupabase } = await import('@/lib/upload-to-supabase');
        for (const photoUrl of data.photoUrls) {
            if (photoUrl.startsWith('data:image')) {
                // This is a base64 string, upload to Supabase
                try {
                    const publicUrl = await uploadBase64ToSupabase(photoUrl, 'Devotion-Photos', 'c2s');
                    uploadedPhotoUrls.push(publicUrl);
                } catch (error) {
                    console.error('Error uploading photo to Supabase:', error);
                    // Fallback to base64 if upload fails
                    uploadedPhotoUrls.push(photoUrl);
                }
            } else {
                // Already a URL, keep it
                uploadedPhotoUrls.push(photoUrl);
            }
        }
    } else if (data.photoUrl && data.photoUrl.startsWith('data:image')) {
        // Upload single photo
        const { uploadBase64ToSupabase } = await import('@/lib/upload-to-supabase');
        try {
            const publicUrl = await uploadBase64ToSupabase(data.photoUrl, 'Devotion-Photos', 'c2s');
            uploadedPhotoUrls.push(publicUrl);
        } catch (error) {
            console.error('Error uploading photo to Supabase:', error);
            uploadedPhotoUrls.push(data.photoUrl);
        }
    }

    const updateData: any = {};
    if (data.manualType !== undefined) updateData.manualType = data.manualType;
    if (data.moduleName !== undefined) updateData.moduleName = data.moduleName;
    if (data.lessonName !== undefined) updateData.lessonName = data.lessonName;
    if (data.topic !== undefined) updateData.topic = data.topic;
    if (data.scripture !== undefined) updateData.scripture = data.scripture;
    if (data.devotionDate !== undefined) updateData.devotionDate = new Date(data.devotionDate);
    if (data.groupId !== undefined) updateData.groupId = data.groupId;
    if (data.clusterName !== undefined) updateData.clusterName = data.clusterName;
    if (data.mentorId !== undefined) updateData.mentorId = data.mentorId;
    if (data.mentorName !== undefined) updateData.mentorName = data.mentorName;
    if (data.mentorRole !== undefined) updateData.mentorRole = data.mentorRole;
    if (data.attendeeNames !== undefined) {
        updateData.attendeeNames = data.attendeeNames;
        updateData.attendeeCount = data.attendeeCount ?? data.attendeeNames.length;
    }
    if (data.reflectionNotes !== undefined) updateData.reflectionNotes = data.reflectionNotes;
    if (data.prayerRequests !== undefined) updateData.prayerRequests = data.prayerRequests;

    // Use uploaded URLs if available
    if (uploadedPhotoUrls.length > 0) {
        updateData.photoUrls = uploadedPhotoUrls;
        updateData.photoUrl = uploadedPhotoUrls[0];
    } else if (data.photoUrls !== undefined) {
        updateData.photoUrls = data.photoUrls;
        updateData.photoUrl = data.photoUrl || (data.photoUrls.length > 0 ? data.photoUrls[0] : null);
    } else if (data.photoUrl !== undefined) {
        updateData.photoUrl = data.photoUrl;
        updateData.photoUrls = data.photoUrl ? [data.photoUrl] : [];
    }

    if (data.status !== undefined) updateData.status = data.status;

    const record = await prisma.c2SDevotionRecord.update({
        where: { id },
        data: updateData,
        include: {
            group: true,
        },
    });
    revalidatePath('/c2s');
    return record;
}

export async function deleteC2SDevotionRecord(id: string) {
    try {
        await prisma.c2SDevotionRecord.deleteMany({ where: { id } });
    } catch (e) {
        console.warn("Could not delete devotion record from DB:", e);
    }
    revalidatePath('/c2s');
}


// --- Venue Elements ---

export async function getVenueElements() {
    return await prisma.venueElement.findMany({
        orderBy: {
            name: 'asc',
        },
    });
}

export async function createVenueElement(data: any) {
    const element = await prisma.venueElement.create({ data });
    revalidatePath('/settings/venue-elements');
    revalidatePath('/settings/rooms');
    return element;
}

export async function updateVenueElement(id: string, data: any) {
    const element = await prisma.venueElement.update({
        where: { id },
        data,
    });
    revalidatePath('/settings/venue-elements');
    revalidatePath('/settings/rooms');
    return element;
}

export async function deleteVenueElement(id: string) {
    await prisma.venueElement.delete({ where: { id } });
    revalidatePath('/settings/venue-elements');
    revalidatePath('/settings/rooms');
}

// --- Batch Ministry Update ---

export async function updateWorkersMinistries(
    ids: string[],
    majorMinistryId?: string,
    minorMinistryId?: string,
) {
    const data: any = {};
    if (majorMinistryId !== undefined) data.majorMinistryId = majorMinistryId;
    if (minorMinistryId !== undefined) data.minorMinistryId = minorMinistryId;

    await prisma.worker.updateMany({
        where: { id: { in: ids } },
        data,
    });
    revalidatePath('/workers');
}

// --- Settings ---

export async function getSetting(id: string) {
    const setting = await prisma.setting.findUnique({
        where: { id },
    });
    return (setting?.data as any) || null;
}

export async function updateSetting(id: string, data: any) {
    const setting = await prisma.setting.upsert({
        where: { id },
        update: { data },
        create: { id, data },
    });
    revalidatePath('/settings');
    return setting.data;
}

// --- Department Settings ---

export async function getDepartmentSettings() {
    return await prisma.departmentSetting.findMany({
        orderBy: {
            id: 'asc',
        },
    });
}

export async function getDepartmentSetting(id: string) {
    return await prisma.departmentSetting.findUnique({
        where: { id },
    });
}

export async function createDepartmentSetting(data: any) {
    return await prisma.departmentSetting.create({
        data,
    });
}

export async function updateDepartmentSetting(id: string, data: any) {
    return await prisma.departmentSetting.update({
        where: { id },
        data,
    });
}

export async function upsertDepartmentSetting(id: string, data: any) {
    return await prisma.departmentSetting.upsert({
        where: { id },
        update: data,
        create: { id, ...data },
    });
}

export async function deleteDepartmentSetting(id: string) {
    return await prisma.departmentSetting.delete({
        where: { id },
    });
}

// --- Transaction Logs ---

export async function createTransactionLog(data: any) {
    return await prisma.transactionLog.create({
        data,
    });
}

export async function recordAuthActivity(
    action: "User Login" | "User Logout",
    actor?: {
        userId?: string | null;
        email?: string | null;
        name?: string | null;
        details?: string | null;
    }
) {
    noStore();
    try {
        const cleanEmail = actor?.email?.trim().toLowerCase();
        let matchedWorker = null;

        if (cleanEmail) {
            matchedWorker = await prisma.worker.findFirst({
                where: { email: { equals: cleanEmail, mode: "insensitive" } },
                select: { id: true, firstName: true, lastName: true, email: true },
            });
        }

        if (!matchedWorker && actor?.userId) {
            matchedWorker = await prisma.worker.findUnique({
                where: { id: actor.userId },
                select: { id: true, firstName: true, lastName: true, email: true },
            });
        }

        const resolvedName = matchedWorker
            ? `${matchedWorker.firstName} ${matchedWorker.lastName}`.trim()
            : actor?.name || cleanEmail?.split("@")[0] || "User";

        const resolvedEmail = matchedWorker?.email || cleanEmail || null;
        const resolvedId = matchedWorker?.id || actor?.userId || null;
        const details = actor?.details || (action === "User Login" ? "User logged in successfully via Web" : "User signed out");

        return await prisma.transactionLog.create({
            data: {
                userId: resolvedId,
                userEmail: resolvedEmail,
                userName: resolvedName,
                action,
                module: "Auth",
                details,
                targetName: resolvedName,
            },
        });
    } catch (err) {
        console.warn("[recordAuthActivity] Failed to record auth activity:", err);
        return null;
    }
}

export async function getTransactionLogs(limit: number = 1000) {
    noStore();
    const [txLogs, invLogs, allWorkers] = await Promise.all([
        prisma.transactionLog.findMany({
            orderBy: { timestamp: "desc" },
            take: limit,
        }),
        prisma.inventoryLog.findMany({
            orderBy: { timestamp: "desc" },
            take: limit,
            include: {
                item: { select: { id: true, name: true, inventoryCode: true, unit: true } },
                worker: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        }),
        prisma.worker.findMany({
            select: { id: true, firstName: true, lastName: true, email: true },
        }),
    ]);

    const workerEmailMap = new Map<string, string>();
    const workerIdMap = new Map<string, string>();
    allWorkers.forEach((w) => {
        const fullName = `${w.firstName} ${w.lastName}`.trim();
        if (w.email) workerEmailMap.set(w.email.toLowerCase(), fullName);
        if (w.id) workerIdMap.set(w.id, fullName);
    });

    const mappedInvLogs = invLogs.map((inv) => {
        const workerName = inv.worker
            ? `${inv.worker.firstName} ${inv.worker.lastName}`.trim()
            : "User";
        const workerEmail = inv.worker?.email || null;
        const workerId = inv.worker?.id || null;
        const itemName = inv.item?.name || "Stock Item";
        const itemCode = inv.item?.inventoryCode ? ` (${inv.item.inventoryCode})` : "";
        const unit = inv.item?.unit || "pcs";

        let action = inv.type || "Stock Monitoring";
        if (action === "Stock In") action = "Stock In (+)";
        else if (action === "Stock Out") action = "Stock Out (-)";
        else if (action === "Adjustment") action = "Stock Adjustment";

        return {
            id: `inv-${inv.id}`,
            timestamp: inv.timestamp,
            userId: workerId,
            userName: workerName,
            userEmail: workerEmail,
            action: action,
            module: "Stock Monitoring",
            details: `${action} applied to "${itemName}"${itemCode}. Quantity: ${inv.quantity} ${unit}. New Balance: ${inv.balance} ${unit}. Notes: ${inv.notes || "None"}`,
            targetId: inv.itemId,
            targetName: itemName,
        };
    });

    // Exclude any redundant Stock Monitoring logs from txLogs so they never duplicate with mappedInvLogs
    // And resolve real worker name for any log with email/id
    const deduplicatedTxLogs = txLogs
        .filter((tx) => {
            const mod = (tx.module || "").toLowerCase();
            const act = (tx.action || "").toLowerCase();
            if (mod === "stock monitoring" && act.includes("stock")) {
                return false;
            }
            return true;
        })
        .map((tx) => {
            const emailKey = (tx.userEmail || "").toLowerCase();
            const idKey = tx.userId || "";
            const matchedName = workerEmailMap.get(emailKey) || workerIdMap.get(idKey);
            if (matchedName) {
                return {
                    ...tx,
                    userName: matchedName,
                };
            }
            return tx;
        });

    const combined = [...deduplicatedTxLogs, ...mappedInvLogs].sort((a, b) => {
        const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tB - tA;
    });

    return combined.slice(0, limit);
}

export async function getWorkerLogs(workerId: string) {
    return await prisma.transactionLog.findMany({
        where: {
            OR: [
                { targetId: workerId },
                { userId: workerId }
            ]
        },
        orderBy: {
            timestamp: "desc",
        },
        take: 50,
    });
}

export async function adminForcePasswordReset(workerId: string) {
    const supabaseAdmin = getSupabaseAdminClient();

    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) throw new Error("Worker not found");

    const defaultPassword = "StudioUser2026!";
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
        workerId,
        { password: defaultPassword }
    );

    if (error) {
        throw new Error(`Failed to forcibly reset password: ${error.message}`);
    }

    // Force sign out the user from all sessions so they have to login again
    await supabaseAdmin.auth.admin.signOut(workerId);

    return defaultPassword;
}

export async function adminSendPasswordResetEmail(workerId: string, appUrl: string) {
    const supabaseAdmin = getSupabaseAdminClient();

    // Get worker to find their email
    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker || !worker.email) {
        throw new Error("Worker does not have an email address set");
    }

    const cleanAppUrl = (
        (appUrl && !appUrl.includes('localhost') ? appUrl : null) ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
        (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost') ? process.env.NEXT_PUBLIC_APP_URL : null) ||
        'https://cogapp.vercel.app'
    ).replace(/\/$/, '');

    // Generate the recovery link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: worker.email,
        options: {
            redirectTo: `${cleanAppUrl}/auth/update-password`
        }
    });

    if (linkError || !linkData?.properties) {
        throw new Error(`Failed to generate reset link: ${linkError?.message || 'Unknown error'}`);
    }

    const resetLink = linkData.properties.hashed_token
        ? `${cleanAppUrl}/auth/update-password?token_hash=${linkData.properties.hashed_token}&type=recovery`
        : linkData.properties.action_link;

    const workerName = `${worker.firstName} ${worker.lastName}`.trim();
    await NotificationService.sendPasswordResetEmail(worker.email, resetLink, workerName);

    return true;
}

// ── Inquiries & Prayer Requests ──────────────────────────────────────────────

export async function createInquiry(data: {
    name: string;
    email: string;
    phone?: string | null;
    message: string;
    type?: string | null;
}) {
    const name = data.name?.trim();
    const email = data.email?.trim().toLowerCase();
    const phone = data.phone?.trim() || null;
    const message = data.message?.trim();
    const type = data.type?.trim() || 'General / Prayer Request';

    if (!name || !email || !message) {
        throw new Error('Name, email, and message are required.');
    }

    try {
        if ((prisma as any).inquiry) {
            const created = await (prisma as any).inquiry.create({
                data: {
                    name,
                    email,
                    phone,
                    message,
                    type,
                    status: 'Pending',
                },
            });
            try { revalidatePath('/inquiries'); } catch {}
            return { success: true, inquiry: created };
        }
    } catch (prismaErr) {
        console.warn('Prisma inquiry.create error, falling back to Supabase client:', prismaErr);
    }

    // Supabase Admin fallback
    try {
        const supabase = getSupabaseAdminClient();
        const { data: inserted, error } = await (supabase.from('inquiries') as any)
            .insert({
                name,
                email,
                phone,
                message,
                type,
                status: 'Pending',
            })
            .select('*')
            .single();

        if (error) throw error;
        try { revalidatePath('/inquiries'); } catch {}
        return { success: true, inquiry: inserted };
    } catch (supabaseErr) {
        console.error('Supabase create inquiry fallback error:', supabaseErr);
        throw supabaseErr;
    }
}

export async function getInquiries(options?: { excludeProblemReports?: boolean }) {
    const excludeReports = options?.excludeProblemReports ?? true;
    try {
        if ((prisma as any).inquiry) {
            const list = await (prisma as any).inquiry.findMany({
                where: excludeReports ? {
                    NOT: {
                        type: {
                            startsWith: 'Problem Report',
                        },
                    },
                } : undefined,
                orderBy: { createdAt: 'desc' },
            });
            return list;
        }
    } catch (err) {
        console.warn('Prisma inquiry.findMany error, falling back to Supabase client:', err);
    }

    try {
        const supabase = getSupabaseAdminClient();
        let query = (supabase.from('inquiries') as any).select('*');
        if (excludeReports) {
            query = query.not('type', 'ilike', 'Problem Report%');
        }
        const { data, error } = await query.order('createdAt', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (supabaseErr) {
        console.error('Supabase get inquiries fallback error:', supabaseErr);
        return [];
    }
}

export async function getProblemReports() {
    try {
        if ((prisma as any).inquiry) {
            const list = await (prisma as any).inquiry.findMany({
                where: {
                    type: {
                        startsWith: 'Problem Report',
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
            return list;
        }
    } catch (err) {
        console.warn('Prisma getProblemReports error, falling back to Supabase client:', err);
    }

    try {
        const supabase = getSupabaseAdminClient();
        const { data, error } = await (supabase.from('inquiries') as any)
            .select('*')
            .ilike('type', 'Problem Report%')
            .order('createdAt', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (supabaseErr) {
        console.error('Supabase get problem reports fallback error:', supabaseErr);
        return [];
    }
}

export async function updateInquiryStatus(
    id: string,
    status: string,
    notes?: string | null,
    responderName?: string | null
) {
    if (!id) throw new Error('Inquiry ID is required');

    const isResponded = status === 'Responded' || status === 'Resolved';
    const respondedAt = isResponded ? new Date().toISOString() : null;

    try {
        if ((prisma as any).inquiry) {
            const updated = await (prisma as any).inquiry.update({
                where: { id },
                data: {
                    status,
                    notes: notes !== undefined ? notes : undefined,
                    respondedAt: isResponded ? new Date() : undefined,
                    respondedBy: responderName || undefined,
                },
            });
            try { revalidatePath('/inquiries'); } catch {}
            return { success: true, inquiry: updated };
        }
    } catch (err) {
        console.warn('Prisma inquiry.update error, falling back to Supabase client:', err);
    }

    try {
        const supabase = getSupabaseAdminClient();
        const updatePayload: any = {
            status,
            updatedAt: new Date().toISOString(),
        };
        if (notes !== undefined) updatePayload.notes = notes;
        if (isResponded) {
            updatePayload.respondedAt = respondedAt;
            if (responderName) updatePayload.respondedBy = responderName;
        }

        const { data, error } = await (supabase.from('inquiries') as any)
            .update(updatePayload)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;
        try { revalidatePath('/inquiries'); } catch {}
        return { success: true, inquiry: data };
    } catch (supabaseErr) {
        console.error('Supabase update inquiry error:', supabaseErr);
        throw supabaseErr;
    }
}

export async function deleteInquiry(id: string) {
    if (!id) throw new Error('Inquiry ID is required');

    try {
        if ((prisma as any).inquiry) {
            await (prisma as any).inquiry.delete({
                where: { id },
            });
            try { revalidatePath('/inquiries'); } catch {}
            return { success: true };
        }
    } catch (err) {
        console.warn('Prisma inquiry.delete error, falling back to Supabase client:', err);
    }

    try {
        const supabase = getSupabaseAdminClient();
        const { error } = await (supabase.from('inquiries') as any).delete().eq('id', id);
        if (error) throw error;
        try { revalidatePath('/inquiries'); } catch {}
        return { success: true };
    } catch (supabaseErr) {
        console.error('Supabase delete inquiry error:', supabaseErr);
        throw supabaseErr;
    }
}

export async function archiveInquiry(id: string) {
    if (!id) throw new Error('Inquiry ID is required');
    return await updateInquiryStatus(id, 'Archived');
}

export async function unarchiveInquiry(id: string) {
    if (!id) throw new Error('Inquiry ID is required');
    return await updateInquiryStatus(id, 'Pending');
}

export async function submitProblemReport(data: {
    category: string;
    subject: string;
    description: string;
    contactEmail?: string | null;
    reporterName?: string | null;
    workerId?: string | null;
}) {
    const categoryKey = data.category?.trim() || 'general';
    const subject = data.subject?.trim();
    const description = data.description?.trim();
    const contactEmail = data.contactEmail?.trim() || null;
    const reporterName = data.reporterName?.trim() || 'Staff / Worker';

    if (!subject || !description) {
        throw new Error('Subject and description are required.');
    }

    const categoryLabels: Record<string, string> = {
        general: 'General System',
        reservations: 'Room Reservations',
        meals: 'Meal Stubs',
        attendance: 'Attendance Log',
        account: 'Account / Access',
    };
    const categoryLabel = categoryLabels[categoryKey] || categoryKey || 'General System';
    const type = `Problem Report: ${categoryLabel}`;
    const formattedMessage = `[Subject: ${subject}]\n\n${description}`;

    let createdRecord: any = null;

    // 1. Save to Database (Prisma Inquiry model, fallback to Supabase Admin)
    try {
        if ((prisma as any).inquiry) {
            createdRecord = await (prisma as any).inquiry.create({
                data: {
                    name: reporterName,
                    email: contactEmail || 'no-reply@cogdasma.com',
                    phone: null,
                    message: formattedMessage,
                    type,
                    status: 'Pending',
                },
            });
        }
    } catch (prismaErr) {
        console.warn('Prisma submitProblemReport error, trying Supabase fallback:', prismaErr);
    }

    if (!createdRecord) {
        try {
            const supabase = getSupabaseAdminClient();
            const { data: inserted, error } = await (supabase.from('inquiries') as any)
                .insert({
                    name: reporterName,
                    email: contactEmail || 'no-reply@cogdasma.com',
                    phone: null,
                    message: formattedMessage,
                    type,
                    status: 'Pending',
                })
                .select('*')
                .single();

            if (error) {
                console.error('Supabase submitProblemReport error:', error);
                throw error;
            }
            createdRecord = inserted;
        } catch (supabaseErr) {
            console.error('Supabase fallback failed in submitProblemReport:', supabaseErr);
            throw supabaseErr;
        }
    }

    try { revalidatePath('/my-settings'); } catch {}

    // 2. Dispatch Email Notifications asynchronously (non-blocking so report submission is instantaneous)
    const itAdminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER || 'churchofgoddasmamain@gmail.com';
    const ticketRef = createdRecord?.id ? `TICKET-${String(createdRecord.id).slice(0, 6).toUpperCase()}` : 'NEW-TICKET';

    void (async () => {
        // A. Send notification to IT Admin / Church Email
        try {
            await EmailService.sendEmail({
                to: itAdminEmail,
                subject: `[IT Helpdesk] ${categoryLabel}: ${subject} (${ticketRef})`,
                html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                        <div style="background: linear-gradient(135deg, #1e3a8a, #2563eb); padding: 20px; border-radius: 12px; color: #ffffff; margin-bottom: 24px;">
                            <span style="background-color: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">New IT Problem Ticket</span>
                            <h2 style="margin: 10px 0 4px 0; font-size: 20px; font-weight: bold; color: #ffffff;">${subject}</h2>
                            <p style="margin: 0; font-size: 13px; opacity: 0.9;">Ticket Ref: <strong>${ticketRef}</strong> &bull; Category: <strong>${categoryLabel}</strong></p>
                        </div>

                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; width: 140px;">Reporter:</td>
                                <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${reporterName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b;">Contact Email:</td>
                                <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${contactEmail || 'Not provided'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b;">Category:</td>
                                <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${categoryLabel}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b;">Submitted At:</td>
                                <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })}</td>
                            </tr>
                        </table>

                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                            <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Detailed Explanation</h4>
                            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${description}</p>
                        </div>

                        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
                            Church of God Dasmariñas &bull; IT Helpdesk Workforce
                        </p>
                    </div>
                `,
                text: `New Problem Ticket [${ticketRef}]: ${subject}\nCategory: ${categoryLabel}\nReporter: ${reporterName} (${contactEmail || 'No email'})\n\nExplanation:\n${description}`,
            });
        } catch (emailErr) {
            console.error('[submitProblemReport] Failed to send IT admin notification email:', emailErr);
        }

        // B. Send confirmation receipt to reporter if contactEmail provided
        if (contactEmail && contactEmail.includes('@')) {
            try {
                await EmailService.sendEmail({
                    to: contactEmail,
                    subject: `[COG IT Support] Problem Report Received: ${subject} (${ticketRef})`,
                    html: `
                        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                            <div style="padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; margin-bottom: 20px;">
                                <h2 style="margin: 0; color: #1e3a8a; font-size: 20px;">Support Ticket Received</h2>
                                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">Ticket Reference: <strong>${ticketRef}</strong></p>
                            </div>
                            <p style="font-size: 14px; color: #334155; line-height: 1.6;">
                                Hello ${reporterName},<br/><br/>
                                Thank you for reaching out to IT support. We have received your problem report regarding <strong>${categoryLabel}</strong>.
                            </p>
                            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; margin: 20px 0;">
                                <h4 style="margin: 0 0 6px 0; font-size: 13px; color: #1e40af; font-weight: bold;">Support SLA Guarantee</h4>
                                <p style="margin: 0; font-size: 13px; color: #1e3a8a; line-height: 1.5;">
                                    Your ticket is automatically triaged and assigned to our IT administration workforce. Standard response time is within <strong>24 to 48 hours</strong> on operating days.
                                </p>
                            </div>
                            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 20px;">
                                <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase;">Your Submitted Issue:</p>
                                <p style="margin: 6px 0 4px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${subject}</p>
                                <p style="margin: 0; font-size: 13px; color: #475569; white-space: pre-wrap;">${description}</p>
                            </div>
                            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
                                Church of God Dasmariñas Management System &bull; IT Support
                            </p>
                        </div>
                    `,
                    text: `Hello ${reporterName},\n\nWe have received your problem report [${ticketRef}]: ${subject}.\nOur IT team typically responds within 24-48 hours.\n\nThank you,\nChurch of God Dasmariñas IT Support`,
                });
            } catch (receiptErr) {
                console.error('[submitProblemReport] Failed to send user confirmation email:', receiptErr);
            }
        }
    })();

    return {
        success: true,
        ticketRef,
        inquiry: createdRecord,
    };
}
