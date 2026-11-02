'use client';
import { Room, Area, Branch } from '@studio/types';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getRooms, createRoom, updateRoom, deleteRoom, createRooms,
    getAreas, createArea, updateArea, deleteArea, createAreas,
    getBranches, createBranch, updateBranch, deleteBranch
} from '@/actions/db';

export function useRooms() {
    const queryClient = useQueryClient();

    const roomsQuery = useQuery({
        queryKey: ['rooms'],
        queryFn: () => getRooms(),
        staleTime: 5 * 60_000,
    });

    const areasQuery = useQuery({
        queryKey: ['areas'],
        queryFn: () => getAreas(),
        staleTime: 5 * 60_000,
    });

    const branchesQuery = useQuery({
        queryKey: ['branches'],
        queryFn: () => getBranches(),
        staleTime: 5 * 60_000,
    });

    const createMutation = useMutation({
        mutationFn: createRoom,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateRoom(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteRoom,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
        },
    });

    const createRoomsMutation = useMutation({
        mutationFn: createRooms,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
        },
    });

    const createAreaMutation = useMutation({
        mutationFn: createArea,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['areas'] });
        },
    });

    const updateAreaMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateArea(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['areas'] });
        },
    });

    const deleteAreaMutation = useMutation({
        mutationFn: deleteArea,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['areas'] });
        },
    });

    const createAreasMutation = useMutation({
        mutationFn: createAreas,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['areas'] });
        },
    });

    const createBranchMutation = useMutation({
        mutationFn: createBranch,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
        },
    });

    const updateBranchMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateBranch(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
        },
    });

    const deleteBranchMutation = useMutation({
        mutationFn: deleteBranch,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
        },
    });

    return {
        rooms: (roomsQuery.data?.map(r => ({
            ...r,
            weight: r.weight ?? undefined,
            status: (r as any).status ?? 'Active',
            numChairs: (r as any).numChairs ?? null,
            numTables: (r as any).numTables ?? null,
        })) as Room[]) || [],
        areas: (areasQuery.data?.map(a => ({
            ...a,
            areaId: (a as any).areaId ?? undefined
        })) as Area[]) || [],
        branches: (branchesQuery.data as Branch[]) || [],
        isLoading: roomsQuery.isLoading || areasQuery.isLoading || branchesQuery.isLoading,
        error: roomsQuery.error || areasQuery.error || branchesQuery.error,
        createRoom: createMutation.mutateAsync,
        updateRoom: updateMutation.mutateAsync,
        deleteRoom: deleteMutation.mutateAsync,
        createRooms: createRoomsMutation.mutateAsync,
        createArea: createAreaMutation.mutateAsync,
        updateArea: updateAreaMutation.mutateAsync,
        deleteArea: deleteAreaMutation.mutateAsync,
        createAreas: createAreasMutation.mutateAsync,
        createBranch: createBranchMutation.mutateAsync,
        updateBranch: updateBranchMutation.mutateAsync,
        deleteBranch: deleteBranchMutation.mutateAsync,
    };
}
