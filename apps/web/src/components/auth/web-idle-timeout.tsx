'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@studio/database';
import { useAuthStore } from '@studio/store';
import { isNativeMobileApp } from '@/lib/native-app';
import { recordAuthActivity } from '@/actions/db';

// 10 minutes of inactivity in milliseconds
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const STORAGE_KEY = 'cog_last_activity_time';
const THROTTLE_MS = 2000; // Throttle activity updates to once every 2 seconds

/**
 * WebIdleTimeout:
 * Automatically logs out the user after 10 minutes of inactivity on the WEB platform.
 * Bypassed completely when running as a native mobile APK (Capacitor), or when on auth/recovery pages.
 */
export function WebIdleTimeout() {
  const { user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const lastWriteRef = useRef<number>(0);
  const isLoggingOutRef = useRef<boolean>(false);

  useEffect(() => {
    // 0. Do NOT auto-logout on auth, password recovery, or login routes
    if (pathname?.startsWith('/auth') || pathname === '/login' || pathname === '/signup') {
      return;
    }

    // 1. Only track if user is authenticated
    if (!user) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
      return;
    }

    // 2. Do NOT auto-logout on native mobile APK (persistent one-time login)
    if (isNativeMobileApp()) {
      return;
    }

    isLoggingOutRef.current = false;

    // Set initial activity timestamp if not yet set
    const currentStored = localStorage.getItem(STORAGE_KEY);
    if (!currentStored) {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }

    const performLogout = async () => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;

      try {
        localStorage.removeItem(STORAGE_KEY);
        if (typeof window !== 'undefined' && user?.id) {
          sessionStorage.removeItem(`cog_session_login_${user.id}`);
        }
        try {
          await recordAuthActivity("User Logout", {
            userId: user?.id || null,
            email: user?.email || null,
            name: user?.displayName || user?.email || 'User',
            details: "User automatically signed out due to 10 minutes of inactivity",
          });
        } catch (logErr) {
          console.warn('Failed to record idle timeout logout:', logErr);
        }
        await supabase.auth.signOut();
        useAuthStore.getState()._setAuthState(null, false, null);
      } catch (err) {
        console.error('Auto logout error:', err);
      } finally {
        router.push('/login?reason=idle');
      }
    };

    const checkIdle = () => {
      if (isLoggingOutRef.current) return;
      const lastActiveStr = localStorage.getItem(STORAGE_KEY);
      if (!lastActiveStr) return;

      const lastActive = parseInt(lastActiveStr, 10);
      if (isNaN(lastActive)) return;

      const elapsed = Date.now() - lastActive;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        performLogout();
      }
    };

    const handleUserActivity = () => {
      if (isLoggingOutRef.current) return;
      const now = Date.now();
      // Throttle localStorage writes to prevent unnecessary disk/storage thrashing
      if (now - lastWriteRef.current > THROTTLE_MS) {
        lastWriteRef.current = now;
        localStorage.setItem(STORAGE_KEY, now.toString());
      }
    };

    // Check periodically every 10 seconds
    const intervalId = setInterval(checkIdle, 10000);

    // Also check immediately when window gains focus or tab becomes active
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkIdle();
      }
    };

    // Cross-tab sync: if another tab logged out, or if user was active in another tab
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        if (!e.newValue) {
          // Cleared by another tab logout
          return;
        }
        const lastActive = parseInt(e.newValue, 10);
        if (!isNaN(lastActive) && Date.now() - lastActive >= IDLE_TIMEOUT_MS) {
          performLogout();
        }
      }
    };

    // Activity event listeners
    const events: Array<keyof WindowEventMap> = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    events.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    window.addEventListener('focus', checkIdle);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorageChange);

    // Initial check on mount
    checkIdle();

    return () => {
      clearInterval(intervalId);
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      window.removeEventListener('focus', checkIdle);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user, router]);

  return null;
}
