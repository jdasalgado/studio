'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@studio/database';

/**
 * Global Realtime Syncer for all incoming requests and room bookings.
 * Subscribes to Supabase Realtime Postgres CDC changes so the UI
 * updates immediately without requiring a manual page refresh.
 */
export function RealtimeRequestsSync() {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!isSupabaseConfigured || typeof window === 'undefined') return;

        const channelName = `realtime_sync_${Date.now()}`;
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'ApprovalRequest' },
                (payload) => {
                    console.log('[Realtime] ApprovalRequest CDC event:', payload.eventType);
                    queryClient.invalidateQueries({ queryKey: ['approvals'] });
                    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                    queryClient.invalidateQueries({ queryKey: ['bookings'] });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'Booking' },
                (payload) => {
                    console.log('[Realtime] Booking CDC event:', payload.eventType);
                    queryClient.invalidateQueries({ queryKey: ['bookings'] });
                    queryClient.invalidateQueries({ queryKey: ['room-bookings'] });
                    queryClient.invalidateQueries({ queryKey: ['reservations'] });
                    queryClient.invalidateQueries({ queryKey: ['approvals'] });
                    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'VenueBooking' },
                (payload) => {
                    console.log('[Realtime] VenueBooking CDC event:', payload.eventType);
                    queryClient.invalidateQueries({ queryKey: ['venue-bookings'] });
                    queryClient.invalidateQueries({ queryKey: ['approvals'] });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'TransactionLog' },
                (payload) => {
                    console.log('[Realtime] TransactionLog CDC event:', payload.eventType);
                    queryClient.invalidateQueries({ queryKey: ['transaction-logs'] });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'InventoryLog' },
                (payload) => {
                    console.log('[Realtime] InventoryLog CDC event:', payload.eventType);
                    queryClient.invalidateQueries({ queryKey: ['inventory'] });
                    queryClient.invalidateQueries({ queryKey: ['transaction-logs'] });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'InventoryItem' },
                (payload) => {
                    console.log('[Realtime] InventoryItem CDC event:', payload.eventType);
                    queryClient.invalidateQueries({ queryKey: ['inventory'] });
                    queryClient.invalidateQueries({ queryKey: ['transaction-logs'] });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'InventoryBorrowing' },
                (payload) => {
                    console.log('[Realtime] InventoryBorrowing CDC event:', payload.eventType);
                    queryClient.invalidateQueries({ queryKey: ['inventory'] });
                    queryClient.invalidateQueries({ queryKey: ['transaction-logs'] });
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] Subscribed to real-time requests CDC channel.');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return null;
}
