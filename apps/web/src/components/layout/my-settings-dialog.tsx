"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
} from "@studio/ui";
import {
  Smartphone,
  LogOut,
  KeyRound,
  HelpCircle,
  AlertCircle,
  Shield,
  LoaderCircle,
} from "lucide-react";
import { useAuthStore } from "@studio/store";
import { supabase } from "@studio/database";
import { useToast } from "@/hooks/use-toast";
import { isValidEmail } from "@/lib/validation";
import { requestPasswordReset } from "@/actions/auth";
import { DeleteConfirmationDialog } from "@/components/common/delete-confirmation-dialog";
import { useUserRole } from "@/hooks/use-user-role";
import { submitProblemReport } from "@/actions/db";

interface MySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MySettingsDialog({ open, onOpenChange }: MySettingsDialogProps) {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { workerProfile, isSuperAdmin, canManageWorkers, canManageRoles } = useUserRole();
  const isAdmin = isSuperAdmin || canManageWorkers || canManageRoles;
  
  const [activeTab, setActiveTab] = useState("password");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState(false);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

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
      await supabase.auth.signOut({ scope: "global" });
      toast({
        title: "Logged out from all devices",
        description: "You have been logged out from all devices.",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to logout from all devices.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent 
        className="max-w-4xl max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col bg-card rounded-2xl border border-border/60 shadow-card-dark" 
        onPointerDownOutside={(e) => {
          e.preventDefault();
        }}
      >
        {/* Header with blue toolbar style - matching room reservation */}
        <DialogHeader className="px-6 pt-6 pb-5 shrink-0 bg-sidebar border-b border-sidebar-border/40">
          <DialogTitle className="text-2xl font-bold font-headline text-white">
            Settings
          </DialogTitle>
          <DialogDescription className="text-sm text-white/70 mt-1">
            Manage your account settings and preferences
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Vertical Tab List - Sidebar with enhanced styling matching room reservation */}
          <div className="flex flex-col gap-1.5 p-4 bg-slate-100/90 dark:bg-muted border-r border-slate-200/70 dark:border-border/50 overflow-y-auto w-56 shrink-0">
            <button
              onClick={() => setActiveTab("password")}
              className={`flex items-center gap-3 px-4 py-3 text-left text-sm font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === "password"
                  ? "bg-sidebar text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground hover:bg-white/50 dark:hover:bg-muted/50"
              }`}
            >
              <KeyRound className="h-4 w-4" />
              <span>Change Password</span>
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`flex items-center gap-3 px-4 py-3 text-left text-sm font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === "security"
                  ? "bg-sidebar text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground hover:bg-white/50 dark:hover:bg-muted/50"
              }`}
            >
              <Shield className="h-4 w-4" />
              <span>Login Security</span>
            </button>
            {!isAdmin && (
              <button
                onClick={() => setActiveTab("support")}
                className={`flex items-center gap-3 px-4 py-3 text-left text-sm font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === "support"
                    ? "bg-sidebar text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground hover:bg-white/50 dark:hover:bg-muted/50"
                }`}
              >
                <HelpCircle className="h-4 w-4" />
                <span>Help & Support</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab("report")}
              className={`flex items-center gap-3 px-4 py-3 text-left text-sm font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === "report"
                  ? "bg-sidebar text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground hover:bg-white/50 dark:hover:bg-muted/50"
              }`}
            >
              <AlertCircle className="h-4 w-4" />
              <span>{isAdmin ? "Helpdesk Reports" : "Report Problem"}</span>
            </button>
          </div>

          {/* Tab Content - Main Area with enhanced card styling */}
          <div className="flex-1 overflow-y-auto p-6 min-w-0 bg-white dark:bg-background">
            {activeTab === "password" && (
              <div className="space-y-5 max-w-2xl">
                {/* Section Header */}
                <div className="space-y-2">
                  <h3 className="text-xl font-bold font-headline text-foreground">Change Password</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Update your account password. We'll send a reset link to your email.
                  </p>
                </div>
                
                {/* Main Card - matching room reservation style */}
                <div className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm space-y-5">
                  <div className="space-y-2.5">
                    <Label htmlFor="email" className="text-sm font-semibold text-foreground">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ""}
                      disabled
                      className="bg-muted text-sm font-medium h-11 rounded-xl border-border/60"
                    />
                  </div>
                  <Button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword}
                    className="w-full text-sm font-semibold h-11 rounded-xl bg-sidebar hover:bg-sidebar/90 text-white shadow-xs"
                  >
                    {isChangingPassword ? "Sending..." : "Send Password Reset Email"}
                  </Button>
                </div>

                {/* Info Banner */}
                <div className="bg-blue-50/70 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-200/70 dark:border-blue-900/40">
                  <p className="text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
                    <span className="font-bold">Note:</span> You'll receive an email with instructions to reset your password. The link will expire in 1 hour.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-5 max-w-2xl">
                {/* Section Header */}
                <div className="space-y-2">
                  <h3 className="text-xl font-bold font-headline text-foreground">Login Security</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Manage your login sessions and devices
                  </p>
                </div>

                {/* Active Devices Card */}
                <div className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm space-y-4">
                  <h4 className="text-sm font-bold flex items-center gap-2.5 text-foreground">
                    <div className="p-2 rounded-lg bg-sidebar/10">
                      <Smartphone className="h-4 w-4 text-sidebar" />
                    </div>
                    Login Devices
                  </h4>
                  <div className="bg-emerald-50/70 dark:bg-emerald-950/20 rounded-xl p-5 border border-emerald-200/70 dark:border-emerald-900/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300">Current Device</p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">Active now</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Online</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This is your current active session. To view all devices, contact support.
                  </p>
                </div>

                {/* Logout All Devices Card */}
                <div className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm space-y-4">
                  <h4 className="text-sm font-bold flex items-center gap-2.5 text-foreground">
                    <div className="p-2 rounded-lg bg-rose-500/10">
                      <LogOut className="h-4 w-4 text-rose-500" />
                    </div>
                    Logout from All Devices
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    This will log you out from all devices including this one. You'll need to log in again.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={() => setShowLogoutAllConfirm(true)}
                    className="w-full text-sm font-semibold h-11 rounded-xl shadow-xs"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout All Devices
                  </Button>

                  <DeleteConfirmationDialog
                    isOpen={showLogoutAllConfirm}
                    onClose={() => setShowLogoutAllConfirm(false)}
                    onConfirm={handleLogoutAllDevices}
                    title="Logout from All Devices?"
                    confirmLabel="Logout All Devices"
                    description="Are you sure you want to sign out from all devices? All active sessions across computers, tablets, and kiosks will be invalidated."
                  />
                </div>

                {/* Security Tip */}
                <div className="bg-amber-50/70 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200/70 dark:border-amber-900/40">
                  <p className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                    <span className="font-bold">Security Tip:</span> Regularly review your active sessions and logout from devices you don't recognize.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "support" && !isAdmin && (
              <div className="space-y-5 max-w-2xl">
                {/* Section Header */}
                <div className="space-y-2">
                  <h3 className="text-xl font-bold font-headline text-foreground">Help & Support</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Get help with using the application
                  </p>
                </div>

                {/* FAQ Section */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-sidebar" />
                    Frequently Asked Questions
                  </h4>
                  <div className="space-y-2.5">
                    <details className="group bg-card rounded-xl p-5 border border-border/60 shadow-sm hover:shadow-md hover:border-sidebar/30 transition-all">
                      <summary className="cursor-pointer font-bold text-sm text-foreground flex items-center justify-between">
                        <span>How do I reserve a room?</span>
                        <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <p className="mt-3 text-sm text-muted-foreground leading-relaxed pl-0.5">
                        Go to Room Reservations → Reserve a Room, select your date, time, and room, then submit your request.
                      </p>
                    </details>
                    <details className="group bg-card rounded-xl p-5 border border-border/60 shadow-sm hover:shadow-md hover:border-sidebar/30 transition-all">
                      <summary className="cursor-pointer font-bold text-sm text-foreground flex items-center justify-between">
                        <span>How do I view my QR code?</span>
                        <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <p className="mt-3 text-sm text-muted-foreground leading-relaxed pl-0.5">
                        Click on "My QR Code" in the sidebar or bottom navigation to view your personal QR code.
                      </p>
                    </details>
                    <details className="group bg-card rounded-xl p-5 border border-border/60 shadow-sm hover:shadow-md hover:border-sidebar/30 transition-all">
                      <summary className="cursor-pointer font-bold text-sm text-foreground flex items-center justify-between">
                        <span>How do I check my attendance?</span>
                        <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <p className="mt-3 text-sm text-muted-foreground leading-relaxed pl-0.5">
                        Navigate to Attendance → Personal Log to view your attendance history.
                      </p>
                    </details>
                  </div>
                </div>

                {/* Contact Card */}
                <div className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-foreground">Need More Help?</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Contact the IT department or submit a problem report.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setActiveTab("report")} 
                    className="w-full text-sm font-semibold h-11 rounded-xl border-sidebar/30 hover:bg-sidebar/10 hover:text-sidebar"
                  >
                    Report a Problem
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "report" && (
              isAdmin ? (
                <div className="space-y-5 max-w-2xl">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sidebar/10 text-sidebar dark:text-blue-400 text-xs font-bold border border-sidebar/20">
                      <Shield className="w-3.5 h-3.5" />
                      <span>IT Administration Helpdesk</span>
                    </div>
                    <h3 className="text-xl font-bold font-headline text-foreground">Worker Problem Reports</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      As an administrator, technical problem reports and tickets submitted by church workers and ministry heads are routed directly to you.
                    </p>
                  </div>

                  <div className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm space-y-4">
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      You are an administrator and do not need to submit problem reports from here. All incoming tickets submitted by workers and ministry heads are collected and manageable in real-time.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button
                        onClick={() => {
                          onOpenChange(false);
                          window.location.href = "/my-settings?tab=report";
                        }}
                        className="bg-sidebar hover:bg-sidebar/90 text-white font-semibold text-xs h-11 rounded-xl shadow-xs cursor-pointer"
                      >
                        Open Helpdesk Reports
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
              <div className="space-y-5 max-w-2xl">
                {/* Section Header */}
                <div className="space-y-2">
                  <h3 className="text-xl font-bold font-headline text-foreground">Report a Problem</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Let us know if you're experiencing any issues
                  </p>
                </div>

                {/* Report Form Card */}
                <div className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm space-y-5">
                  <div className="space-y-2.5">
                    <Label htmlFor="issue-title" className="text-sm font-semibold text-foreground">
                      Issue Title <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="issue-title"
                      placeholder="Brief description of the problem"
                      value={issueTitle}
                      onChange={(e) => setIssueTitle(e.target.value)}
                      className="text-sm h-11 rounded-xl border-border/60"
                    />
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="issue-description" className="text-sm font-semibold text-foreground">
                      Description <span className="text-destructive">*</span>
                    </Label>
                    <textarea
                      id="issue-description"
                      value={issueDescription}
                      onChange={(e) => setIssueDescription(e.target.value)}
                      className="flex min-h-[140px] w-full rounded-xl border border-border/60 bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                      placeholder="Please describe the problem in detail..."
                    />
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="contact-email" className="text-sm font-semibold text-foreground">Contact Email (Optional)</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="Your email for follow-up"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="text-sm h-11 rounded-xl border-border/60"
                    />
                  </div>
                  <Button
                    disabled={isSubmittingReport}
                    onClick={async () => {
                      if (!issueTitle.trim() || !issueDescription.trim()) {
                        toast({
                          variant: "destructive",
                          title: "Required Fields Missing",
                          description: "Please fill in both the issue title and description.",
                        });
                        return;
                      }
                      if (contactEmail.trim() && !isValidEmail(contactEmail.trim())) {
                        toast({
                          variant: "destructive",
                          title: "Invalid Email",
                          description: "Please provide a valid email format for follow-up.",
                        });
                        return;
                      }

                      setIsSubmittingReport(true);
                      try {
                        const reporterName = workerProfile
                          ? [workerProfile.firstName, workerProfile.lastName].filter(Boolean).join(" ")
                          : (user?.user_metadata?.full_name as string) || user?.email || "Staff / Worker";

                        const result = await submitProblemReport({
                          category: "general",
                          subject: issueTitle.trim(),
                          description: issueDescription.trim(),
                          contactEmail: contactEmail.trim() || user?.email || null,
                          reporterName,
                          workerId: workerProfile?.id || user?.id || null,
                        });

                        toast({
                          title: "Problem Report Submitted",
                          description: `Your ticket (${result.ticketRef}) has been sent to IT support.`,
                        });
                        setIssueTitle("");
                        setIssueDescription("");
                        setContactEmail("");
                        onOpenChange(false);
                      } catch (err: any) {
                        toast({
                          variant: "destructive",
                          title: "Submission Failed",
                          description: err?.message || "Could not submit report. Please try again.",
                        });
                      } finally {
                        setIsSubmittingReport(false);
                      }
                    }}
                    className="w-full text-sm font-semibold h-11 rounded-xl bg-sidebar hover:bg-sidebar/90 text-white shadow-xs cursor-pointer"
                  >
                    {isSubmittingReport ? (
                      <span className="flex items-center justify-center gap-2">
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        <span>Submitting Ticket...</span>
                      </span>
                    ) : (
                      "Submit Report"
                    )}
                  </Button>
                </div>

                {/* Info Banner */}
                <div className="bg-blue-50/70 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-200/70 dark:border-blue-900/40">
                  <p className="text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
                    <span className="font-bold">Note:</span> Your report will be sent to the IT department for review. We typically respond within 24-48 hours.
                  </p>
                </div>
              </div>
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
