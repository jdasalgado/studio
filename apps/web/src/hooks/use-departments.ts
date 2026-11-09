import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDepartmentSettings, createDepartmentSetting, updateDepartmentSetting, deleteDepartmentSetting, upsertDepartmentSetting } from '@/actions/db';

export function useDepartments() {
    const queryClient = useQueryClient();

    const { data, isLoading, error } = useQuery({
        queryKey: ['departments'],
        queryFn: () => getDepartmentSettings(),
        staleTime: 5 * 60_000,
    });

    const createMutation = useMutation({
        mutationFn: createDepartmentSetting,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateDepartmentSetting(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
        },
    });

    const upsertMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => upsertDepartmentSetting(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteDepartmentSetting,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
        },
    });

    return {
        departments: data || [],
        isLoading,
        error,
        createDepartment: createMutation.mutateAsync,
        updateDepartment: updateMutation.mutateAsync,
        upsertDepartment: upsertMutation.mutateAsync,
        deleteDepartment: deleteMutation.mutateAsync,
    };
}
