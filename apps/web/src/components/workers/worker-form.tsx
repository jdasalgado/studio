"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@studio/ui";
import { Label } from "@studio/ui";
import { Input } from "@studio/ui";
import { Textarea } from "@studio/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@studio/ui";
import { Checkbox } from "@studio/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@studio/ui";
import { Mail } from "lucide-react";
import type { Worker, Role, Ministry } from "@studio/types";
import { WorkerActivityLog } from "./worker-activity-log";
import { assignRolesToWorker } from "@/actions/db";
import { useToast } from "@/hooks/use-toast";
import { isValidPhilippineNumber, cleanPhoneNumber, isValidEmail, isValidName, cleanName, MAX_LENGTHS } from "@/lib/validation";
import Link from "next/link";

interface WorkerFormProps {
  worker: Partial<Worker> | null;
  roles: Role[];
  ministries: Ministry[];
  onSave: (worker: Partial<Worker>, roleIds: string[]) => Promise<void>;
  onClose: () => void;
  onResetPassword?: (worker: Worker) => void;
  canManage: boolean;
}

export function WorkerForm({
  worker,
  roles,
  ministries,
  onSave,
  onClose,
  onResetPassword,
  canManage,
}: WorkerFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<Worker>>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    roleId: "viewer",
    status: "Active",
    avatarUrl: `https://picsum.photos/seed/${Math.random()}/100/100`,
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

  // Multi-role state: list of selected role IDs
  const [roleIds, setRoleIds] = useState<string[]>(["viewer"]);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    if (worker) {
      setAgreedToTerms(true);
      setFormData({
        ...worker,
        firstName: worker.firstName || "",
        lastName: worker.lastName || "",
        email: worker.email || "",
        phone: worker.phone || "",
        roleId: worker.roleId || "viewer",
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
      // Populate roleIds from worker.roles join table; fall back to legacy roleId
      const fromRoles = (worker as any).roles?.map((wr: any) => wr.roleId) as string[] | undefined;
      if (fromRoles && fromRoles.length > 0) {
        setRoleIds(fromRoles);
      } else if (worker.roleId) {
        setRoleIds([worker.roleId]);
      } else {
        setRoleIds(["viewer"]);
      }
    } else {
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        roleId: "viewer",
        status: "Active",
        avatarUrl: `https://picsum.photos/seed/${Math.random()}/100/100`,
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
      setRoleIds(["viewer"]);
    }
  }, [worker, canManage]);

  const toggleRole = (roleId: string) => {
    setRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId],
    );
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

  const MinistrySelect = ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <Select
      value={value || "none"}
      onValueChange={(v) => onChange(v === "none" ? "" : v)}
    >
      <SelectTrigger className="col-span-3">
        <SelectValue placeholder="Select a ministry" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">None</SelectItem>
        {Object.entries(groupedMinistries).map(([dept, mins]) => (
          <SelectGroup key={dept}>
            <SelectLabel className="text-muted-foreground uppercase text-xs tracking-wider">
              {dept}
            </SelectLabel>
            {[...mins]
              .sort((a, b) => {
                const wA = a.weight ?? 0;
                const wB = b.weight ?? 0;
                if (wA !== wB) return wA - wB;
                return a.name.localeCompare(b.name);
              })
              .map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );

  const handleSave = async () => {
    if (!formData.firstName?.trim() || !formData.lastName?.trim()) {
      toast({
        variant: "destructive",
        title: "Required Fields Missing",
        description: "Please enter both first name and last name.",
      });
      return;
    }

    if (!isValidName(formData.firstName.trim(), 2, MAX_LENGTHS.FIRST_NAME)) {
      toast({
        variant: "destructive",
        title: "Invalid First Name",
        description: `First name must contain only letters and not exceed ${MAX_LENGTHS.FIRST_NAME} characters.`,
      });
      return;
    }

    if (!isValidName(formData.lastName.trim(), 2, MAX_LENGTHS.LAST_NAME)) {
      toast({
        variant: "destructive",
        title: "Invalid Last Name",
        description: `Last name must contain only letters and not exceed ${MAX_LENGTHS.LAST_NAME} characters.`,
      });
      return;
    }

    if (formData.email?.trim() && !isValidEmail(formData.email.trim(), MAX_LENGTHS.EMAIL)) {
      toast({
        variant: "destructive",
        title: "Invalid Email Address",
        description: `Please enter a valid email format (up to ${MAX_LENGTHS.EMAIL} characters).`,
      });
      return;
    }

    if (formData.address && formData.address.trim().length > MAX_LENGTHS.ADDRESS) {
      toast({
        variant: "destructive",
        title: "Address Too Long",
        description: `Address must not exceed ${MAX_LENGTHS.ADDRESS} characters.`,
      });
      return;
    }

    if (formData.remarks && formData.remarks.trim().length > 500) {
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

    if (!worker && !agreedToTerms) {
      toast({
        variant: "destructive",
        title: "Terms & Privacy Acceptance Required",
        description: "Please confirm that the worker has reviewed and accepted the Terms of Service and Privacy Policy.",
      });
      return;
    }

    // Keep legacy roleId in sync with first selected role
    const primaryRoleId = roleIds[0] ?? "viewer";
    const dataToSave: Partial<Worker> = {
      ...formData,
      roleId: primaryRoleId,
      ...((!worker && agreedToTerms) ? {
        termsAcceptedVersion: "1.0",
        termsAcceptedAt: new Date().toISOString(),
      } : {}),
    };

    // Pass roleIds to parent so it can handle full synchronization
    await onSave(dataToSave, roleIds);
  };

  const fields = (
    <div className="grid gap-4 py-1">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="firstName" className="text-right">First Name</Label>
        <div className="col-span-3 space-y-1">
          <Input id="firstName" maxLength={MAX_LENGTHS.FIRST_NAME} value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: cleanName(e.target.value, MAX_LENGTHS.FIRST_NAME) })} />
        </div>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="lastName" className="text-right">Last Name</Label>
        <div className="col-span-3 space-y-1">
          <Input id="lastName" maxLength={MAX_LENGTHS.LAST_NAME} value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: cleanName(e.target.value, MAX_LENGTHS.LAST_NAME) })} />
        </div>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="email" className="text-right">Email</Label>
        <Input id="email" type="email" maxLength={MAX_LENGTHS.EMAIL} value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value.slice(0, MAX_LENGTHS.EMAIL) })} className="col-span-3" />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="phone" className="text-right">Phone</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="numeric"
          maxLength={11}
          placeholder="09171234567"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: cleanPhoneNumber(e.target.value) })}
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="birthDate" className="text-right">Date of Birth</Label>
        <Input id="birthDate" type="date" value={formData.birthDate || ""} onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })} className="col-span-3" />
      </div>

      {/* Multi-role checkbox list */}
      <div className="grid grid-cols-4 items-start gap-4">
        <Label className="text-right pt-1">Roles</Label>
        <div className="col-span-3 flex flex-col gap-2">
          {roles.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <Checkbox
                id={`role-${r.id}`}
                checked={roleIds.includes(r.id)}
                onCheckedChange={() => toggleRole(r.id)}
                disabled={!canManage}
              />
              <Label htmlFor={`role-${r.id}`} className="font-normal cursor-pointer">
                {r.name}
              </Label>
            </div>
          ))}
          {roleIds.length === 0 && (
            <p className="text-xs text-destructive">At least one role must be selected.</p>
          )}
        </div>
      </div>

      {worker && (
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="status" className="text-right">Status</Label>
          <Select value={formData.status || "Active"} onValueChange={(v: any) => setFormData({ ...formData, status: v })} disabled={!canManage}>
            <SelectTrigger className="col-span-3"><SelectValue placeholder="Select a status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-4 items-center gap-4">
        <Label className="text-right">Ministry</Label>
        <MinistrySelect value={formData.majorMinistryId || ""} onChange={(v) => setFormData({ ...formData, majorMinistryId: v, minorMinistryId: "" })} />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="employmentType" className="text-right">Worker Type</Label>
        <Select value={formData.employmentType || "Volunteer"} onValueChange={(v: any) => setFormData({ ...formData, employmentType: v })} disabled={!canManage}>
          <SelectTrigger className="col-span-3"><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Full-Time">Full-Time</SelectItem>
            <SelectItem value="On-Call">On-Call</SelectItem>
            <SelectItem value="Volunteer">Volunteer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Additional Info section */}
      <div className="pt-2 border-t">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Additional Info</p>
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Senior Pastor</Label>
            <div className="col-span-3 flex items-center gap-2">
              <Checkbox
                id="isSeniorPastor"
                checked={formData.isSeniorPastor ?? false}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isSeniorPastor: checked === true, isPastor: checked === true ? false : (formData as any).isPastor } as any)
                }
                disabled={!canManage}
              />
              <Label htmlFor="isSeniorPastor" className="font-normal cursor-pointer">
                This worker is a Senior Pastor
              </Label>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Pastor</Label>
            <div className="col-span-3 flex items-center gap-2">
              <Checkbox
                id="isPastor"
                checked={(formData as any).isPastor ?? false}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isPastor: checked === true, isSeniorPastor: checked === true ? false : formData.isSeniorPastor } as any)
                }
                disabled={!canManage}
              />
              <Label htmlFor="isPastor" className="font-normal cursor-pointer">
                This worker is a Pastor
              </Label>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="address" className="text-right">Address</Label>
            <Input
              id="address"
              maxLength={MAX_LENGTHS.ADDRESS}
              value={formData.address || ""}
              onChange={(e) => setFormData({ ...formData, address: e.target.value.slice(0, MAX_LENGTHS.ADDRESS) })}
              className="col-span-3"
              placeholder="Full address"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="startMonth" className="text-right">Start Month</Label>
            <Input
              id="startMonth"
              value={formData.startMonth || ""}
              onChange={(e) => setFormData({ ...formData, startMonth: e.target.value })}
              className="col-span-3"
              placeholder="e.g. January"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="startYear" className="text-right">Start Year</Label>
            <Input
              id="startYear"
              value={formData.startYear || ""}
              onChange={(e) => setFormData({ ...formData, startYear: e.target.value })}
              className="col-span-3"
              placeholder="e.g. 2020"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="remarks" className="text-right pt-2">Remarks</Label>
            <Textarea
              id="remarks"
              value={formData.remarks || ""}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="col-span-3"
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>
        </div>
      </div>
    </div>
  );
  return (
    <div className="space-y-6">
      <div className="pb-2 underline-offset-4">
        <h2 className="text-2xl font-headline font-semibold">
          {worker ? "Edit Worker" : "Add New Worker"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {worker 
            ? `Update the details for ${worker.firstName} ${worker.lastName}.` 
            : "Fill in the details for the new worker."}
        </p>
      </div>

      {worker ? (
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-0 space-y-6">
            {fields}
            <div className="flex flex-row items-center justify-between gap-2 pt-6 border-t mt-6">
              {worker && onResetPassword && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onResetPassword(worker as Worker)} 
                  className="sm:mr-auto"
                >
                  <Mail className="mr-2 h-4 w-4" /> Send Reset Link
                </Button>
              )}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={roleIds.length === 0}>
                  Save changes
                </Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="activity">
            <WorkerActivityLog workerId={worker.id!} />
            <div className="mt-8 pt-4 border-t text-right">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-6">
          {fields}

          {/* Terms & Privacy Agreement for New Worker */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2 mt-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="worker-form-terms-checkbox"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(Boolean(checked))}
                className="mt-0.5 shrink-0"
              />
              <label
                htmlFor="worker-form-terms-checkbox"
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
                (Version 1.0). <span className="text-destructive font-bold">*</span>
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground pl-7">
              This acceptance is required before the worker profile can be created.
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-6 border-t">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={roleIds.length === 0 || !agreedToTerms}>
              Save changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

