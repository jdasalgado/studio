"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { useRoles } from "@/hooks/use-roles";
import { useMinistries } from "@/hooks/use-ministries";
import { useUserRole } from "@/hooks/use-user-role";
import { useToast } from "@/hooks/use-toast";
import { showSubmitSuccess, showSubmitError } from "@/hooks/use-submission-modal";
import { LoaderCircle, ArrowLeft, ArrowRight, User, Building2, FileText, ClipboardCheck, CheckCircle2, Briefcase } from "lucide-react";
import { createWorkerWithAuth } from "@/actions/db";
import { useAuditLog } from "@/hooks/use-audit-log";
import Link from "next/link";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  Checkbox,
} from "@studio/ui";
import { cn } from "@/lib/utils";
import { isValidPhilippineNumber, cleanPhoneNumber, isValidEmail, isValidName, cleanName, MAX_LENGTHS } from "@/lib/validation";
import type { Worker } from "@studio/types";

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Personal Information", sub: "Worker Details",        icon: User },
  { id: 2, label: "Church Assignment",    sub: "Role & Ministry",       icon: Building2 },
  { id: 3, label: "Additional Information", sub: "Notes & Emergency",   icon: FileText },
  { id: 4, label: "Review",               sub: "Confirm & Submit",      icon: ClipboardCheck },
];

// ── Stepper ───────────────────────────────────────────────────────────────────
function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-card-dark px-6 py-4">
      <div className="flex items-center justify-between">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = step.id === currentStep;
          const isDone = step.id < currentStep;
          return (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                  isDone ? "bg-emerald-500 text-white" :
                  isActive ? "bg-primary text-white" :
                  "bg-muted text-muted-foreground"
                )}>
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <div className="hidden sm:block min-w-0">
                  <p className={cn("text-xs font-bold leading-tight", isActive ? "text-foreground" : isDone ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                    {step.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{step.sub}</p>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("flex-1 max-w-[60px] h-px mx-3 shrink-0", step.id < currentStep ? "bg-emerald-400" : "bg-border/60")} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── Field component ───────────────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Onboarding Tips ───────────────────────────────────────────────────────────
function OnboardingTips({ tips }: { tips: string[] }) {
  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-card-dark p-5">
      <h3 className="text-sm font-bold text-foreground mb-3">Onboarding Tips</h3>
      <ul className="space-y-2">
        {tips.map((tip, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NewWorkerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { logAction } = useAuditLog();
  const { roles, isLoading: rolesLoading } = useRoles();
  const { ministries, isLoading: ministriesLoading } = useMinistries();
  const { workerProfile, canManageWorkers, isSuperAdmin, canManageRoles, isLoading: userRoleLoading } = useUserRole();

  const isAdmin = isSuperAdmin || canManageRoles;

  const isLoading = rolesLoading || ministriesLoading || userRoleLoading;

  const groupedMinistries = useMemo(() => {
    const groups: Record<string, typeof ministries> = {};
    ministries.forEach((m) => {
      const dept = m.department || "Other";
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(m);
    });
    return groups;
  }, [ministries]);

  const availableRoleCards = useMemo(() => {
    const allCards = [
      {
        id: "worker",
        label: "WORKER",
        icon: (
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        ),
        activeBorder: "border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20",
        activeBg: "bg-gradient-to-b from-indigo-500/12 via-indigo-500/5 to-transparent dark:from-indigo-500/20 dark:via-indigo-500/10 dark:to-transparent",
        iconBoxActive: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700/80 shadow-xs",
        iconBoxDefault: "bg-indigo-500/10 text-indigo-500/70 dark:text-indigo-400/70 border-indigo-200/50 dark:border-indigo-800/40",
        activeText: "text-indigo-600 dark:text-indigo-400 font-extrabold",
        checkBg: "bg-indigo-600 dark:bg-indigo-500 text-white",
      },
      {
        id: "ministry_head",
        label: "MINISTRY HEAD",
        icon: (
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        ),
        activeBorder: "border-emerald-500 dark:border-emerald-400 ring-2 ring-emerald-500/20",
        activeBg: "bg-gradient-to-b from-emerald-500/12 via-emerald-500/5 to-transparent dark:from-emerald-500/20 dark:via-emerald-500/10 dark:to-transparent",
        iconBoxActive: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/80 shadow-xs",
        iconBoxDefault: "bg-emerald-500/10 text-emerald-500/70 dark:text-emerald-400/70 border-emerald-200/50 dark:border-emerald-800/40",
        activeText: "text-emerald-600 dark:text-emerald-400 font-extrabold",
        checkBg: "bg-emerald-600 dark:bg-emerald-500 text-white",
      },
      {
        id: "admin",
        label: "ADMIN",
        icon: (
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
        activeBorder: "border-orange-500 dark:border-orange-400 ring-2 ring-orange-500/20",
        activeBg: "bg-gradient-to-b from-orange-500/12 via-orange-500/5 to-transparent dark:from-orange-950/20 dark:via-orange-950/10 dark:to-transparent",
        iconBoxActive: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700/80 shadow-xs",
        iconBoxDefault: "bg-orange-500/10 text-orange-500/70 dark:text-orange-400/70 border-orange-200/50 dark:border-orange-800/40",
        activeText: "text-orange-600 dark:text-orange-400 font-extrabold",
        checkBg: "bg-orange-600 dark:bg-orange-500 text-white",
      },
    ];

    if (isAdmin) {
      return allCards;
    }
    return allCards.filter((c) => c.id === "worker");
  }, [isAdmin]);

  const [step, setStep] = useState(1);

  // Form state — Step 1: Personal Information
  const [firstName, setFirstName]   = useState("");
  const [lastName, setLastName]     = useState("");
  const [email, setEmail]           = useState("");
  const [phone, setPhone]           = useState("");
  const [birthDate, setBirthDate]   = useState("");
  const [address, setAddress]       = useState("");

  // Form state — Step 2: Church Assignment
  const [roleId, setRoleId]               = useState("");
  const [majorMinistryId, setMajorMinistryId] = useState("");
  const [minorMinistryId, setMinorMinistryId] = useState("");
  const [employmentType, setEmploymentType]   = useState("Full-Time");
  const [startDate, setStartDate]             = useState("");

  const DEPT_OPTIONS = useMemo(() => [
    "Worship",
    "Outreach",
    "Relationship",
    "Discipleship",
    "Administration",
  ], []);

  const selectedRole = useMemo(() => roles.find(r => r.id === roleId), [roles, roleId]);
  const isMinistryHeadRole = useMemo(() => 
    roleId === "ministry_head" || 
    Boolean(selectedRole && (selectedRole.name.toLowerCase().includes("ministry head") || selectedRole.name.toLowerCase() === "head")),
    [roleId, selectedRole]
  );
  const isAdminRole = useMemo(() => 
    roleId === "admin" || 
    Boolean(selectedRole && (selectedRole.name.toLowerCase().includes("admin") || selectedRole.isSuperAdmin)),
    [roleId, selectedRole]
  );

  // Auto-select role based on permissions
  useEffect(() => {
    if (roles.length > 0) {
      const workerRole = roles.find(r => r.name.toLowerCase().includes("worker") || r.id === "worker") || roles[0];
      if (!isAdmin) {
        if (workerRole && roleId !== workerRole.id) {
          setRoleId(workerRole.id);
        }
      } else if (!roleId && workerRole) {
        setRoleId(workerRole.id);
      }
    }
  }, [roles, roleId, isAdmin]);

  // Auto-select first ministry when loaded
  useEffect(() => {
    if (isAdminRole) {
      if (majorMinistryId) setMajorMinistryId("");
      return;
    }
    if (!majorMinistryId && ministries.length > 0) {
      if (isMinistryHeadRole) {
        setMajorMinistryId("Worship");
      } else {
        const firstDept = Object.keys(groupedMinistries)[0];
        const mins = groupedMinistries[firstDept];
        const firstSorted = mins && mins.length > 0
          ? [...mins].sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0) || a.name.localeCompare(b.name))[0]
          : ministries[0];
        if (firstSorted) {
          setMajorMinistryId(firstSorted.id);
        }
      }
    }
  }, [ministries, groupedMinistries, majorMinistryId, isMinistryHeadRole, isAdminRole]);

  // Form state — Step 3: Additional Information
  const [remarks, setRemarks]             = useState("");
  const [isSeniorPastor, setIsSeniorPastor] = useState(false);
  const [isPastor, setIsPastor]           = useState(false);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  const [saving, setSaving] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const validateStep1 = () => {
    if (!firstName.trim()) { toast({ variant: "destructive", title: "First name is required" }); return false; }
    if (!isValidName(firstName.trim(), 2, MAX_LENGTHS.FIRST_NAME)) {
      toast({
        variant: "destructive",
        title: "Invalid First Name",
        description: `First name must contain only letters and not exceed ${MAX_LENGTHS.FIRST_NAME} characters.`,
      });
      return false;
    }
    if (!lastName.trim())  { toast({ variant: "destructive", title: "Last name is required" }); return false; }
    if (!isValidName(lastName.trim(), 2, MAX_LENGTHS.LAST_NAME)) {
      toast({
        variant: "destructive",
        title: "Invalid Last Name",
        description: `Last name must contain only letters and not exceed ${MAX_LENGTHS.LAST_NAME} characters.`,
      });
      return false;
    }
    if (!email.trim())     { toast({ variant: "destructive", title: "Email is required" }); return false; }
    if (!isValidEmail(email.trim(), MAX_LENGTHS.EMAIL)) {
      toast({
        variant: "destructive",
        title: "Invalid Email Address",
        description: `Please enter a valid email format (up to ${MAX_LENGTHS.EMAIL} characters).`,
      });
      return false;
    }
    if (address && address.trim().length > MAX_LENGTHS.ADDRESS) {
      toast({
        variant: "destructive",
        title: "Address Too Long",
        description: `Address must not exceed ${MAX_LENGTHS.ADDRESS} characters.`,
      });
      return false;
    }
    if (!phone.trim())     { toast({ variant: "destructive", title: "Mobile number is required" }); return false; }
    if (!isValidPhilippineNumber(phone.trim())) {
      toast({
        variant: "destructive",
        title: "Invalid Contact Number",
        description: "Mobile number must be exactly 11 digits starting with 09 (e.g. 09171234567) and numbers only.",
      });
      return false;
    }
    if (!birthDate.trim()) { toast({ variant: "destructive", title: "Birth date is required" }); return false; }
    if (!address.trim())   { toast({ variant: "destructive", title: "Address is required" }); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!isAdminRole && !majorMinistryId) {
      toast({ variant: "destructive", title: "Ministry is required" });
      return false;
    }
    if (!startDate) {
      toast({ variant: "destructive", title: "Start date is required" });
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!emergencyName.trim()) {
      toast({ variant: "destructive", title: "Emergency contact name is required" });
      return false;
    }
    if (!isValidName(emergencyName.trim(), 2, MAX_LENGTHS.EMERGENCY_NAME)) {
      toast({
        variant: "destructive",
        title: "Invalid Emergency Contact Name",
        description: `Emergency contact name can only contain letters and must not exceed ${MAX_LENGTHS.EMERGENCY_NAME} characters.`,
      });
      return false;
    }
    if (remarks && remarks.trim().length > 500) {
      toast({
        variant: "destructive",
        title: "Remarks Too Long",
        description: "Remarks must not exceed 500 characters.",
      });
      return false;
    }
    if (!emergencyPhone.trim()) {
      toast({ variant: "destructive", title: "Emergency contact phone is required" });
      return false;
    }
    if (!isValidPhilippineNumber(emergencyPhone.trim())) {
      toast({
        variant: "destructive",
        title: "Invalid Emergency Phone",
        description: "Emergency phone must be exactly 11 digits starting with 09 (e.g. 09171234567) and numbers only.",
      });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    setStep(s => Math.min(4, s + 1));
  };

  const handlePrev = () => setStep(s => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (!validateStep1()) { setStep(1); return; }
    if (!validateStep2()) { setStep(2); return; }
    if (!validateStep3()) { setStep(3); return; }
    if (!agreedToTerms) {
      toast({
        variant: "destructive",
        title: "Terms & Privacy Acceptance Required",
        description: "Please confirm that the worker has reviewed and accepted the Terms of Service and Privacy Policy.",
      });
      return;
    }
    setSaving(true);
    try {
      const workerId = String(20000 + Math.floor(Math.random() * 10000)).padStart(6, "0");
      const termsAcceptedAt = new Date().toISOString();
      const termsAcceptedVersion = "1.0";
      const data = { 
        firstName, 
        lastName, 
        email: email.trim(), 
        phone: phone.trim(), 
        birthDate, 
        address, 
        majorMinistryId, 
        minorMinistryId, 
        roleId: roleId || "viewer", 
        employmentType, 
        status: "Active", 
        workerId, 
        avatarUrl: "", 
        remarks, 
        isSeniorPastor, 
        isPastor,
        startDate,
        emergencyName,
        emergencyPhone,
        termsAcceptedVersion,
        termsAcceptedAt,
      };
      const newWorker: any = await createWorkerWithAuth(data, roleId ? [roleId] : [], workerProfile?.id);
      if (!newWorker || newWorker.success === false || newWorker.error) {
        toast({ 
          variant: "destructive", 
          title: "Save Failed", 
          description: newWorker?.error || "Could not save worker profile." 
        });
        return;
      }
      await logAction("Created Worker", "Workers", `Created worker: ${firstName} ${lastName} (Terms v${termsAcceptedVersion} accepted)`, newWorker.id, `${firstName} ${lastName}`);
      if (newWorker.emailSent) {
        showSubmitSuccess({
          title: "Worker Registered Successfully!",
          description: `${firstName} ${lastName} has been added. Credentials and details were sent to ${email}.`,
          confirmText: "View Workers",
          onConfirm: () => router.push("/workers"),
        });
      } else {
        showSubmitSuccess({
          title: "Worker Added Successfully",
          description: `Worker was saved, but email could not be sent: ${newWorker.emailError || "Email delivery failed"}.`,
          confirmText: "View Workers",
          onConfirm: () => router.push("/workers"),
        });
      }
    } catch (error: any) {
      const msg = error?.message?.includes("Minified React error #441")
        ? "Could not save worker profile. The email address may already be in use by another worker."
        : (error?.message || "Could not save worker profile.");
      toast({ variant: "destructive", title: "Save Failed", description: msg });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <AppLayout><div className="flex justify-center py-10"><LoaderCircle className="h-8 w-8 animate-spin" /></div></AppLayout>;
  if (!canManageWorkers) return <AppLayout><div className="p-10 text-center"><h1 className="text-2xl font-bold">Access Denied</h1></div></AppLayout>;

  const step1Tips = [
    "Use the worker's legal name for accurate records.",
    "Email is used for login and notifications.",
    "Role determines what the worker can access in COG App.",
    "You can change ministry and role anytime later.",
  ];

  return (
    <AppLayout>
      <div className="space-y-6 pb-12">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">Register a New Worker</h1>
            <p className="text-sm text-muted-foreground">
              A guided onboarding flow — your progress saves automatically as you type.
            </p>
          </div>
          <button
            onClick={() => router.push("/workers")}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl border border-border/60 bg-card text-sm font-medium text-foreground hover:bg-muted/40 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>

        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Stepper */}
          <Stepper currentStep={step} />

        {/* Content + Tips */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-start">

          {/* Form card */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-card-dark overflow-hidden">
            <div className="px-7 pt-7 pb-4 border-b border-border/40">
              <h2 className="text-lg font-bold text-foreground">{STEPS[step - 1].label}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Step {step} of {STEPS.length}</p>
            </div>

            <div className="px-7 py-6">
              {step === 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                  <Field label="First Name" required>
                    <Input maxLength={MAX_LENGTHS.FIRST_NAME} value={firstName} onChange={e => setFirstName(cleanName(e.target.value, MAX_LENGTHS.FIRST_NAME))} className="h-10 rounded-xl border-border/60 bg-background" />
                  </Field>
                  <Field label="Last Name" required>
                    <Input maxLength={MAX_LENGTHS.LAST_NAME} value={lastName} onChange={e => setLastName(cleanName(e.target.value, MAX_LENGTHS.LAST_NAME))} className="h-10 rounded-xl border-border/60 bg-background" />
                  </Field>
                  <Field label="Email" required>
                    <Input type="email" maxLength={MAX_LENGTHS.EMAIL} value={email} onChange={e => setEmail(e.target.value.slice(0, MAX_LENGTHS.EMAIL))} className="h-10 rounded-xl border-border/60 bg-background" />
                  </Field>
                  <Field label="Mobile Number" required>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="09171234567"
                      value={phone}
                      onChange={e => setPhone(cleanPhoneNumber(e.target.value))}
                      className="h-10 rounded-xl border-border/60 bg-background"
                    />
                  </Field>
                  <Field label="Birth Date" required>
                    <Input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="h-10 rounded-xl border-border/60 bg-background" />
                  </Field>
                  <Field label="Address" required>
                    <Input maxLength={MAX_LENGTHS.ADDRESS} value={address} onChange={e => setAddress(e.target.value.slice(0, MAX_LENGTHS.ADDRESS))} className="h-10 rounded-xl border-border/60 bg-background" />
                  </Field>
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col gap-6">
                  {/* Role cards */}
                  <div>
                    <p className="text-sm font-medium text-foreground mb-3">
                      Choose a Role <span className="text-red-500">*</span>
                    </p>
                    <div className={cn("grid gap-3.5", availableRoleCards.length === 1 ? "grid-cols-1 w-full" : "grid-cols-1 sm:grid-cols-3")}>
                      {availableRoleCards.map(card => {
                        const role = roles.find(r => r.name.toLowerCase().includes(card.id.replace("_", " ")) || r.id === card.id);
                        const isSelected = roleId === (role?.id || card.id);
                        return (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => {
                              const newRoleId = role?.id || card.id;
                              setRoleId(newRoleId);
                              if (card.id === "admin" || role?.name?.toLowerCase().includes("admin") || role?.isSuperAdmin) {
                                setMajorMinistryId("");
                                setMinorMinistryId("");
                              } else if (card.id === "ministry_head" || role?.name?.toLowerCase().includes("ministry head") || role?.name?.toLowerCase() === "head") {
                                if (!DEPT_OPTIONS.includes(majorMinistryId)) {
                                  const currentMin = ministries.find((m) => m.id === majorMinistryId);
                                  const matchedDept = currentMin?.department && DEPT_OPTIONS.includes(currentMin.department as string)
                                    ? (currentMin.department as string)
                                    : "Worship";
                                  setMajorMinistryId(matchedDept);
                                }
                              } else {
                                if (DEPT_OPTIONS.includes(majorMinistryId) || !majorMinistryId) {
                                  const mins = (majorMinistryId && groupedMinistries[majorMinistryId]) || groupedMinistries[Object.keys(groupedMinistries)[0]] || ministries;
                                  if (mins.length > 0) {
                                    setMajorMinistryId(mins[0].id);
                                  }
                                }
                              }
                            }}
                            className={cn(
                              "relative w-full flex flex-col items-center justify-center text-center gap-3 py-6 px-6 rounded-2xl border-2 transition-colors shadow-xs",
                              availableRoleCards.length === 1 ? "cursor-default" : "cursor-pointer",
                              isSelected
                                ? `${card.activeBorder} ${card.activeBg}`
                                : "border-border/60 bg-card"
                            )}
                          >
                            {/* Icon box */}
                            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border", isSelected ? card.iconBoxActive : card.iconBoxDefault)}>
                              {card.icon}
                            </div>

                            {/* Text */}
                            <span className={cn("text-xs tracking-widest uppercase text-center", isSelected ? card.activeText : "font-bold text-muted-foreground")}>
                              {card.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ministry, Worker type, Start date */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-5">
                    <Field label="Ministry" required={!isAdminRole}>
                      {isAdminRole ? (
                        <div className="h-10 rounded-xl border border-border/60 bg-muted/40 px-3 flex items-center text-sm text-muted-foreground select-none cursor-not-allowed">
                          General / All Ministries (Admin)
                        </div>
                      ) : (
                        <Select
                          value={majorMinistryId || undefined}
                          onValueChange={(v) => {
                            setMajorMinistryId(v || "");
                            setMinorMinistryId("");
                          }}
                          disabled={ministries.length === 0}
                        >
                          <SelectTrigger 
                            className="h-10 rounded-xl border-border/60 bg-background text-sm" 
                            disabled={ministries.length === 0}
                          >
                            <SelectValue 
                              placeholder={
                                ministries.length === 0 
                                  ? "No ministry assignment available" 
                                  : (isMinistryHeadRole ? "Select department" : "Select ministry")
                              } 
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {isMinistryHeadRole ? (
                              DEPT_OPTIONS.map((dept) => (
                                <SelectItem key={dept} value={dept} className="text-xs">
                                  {dept}
                                </SelectItem>
                              ))
                            ) : (
                              Object.entries(groupedMinistries).map(([dept, mins]) => (
                                <SelectGroup key={dept}>
                                  <SelectLabel className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                                    {dept}
                                  </SelectLabel>
                                  {[...mins]
                                    .sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0) || a.name.localeCompare(b.name))
                                    .map((m) => (
                                      <SelectItem key={m.id} value={m.id} className="text-xs">
                                        {m.name}
                                      </SelectItem>
                                    ))}
                                </SelectGroup>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      )}
                      {isAdminRole && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          General role with system-wide access to all ministries.
                        </p>
                      )}
                    </Field>
                    <Field label="Worker Type" required>
                      <Select
                        value={employmentType}
                        onValueChange={(v) => setEmploymentType(v)}
                      >
                        <SelectTrigger className="h-10 rounded-xl border-border/60 bg-background text-sm">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Full-Time">Full-Time</SelectItem>
                          <SelectItem value="Part-Time">Part-Time</SelectItem>
                          <SelectItem value="Volunteer">Volunteer</SelectItem>
                          <SelectItem value="On-Call">On-Call</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Start Date" required>
                      <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                        className="h-10 rounded-xl border-border/60 bg-background" />
                    </Field>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="flex flex-col gap-5">
                  {/* Toggle cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: "Senior Pastor", desc: "Mark this worker as a senior pastor.", value: isSeniorPastor, set: setIsSeniorPastor },
                      { label: "Pastor",        desc: "Mark this worker as a pastor.",        value: isPastor,       set: setIsPastor },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background px-4 py-3.5">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                        {/* Toggle switch */}
                        <button
                          type="button"
                          onClick={() => {
                            const next = !item.value;
                            item.set(next);
                            if (next && item.label === "Senior Pastor") setIsPastor(false);
                            if (next && item.label === "Pastor") setIsSeniorPastor(false);
                          }}
                          className={cn(
                            "relative w-11 h-6 rounded-full transition-colors shrink-0",
                            item.value ? "bg-primary" : "bg-muted-foreground/25"
                          )}
                        >
                          <span className={cn(
                            "absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200",
                            item.value ? "translate-x-6" : "translate-x-1"
                          )} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Notes */}
                  <Field label="Notes">
                    <textarea
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      rows={4}
                      placeholder=""
                      className="rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none w-full"
                    />
                    <p className="text-[11px] text-muted-foreground">Any context that may help administrators.</p>
                  </Field>

                  {/* Emergency contact */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                    <Field label="Emergency contact name" required>
                      <Input 
                        maxLength={MAX_LENGTHS.EMERGENCY_NAME}
                        value={emergencyName} 
                        onChange={e => setEmergencyName(cleanName(e.target.value, MAX_LENGTHS.EMERGENCY_NAME))} 
                        placeholder="e.g. Maria Santos"
                        className="h-10 rounded-xl border-border/60 bg-background" 
                      />
                    </Field>
                    <Field label="Emergency contact phone" required>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        maxLength={11}
                        placeholder="09171234567"
                        value={emergencyPhone}
                        onChange={e => setEmergencyPhone(cleanPhoneNumber(e.target.value))}
                        className="h-10 rounded-xl border-border/60 bg-background"
                      />
                    </Field>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Please review the information before submitting.</p>
                  
                  {/* Credential Notification Banner */}
                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 flex items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-foreground">Worker Login & Email Dispatch</p>
                      <p className="text-muted-foreground leading-relaxed">
                        The worker will be initialized with the default password <code className="px-1.5 py-0.5 rounded bg-muted font-mono font-bold text-foreground">COGDASMA2026</code>. An email with all their registration details and login credentials will be automatically sent to <strong className="text-foreground">{email}</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/30 divide-y divide-border/40">
                    {[
                      ["First Name", firstName], ["Last Name", lastName],
                      ["Email", email], ["Phone", phone],
                      ["Birth Date", birthDate || "—"], ["Address", address || "—"],
                      ["Role", (() => {
                        const rName = roles.find(r => r.id === roleId)?.name || "—";
                        const base = rName.toLowerCase() === "super admin" ? "Admin" : rName;
                        if (isSeniorPastor) return `${base} (Senior Pastor)`;
                        if (isPastor) return `${base} (Pastor)`;
                        return base;
                      })()],
                      ["Ministry", isAdminRole || !majorMinistryId ? "General / All Ministries (Admin)" : (DEPT_OPTIONS.includes(majorMinistryId) ? majorMinistryId : (ministries.find(m => m.id === majorMinistryId)?.name || majorMinistryId || "—"))],
                      ["Worker Type", employmentType], ["Start Date", startDate || "—"],
                      ["Emergency Contact", emergencyName ? `${emergencyName}${emergencyPhone ? ` (${emergencyPhone})` : ''}` : "—"],
                      ["Default Password", "COGDASMA2026"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                        <span className="text-sm text-foreground font-medium">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Explicit Terms & Privacy Agreement for Registration */}
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="register-terms-checkbox"
                          checked={agreedToTerms}
                          onCheckedChange={(checked) => setAgreedToTerms(Boolean(checked))}
                          className="mt-0.5 shrink-0"
                        />
                        <label
                          htmlFor="register-terms-checkbox"
                          className="text-xs text-foreground leading-relaxed cursor-pointer select-none"
                        >
                          I confirm that this worker has been oriented on and explicitly agrees to the Church of God Dasmariñas{" "}
                          <Link href="/terms" target="_blank" className="font-semibold text-primary underline underline-offset-2 hover:opacity-80">
                            Terms of Service
                          </Link>{" "}
                          and{" "}
                          <Link href="/privacy" target="_blank" className="font-semibold text-primary underline underline-offset-2 hover:opacity-80">
                            Privacy Policy
                          </Link>{" "}
                          (Version 1.0).
                        </label>
                      </div>
                      <p className="text-[11px] text-muted-foreground pl-7">
                        This explicit consent is timestamped and permanently archived with the worker's official governance record.
                      </p>
                    </div>
                  </div>
                )}
              </div>

            {/* Footer navigation */}
            <div className="px-7 py-5 border-t border-border/40 flex items-center justify-between">
              <button
                onClick={handlePrev}
                disabled={step === 1}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl border border-border/60 bg-card text-sm font-medium text-foreground hover:bg-muted/40 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Previous
              </button>

              {step < 4 ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 h-9 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex items-center gap-1.5 h-9 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Submit
                </button>
              )}
            </div>
          </div>

          {/* Onboarding Tips sidebar */}
          <OnboardingTips tips={step1Tips} />
        </div>
        </div>
      </div>
    </AppLayout>
  );
}
