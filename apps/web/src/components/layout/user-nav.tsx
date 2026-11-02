"use client";

import React, { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@studio/ui";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@studio/database";
import { useAuthStore } from "@studio/store";
import { useUserRole } from "@/hooks/use-user-role";
import { useImpersonation } from "@/hooks/use-impersonation";
import { useMinistries } from "@/hooks/use-ministries";
import { requestPasswordReset } from "@/actions/auth";
import { recordAuthActivity } from "@/actions/db";
import { LogOut, ChevronDown, QrCode, KeyRound, User, Loader2 } from "lucide-react";

export function UserNav() {
  const { user } = useAuthStore();
  const { workerProfile, allRoles, isSuperAdmin, isMinistryHead } = useUserRole();
  const { toast } = useToast();
  const { impersonatedWorkerId, stopImpersonation } = useImpersonation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { allMinistries } = useMinistries();

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      if (impersonatedWorkerId) {
        stopImpersonation();
        return;
      }
      if (typeof window !== "undefined" && user?.id) {
        sessionStorage.removeItem(`cog_session_login_${user.id}`);
      }
      try {
        await recordAuthActivity("User Logout", {
          userId: workerProfile?.id || user?.id || null,
          email: user?.email || workerProfile?.email || null,
          name: displayName,
          details: "User signed out manually",
        });
      } catch (logErr) {
        console.warn('Failed to record logout activity:', logErr);
      }
      await supabase.auth.signOut();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.message || "Failed to log out. Please try again.",
      });
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    try {
      const res = await requestPasswordReset(user.email, window.location.origin);
      if (!res.success) {
        toast({
          variant: "destructive",
          title: res.isDeactivated ? "Account Deactivated" : "Error",
          description: res.error || "Failed to send password reset email.",
        });
        return;
      }
      toast({
        title: "Password Reset Email Sent",
        description: `Instructions sent to ${res.email}. Please check your inbox.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send password reset email.",
      });
    }
  };

  const initial =
    workerProfile?.firstName?.[0]?.toUpperCase() ||
    user?.displayName?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "S";

  const displayName =
    workerProfile?.firstName && workerProfile?.lastName
      ? `${workerProfile.firstName} ${workerProfile.lastName}`
      : workerProfile?.firstName || user?.displayName || user?.email?.split("@")[0] || "System Admin";

  // Resolve role title
  const roleName = isSuperAdmin
    ? "Administrator"
    : allRoles?.find((r: any) => r.id === workerProfile?.roleId)?.name ||
      (workerProfile as any)?.role ||
      "Administrator";

  const userMinistry = allMinistries?.find(
    (m: any) =>
      m.id === workerProfile?.majorMinistryId ||
      m.headId === workerProfile?.id ||
      m.approverId === workerProfile?.id
  );
  const headDept = userMinistry?.department || "Outreach";

  const rawRole = (allRoles?.find((r: any) => r.id === workerProfile?.roleId)?.name || "").toLowerCase();
  const isHead = isMinistryHead || rawRole.includes("head") || Boolean(allMinistries && workerProfile?.id && allMinistries.some((m: any) => m.headId === workerProfile.id));

  let indicatorBadge = "";
  if (isSuperAdmin) {
    indicatorBadge = "Super Admin • All Departments";
  } else if (isHead) {
    indicatorBadge = `Ministry Head • ${headDept}`;
  } else {
    const clusterLabel = userMinistry?.name || (workerProfile as any)?.department || "Outreach";
    indicatorBadge = `Mentor • ${clusterLabel}`;
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 p-1 sm:px-2 mr-1 sm:mr-2 rounded-lg hover:bg-muted/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer select-none"
          >
            {/* Avatar circle */}
            <div className="h-8 w-8 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0 ring-2 ring-indigo-300/50">
              {initial}
            </div>

            {/* User name - font-medium and nudged down slightly */}
            <span className="hidden sm:inline-block text-xs sm:text-[13px] font-medium text-foreground leading-none ml-1 translate-y-[1px]">
              {displayName}
            </span>

            {/* Down Chevron - closer to text */}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 translate-y-[1px]" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-40 mt-1.5 shadow-lg rounded-xl p-1" align="end" forceMount>
          {impersonatedWorkerId && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={stopImpersonation} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Exit Impersonation</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}



          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setShowLogoutConfirm(true);
            }}
            className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="w-[calc(100vw-2.5rem)] sm:max-w-[420px] p-5 sm:p-6 rounded-2xl border border-border/80 shadow-2xl gap-5">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-sm">
              <LogOut className="h-6 w-6 stroke-[2.2] translate-x-[1px]" />
            </div>
            <div className="flex-1 space-y-1 pt-0.5">
              <AlertDialogTitle className="text-lg font-bold text-foreground tracking-tight">
                Log out of your account?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
                You will be signed out of your current session on this device.
              </AlertDialogDescription>
            </div>
          </div>

          {/* Current Account Card Preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 dark:bg-muted/30 border border-border/60">
            <div className="h-9 w-9 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0 ring-2 ring-indigo-300/40">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{indicatorBadge || roleName}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-2 pt-1">
            <AlertDialogCancel
              disabled={isLoggingOut}
              className="rounded-xl border-border/80 hover:bg-muted/80 font-medium h-9 text-xs sm:text-sm"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleLogout();
              }}
              disabled={isLoggingOut}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] transition-all text-white font-medium shadow-sm shadow-rose-600/20 h-9 px-4 text-xs sm:text-sm inline-flex items-center justify-center gap-2"
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Logging out...</span>
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  <span>Log out</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
