'use client';

import { ReactNode, useEffect } from "react";
import { SupabaseProvider, useSupabase } from "@studio/database";
import { UserRoleSyncerSQL } from "@/store/user-role-syncer-sql";
import { useAuthStore } from "@studio/store";
import { WebIdleTimeout } from "@/components/auth/web-idle-timeout";
import { RealtimeRequestsSync } from "@/components/realtime/realtime-requests-sync";
import { recordAuthActivity } from "@/actions/db";

// Bridge Supabase auth state into the Zustand auth store.
// Normalizes Supabase User (id) → uid so existing code using user?.uid keeps working.
function SupabaseAuthBridge() {
    const { user, isLoading } = useSupabase();

    useEffect(() => {
        const normalized = user ? { ...user, uid: user.id } : null;
        useAuthStore.getState()._setAuthState(normalized, isLoading, null);
    }, [user, isLoading]);

    return null;
}

// Automatically records "User Login" in activity logs once per browser session/entry.
// Ensures that workers and admins accessing the web app (including persistent sessions)
// are accurately recorded in the audit trail.
function GlobalSessionAuthLogger() {
    const { user, isLoading } = useSupabase();

    useEffect(() => {
        if (isLoading || !user || !user.id) return;

        const sessionKey = `cog_session_login_${user.id}`;
        if (typeof window !== "undefined") {
            const alreadyLogged = sessionStorage.getItem(sessionKey);
            if (!alreadyLogged) {
                sessionStorage.setItem(sessionKey, Date.now().toString());
                recordAuthActivity("User Login", {
                    userId: user.id,
                    email: user.email,
                    details: "User active session connected via Web",
                }).catch((err) => {
                    console.warn("[GlobalSessionAuthLogger] login record failed:", err);
                });
            }
        }
    }, [user, isLoading]);

    return null;
}

export function AuthSync({ children }: { children: ReactNode }) {
    return (
        <SupabaseProvider>
            <SupabaseAuthBridge />
            <GlobalSessionAuthLogger />
            <UserRoleSyncerSQL />
            <WebIdleTimeout />
            <RealtimeRequestsSync />
            {children}
        </SupabaseProvider>
    );
}
