"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Settings,
  ArrowLeft,
  Save,
  LoaderCircle,
  Building2,
  SlidersHorizontal,
  Ticket,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { useUserRole } from "@/hooks/use-user-role";
import { useToast } from "@/hooks/use-toast";
import { isValidEmail } from "@/lib/validation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@studio/ui";
import { cn } from "@/lib/utils";

// ── Toggle switch ──────────────────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sidebar/20",
        value ? "bg-sidebar dark:bg-sky-600" : "bg-muted-foreground/25"
      )}
    >
      <span
        className={cn(
          "absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200",
          value ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

// ── Field ──────────────────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label className="text-xs font-semibold text-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Toggle Row ─────────────────────────────────────────────────────────────────
function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="p-3 sm:px-4 rounded-xl border border-border/60 bg-muted/[0.12] flex items-center justify-between gap-4 hover:border-sidebar/40 hover:bg-muted/[0.22] transition-all group shadow-2xs">
      <div className="min-w-0">
        <p className="text-xs sm:text-sm font-semibold text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

const SETTINGS_KEY = "cog_general_settings";

interface GeneralSettings {
  appName: string;
  supportEmail: string;
  timezone: string;
  defaultLanguage: string;
  emailNotifications: boolean;
  maintenanceMode: boolean;
  auditLogging: boolean;
  weeklyPoolSize: string;
  restrictedDays: string;
  autoRollover: boolean;
}

const defaults: GeneralSettings = {
  appName: "Church of God Dasmariñas",
  supportEmail: "",
  timezone: "Asia/Manila",
  defaultLanguage: "English",
  emailNotifications: true,
  maintenanceMode: false,
  auditLogging: true,
  weeklyPoolSize: "1200",
  restrictedDays: "",
  autoRollover: false,
};

export default function GeneralSettingsPage() {
  const router = useRouter();
  const { canManageRoles, isLoading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<GeneralSettings>(defaults);
  const [initialSettings, setInitialSettings] = useState<GeneralSettings>(defaults);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const loaded = { ...defaults, ...JSON.parse(stored) };
        setSettings(loaded);
        setInitialSettings(loaded);
      }
    } catch {}
  }, []);

  // Track if there are unsaved changes
  const isDirty = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(initialSettings);
  }, [settings, initialSettings]);

  const set = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    // 1. Validation: Application Name required
    if (!settings.appName.trim()) {
      toast({
        variant: "destructive",
        title: "Required Field",
        description: "Application Name cannot be empty.",
      });
      return;
    }

    // 2. Validation: Valid Support Email if provided
    if (settings.supportEmail.trim() && !isValidEmail(settings.supportEmail.trim())) {
      toast({
        variant: "destructive",
        title: "Invalid Email Address",
        description: "Please enter a valid Support Email address (e.g. support@church.org).",
      });
      return;
    }

    // 3. Validation: Weekly Pool Size non-negative number
    const poolNum = Number(settings.weeklyPoolSize);
    if (isNaN(poolNum) || poolNum < 0) {
      toast({
        variant: "destructive",
        title: "Invalid Pool Size",
        description: "Weekly Pool Size must be a valid positive number or 0.",
      });
      return;
    }

    setSaving(true);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      setInitialSettings(settings);
      await new Promise(r => setTimeout(r, 200));
      toast({ title: "Settings saved", description: "Your changes have been applied successfully." });
    } catch {
      toast({ variant: "destructive", title: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  // Cancel button validation & action
  const handleCancel = () => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      toast({
        title: "No changes made",
        description: "Returning to settings menu.",
      });
      router.push("/settings");
    }
  };

  const handleBack = () => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      router.push("/settings");
    }
  };

  if (roleLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 pb-12 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight text-foreground">
              General
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Application name, system preferences and global defaults.
            </p>
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 h-9 px-3.5 sm:px-4 rounded-xl border border-border/60 bg-white dark:bg-card text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors shrink-0 shadow-2xs self-end sm:self-auto sm:ml-auto cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Application Settings */}
          <div className="bg-white dark:bg-card rounded-2xl border border-border/60 shadow-card-dark overflow-hidden flex flex-col justify-between h-full">
            <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/[0.12] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sidebar/10 text-sidebar dark:text-sky-400 flex items-center justify-center shrink-0 border border-sidebar/20">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold font-headline text-foreground">Application Settings</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Core identity shown across the app.</p>
              </div>
            </div>
            <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 flex-1">
              <Field label="Application Name" hint="Displayed in the title bar.">
                <input
                  value={settings.appName}
                  onChange={e => set("appName", e.target.value)}
                  placeholder="e.g. Church of God Dasmariñas"
                  className="h-9 text-xs sm:text-sm rounded-xl border border-border/70 bg-muted/[0.15] focus:bg-background px-3 focus:border-sidebar/60 focus:ring-2 focus:ring-sidebar/20 transition-all text-foreground w-full"
                />
              </Field>
              <Field label="Support Email">
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={e => set("supportEmail", e.target.value)}
                  placeholder="support@church.org"
                  className="h-9 text-xs sm:text-sm rounded-xl border border-border/70 bg-muted/[0.15] focus:bg-background px-3 focus:border-sidebar/60 focus:ring-2 focus:ring-sidebar/20 transition-all text-foreground w-full"
                />
              </Field>
              <Field label="Timezone" hint="Used for all logs & schedules.">
                <input
                  value={settings.timezone}
                  onChange={e => set("timezone", e.target.value)}
                  className="h-9 text-xs sm:text-sm rounded-xl border border-border/70 bg-muted/[0.15] focus:bg-background px-3 focus:border-sidebar/60 focus:ring-2 focus:ring-sidebar/20 transition-all text-foreground w-full"
                />
              </Field>
              <Field label="Default Language">
                <input
                  value={settings.defaultLanguage}
                  onChange={e => set("defaultLanguage", e.target.value)}
                  className="h-9 text-xs sm:text-sm rounded-xl border border-border/70 bg-muted/[0.15] focus:bg-background px-3 focus:border-sidebar/60 focus:ring-2 focus:ring-sidebar/20 transition-all text-foreground w-full"
                />
              </Field>
            </div>
          </div>

          {/* System Preferences */}
          <div className="bg-white dark:bg-card rounded-2xl border border-border/60 shadow-card-dark overflow-hidden flex flex-col justify-between h-full">
            <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/[0.12] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sidebar/10 text-sidebar dark:text-sky-400 flex items-center justify-center shrink-0 border border-sidebar/20">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold font-headline text-foreground">System Preferences</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Behaviour of background tasks and notifications.</p>
              </div>
            </div>
            <div className="p-4 sm:p-5 flex flex-col gap-2.5 flex-1 justify-center">
              <ToggleRow label="Email Notifications" desc="Send digests for important events." value={settings.emailNotifications} onChange={v => set("emailNotifications", v)} />
              <ToggleRow label="Maintenance mode" desc="Temporarily disable member access." value={settings.maintenanceMode} onChange={v => set("maintenanceMode", v)} />
              <ToggleRow label="Audit Logging" desc="Record every change to the audit trail." value={settings.auditLogging} onChange={v => set("auditLogging", v)} />
            </div>
          </div>

          {/* Meal Stub Allocation — full width */}
          <div className="lg:col-span-2 bg-white dark:bg-card rounded-2xl border border-border/60 shadow-card-dark overflow-hidden flex flex-col justify-between">
            <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/[0.12] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sidebar/10 text-sidebar dark:text-sky-400 flex items-center justify-center shrink-0 border border-sidebar/20">
                <Ticket className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold font-headline text-foreground">Meal Stub Allocation</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Defaults applied when distributing stubs.</p>
              </div>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <Field label="Weekly Pool Size" hint="Total stubs available each week.">
                  <input
                    type="number"
                    value={settings.weeklyPoolSize}
                    onChange={e => set("weeklyPoolSize", e.target.value)}
                    className="h-9 text-xs sm:text-sm rounded-xl border border-border/70 bg-muted/[0.15] focus:bg-background px-3 focus:border-sidebar/60 focus:ring-2 focus:ring-sidebar/20 transition-all text-foreground w-full"
                  />
                </Field>
                <Field label="Restricted Days">
                  <input
                    value={settings.restrictedDays}
                    onChange={e => set("restrictedDays", e.target.value)}
                    placeholder="e.g. Saturday"
                    className="h-9 text-xs sm:text-sm rounded-xl border border-border/70 bg-muted/[0.15] focus:bg-background px-3 focus:border-sidebar/60 focus:ring-2 focus:ring-sidebar/20 transition-all text-foreground w-full"
                  />
                </Field>
              </div>
              <ToggleRow label="Auto-rollover unused stubs" desc="Carry remaining stubs to next week." value={settings.autoRollover} onChange={v => set("autoRollover", v)} />
            </div>

            {/* Footer actions */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60 bg-muted/[0.08]">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                {isDirty ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium border border-amber-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Unsaved changes pending
                  </span>
                ) : (
                  <span className="text-muted-foreground/80">All settings saved</span>
                )}
              </div>
              <div className="flex items-center gap-2.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="h-9 px-4 rounded-xl border border-border/60 bg-white dark:bg-card text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors shadow-2xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className={cn(
                    "h-9 px-4 flex items-center gap-2 rounded-xl text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer",
                    isDirty
                      ? "bg-sidebar hover:bg-sidebar/90"
                      : "bg-sidebar/60 opacity-60 cursor-not-allowed"
                  )}
                >
                  {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Discard Confirmation Dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1">
              <AlertCircle className="w-5 h-5" />
            </div>
            <AlertDialogTitle className="text-base font-bold font-headline">
              Discard Unsaved Changes?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              You have unsaved changes. Are you sure you want to discard your modifications?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
            <AlertDialogCancel
              onClick={() => setShowDiscardDialog(false)}
              className="rounded-xl text-xs h-9 cursor-pointer"
            >
              Keep Editing
            </AlertDialogCancel>
            <button
              type="button"
              onClick={() => {
                setSettings(initialSettings);
                setShowDiscardDialog(false);
                toast({
                  title: "Settings Reverted",
                  description: "All fields have been reverted to saved values.",
                });
              }}
              className="h-9 px-3.5 rounded-xl border border-border/70 text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
            >
              Reset to Saved
            </button>
            <AlertDialogAction
              onClick={() => {
                setSettings(initialSettings);
                setShowDiscardDialog(false);
                toast({
                  title: "Changes Discarded",
                  description: "Changes discarded.",
                });
                router.push("/settings");
              }}
              className="rounded-xl text-xs h-9 bg-destructive hover:bg-destructive/90 text-white font-semibold cursor-pointer"
            >
              Discard & Exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
