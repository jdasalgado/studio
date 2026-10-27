'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    getWorkers, 
    createWorker, 
    updateWorker, 
    deleteWorker, 
    deleteWorkers,
    getPaginatedWorkers,
    getWorkerStats,
    createWorkerWithAuth
} from '@/actions/db';

import { useUserRole } from '@/hooks/use-user-role';

export function useWorkers(params: {
    page?: number;
    limit?: number;
    search?: string;
    searchMode?: 'workerId' | 'name';
    ministryIds?: string[];
    sortField?: string;
    sortDir?: 'asc' | 'desc';
    actorId?: string;
    enabled?: boolean;
    unrestricted?: boolean;
} = {}) {
    const { workerProfile, myMinistryIds, isSuperAdmin } = useUserRole();
    const queryClient = useQueryClient();
    const { enabled = true, unrestricted = false, ...queryParams } = params;

    const actorId = unrestricted ? undefined : (params.actorId || workerProfile?.id);
    let effectiveMinistryIds = params.ministryIds;
    if (!isSuperAdmin && !unrestricted) {
        if (!myMinistryIds || myMinistryIds.length === 0) {
            effectiveMinistryIds = ['__NONE__'];
        } else if (effectiveMinistryIds && effectiveMinistryIds.length > 0) {
            effectiveMinistryIds = effectiveMinistryIds.filter(id => myMinistryIds.includes(id));
            if (effectiveMinistryIds.length === 0) effectiveMinistryIds = ['__NONE__'];
        } else {
            effectiveMinistryIds = myMinistryIds;
        }
    }

    const { data, isLoading, error } = useQuery({
        queryKey: ['workers', 'paginated', { ...queryParams, actorId, ministryIds: effectiveMinistryIds }],
        queryFn: () => getPaginatedWorkers(queryParams.page, queryParams.limit, {
            search: queryParams.search,
            searchMode: queryParams.searchMode,
            ministryIds: effectiveMinistryIds,
            sortField: queryParams.sortField,
            sortDir: queryParams.sortDir,
            actorId,
        }),
        enabled: enabled,
        staleTime: 30_000,
        placeholderData: (prev) => prev,
    });

    const createMutation = useMutation({
        mutationFn: createWorker,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workers'] });
            queryClient.invalidateQueries({ queryKey: ['worker-stats'] });
        },
    });

    const createWithAuthMutation = useMutation({
        mutationFn: async ({ data, roleIds, assignedBy }: { data: any; roleIds: string[]; assignedBy?: string }) => {
            const res = await createWorkerWithAuth(data, roleIds, assignedBy);
            if (res && (res.success === false || res.error)) {
                throw new Error(res.error || 'Failed to create worker');
            }
            return res;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workers'] });
            queryClient.invalidateQueries({ queryKey: ['worker-stats'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateWorker(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workers'] });
            queryClient.invalidateQueries({ queryKey: ['worker-stats'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteWorker,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workers'] });
            queryClient.invalidateQueries({ queryKey: ['worker-stats'] });
        },
    });

    const deleteBatchMutation = useMutation({
        mutationFn: deleteWorkers,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workers'] });
            queryClient.invalidateQueries({ queryKey: ['worker-stats'] });
        },
    });

    return {
        workers: data?.workers || [],
        pagination: {
            total: data?.total || 0,
            page: data?.page || 1,
            limit: data?.limit || 50,
            totalPages: data?.totalPages || 0,
        },
        isLoading,
        error,
        createWorker: createMutation.mutateAsync,
        createWorkerWithAuth: createWithAuthMutation.mutateAsync,
        updateWorker: updateMutation.mutateAsync,
        deleteWorker: deleteMutation.mutateAsync,
        deleteWorkers: deleteBatchMutation.mutateAsync,
    };
}

export function useWorkerStats(ministryIds?: string[], actorId?: string) {
    const { workerProfile, myMinistryIds, isSuperAdmin } = useUserRole();
    const effectiveActorId = actorId || workerProfile?.id;
    let effectiveMinistryIds = ministryIds;
    if (!isSuperAdmin) {
        if (!myMinistryIds || myMinistryIds.length === 0) {
            effectiveMinistryIds = ['__NONE__'];
        } else if (effectiveMinistryIds && effectiveMinistryIds.length > 0) {
            effectiveMinistryIds = effectiveMinistryIds.filter(id => myMinistryIds.includes(id));
            if (effectiveMinistryIds.length === 0) effectiveMinistryIds = ['__NONE__'];
        } else {
            effectiveMinistryIds = myMinistryIds;
        }
    }

    return useQuery({
        queryKey: ['worker-stats', effectiveMinistryIds, effectiveActorId],
        queryFn: () => getWorkerStats(effectiveMinistryIds, effectiveActorId),
        staleTime: 60_000,
    });
}
