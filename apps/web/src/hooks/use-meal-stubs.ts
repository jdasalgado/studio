'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMealStubs, createMealStub, updateMealStub, deleteMealStub } from '@/actions/db';
import { useUserRole } from '@/hooks/use-user-role';

export function useMealStubs(filters: {
    workerId?: string;
    dateFrom?: Date | string;
    dateTo?: Date | string;
    ministryIds?: string[];
    actorId?: string;
    includeSelf?: boolean;
    enabled?: boolean;
} = {}) {
    const { workerProfile, myMinistryIds, isSuperAdmin } = useUserRole();
    const queryClient = useQueryClient();
    const { enabled = true, ...queryFilters } = filters;

    const actorId = filters.actorId || workerProfile?.id;
    let effectiveMinistryIds = filters.ministryIds;
    if (!isSuperAdmin) {
        if (filters.workerId && (filters.workerId === workerProfile?.id || filters.workerId === workerProfile?.workerId || filters.workerId === actorId)) {
            // When querying their own stubs, do not restrict by ministry
            effectiveMinistryIds = undefined;
        } else if (!myMinistryIds || myMinistryIds.length === 0) {
            effectiveMinistryIds = filters.includeSelf ? [] : ['__NONE__'];
        } else if (effectiveMinistryIds && effectiveMinistryIds.length > 0) {
            effectiveMinistryIds = effectiveMinistryIds.filter(id => myMinistryIds.includes(id));
            if (effectiveMinistryIds.length === 0 && !filters.includeSelf) effectiveMinistryIds = ['__NONE__'];
        } else {
            effectiveMinistryIds = myMinistryIds;
        }
    }

    const { data, isPending, isFetching, error } = useQuery({
        queryKey: ['meal-stubs', { ...queryFilters, actorId, ministryIds: effectiveMinistryIds, includeSelf: filters.includeSelf }],
        queryFn: () => getMealStubs({ ...queryFilters, actorId, ministryIds: effectiveMinistryIds, includeSelf: filters.includeSelf }),
        enabled: enabled,
        staleTime: 30_000,
        placeholderData: (prev) => prev,
    });

    // When enabled=false or when data is already available or not actively fetching, don't show loader
    const isLoading = enabled && isPending && isFetching && !data;

    const createMutation = useMutation({
        mutationFn: createMealStub,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meal-stubs'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateMealStub(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meal-stubs'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteMealStub,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meal-stubs'] });
        },
    });

    return {
        mealStubs: data || [],
        isLoading,
        error,
        createMealStub: createMutation.mutateAsync,
        updateMealStub: updateMutation.mutateAsync,
        deleteMealStub: deleteMutation.mutateAsync,
    };
}
