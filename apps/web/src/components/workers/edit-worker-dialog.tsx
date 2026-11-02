"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  Label,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  Checkbox,
} from "@studio/ui";
import {
  UserCog,
  X,
  Mail,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  User,
  Sparkles,
  History,
  LoaderCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { Worker, Role, Ministry } from "@studio/types";
import { WorkerActivityLog } from "./worker-activity-log";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/use-audit-log";
import { isValidPhilippineNumber, cleanPhoneNumber, isValidEmail, cleanName, isValidName, MAX_LENGTHS } from "@/lib/validation";
import {
  updateWorker as updateWorkerSql,
  assignRolesToWorker,
  adminSendPasswordResetEmail,
} from "@/actions/db";

interface EditWorkerDialogProps {
  worker: Worker | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: Role[];
  ministries: Ministry[];
  canManage: boolean;
  isSuperAdmin?: boolean;
  currentWorkerProfile?: Worker | null;
  onSuccess?: () => void;
}

export function EditWorkerDialog({
  worker,
  open,
  onOpenChange,
  roles,
  ministries,
  canManage,
  isSuperAdmin,
  currentWorkerProfile,
  onSuccess,
}: EditWorkerDialogProps) {
  const { toast } = useToast();
  const { logAction } = useAuditLog();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"details" | "activity">("details");
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const [formData, setFormData] = useState<Partial<Worker>>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    roleId: "viewer",
    status: "Active",
    majorMinistryId: "",
    minorMinistryId: "",
    birthDate: "",
    isSeniorPastor: false,
    isPastor: false,
    address: "",
    startMonth: "",
    startYear: "",
    remarks: "",
  });

  const [roleIds, setRoleIds] = useState<string[]>(["viewer"]);

  useEffect(() => {
    if (worker && open) {
      setActiveTab("details");
      setFormData({
        firstName: worker.firstName || "",
        lastName: worker.lastName || "",
        email: worker.email || "",
        phone: worker.phone || "",
        roleId: worker.roleId || "viewer",
        status: worker.status || "Active",
        majorMinistryId: worker.majorMinistryId || "",
        minorMinistryId: worker.minorMinistryId || "",
        birthDate: worker.birthDate || "",
        isSeniorPastor: worker.isSeniorPastor ?? false,
        isPastor: (worker as any).isPastor ?? false,
        address: worker.address || "",
        startMonth: worker.startMonth || "",
        startYear: worker.startYear || "",
        remarks: worker.remarks || "",
      });

      const fromRoles = (worker as any).roles?.map((wr: any) => wr.roleId) as
        | string[]
        | undefined;
      if (fromRoles && fromRoles.length > 0) {
        setRoleIds(fromRoles);
      } else if (worker.roleId) {
        setRoleIds([worker.roleId]);
      } else {
        setRoleIds(["viewer"]);
      }
    }
  }, [worker, open]);

  const toggleRole = (roleId: string) => {
    if (!canManage) return;
    setRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const visibleRoles = useMemo(() => {
    return (roles || []).filter((r) => {
      if (isSuperAdmin) return true;
      const lower = (r.name || "").toLowerCase().trim();
      // On Ministry Head (MH) side, remove Ministry Head and Super Admin / Admin roles
      if (
        lower.includes("super admin") ||
        lower === "admin" ||
        lower.includes("admin") ||
        lower.includes("ministry head") ||
        lower === "head" ||
        r.id === "admin" ||
        r.id === "super_admin" ||
        r.id === "ministry_head"
      ) {
        return false;
      }
      return true;
    });
  }, [roles, isSuperAdmin]);

  const getRoleDisplayName = (name: string) => {
    if (!name) return "";
    if (name.toLowerCase() === "super admin") return "Admin";
    return name.replace(/^super\s+admin$/i, "Admin");
  };

  const groupedMinistries = useMemo(() => {
    const groups: Record<string, Ministry[]> = {};
    ministries.forEach((m) => {
      const dept = m.department || "Other";
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(m);
    });
    return groups;
  }, [ministries]);

  const handleResetPassword = async () => {
    if (!worker?.email || !worker?.id) {
      toast({
        variant: "destructive",
        title: "No Email",
        description: "This worker does not have an email address configured.",
      });
      return;
    }

    try {
      setIsSendingReset(true);
      await adminSendPasswordResetEmail(worker.id, window.location.origin);
      await logAction(
        "Requested Password Reset",
        "Workers",
        `Admin sent password reset email to ${worker.firstName} ${worker.lastName}`,
        worker.id,
        `${worker.firstName} ${worker.lastName}`
      );
      toast({
        title: "Reset Link Sent",
        description: `A password reset link has been emailed to ${worker.email}.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to Send Email",
        description: error.message || "Failed to send reset email.",
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!worker?.id) return;

    const trimmedFirst = formData.firstName?.trim() || "";
    const trimmedLast = formData.lastName?.trim() || "";
    if (!trimmedFirst || !trimmedLast) {
      toast({
        variant: "destructive",
        title: "Required Fields Missing",
        description: "Please enter both first name and last name.",
      });
      return;
    }
    if (!isValidName(trimmedFirst) || trimmedFirst.length > MAX_LENGTHS.FIRST_NAME) {
      toast({
        variant: "destructive",
        title: "Invalid First Name",
        description: `First name cannot exceed ${MAX_LENGTHS.FIRST_NAME} characters or 8 words.`,
      });
      return;
    }
    if (!isValidName(trimmedLast) || trimmedLast.length > MAX_LENGTHS.LAST_NAME) {
      toast({
        variant: "destructive",
        title: "Invalid Last Name",
        description: `Last name cannot exceed ${MAX_LENGTHS.LAST_NAME} characters or 8 words.`,
      });
      return;
    }

    if (formData.email?.trim()) {
      if (formData.email.trim().length > MAX_LENGTHS.EMAIL || !isValidEmail(formData.email.trim())) {
        toast({
          variant: "destructive",
          title: "Invalid Email Address",
          description: "Please enter a valid email address (up to 100 characters).",
        });
        return;
      }
    }
    if (formData.address && formData.address.length > MAX_LENGTHS.ADDRESS) {
      toast({
        variant: "destructive",
        title: "Address Too Long",
        description: `Address must not exceed ${MAX_LENGTHS.ADDRESS} characters.`,
      });
      return;
    }
    if (formData.remarks && formData.remarks.length > 500) {
      toast({
        variant: "destructive",
        title: "Remarks Too Long",
        description: "Remarks must not exceed 500 characters.",
      });
      return;
    }

    if (formData.phone?.trim() && !isValidPhilippineNumber(formData.phone.trim())) {
      toast({
        variant: "destructive",
        title: "Invalid Contact Number",
        description: "Phone number must be exactly 11 digits starting with 09 (e.g. 09171234567) and numbers only.",
      });
      return;
    }

    if (roleIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Role Required",
        description: "Please assign at least one role to this worker.",
      });
      return;
    }

    try {
      setIsSaving(true);
      const isMinistryChanging =
        (formData.majorMinistryId !== undefined &&
          formData.majorMinistryId !== (worker.majorMinistryId || "")) ||
        (formData.minorMinistryId !== undefined &&
          formData.minorMinistryId !== (worker.minorMinistryId || ""));

      const primaryRoleId = roleIds[0] ?? "viewer";
      const payload: Partial<Worker> = {
        ...formData,
        roleId: primaryRoleId,
      };

      await updateWorkerSql(worker.id, payload);
      await logAction(
        "Updated Worker",
        "Workers",
        `Updated worker: ${formData.firstName} ${formData.lastName}`,
        worker.id,
        `${formData.firstName} ${formData.lastName}`
      );
      toast({
        title: "Worker Updated",
        description: "Worker profile has been updated successfully.",
      });

      await assignRolesToWorker(worker.id, roleIds);

      await queryClient.invalidateQueries({ queryKey: ["workers"] });
      await queryClient.invalidateQueries({ queryKey: ["worker-stats"] });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error.message || "Could not save worker profile.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!worker) return null;

  const workerIdFormatted = worker.workerId ? String(worker.workerId).replace(/^COG-?/i, "").padStart(6, "0") : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl h-[90dvh] sm:h-[86vh] max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl border-border/80 shadow-2xl gap-0 bg-background [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">
          Edit Worker - {worker.firstName} {worker.lastName}
        </DialogTitle>

        {/* ── MODAL HEADER ── */}
        <div className="p-5 pb-4 border-b border-border/70 bg-card/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <UserCog className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold font-headline tracking-tight text-foreground">
                    Edit Worker Profile
                  </h2>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-2xs border shrink-0",
                      formData.status === "Active"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        : formData.status === "Inactive"
                        ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                    )}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        formData.status === "Active"
                          ? "bg-emerald-500"
                          : formData.status === "Inactive"
                          ? "bg-rose-500"
                          : "bg-amber-500"
                      )}
                    />
                    {formData.status}
                  </span>
                </div>
                {workerIdFormatted && (
                  <div className="mt-1">
                    <span className="inline-flex font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/70 shrink-0">
                      {workerIdFormatted}
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Update personal details, roles, ministry assignment, and permissions for{" "}
                  <span className="font-semibold text-foreground">
                    {worker.firstName} {worker.lastName}
                  </span>
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer shrink-0 -mt-1 -mr-1"
              title="Close modal"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          {/* Segmented Tabs */}
          <div className="grid grid-cols-2 gap-1.5 mt-4 p-1 rounded-xl bg-muted/60 border border-border/50 h-10 items-center">
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={cn(
                "h-8 flex items-center justify-center gap-1.5 px-2.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer",
                activeTab === "details"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">Profile &amp; Assignments</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("activity")}
              className={cn(
                "h-8 flex items-center justify-center gap-1.5 px-2.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer",
                activeTab === "activity"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <History className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">Activity Log</span>
            </button>
          </div>
        </div>

        {/* ── MODAL BODY ── */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Migration / First login notice */}
          {(worker as any)?.legacyMigratedAt ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200/70 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2.5 shadow-2xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Legacy access migrated via{" "}
                <strong className="font-semibold">
                  {(worker as any).legacyMigratedFrom || "login"}
                </strong>{" "}
                on{" "}
                {format(
                  new Date((worker as any).legacyMigratedAt),
                  "MMM d, yyyy 'at' h:mm a"
                )}
              </span>
            </div>
          ) : (worker as any)?.passwordChangeRequired ? (
            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2.5 shadow-2xs">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Pending first login. Worker has not yet set their permanent password.
              </span>
            </div>
          ) : null}

          {activeTab === "activity" ? (
            <div className="p-4 rounded-2xl border border-border/70 bg-card/60 shadow-2xs">
              <WorkerActivityLog workerId={worker.id} />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              {/* SECTION 1: Personal Information */}
              <div className="p-4 rounded-2xl border border-border/70 bg-card/60 shadow-2xs space-y-3.5">
                <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                  <User className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Personal Information
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-firstName" className="text-xs font-semibold">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="edit-firstName"
                      maxLength={MAX_LENGTHS.FIRST_NAME}
                      value={formData.firstName || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: cleanName(e.target.value, MAX_LENGTHS.FIRST_NAME) })
                      }
                      placeholder="e.g. John"
                      className="h-9 text-xs rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-lastName" className="text-xs font-semibold">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="edit-lastName"
                      maxLength={MAX_LENGTHS.LAST_NAME}
                      value={formData.lastName || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: cleanName(e.target.value, MAX_LENGTHS.LAST_NAME) })
                      }
                      placeholder="e.g. Doe"
                      className="h-9 text-xs rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-email" className="text-xs font-semibold">
                      Email Address
                    </Label>
                    <Input
                      id="edit-email"
                      type="email"
                      maxLength={MAX_LENGTHS.EMAIL}
                      value={formData.email || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="e.g. john.doe@studio.com"
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-phone" className="text-xs font-semibold">
                      Phone Number
                    </Label>
                    <Input
                      id="edit-phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={11}
                      value={formData.phone || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: cleanPhoneNumber(e.target.value) })
                      }
                      placeholder="09171234567"
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-birthDate" className="text-xs font-semibold">
                      Date of Birth
                    </Label>
                    <Input
                      id="edit-birthDate"
                      type="date"
                      value={formData.birthDate || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, birthDate: e.target.value })
                      }
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-address" className="text-xs font-semibold">
                      Home Address
                    </Label>
                    <Input
                      id="edit-address"
                      maxLength={MAX_LENGTHS.ADDRESS}
                      value={formData.address || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      placeholder="e.g. Quezon City, Metro Manila"
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Roles & Permissions */}
              <div className="p-4 rounded-2xl border border-border/70 bg-card/60 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between pb-1 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Roles & Permissions
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {roleIds.length} {roleIds.length === 1 ? "role" : "roles"} selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {visibleRoles.map((r) => {
                    const isChecked = roleIds.includes(r.id);
                    return (
                      <label
                        key={r.id}
                        htmlFor={`edit-role-${r.id}`}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none",
                          isChecked
                            ? "bg-primary/5 border-primary/40 text-foreground shadow-2xs"
                            : "bg-background/80 border-border/60 hover:bg-muted/50 text-muted-foreground"
                        )}
                      >
                        <Checkbox
                          id={`edit-role-${r.id}`}
                          checked={isChecked}
                          onCheckedChange={() => toggleRole(r.id)}
                          disabled={!canManage}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground leading-tight">
                            {getRoleDisplayName(r.name)}
                          </p>
                          {(r as any).description && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                              {(r as any).description}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
                {roleIds.length === 0 && (
                  <p className="text-xs font-semibold text-destructive mt-1">
                    At least one role must be selected.
                  </p>
                )}
              </div>

              {/* SECTION 3: Ministry & Employment */}
              <div className="p-4 rounded-2xl border border-border/70 bg-card/60 shadow-2xs space-y-3.5">
                <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Ministry & Worker Status
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Ministry</Label>
                    <Select
                      value={formData.majorMinistryId || "none"}
                      onValueChange={(v) =>
                        setFormData({
                          ...formData,
                          majorMinistryId: v === "none" ? "" : v,
                          minorMinistryId: "",
                        })
                      }
                    >
                      <SelectTrigger className="h-9 text-xs rounded-xl">
                        <SelectValue placeholder="Select a ministry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {Object.entries(groupedMinistries).map(([dept, mins]) => (
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
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Worker Type</Label>
                    <Select
                      value={formData.employmentType || "Volunteer"}
                      onValueChange={(v) =>
                        setFormData({ ...formData, employmentType: v as any })
                      }
                      disabled={!canManage}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-xl">
                        <SelectValue placeholder="Select worker type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Full-Time" className="text-xs">Full-Time</SelectItem>
                        <SelectItem value="On-Call" className="text-xs">On-Call</SelectItem>
                        <SelectItem value="Volunteer" className="text-xs">Volunteer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Account Status</Label>
                    <Select
                      value={formData.status || "Active"}
                      onValueChange={(v) =>
                        setFormData({ ...formData, status: v as any })
                      }
                      disabled={!canManage && !worker}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-xl">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active" className="text-xs">Active</SelectItem>
                        <SelectItem value="Inactive" className="text-xs">Inactive</SelectItem>
                        <SelectItem value="Pending Approval" className="text-xs">Pending Approval</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Pastoral & Service Information */}
              <div className="p-4 rounded-2xl border border-border/70 bg-card/60 shadow-2xs space-y-3.5">
                <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                  <Sparkles className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Pastoral & Service Records
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    htmlFor="edit-isSeniorPastor"
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none",
                      formData.isSeniorPastor
                        ? "bg-primary/5 border-primary/40 text-foreground shadow-2xs"
                        : "bg-background/80 border-border/60 hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <Checkbox
                      id="edit-isSeniorPastor"
                      checked={formData.isSeniorPastor ?? false}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          isSeniorPastor: checked === true,
                          isPastor: checked === true ? false : (formData as any).isPastor,
                        } as any)
                      }
                      disabled={!canManage}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground leading-tight">
                        Senior Pastor
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Designated senior pastoral leadership
                      </p>
                    </div>
                  </label>

                  <label
                    htmlFor="edit-isPastor"
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none",
                      (formData as any).isPastor
                        ? "bg-primary/5 border-primary/40 text-foreground shadow-2xs"
                        : "bg-background/80 border-border/60 hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <Checkbox
                      id="edit-isPastor"
                      checked={(formData as any).isPastor ?? false}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          isPastor: checked === true,
                          isSeniorPastor:
                            checked === true ? false : formData.isSeniorPastor,
                        } as any)
                      }
                      disabled={!canManage}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground leading-tight">
                        Pastor
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Ordained / pastoral staff member
                      </p>
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-startMonth" className="text-xs font-semibold">
                      Start Month
                    </Label>
                    <Input
                      id="edit-startMonth"
                      value={formData.startMonth || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, startMonth: e.target.value })
                      }
                      placeholder="e.g. January"
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-startYear" className="text-xs font-semibold">
                      Start Year
                    </Label>
                    <Input
                      id="edit-startYear"
                      value={formData.startYear || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, startYear: e.target.value })
                      }
                      placeholder="e.g. 2024"
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="edit-remarks" className="text-xs font-semibold">
                    Remarks & Notes
                  </Label>
                  <Textarea
                    id="edit-remarks"
                    value={formData.remarks || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, remarks: e.target.value })
                    }
                    placeholder="Add any internal notes, certifications, or remarks..."
                    rows={2}
                    className="text-xs rounded-xl resize-none"
                  />
                </div>
              </div>
            </form>
          )}
        </div>

        {/* ── MODAL FOOTER ── */}
        <div className="p-3.5 sm:p-4 border-t border-border/70 bg-card/80 backdrop-blur-md flex flex-row items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            {worker.email ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetPassword}
                disabled={isSendingReset || isSaving}
                className="rounded-xl text-xs font-semibold gap-1.5 cursor-pointer shadow-2xs px-2.5 sm:px-3 whitespace-nowrap"
              >
                {isSendingReset ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <Mail className="h-3.5 w-3.5 text-primary" />
                )}
                <span>Send Reset Link</span>
              </Button>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="rounded-xl text-xs font-semibold px-3 sm:px-4 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleSave()}
              disabled={isSaving || roleIds.length === 0}
              className="rounded-xl text-xs font-bold px-3.5 sm:px-5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md gap-1.5 cursor-pointer whitespace-nowrap"
            >
              {isSaving ? (
                <>
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
