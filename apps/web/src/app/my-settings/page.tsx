"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Button,
  Input,
  Label,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@studio/ui";
import {
  Smartphone,
  LogOut,
  KeyRound,
  Shield,
  HelpCircle,
  AlertCircle,
  Mail,
  Info,
  ShieldCheck,
  Send,
  LoaderCircle,
  ChevronDown,
  CheckCircle2,
  Lock,
  ExternalLink,
  Clock,
  Sparkles,
  Laptop,
  Check,
  ArrowRight,
  Type,
  SunMoon,
  Inbox,
  Search,
  FileText,
  RefreshCw,
  Filter,
  User,
  Tag,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useAuthStore, usePermissionsStore } from "@studio/store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@studio/database";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { cleanName, isValidName, MAX_LENGTHS } from "@/lib/validation";
import { FontSizeSlider } from "@/components/settings/font-size-slider";
import { ThemeToggle } from "@/components/settings/theme-toggle";
import { requestPasswordReset } from "@/actions/auth";
import { useUserRole } from "@/hooks/use-user-role";
import {
  updateWorkerProfileSettings,
  getEmailChangeStatus,
  recordAuthActivity,
  submitProblemReport,
  getProblemReports,
  updateInquiryStatus,
} from "@/actions/db";


function parseDateSafe(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val?.toDate === "function") return val.toDate();
  if (typeof val?.seconds === "number") return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function extractSubjectAndBody(msg: string): { subject: string; body: string } {
  if (!msg) return { subject: "Problem Report", body: "" };
  if (msg.startsWith("[Subject:")) {
    const endIdx = msg.indexOf("]");
    if (endIdx !== -1) {
      const subject = msg.slice(9, endIdx).trim();
      const body = msg.slice(endIdx + 1).trim();
      return { subject: subject || "Problem Report", body: body };
    }
  }
  return { subject: msg.slice(0, 70), body: msg };
}

function getGmailComposeUrl(email: string, subject?: string, body?: string): string {
  const params = new URLSearchParams();
  params.set("view", "cm");
  params.set("fs", "1");
  if (email) params.set("to", email.trim());
  if (subject) params.set("su", subject.trim());
  if (body) params.set("body", body.trim());
  return `https://mail.google.com/mail/?${params.toString()}`;
}

type SettingTab = "profile" | "appearance" | "password" | "security" | "support" | "report";

function MySettingsContent() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { workerProfile, isSuperAdmin, canManageWorkers, canManageRoles } = useUserRole();
  const isAdmin = isSuperAdmin || canManageWorkers || canManageRoles;
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const rawTab = searchParams.get("tab");
  const validTabs: SettingTab[] = isAdmin
    ? ["profile", "appearance", "password", "security", "report"]
    : ["profile", "appearance", "password", "security", "support", "report"];

  const activeTab: SettingTab =
    rawTab && validTabs.includes(rawTab as SettingTab)
      ? (rawTab as SettingTab)
      : "profile";

  useEffect(() => {
    if (isAdmin && rawTab === "support") {
      router.replace("/my-settings?tab=profile");
    }
  }, [isAdmin, rawTab, router]);

  const [firstName, setFirstName] = useState(workerProfile?.firstName || "");
  const [lastName, setLastName] = useState(workerProfile?.lastName || "");
  const [email, setEmail] = useState(workerProfile?.email || user?.email || "");
  const [remainingEmailChanges, setRemainingEmailChanges] = useState<number>(2);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; email?: string }>({});
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  useEffect(() => {
    if (workerProfile) {
      setFirstName(workerProfile.firstName || "");
      setLastName(workerProfile.lastName || "");
      setEmail(workerProfile.email || user?.email || "");
      getEmailChangeStatus(workerProfile.id).then((st) => {
        setRemainingEmailChanges(st.remaining);
      }).catch(() => {});
    }
    const currentEmail = workerProfile?.email || user?.email;
    if (currentEmail && !reportEmail) {
      setReportEmail(currentEmail);
    }
  }, [workerProfile?.id, workerProfile?.firstName, workerProfile?.lastName, workerProfile?.email, user?.email]);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [reportCategory, setReportCategory] = useState("general");
  const [reportTitle, setReportTitle] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportEmail, setReportEmail] = useState(user?.email || "");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Admin problem reports states
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [adminCategoryFilter, setAdminCategoryFilter] = useState("all");
  const [adminStatusFilter, setAdminStatusFilter] = useState<"all" | "pending" | "responded">("all");
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [ticketToConfirmRespond, setTicketToConfirmRespond] = useState<any | null>(null);

  // Fetch problem reports exclusively for admin helpdesk
  const {
    data: problemReports = [],
    isLoading: isLoadingProblemReports,
    refetch: refetchProblemReports,
  } = useQuery({
    queryKey: ["problem-reports"],
    queryFn: () => getProblemReports(),
    enabled: isAdmin && activeTab === "report",
  });

  const currentAdminName = useMemo(() => {
    if (workerProfile?.firstName || workerProfile?.lastName) {
      return [workerProfile.firstName, workerProfile.lastName].filter(Boolean).join(" ");
    }
    return (
      (user?.user_metadata?.full_name as string) ||
      (user?.user_metadata?.name as string) ||
      user?.email?.split("@")[0] ||
      "Admin"
    );
  }, [workerProfile, user]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const responder = currentAdminName;
      return await updateInquiryStatus(id, status, undefined, responder);
    },
    onSuccess: (data: any, vars) => {
      queryClient.invalidateQueries({ queryKey: ["problem-reports"] });
      const currentResponder = currentAdminName;

      if (selectedTicket && selectedTicket.id === vars.id) {
        setSelectedTicket((prev: any) =>
          prev
            ? {
                ...prev,
                status: vars.status,
                respondedBy: data?.inquiry?.respondedBy || currentResponder,
                respondedAt: data?.inquiry?.respondedAt || new Date().toISOString(),
              }
            : null
        );
      }
      toast({
        title: "Ticket Status Updated",
        description: `Ticket marked as ${vars.status} by ${currentResponder}.`,
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: err?.message || "Could not update status.",
      });
    },
  });

  const activeReportsPool = problemReports;

  const filteredReports = useMemo(() => {
    return activeReportsPool.filter((inq: any) => {
      if (adminCategoryFilter !== "all") {
        const catMap: Record<string, string> = {
          general: "General System",
          reservations: "Room Reservations",
          meals: "Meal Stubs",
          attendance: "Attendance Log",
          account: "Account / Access",
        };
        const target = catMap[adminCategoryFilter];
        if (target && !inq.type?.includes(target)) return false;
      }

      if (adminStatusFilter === "pending") {
        if (inq.status === "Responded" || inq.status === "Resolved") return false;
      } else if (adminStatusFilter === "responded") {
        if (inq.status !== "Responded" && inq.status !== "Resolved") return false;
      }

      if (adminSearchQuery.trim()) {
        const q = adminSearchQuery.toLowerCase();
        const matchesName = inq.name?.toLowerCase().includes(q);
        const matchesEmail = inq.email?.toLowerCase().includes(q);
        const matchesMessage = inq.message?.toLowerCase().includes(q);
        const matchesType = inq.type?.toLowerCase().includes(q);
        const matchesId = inq.id?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesMessage && !matchesType && !matchesId) {
          return false;
        }
      }

      return true;
    });
  }, [activeReportsPool, adminCategoryFilter, adminStatusFilter, adminSearchQuery]);

  const pendingReportsCount = useMemo(() => {
    return activeReportsPool.filter((r: any) => r.status !== "Responded" && r.status !== "Resolved").length;
  }, [activeReportsPool]);

  const respondedReportsCount = useMemo(() => {
    return activeReportsPool.filter((r: any) => r.status === "Responded" || r.status === "Resolved").length;
  }, [activeReportsPool]);

  const handleTabChange = (newTab: SettingTab) => {
    router.push(`/my-settings?tab=${newTab}`, { scroll: false });
  };

  const handleFirstNameChange = (val: string) => {
    setFirstName(cleanName(val, MAX_LENGTHS.FIRST_NAME));
    if (errors.firstName) {
      setErrors((prev) => ({ ...prev, firstName: undefined }));
    }
  };

  const handleLastNameChange = (val: string) => {
    setLastName(cleanName(val, MAX_LENGTHS.LAST_NAME));
    if (errors.lastName) {
      setErrors((prev) => ({ ...prev, lastName: undefined }));
    }
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: undefined }));
    }
  };

  const validateForm = () => {
    const newErrors: { firstName?: string; lastName?: string; email?: string } = {};

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirst) {
      newErrors.firstName = "First name is required.";
    } else if (trimmedFirst.length < 2) {
      newErrors.firstName = "First name must be at least 2 characters.";
    } else if (trimmedFirst.length > MAX_LENGTHS.FIRST_NAME) {
      newErrors.firstName = `First name cannot exceed ${MAX_LENGTHS.FIRST_NAME} letters.`;
    } else if (!isValidName(trimmedFirst, 2, MAX_LENGTHS.FIRST_NAME)) {
      newErrors.firstName = "First name must contain only letters.";
    }

    if (!trimmedLast) {
      newErrors.lastName = "Last name is required.";
    } else if (trimmedLast.length < 2) {
      newErrors.lastName = "Last name must be at least 2 characters.";
    } else if (trimmedLast.length > MAX_LENGTHS.LAST_NAME) {
      newErrors.lastName = `Last name cannot exceed ${MAX_LENGTHS.LAST_NAME} letters.`;
    } else if (!isValidName(trimmedLast, 2, MAX_LENGTHS.LAST_NAME)) {
      newErrors.lastName = "Last name must contain only letters.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) {
      newErrors.email = "Email address is required.";
    } else if (!emailRegex.test(trimmedEmail)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please check and correct the highlighted fields.",
      });
      return false;
    }

    const currentFirst = (workerProfile?.firstName || "").trim();
    const currentLast = (workerProfile?.lastName || "").trim();
    const currentEmail = (workerProfile?.email || user?.email || "").trim().toLowerCase();

    const isNameUnchanged = trimmedFirst === currentFirst && trimmedLast === currentLast;
    const isEmailUnchanged = trimmedEmail.toLowerCase() === currentEmail;

    if (isNameUnchanged && isEmailUnchanged) {
      toast({
        variant: "destructive",
        title: "No Changes Detected",
        description: "You haven't made any modifications to your name or email.",
      });
      return false;
    }

    if (!isEmailUnchanged && remainingEmailChanges <= 0) {
      toast({
        variant: "destructive",
        title: "Email Change Limit Reached",
        description: "You have already used your 2 email changes for this calendar month.",
      });
      return false;
    }

    setErrors({});
    return true;
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsConfirmOpen(true);
  };

  const executeSaveProfile = async () => {
    const targetId = workerProfile?.id || user?.uid;
    if (!targetId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Worker profile not found.",
      });
      setIsConfirmOpen(false);
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await updateWorkerProfileSettings(targetId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      });

      if (!res.success) {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: res.error || "An error occurred while updating your profile.",
        });
        return;
      }

      if (res.remainingChanges !== undefined) {
        setRemainingEmailChanges(res.remainingChanges);
      }

      // Immediately sync with Zustand permissions store so header, user-nav, and dashboard update in real-time
      if (res.worker) {
        setFirstName(res.worker.firstName || "");
        setLastName(res.worker.lastName || "");
        setEmail(res.worker.email || "");

        const currentPerms = usePermissionsStore.getState();
        usePermissionsStore.getState()._setPermissions({
          ...currentPerms,
          workerProfile: {
            ...currentPerms.workerProfile,
            ...res.worker,
          },
        });
      }

      // Invalidate React Query worker caches
      await queryClient.invalidateQueries({ queryKey: ["worker"] });
      await queryClient.invalidateQueries({ queryKey: ["workers"] });
      await queryClient.invalidateQueries({ queryKey: ["worker-view-as"] });

      // Update local Supabase Auth metadata
      try {
        await supabase.auth.updateUser({
          data: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          },
        });
      } catch {
        // ignore
      }

      router.refresh();

      toast({
        title: "Profile Updated",
        description: res.message || "Your profile details have been successfully updated.",
      });
      setIsConfirmOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "An error occurred while saving your profile.",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveProfile = handleProfileSubmit;
  const handleSaveName = handleProfileSubmit;
  const isSavingName = isSavingProfile;

  const handleChangePassword = async () => {
    if (!user?.email) return;
    setIsChangingPassword(true);
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
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogoutAllDevices = async () => {
    try {
      if (typeof window !== 'undefined' && user?.id) {
        sessionStorage.removeItem(`cog_session_login_${user.id}`);
      }
      try {
        await recordAuthActivity("User Logout", {
          userId: user?.id || null,
          email: user?.email || null,
          name: `${firstName} ${lastName}`.trim() || user?.email || 'User',
          details: "User signed out from all devices",
        });
      } catch (logErr) {
        console.warn('Failed to record logout all devices:', logErr);
      }
      await supabase.auth.signOut({ scope: "global" });
      toast({
        title: "Logged out from all devices",
        description: "You have been logged out from all devices.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to logout from all devices.",
      });
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle.trim() || !reportDescription.trim()) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill in both the issue subject and description.",
      });
      return;
    }

    setIsSubmittingReport(true);
    try {
      const reporterName = workerProfile
        ? [workerProfile.firstName, workerProfile.lastName].filter(Boolean).join(" ")
        : (user?.user_metadata?.full_name as string) || user?.email || "Staff / Worker";

      const res = await submitProblemReport({
        category: reportCategory,
        subject: reportTitle.trim(),
        description: reportDescription.trim(),
        contactEmail: reportEmail.trim() || user?.email || null,
        reporterName,
        workerId: workerProfile?.id || user?.id || null,
      });

      setReportTitle("");
      setReportDescription("");
      toast({
        title: "Problem Report Submitted",
        description: `Your ticket (${res.ticketRef}) has been recorded and dispatched to IT support.`,
      });
    } catch (err: any) {
      console.error("Failed to submit problem report:", err);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: err?.message || "Could not submit report. Please try again.",
      });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div className="w-full space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-headline tracking-tight text-gray-900 dark:text-white">
            {activeTab === "profile" && "Profile & Name"}
            {activeTab === "appearance" && "Display & Appearance"}
            {activeTab === "password" && "Change Password"}
            {activeTab === "security" && "Login Security"}
            {activeTab === "support" && !isAdmin && "Help & Support"}
            {activeTab === "report" && (isAdmin ? "Worker Problem Reports" : "Report a Problem")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeTab === "profile" && "Update your account display name and personal credentials."}
            {activeTab === "appearance" && "Customize theme mode (Dark / Light), typography, text sizing, and accessibility preferences across the application."}
            {activeTab === "password" && "Manage your account authentication credentials and security settings."}
            {activeTab === "security" && "Monitor active devices, login sessions, and global security controls."}
            {activeTab === "support" && !isAdmin && "Browse FAQs and find guidance on using the workforce management platform."}
            {activeTab === "report" &&
              (isAdmin
                ? "Review, triage, and resolve problem reports and helpdesk tickets submitted by church workers and ministry heads."
                : "Submit a technical support request directly to the IT administration team.")}
          </p>
        </div>
      </div>


      {/* Main Container Card */}
      <div className="bg-white dark:bg-card rounded-2xl border border-border/60 shadow-card-dark p-6 sm:p-8 md:p-10 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* ── Tab: Profile & Name ── */}
        {activeTab === "profile" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-sidebar/10 text-sidebar dark:text-blue-400 text-xs font-bold">
                  <span>Profile Information</span>
                </div>
                <h3 className="text-2xl font-bold font-headline text-foreground">
                  Profile & Account Details
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Update your display name and email address. You are allowed to change your email up to 2 times per calendar month.
                </p>
              </div>

              <form onSubmit={handleProfileSubmit} noValidate className="bg-slate-50/80 dark:bg-muted/30 rounded-2xl border border-border/60 p-6 sm:p-7 shadow-2xs space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      First Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      maxLength={MAX_LENGTHS.FIRST_NAME}
                      value={firstName}
                      onChange={(e) => handleFirstNameChange(e.target.value)}
                      placeholder="First Name"
                      required
                      className={cn(
                        "bg-white dark:bg-background text-sm font-medium h-11 rounded-xl border-slate-200/90 dark:border-border text-foreground shadow-2xs pl-4 transition-colors",
                        errors.firstName && "border-red-500 focus-visible:ring-red-500"
                      )}
                    />
                    {errors.firstName && (
                      <p className="text-[11px] text-red-500 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{errors.firstName}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Last Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="lastName"
                      maxLength={MAX_LENGTHS.LAST_NAME}
                      value={lastName}
                      onChange={(e) => handleLastNameChange(e.target.value)}
                      placeholder="Last Name"
                      required
                      className={cn(
                        "bg-white dark:bg-background text-sm font-medium h-11 rounded-xl border-slate-200/90 dark:border-border text-foreground shadow-2xs pl-4 transition-colors",
                        errors.lastName && "border-red-500 focus-visible:ring-red-500"
                      )}
                    />
                    {errors.lastName && (
                      <p className="text-[11px] text-red-500 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{errors.lastName}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label htmlFor="profileEmail" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-sidebar dark:text-blue-400" />
                      Email Address <span className="text-red-500">*</span>
                    </Label>
                    {remainingEmailChanges > 0 ? (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-800/80">
                        {remainingEmailChanges} / 2 changes left this month
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/80 dark:border-amber-800/80">
                        Monthly limit reached (0 / 2 left)
                      </span>
                    )}
                  </div>
                  <Input
                    id="profileEmail"
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    disabled={remainingEmailChanges <= 0 && email.trim().toLowerCase() === (workerProfile?.email || user?.email || "").toLowerCase()}
                    placeholder="your.email@example.com"
                    required
                    className={cn(
                      "bg-white dark:bg-background text-sm font-medium h-11 rounded-xl border-slate-200/90 dark:border-border text-foreground shadow-2xs pl-4 transition-colors",
                      errors.email && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                  {errors.email ? (
                    <p className="text-[11px] text-red-500 font-medium flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{errors.email}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-sidebar dark:text-blue-400 shrink-0" />
                      <span>
                        {remainingEmailChanges > 0
                          ? "You can change your email up to 2 times a month. Changes update your login credentials."
                          : "You have used your 2 email changes for this month. You will be able to change it again next month."}
                      </span>
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSavingProfile}
                    className="w-full text-sm font-bold h-11 rounded-xl bg-sidebar hover:bg-sidebar/90 text-white shadow-sm hover:shadow transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    {isSavingProfile ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {/* Confirmation Dialog on Save */}
              <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <AlertDialogContent className="max-w-md rounded-2xl bg-white dark:bg-card border border-border/80 shadow-2xl p-6">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                      <ShieldCheck className="h-5 w-5 text-sidebar dark:text-blue-400" />
                      Confirm Profile Changes
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3 pt-2 text-sm text-foreground">
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Please review the updates you are about to save to your account profile:
                        </p>

                        <div className="bg-slate-50 dark:bg-muted/40 rounded-xl p-3.5 border border-border/60 space-y-2 text-xs">
                          {/* Only show name row if name was changed */}
                          {(`${firstName.trim()} ${lastName.trim()}` !== `${(workerProfile?.firstName || "").trim()} ${(workerProfile?.lastName || "").trim()}`) && (
                            <div className="flex justify-between items-center py-1 last:border-b-0">
                              <span className="text-muted-foreground">New Display Name</span>
                              <span className="font-semibold text-foreground">
                                {firstName.trim()} {lastName.trim()}
                              </span>
                            </div>
                          )}
                          {/* Only show email row if email was changed */}
                          {(email.trim().toLowerCase() !== (workerProfile?.email || user?.email || "").trim().toLowerCase()) && (
                            <div className="flex justify-between items-center py-1 last:border-b-0">
                              <span className="text-muted-foreground">New Email Address</span>
                              <span className="font-semibold text-foreground truncate max-w-[200px]" title={email.trim()}>
                                {email.trim()}
                              </span>
                            </div>
                          )}
                        </div>

                        {email.trim().toLowerCase() !== (workerProfile?.email || user?.email || "").trim().toLowerCase() && (
                          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
                            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div className="leading-relaxed">
                              <strong className="font-semibold">Notice:</strong> Changing your email will use <strong>1</strong> of your <strong>2</strong> monthly changes ({Math.max(0, remainingEmailChanges - 1)} left after this).
                            </div>
                          </div>
                        )}
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="mt-4 gap-2 sm:gap-2">
                    <AlertDialogCancel
                      disabled={isSavingProfile}
                      className="rounded-xl border-border/60 hover:bg-muted text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        executeSaveProfile();
                      }}
                      disabled={isSavingProfile}
                      className="rounded-xl bg-sidebar hover:bg-sidebar/90 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      {isSavingProfile ? (
                        <>
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Confirm & Save
                        </>
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Right Column: Information Preview Card */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-50/70 dark:bg-muted/20 border border-slate-200/80 dark:border-border/80 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-sidebar/10 flex items-center justify-center text-sidebar font-bold text-base border-2 border-border/60 shrink-0">
                      <span>
                        {workerProfile?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">
                        {workerProfile?.firstName && workerProfile?.lastName
                          ? `${workerProfile.firstName} ${workerProfile.lastName}`
                          : user?.email?.split("@")[0] || "User"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {(workerProfile as any)?.role?.name || workerProfile?.roleId || "Member"}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                    <Check className="w-3 h-3" /> {workerProfile?.status || "Active"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
                  <Info className="h-4 w-4 text-sidebar dark:text-blue-400" />
                  <span>Profile Overview</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Current Display Name</span>
                    <span className="font-semibold text-foreground">
                      {workerProfile?.firstName && workerProfile?.lastName
                        ? `${workerProfile.firstName} ${workerProfile.lastName}`
                        : user?.email?.split("@")[0] || "User"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Registered Email</span>
                    <span className="font-semibold text-foreground truncate max-w-[170px]" title={workerProfile?.email || user?.email || ""}>
                      {workerProfile?.email || user?.email || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Email Changes (This Month)</span>
                    <span className="font-semibold text-foreground">
                      {Math.max(0, 2 - remainingEmailChanges)} / 2 used
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Worker ID</span>
                    <span className="font-semibold font-mono text-foreground">
                      {workerProfile?.workerId || workerProfile?.id?.slice(0, 8) || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-semibold text-foreground">
                      {(workerProfile as any)?.role?.name || workerProfile?.roleId || "Member"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Account Status</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {workerProfile?.status || "Active"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Display & Appearance ── */}
        {activeTab === "appearance" && (
          <div className="space-y-10">
            {/* Theme / Dark Mode Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-sidebar/10 text-sidebar dark:text-blue-400 text-xs font-bold">
                  <span>Color Theme</span>
                </div>
                <h3 className="text-2xl font-bold font-headline text-foreground">
                  Appearance & Theme
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  Choose between Light and Dark mode. Dark mode uses a comfortable, low-glare slate palette designed to reduce eye strain in low-light environments.
                </p>
              </div>

              <ThemeToggle />
            </div>

            {/* Subtle Divider */}
            <div className="h-[1px] bg-border/60" />

            {/* Typography / Font Size Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-sidebar/10 text-sidebar dark:text-blue-400 text-xs font-bold">
                  <span>Accessibility & Typography</span>
                </div>
                <h3 className="text-2xl font-bold font-headline text-foreground">
                  Text & Font Size
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  Personalize text size across the entire application for improved legibility and comfort. The setting scales all headers, forms, tables, cards, dialogs, and navigation labels immediately.
                </p>
              </div>

              <FontSizeSlider />
            </div>
          </div>
        )}

        {/* ── Tab: Change Password ── */}
        {activeTab === "password" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Action Card */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-sidebar/10 text-sidebar dark:text-blue-400 text-xs font-bold">
                  <span>Account Credentials</span>
                </div>
                <h3 className="text-2xl font-bold font-headline text-foreground">
                  Reset Account Password
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We'll send a secure password reset link to your verified email address. You will be redirected to create a new, strong password.
                </p>
              </div>

              {/* Form Box */}
              <div className="bg-slate-50/80 dark:bg-muted/30 rounded-2xl border border-border/60 p-6 sm:p-7 shadow-2xs space-y-6">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-sidebar dark:text-blue-400" />
                      Registered Email Address
                    </Label>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                      <Check className="h-3 w-3" /> Verified
                    </span>
                  </div>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="bg-white dark:bg-background text-sm font-semibold h-12 rounded-xl border-slate-200/90 dark:border-border text-foreground shadow-2xs cursor-not-allowed opacity-95 pl-4"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    This email is permanently linked to your worker profile and credentials.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword}
                    className="w-full text-sm font-bold h-12 rounded-xl bg-sidebar hover:bg-sidebar/90 text-white shadow-sm hover:shadow transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    {isChangingPassword ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        <span>Sending Reset Link...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4" />
                        <span>Send Password Reset Email</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Bottom SLA banner */}
              <div className="bg-blue-50/70 dark:bg-blue-950/20 p-4 sm:p-5 rounded-2xl border border-blue-200/70 dark:border-blue-900/40 flex items-start gap-3.5">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shrink-0 mt-0.5 shadow-2xs">
                  <Clock className="h-4 w-4" />
                </div>
                <div className="text-xs text-blue-950 dark:text-blue-300 leading-relaxed space-y-1">
                  <p className="font-bold text-[13px]">1-Hour Link Validity</p>
                  <p>
                    For your security, the reset link is single-use and will automatically expire in 60 minutes. Check your spam folder if you do not see it in your inbox.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Security Guide & Overview Card */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/40 dark:from-muted/40 dark:via-card dark:to-blue-950/10 rounded-2xl border border-border/70 p-6 sm:p-7 shadow-2xs space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-sidebar text-white shadow-xs">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold font-headline text-foreground">
                      Security Recommendations
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Best practices for account protection
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-1 divide-y divide-border/40">
                  <div className="flex items-start gap-3 pt-3 first:pt-0">
                    <div className="p-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <div className="text-xs leading-relaxed">
                      <p className="font-bold text-foreground">Create a Unique Password</p>
                      <p className="text-muted-foreground mt-0.5">
                        Use at least 8 characters with a blend of numbers, symbols, and uppercase letters.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 pt-3">
                    <div className="p-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <div className="text-xs leading-relaxed">
                      <p className="font-bold text-foreground">Secure Email Delivery</p>
                      <p className="text-muted-foreground mt-0.5">
                        Reset requests are delivered with TLS encryption directly to your authorized inbox.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 pt-3">
                    <div className="p-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <div className="text-xs leading-relaxed">
                      <p className="font-bold text-foreground">Never Share Credentials</p>
                      <p className="text-muted-foreground mt-0.5">
                        Church administrators will never ask for your password or verification links.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Link Card */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleTabChange("security")}
                    className="w-full group p-3.5 rounded-xl border border-border/80 bg-white/80 dark:bg-background/80 hover:bg-sidebar hover:text-white dark:hover:bg-sidebar transition-all flex items-center justify-between text-xs font-bold text-foreground cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="h-4 w-4 text-sidebar group-hover:text-white" />
                      <span>Manage Active Devices & Sessions</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-white transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Login Security ── */}
        {activeTab === "security" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-sidebar/10 text-sidebar dark:text-blue-400 text-xs font-bold">
                  <span>Session Security</span>
                </div>
                <h3 className="text-2xl font-bold font-headline text-foreground">
                  Active Sessions & Devices
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Monitor devices currently logged into your account and terminate unauthorized sessions immediately.
                </p>
              </div>

              {/* Active Device Session Card */}
              <div className="bg-slate-50/80 dark:bg-muted/30 rounded-2xl border border-border/60 p-4 sm:p-7 shadow-2xs space-y-4 sm:space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold flex items-center gap-2.5 text-foreground">
                    <div className="p-2 rounded-xl bg-sidebar/10 dark:bg-sidebar/20 text-sidebar dark:text-blue-400 shrink-0">
                      <Laptop className="h-4 w-4" />
                    </div>
                    <span>Current Connected Device</span>
                  </h4>
                  <span className="text-xs font-bold text-muted-foreground bg-muted/60 dark:bg-muted/40 px-2.5 py-0.5 rounded-md shrink-0">
                    Web Application
                  </span>
                </div>

                <div className="bg-emerald-50/80 dark:bg-emerald-950/25 rounded-2xl p-4 sm:p-5 border border-emerald-200/80 dark:border-emerald-900/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-emerald-950 dark:text-emerald-300">
                          Active Browser Session
                        </p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200/80 dark:bg-emerald-900/70 text-emerald-900 dark:text-emerald-200 shrink-0">
                          This Computer
                        </span>
                      </div>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed break-words">
                        Authenticated via Supabase Auth • Secure Token Active
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-center px-2.5 py-1 rounded-full bg-emerald-100/90 dark:bg-emerald-900/50 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Online</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  This device has valid authentication tokens. If you suspect any unauthorized access, revoke all credentials below.
                </p>
              </div>

              {/* Global Logout Card */}
              <div className="bg-rose-50/50 dark:bg-rose-950/15 rounded-2xl border border-rose-200/70 dark:border-rose-900/40 p-6 sm:p-7 shadow-2xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <LogOut className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-foreground">
                      Terminate All Active Sessions
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Sign out across all computers, tablets, and kiosks
                    </p>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  This action will invalidate all login tokens globally. You and any active sessions on other devices will be prompted to log in again.
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setShowLogoutAllConfirm(true)}
                  className="w-full text-sm font-bold h-12 rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout from All Devices</span>
                </Button>

                {/* Confirmation Dialog on Logout All Devices */}
                <AlertDialog open={showLogoutAllConfirm} onOpenChange={setShowLogoutAllConfirm}>
                  <AlertDialogContent className="max-w-md rounded-2xl bg-white dark:bg-card border border-border/80 shadow-2xl p-6">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2.5 text-lg font-bold text-foreground">
                        <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                          <LogOut className="h-5 w-5" />
                        </div>
                        Terminate All Sessions?
                      </AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-3 pt-2 text-sm text-foreground">
                          <p className="text-muted-foreground text-xs leading-relaxed">
                            Are you sure you want to sign out from all devices? This will invalidate all active session tokens globally across all computers, tablets, and kiosks.
                          </p>
                          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                            <div className="leading-relaxed">
                              You and any active sessions on other devices will be required to log in again with your credentials.
                            </div>
                          </div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 gap-2 sm:gap-2">
                      <AlertDialogCancel
                        disabled={isLoggingOutAll}
                        className="rounded-xl border-border/60 hover:bg-muted text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async (e) => {
                          e.preventDefault();
                          setIsLoggingOutAll(true);
                          try {
                            await handleLogoutAllDevices();
                          } finally {
                            setIsLoggingOutAll(false);
                            setShowLogoutAllConfirm(false);
                          }
                        }}
                        disabled={isLoggingOutAll}
                        className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold cursor-pointer"
                      >
                        {isLoggingOutAll ? (
                          <>
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            Logging out...
                          </>
                        ) : (
                          "Logout from All Devices"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {/* Right Column: Security Status */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-50/80 dark:bg-muted/30 rounded-2xl border border-border/70 p-6 sm:p-7 shadow-2xs space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold font-headline text-foreground">
                      Account Protection
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Device security status
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5 text-xs leading-relaxed text-muted-foreground">
                  <div className="p-3.5 rounded-xl bg-white dark:bg-background border border-border/60">
                    <p className="font-bold text-foreground mb-1">Session Expiration</p>
                    <p>Inactivity timeout automatically triggers re-authentication to protect sensitive workforce data.</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-background border border-border/60">
                    <p className="font-bold text-foreground mb-1">Public Computer Caution</p>
                    <p>Always remember to explicitly log out when accessing the portal from shared church computers or registration kiosks.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Help & Support (Workers & Ministry Heads Only) ── */}
        {activeTab === "support" && !isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-sidebar/10 text-sidebar dark:text-blue-400 text-xs font-bold">
                  <span>Knowledge Base</span>
                </div>
                <h3 className="text-2xl font-bold font-headline text-foreground">
                  Frequently Asked Questions
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Quick answers to common questions about reservation requests, meal allowances, and attendance tracking.
                </p>
              </div>

              {/* FAQ Accordions */}
              <div className="space-y-3">
                <details className="group bg-slate-50/80 dark:bg-muted/30 rounded-xl p-5 border border-border/60 shadow-2xs hover:shadow-xs hover:border-sidebar/30 transition-all cursor-pointer">
                  <summary className="cursor-pointer font-bold text-sm text-foreground flex items-center justify-between select-none">
                    <span>How do I reserve a room or venue?</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform duration-200 shrink-0 ml-2" />
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed pl-0.5">
                    Navigate to <span className="font-semibold text-foreground">Room Reservations → Reserve a Room</span>, pick your desired branch, date, time slot, and room, provide your event purpose, and submit the booking request for approval.
                  </p>
                </details>

                <details className="group bg-slate-50/80 dark:bg-muted/30 rounded-xl p-5 border border-border/60 shadow-2xs hover:shadow-xs hover:border-sidebar/30 transition-all cursor-pointer">
                  <summary className="cursor-pointer font-bold text-sm text-foreground flex items-center justify-between select-none">
                    <span>How do I access and display my QR Code?</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform duration-200 shrink-0 ml-2" />
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed pl-0.5">
                    Click on <span className="font-semibold text-foreground">My QR Code</span> located in the navigation sidebar or bottom bar to display your personal worker badge for fast attendance and meal stub scanning.
                  </p>
                </details>

                <details className="group bg-slate-50/80 dark:bg-muted/30 rounded-xl p-5 border border-border/60 shadow-2xs hover:shadow-xs hover:border-sidebar/30 transition-all cursor-pointer">
                  <summary className="cursor-pointer font-bold text-sm text-foreground flex items-center justify-between select-none">
                    <span>How do I claim or check my daily meal stubs?</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform duration-200 shrink-0 ml-2" />
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed pl-0.5">
                    Go to <span className="font-semibold text-foreground">Meal Stubs</span> to monitor your daily allocation and weekly utilization, or present your QR badge at any scanning station.
                  </p>
                </details>

                <details className="group bg-slate-50/80 dark:bg-muted/30 rounded-xl p-5 border border-border/60 shadow-2xs hover:shadow-xs hover:border-sidebar/30 transition-all cursor-pointer">
                  <summary className="cursor-pointer font-bold text-sm text-foreground flex items-center justify-between select-none">
                    <span>How do I check my attendance history?</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform duration-200 shrink-0 ml-2" />
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed pl-0.5">
                    Navigate to <span className="font-semibold text-foreground">Attendance</span> to see your complete clock-in and clock-out logs, weekly summary statistics, and time tracking history.
                  </p>
                </details>
              </div>
            </div>

            {/* Right Column: Support Card */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-50/80 dark:bg-muted/30 rounded-2xl border border-border/70 p-6 sm:p-7 shadow-2xs space-y-5">
                <div className="space-y-1">
                  <h4 className="text-base font-bold font-headline text-foreground">Still have questions?</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Our technical support and administration team is available to assist with system errors, access roles, or inquiries.
                  </p>
                </div>
                <Button
                  onClick={() => handleTabChange("report")}
                  className="w-full text-sm font-bold h-12 rounded-xl bg-sidebar hover:bg-sidebar/90 text-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>Submit a Support Ticket</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Report a Problem ── */}
        {activeTab === "report" && (
          isAdmin ? (
            <div className="space-y-6">
              {/* Top Header Row */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sidebar/10 text-sidebar dark:text-blue-400 text-xs font-bold border border-sidebar/20">
                    <Inbox className="w-3.5 h-3.5" />
                    <span>Worker & Ministry Head Helpdesk</span>
                  </div>
                  <h3 className="text-2xl font-bold font-headline text-foreground">
                    Worker Problem Reports
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Review, triage, and respond to incoming technical issues, room reservation glitches, attendance disputes, and support tickets submitted by workers and ministry heads.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchProblemReports()}
                    disabled={isLoadingProblemReports}
                    className="h-10 px-3.5 rounded-xl border-border/70 hover:bg-muted text-xs font-semibold gap-2 cursor-pointer"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", isLoadingProblemReports && "animate-spin")} />
                    <span>Refresh</span>
                  </Button>
                </div>
              </div>

              {/* Stats Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="bg-slate-50/80 dark:bg-muted/20 border border-border/60 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Tickets</p>
                    <p className="text-2xl font-bold text-foreground">{activeReportsPool.length}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-sidebar/10 text-sidebar flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">Pending Review</p>
                    <p className="text-2xl font-bold text-amber-900 dark:text-amber-200">{pendingReportsCount}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                    <Clock className="w-5 h-5 animate-pulse" />
                  </div>
                </div>

                <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Responded / Solved</p>
                    <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-200">{respondedReportsCount}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Filters & Search Control Bar */}
              <div className="space-y-3.5 bg-slate-50/80 dark:bg-muted/20 border border-border/60 rounded-2xl p-4 shadow-2xs">
                {/* Search Bar + Status Toggle */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="Search ticket subject, worker name, email, or keywords..."
                      value={adminSearchQuery}
                      onChange={(e) => setAdminSearchQuery(e.target.value)}
                      className="pl-9.5 text-xs font-medium h-10 bg-white dark:bg-background border-slate-200/90 dark:border-border rounded-xl shadow-2xs w-full"
                    />
                  </div>

                  {/* Status Toggle Pills */}
                  <div className="flex items-center p-1 bg-white dark:bg-background rounded-xl border border-border/70 shrink-0">
                    {[
                      { id: "all", label: `All (${activeReportsPool.length})` },
                      { id: "pending", label: `Pending (${pendingReportsCount})` },
                      { id: "responded", label: `Responded (${respondedReportsCount})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setAdminStatusFilter(tab.id as any)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                          adminStatusFilter === tab.id
                            ? "bg-sidebar text-white shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-1 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> Category:
                  </span>
                  {[
                    { id: "all", label: "All Categories" },
                    { id: "general", label: "General System" },
                    { id: "reservations", label: "Room Reservations" },
                    { id: "meals", label: "Meal Stubs" },
                    { id: "attendance", label: "Attendance Log" },
                    { id: "account", label: "Account / Access" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setAdminCategoryFilter(cat.id)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                        adminCategoryFilter === cat.id
                          ? "bg-sidebar/90 text-white shadow-2xs font-bold"
                          : "bg-white dark:bg-background border border-border/60 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tickets List */}
              {isLoadingProblemReports ? (
                <div className="flex flex-col items-center justify-center p-16 text-muted-foreground border border-border/60 rounded-2xl bg-card">
                  <RefreshCw className="w-8 h-8 animate-spin text-sidebar mb-3" />
                  <p className="font-medium text-xs">Loading problem reports...</p>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-border/60 rounded-2xl bg-card">
                  <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-3">
                    <Inbox className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">No Problem Reports Found</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1">
                    {adminSearchQuery || adminCategoryFilter !== "all" || adminStatusFilter !== "all"
                      ? "No tickets match your filter criteria. Try clearing search filters."
                      : "No problem reports have been submitted by workers or ministry heads yet."}
                  </p>
                  {(adminSearchQuery || adminCategoryFilter !== "all" || adminStatusFilter !== "all") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAdminSearchQuery("");
                        setAdminCategoryFilter("all");
                        setAdminStatusFilter("all");
                      }}
                      className="mt-3.5 h-8 text-xs rounded-xl"
                    >
                      Reset Filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredReports.map((report: any) => {
                    const parsed = extractSubjectAndBody(report.message || "");
                    const isResponded = report.status === "Responded" || report.status === "Resolved";
                    const ticketRef = `TICKET-${String(report.id).slice(0, 6).toUpperCase()}`;
                    const rawType = report.type || "Problem Report: General System";
                    const categoryName = rawType.replace("Problem Report: ", "").trim();

                    return (
                      <div
                        key={report.id}
                        className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-2xs hover:shadow-xs transition-all"
                      >
                        {/* Top bar: Ticket Ref, Category, Status, Time */}
                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-50/90 dark:bg-muted/30 border-b border-border/50 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sidebar dark:text-blue-400 bg-sidebar/10 px-2.5 py-0.5 rounded-lg text-[11px]">
                              {ticketRef}
                            </span>
                            <span className="inline-flex items-center gap-1 font-semibold text-[11px] px-2.5 py-0.5 rounded-full bg-white dark:bg-card border border-border/60 text-foreground">
                              <Tag className="w-3 h-3 text-sidebar" />
                              <span>{categoryName}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isResponded ? (
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full">
                                  <Check className="w-3 h-3" /> Responded
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                                  by <strong className="font-bold">{report.respondedBy || "Admin"}</strong>
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 rounded-full">
                                <Clock className="w-3 h-3 animate-pulse" /> Pending
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{formatDistanceToNow(parseDateSafe(report.createdAt), { addSuffix: true })}</span>
                            </span>
                          </div>
                        </div>

                        {/* Body */}
                        <div className="p-4 sm:p-5 space-y-3">
                          {/* Worker Information */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-sidebar/10 text-sidebar dark:bg-sidebar/30 dark:text-sidebar-foreground font-bold text-xs flex items-center justify-center shrink-0">
                                {report.name ? report.name.slice(0, 2).toUpperCase() : "WK"}
                              </div>
                              <div>
                                <p className="font-bold text-sm text-foreground">{report.name || "Worker / Staff"}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                                  <a
                                    href={getGmailComposeUrl(report.email, `RE: [${ticketRef}] ${parsed.subject}`)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline text-sidebar dark:text-blue-400"
                                  >
                                    {report.email}
                                  </a>
                                  {report.phone && <span className="text-muted-foreground/60">&bull; {report.phone}</span>}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Subject */}
                          <div className="pt-1">
                            <h4 className="text-base font-bold text-foreground">
                              {parsed.subject}
                            </h4>
                          </div>

                          {/* Description box */}
                          <div
                            onClick={() => {
                              setSelectedTicket(report);
                              setIsTicketModalOpen(true);
                            }}
                            className="bg-slate-50/70 dark:bg-muted/20 border border-border/50 rounded-xl p-3.5 text-xs sm:text-sm text-foreground/90 leading-relaxed cursor-pointer hover:bg-slate-100/70 dark:hover:bg-muted/40 transition-colors"
                          >
                            <p className="line-clamp-3 whitespace-pre-wrap select-text">
                              {parsed.body || report.message}
                            </p>
                          </div>

                          {/* Action Toolbar */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                            <div className="flex items-center gap-2">
                              {!isResponded ? (
                                <Button
                                  size="sm"
                                  disabled={updateStatusMutation.isPending}
                                  onClick={() => setTicketToConfirmRespond(report)}
                                  className="h-8 text-xs font-semibold rounded-xl gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Mark as Responded</span>
                                </Button>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-xl">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Responded by {report.respondedBy || "Admin"}</span>
                                </span>
                              )}

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedTicket(report);
                                  setIsTicketModalOpen(true);
                                }}
                                className="h-8 text-xs font-semibold rounded-xl gap-1.5 cursor-pointer"
                              >
                                <span>View Details</span>
                              </Button>
                            </div>

                            <a
                              href={getGmailComposeUrl(
                                report.email,
                                `RE: [${ticketRef}] ${parsed.subject}`,
                                `Hello ${report.name || "Worker"},\n\nRegarding to your Reports:\n\n`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sidebar hover:text-sidebar/80 dark:text-blue-400 hover:underline px-2 py-1"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>Email Worker</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Full Ticket Details Modal */}
              <Dialog open={isTicketModalOpen} onOpenChange={setIsTicketModalOpen}>
                <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-xl max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col bg-card rounded-2xl border border-border/70 shadow-2xl">
                  {selectedTicket && (() => {
                    const parsed = extractSubjectAndBody(selectedTicket.message || "");
                    const isResponded = selectedTicket.status === "Responded" || selectedTicket.status === "Resolved";
                    const ticketRef = `TICKET-${String(selectedTicket.id).slice(0, 6).toUpperCase()}`;
                    const rawType = selectedTicket.type || "Problem Report: General System";
                    const categoryName = rawType.replace("Problem Report: ", "").trim();

                    return (
                      <>
                        <DialogHeader className="p-5 pb-4 border-b border-border/60 bg-sidebar text-white shrink-0">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white bg-white/20 px-2.5 py-0.5 rounded-lg text-xs">
                                {ticketRef}
                              </span>
                              <span className="text-xs font-semibold text-white/90 bg-white/10 px-2.5 py-0.5 rounded-full">
                                {categoryName}
                              </span>
                            </div>
                            {isResponded ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-200 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                                <Check className="w-3 h-3" /> Responded by {selectedTicket.respondedBy || "Admin"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-200 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                                <Clock className="w-3 h-3 animate-pulse" /> Pending
                              </span>
                            )}
                          </div>
                          <DialogTitle className="text-lg font-bold text-white mt-2">
                            {parsed.subject}
                          </DialogTitle>
                        </DialogHeader>

                        <div className="p-5 space-y-4 overflow-y-auto flex-1">
                          {/* Requester Information Card */}
                          <div className="bg-slate-50/80 dark:bg-muted/20 border border-border/60 rounded-xl p-3.5 space-y-2 text-xs">
                            <p className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                              Reporter Information
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-foreground">
                              <div>
                                <span className="text-muted-foreground">Name: </span>
                                <span className="font-semibold">{selectedTicket.name || "Worker / Staff"}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Contact: </span>
                                <a
                                  href={getGmailComposeUrl(selectedTicket.email, `RE: [${ticketRef}] ${parsed.subject}`)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-sidebar dark:text-blue-400 hover:underline"
                                >
                                  {selectedTicket.email}
                                </a>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Submitted: </span>
                                <span className="font-semibold">{format(parseDateSafe(selectedTicket.createdAt), "MMM d, yyyy • h:mm a")}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Category: </span>
                                <span className="font-semibold">{categoryName}</span>
                              </div>
                            </div>
                          </div>

                          {/* Admin Response Audit Card */}
                          {isResponded && (
                            <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl p-3.5 space-y-2 text-xs">
                              <div className="flex items-center justify-between">
                                <p className="font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 text-[10px] flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  Admin Response Details
                                </p>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                                  Responded
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-foreground">
                                <div>
                                  <span className="text-muted-foreground">Responded By: </span>
                                  <span className="font-bold text-emerald-900 dark:text-emerald-200">
                                    {selectedTicket.respondedBy || "Administrator"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Responded At: </span>
                                  <span className="font-semibold text-foreground">
                                    {selectedTicket.respondedAt
                                      ? format(parseDateSafe(selectedTicket.respondedAt), "MMM d, yyyy • h:mm a")
                                      : "—"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Full Explanation */}
                          <div className="space-y-1.5">
                            <p className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                              Detailed Explanation
                            </p>
                            <div className="bg-slate-50 dark:bg-muted/30 border border-border/70 rounded-xl p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap select-text">
                              {parsed.body || selectedTicket.message}
                            </div>
                          </div>
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="p-4 bg-muted/30 border-t border-border/60 flex items-center justify-between gap-3 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsTicketModalOpen(false)}
                            className="rounded-xl text-xs font-semibold"
                          >
                            Close
                          </Button>

                          <div className="flex items-center gap-2">
                            <a
                              href={getGmailComposeUrl(
                                selectedTicket.email,
                                `RE: [${ticketRef}] ${parsed.subject}`,
                                `Hello ${selectedTicket.name || "Worker"},\n\nRegarding to your Reports:\n\n`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold bg-white dark:bg-background border border-border/70 hover:bg-muted text-foreground transition-all"
                            >
                              <Mail className="w-3.5 h-3.5 text-sidebar" />
                              <span>Email Worker</span>
                            </a>

                            {!isResponded ? (
                              <Button
                                size="sm"
                                disabled={updateStatusMutation.isPending}
                                onClick={() => setTicketToConfirmRespond(selectedTicket)}
                                className="h-9 px-4 text-xs font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer gap-1.5 shadow-2xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Mark as Responded</span>
                              </Button>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3.5 py-1.5 rounded-xl">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Responded by {selectedTicket.respondedBy || "Admin"}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </DialogContent>
              </Dialog>

              {/* Confirmation Dialog before Marking as Responded */}
              <AlertDialog
                open={!!ticketToConfirmRespond}
                onOpenChange={(open) => !open && setTicketToConfirmRespond(null)}
              >
                <AlertDialogContent className="w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl p-6 border-border/80 shadow-2xl space-y-4">
                  <AlertDialogHeader className="space-y-2 text-left">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 mb-1">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <AlertDialogTitle className="text-lg font-bold text-foreground">
                      Mark Report as Responded?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Are you sure you want to mark this report as <strong>Responded</strong>
                      {ticketToConfirmRespond && (
                        <span>
                          {" "}
                          (
                          <strong className="text-foreground font-mono">
                            TICKET-{String(ticketToConfirmRespond.id).slice(0, 6).toUpperCase()}
                          </strong>
                          )
                        </span>
                      )}
                      ? This action will be recorded in the system under your admin account (<strong>{currentAdminName}</strong>).
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <AlertDialogFooter className="flex-row items-center justify-end gap-2.5 pt-2 border-t border-border/40">
                    <AlertDialogCancel
                      disabled={updateStatusMutation.isPending}
                      onClick={() => setTicketToConfirmRespond(null)}
                      className="rounded-xl h-10 px-4 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      disabled={updateStatusMutation.isPending}
                      onClick={async (e) => {
                        e.preventDefault();
                        if (!ticketToConfirmRespond) return;
                        await updateStatusMutation.mutateAsync({
                          id: ticketToConfirmRespond.id,
                          status: "Responded",
                        });
                        setTicketToConfirmRespond(null);
                      }}
                      className="rounded-xl h-10 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-2"
                    >
                      {updateStatusMutation.isPending ? (
                        <>
                          <LoaderCircle className="w-4 h-4 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Confirm & Mark Responded</span>
                        </>
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 space-y-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-sidebar/10 text-sidebar dark:text-blue-400 text-xs font-bold">
                    <span>Helpdesk Ticket</span>
                  </div>
                  <h3 className="text-2xl font-bold font-headline text-foreground">
                    Submit a Problem Report
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Encountered an issue or bug? Provide details below and our IT support team will investigate promptly.
                  </p>
                </div>

                {/* Form Card */}
                <form onSubmit={handleSubmitReport} className="bg-slate-50/80 dark:bg-muted/30 rounded-2xl border border-border/60 p-6 sm:p-7 shadow-2xs space-y-5">
                  {/* Category Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Issue Category
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "general", label: "General System" },
                        { id: "reservations", label: "Room Reservations" },
                        { id: "meals", label: "Meal Stubs" },
                        { id: "attendance", label: "Attendance Log" },
                        { id: "account", label: "Account / Access" },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setReportCategory(cat.id)}
                          className={cn(
                            "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                            reportCategory === cat.id
                              ? "bg-sidebar text-white shadow-xs"
                              : "bg-white dark:bg-background border border-border/70 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="issue-title" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Issue Subject <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="issue-title"
                      placeholder="e.g., Cannot submit room reservation request for Level 2"
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      className="text-sm h-12 rounded-xl border-slate-200/90 dark:border-border bg-white dark:bg-background shadow-2xs"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="issue-description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Detailed Explanation <span className="text-rose-500">*</span>
                    </Label>
                    <textarea
                      id="issue-description"
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      rows={5}
                      className="flex w-full rounded-xl border border-slate-200/90 dark:border-border bg-white dark:bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none shadow-2xs"
                      placeholder="Please describe what happened, steps to reproduce, and any error messages..."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Contact Email for Updates
                    </Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={reportEmail}
                      onChange={(e) => setReportEmail(e.target.value)}
                      placeholder="Your email address"
                      className="text-sm h-12 rounded-xl border-slate-200/90 dark:border-border bg-white dark:bg-background shadow-2xs"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmittingReport}
                    className="w-full text-sm font-bold h-12 rounded-xl bg-sidebar hover:bg-sidebar/90 text-white shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    {isSubmittingReport ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        <span>Submitting Ticket...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Submit Problem Ticket</span>
                      </>
                    )}
                  </Button>
                </form>
              </div>

              {/* Right Column: SLA Banner */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-blue-50/70 dark:bg-blue-950/20 p-6 sm:p-7 rounded-2xl border border-blue-200/70 dark:border-blue-900/40 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-blue-950 dark:text-blue-200">
                        Support SLA Guarantee
                      </h4>
                      <p className="text-xs text-blue-800/80 dark:text-blue-300/80">
                        Typical turnaround time
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
                    Your ticket is automatically triaged and assigned to the IT administration workforce. Standard response time is within 24 to 48 hours on operating days.
                  </p>
                </div>
              </div>
            </div>
          )
        )}

      </div>
    </div>
  );
}

export default function MySettingsPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex justify-center py-10"><LoaderCircle className="h-8 w-8 animate-spin" /></div>}>
        <MySettingsContent />
      </Suspense>
    </AppLayout>
  );
}
