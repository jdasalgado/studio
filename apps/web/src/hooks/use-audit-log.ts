import { useSupabaseUser } from '@studio/database';
import { useUserRole } from './use-user-role';
import { useAuthStore } from '@studio/store';
import { useCallback } from 'react';
import { createTransactionLog } from '@/actions/db';
import { useQueryClient } from '@tanstack/react-query';

export function useAuditLog() {
    const { user: supabaseUser } = useSupabaseUser();
    const { workerProfile } = useUserRole();
    const { user: authStoreUser } = useAuthStore();
    const queryClient = useQueryClient();

    const logAction = useCallback(async (
        action: string,
        module: string,
        details?: string,
        targetId?: string,
        targetName?: string
    ) => {
        const currentUser = supabaseUser || authStoreUser;
        if (!currentUser && !workerProfile) return;

        const resolvedId = workerProfile?.id || currentUser?.id || null;
        const resolvedEmail = currentUser?.email || workerProfile?.email || null;
        const resolvedName = workerProfile?.firstName 
            ? `${workerProfile.firstName} ${workerProfile.lastName}`.trim()
            : (currentUser as any)?.displayName || currentUser?.email?.split('@')[0] || 'User';

        try {
            await createTransactionLog({
                userId: resolvedId,
                userEmail: resolvedEmail,
                userName: resolvedName,
                action,
                module,
                details: details || '',
                targetId: targetId || null,
                targetName: targetName || null,
            });
            queryClient.invalidateQueries({ queryKey: ['transaction-logs'] });
        } catch (e) {
            console.error('Failed to write audit log', e);
        }
    }, [supabaseUser, authStoreUser, workerProfile, queryClient]);

    return { logAction };
}
