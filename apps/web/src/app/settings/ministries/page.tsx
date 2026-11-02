"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@studio/ui";
import {
  Building2, HeartHandshake, User as UserIcon, Users, LoaderCircle,
  PlusCircle, MoreHorizontal, Edit, Trash2, UserCog, Utensils,
  Eye, ArrowLeft, Search, Copy, ClipboardCheck, X, AlertTriangle,
} from "lucide-react";
import type { Ministry, Worker, Department } from "@studio/types";
import { useUserRole } from "@/hooks/use-user-role";
import { useAuditLog } from "@/hooks/use-audit-log";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@studio/ui";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@studio/ui";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@studio/ui";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@studio/ui";
import { Label } from "@studio/ui";
import { Input } from "@studio/ui";
import { Textarea } from "@studio/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@studio/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@studio/ui";
import { useMinistries } from "@/hooks/use-ministries";
import { useWorkers } from "@/hooks/use-workers";
import { DeleteConfirmationDialog } from "@/components/common/delete-confirmation-dialog";
import { cn } from "@/lib/utils";

const generateMinistryId = (name: string, department: string) =>
  `${department.charAt(0).toUpperCase()}-${name.trim()}`;

// ── Worker initials ────────────────────────────────────────────────────────────
function WorkerInitials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const init = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  return <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sidebar/10 text-sidebar dark:text-sky-400 text-[11px] font-black shrink-0 border border-sidebar/20">{init}</span>;
}

// ── Ministry Form ──────────────────────────────────────────────────────────────
function MinistryForm({ ministry, workers, departments, onSave, onClose }: {
  ministry: Partial<Ministry> | null; workers: Worker[]; departments: Department[];
  onSave: (data: Partial<Ministry>) => void; onClose: () => void;
}) {
  const [formData, setFormData] = useState<Partial<Ministry>>({ name: "", description: "", department: "Worship", leaderId: "", headId: "" });
  useEffect(() => {
    if (ministry) setFormData(ministry);
    else setFormData({ name: "", description: "", department: "Worship", leaderId: "", headId: "", weight: 0 });
  }, [ministry]);

  const set = (field: keyof Ministry, value: string | number) => setFormData(p => ({ ...p, [field]: value }));
  const sorted = [...workers].sort((a, b) => a.firstName.localeCompare(b.firstName));
  const selectedHead = workers.find(w => w.id === formData.headId);
  const [confirmClearHead, setConfirmClearHead] = useState(false);
  const [formError, setFormError] = useState('');

  return (
    <div className="flex flex-col h-full max-h-[90vh] overflow-hidden">
      {/* ── MODAL HEADER ── */}
      <div className="p-5 pb-4 border-b border-border/70 bg-card/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-2xl bg-sidebar/10 text-sidebar dark:text-sky-400 flex items-center justify-center font-bold shrink-0 border border-sidebar/20 shadow-xs mt-0.5">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground font-headline">
                {ministry?.id ? "Edit Ministry" : "Add New Ministry"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                Update ministry details, assigned leadership, and parent department.
              </DialogDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer shrink-0 -mt-1 -mr-1"
            title="Close modal"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div className="p-5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
        {formError && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
            {formError}
          </div>
        )}
        {/* Card 1: Ministry Information */}
        <div className="rounded-2xl border border-border/70 bg-slate-50/60 dark:bg-muted/20 p-4 sm:p-5 space-y-4 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sidebar dark:text-sky-400">
            <Building2 className="h-4 w-4" />
            <span>Ministry Details</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              Ministry Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.name}
              maxLength={50}
              onChange={e => { set("name", e.target.value); setFormError(''); }}
              placeholder="e.g. Media & Tech Ministry"
              className="h-10 rounded-xl border-slate-200/90 dark:border-border text-xs bg-background shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              Department <span className="text-destructive">*</span>
            </Label>
            <Select value={formData.department} onValueChange={v => set("department", v)}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200/90 dark:border-border text-xs bg-background shadow-2xs focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar cursor-pointer">
                <SelectValue placeholder="Select parent department" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-border shadow-xl">
                {departments.map(d => (
                  <SelectItem key={d} value={d} className="text-xs font-medium cursor-pointer">
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Description</Label>
            <Textarea
              value={formData.description}
              maxLength={500}
              onChange={e => { set("description", e.target.value); setFormError(''); }}
              placeholder="Brief overview of the ministry's role..."
              className="rounded-xl border-slate-200/90 dark:border-border text-xs min-h-[85px] focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar bg-background resize-none transition-all"
            />
          </div>
        </div>

        {/* Card 2: Ministry Leadership */}
        <div className="rounded-2xl border border-border/70 bg-slate-50/60 dark:bg-muted/20 p-4 sm:p-5 space-y-3.5 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sidebar dark:text-sky-400">
            <UserCog className="h-4 w-4" />
            <span>Ministry Leadership</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Ministry Head</Label>
            <Select value={formData.headId || "none"} onValueChange={v => set("headId", v === "none" ? "" : v)}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200/90 dark:border-border text-xs bg-background shadow-2xs focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar cursor-pointer">
                <SelectValue placeholder="Select a ministry head" />
              </SelectTrigger>
              <SelectContent side="bottom" align="start" avoidCollisions={false} className="rounded-xl border border-border shadow-xl max-h-56">
                <SelectItem value="none" className="text-xs font-medium cursor-pointer text-muted-foreground">
                  None (Unassigned)
                </SelectItem>
                {sorted.map(w => (
                  <SelectItem key={w.id} value={w.id} className="text-xs font-medium cursor-pointer">
                    <div className="flex items-center gap-2 py-0.5">
                      <span className="w-5 h-5 rounded-full bg-sidebar/10 text-sidebar dark:text-sky-400 text-[9px] font-black flex items-center justify-center shrink-0">
                        {w.firstName?.[0]}{w.lastName?.[0]}
                      </span>
                      <span>{w.firstName} {w.lastName}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Selected Head Preview */}
            {selectedHead && (
              <div className="mt-3 flex items-center justify-between p-3 rounded-xl bg-background border border-border/80 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <WorkerInitials name={`${selectedHead.firstName} ${selectedHead.lastName}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">
                      {selectedHead.firstName} {selectedHead.lastName}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {selectedHead.email || "Designated Ministry Head"}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmClearHead(true)}
                  className="h-7 px-2 text-[11px] font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer shrink-0"
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Clear Head Confirmation Dialog */}
        <DeleteConfirmationDialog
          isOpen={confirmClearHead}
          onClose={() => setConfirmClearHead(false)}
          onConfirm={() => {
            set("headId", "");
            setConfirmClearHead(false);
          }}
          title="Clear Ministry Head?"
          itemName={selectedHead ? `${selectedHead.firstName} ${selectedHead.lastName}` : undefined}
          confirmLabel="Clear Head"
          description={
            <p className="text-xs text-muted-foreground leading-relaxed text-center">
              Are you sure you want to remove <strong className="font-bold text-foreground">{selectedHead?.firstName} {selectedHead?.lastName}</strong> as ministry head?
            </p>
          }
        />
      </div>

      {/* ── MODAL FOOTER ── */}
      <div className="p-4 sm:p-5 border-t border-border/70 bg-card/95 backdrop-blur-md sticky bottom-0 z-10 flex flex-row items-center justify-end gap-2.5 shrink-0">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="rounded-xl h-10 px-4 sm:px-5 text-xs font-semibold hover:bg-muted/60 transition-colors cursor-pointer flex-1 sm:flex-initial"
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
              if (!formData.name?.trim()) {
                setFormError('Ministry Name is required.');
                return;
              }
              if (formData.name.trim().length > 50) {
                setFormError('Ministry Name must not exceed 50 characters.');
                return;
              }
              if (formData.description && formData.description.length > 500) {
                setFormError('Description must not exceed 500 characters.');
                return;
              }
              onSave(formData);
            }}
          className="bg-sidebar hover:bg-sidebar/90 text-white rounded-xl h-10 px-5 sm:px-6 text-xs font-bold shadow-xs transition-all active:scale-[0.99] cursor-pointer flex-1 sm:flex-initial disabled:opacity-50"
        >
          {ministry?.id ? "Save Changes" : "Create Ministry"}
        </Button>
      </div>
    </div>
  );
}

// ── Appoint Dialog ──────────────────────────────────────────────────────────────
function AppointDialog({ ministry, workers, onSave, onClose }: {
  ministry: Ministry; workers: Worker[];
  onSave: (id: string, userId: string | null) => void;
  onClose: () => void;
}) {
  const [sel, setSel] = useState<string>(ministry.headId || "none");
  const sorted = [...workers].sort((a, b) => a.firstName.localeCompare(b.firstName));
  const selectedWorker = workers.find(w => w.id === sel);

  return (
    <div className="flex flex-col h-full max-h-[90vh] overflow-hidden">
      {/* ── MODAL HEADER ── */}
      <div className="p-5 pb-4 border-b border-border/70 bg-card/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-2xl bg-sidebar/10 text-sidebar dark:text-sky-400 flex items-center justify-center font-bold shrink-0 border border-sidebar/20 shadow-xs mt-0.5">
              <UserCog className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground font-headline">
                Appoint Ministry Head
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                Assign authorized leadership for <span className="font-semibold text-foreground">{ministry.name}</span>.
              </DialogDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer shrink-0 -mt-1 -mr-1"
            title="Close modal"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
        {/* Ministry summary context card */}
        <div className="rounded-2xl border border-border/70 bg-slate-50/60 dark:bg-muted/20 p-4 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-sidebar/10 text-sidebar dark:text-sky-400 border border-sidebar/20 shrink-0">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{ministry.name}</p>
              <p className="text-[10px] text-muted-foreground">{ministry.department} Department</p>
            </div>
          </div>
          <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sidebar/10 text-sidebar dark:text-sky-400 border border-sidebar/20 shrink-0">
            {ministry.department}
          </span>
        </div>

        {/* Worker selection card */}
        <div className="rounded-2xl border border-border/70 bg-slate-50/60 dark:bg-muted/20 p-4 sm:p-5 space-y-3.5 shadow-2xs">
          <Label className="text-xs font-bold text-foreground flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-sidebar dark:text-sky-400" />
            <span>Select Appointed Head</span>
          </Label>
          <Select value={sel} onValueChange={setSel}>
            <SelectTrigger className="h-11 rounded-xl border-slate-200/90 dark:border-border text-xs bg-background shadow-2xs focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar cursor-pointer">
              <SelectValue placeholder="Choose a worker to appoint" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-border shadow-xl max-h-64">
              <SelectItem value="none" className="text-xs font-medium cursor-pointer text-muted-foreground">
                None (Remove Appointed Head)
              </SelectItem>
              {sorted.map(w => (
                <SelectItem key={w.id} value={w.id} className="text-xs font-medium cursor-pointer">
                  <div className="flex items-center gap-2 py-0.5">
                    <span className="w-5 h-5 rounded-full bg-sidebar/10 text-sidebar dark:text-sky-400 text-[9px] font-black flex items-center justify-center shrink-0">
                      {w.firstName?.[0]}{w.lastName?.[0]}
                    </span>
                    <span>{w.firstName} {w.lastName}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Selected Worker Preview */}
          {selectedWorker ? (
            <div className="p-3.5 rounded-xl bg-background border border-border/80 shadow-2xs flex items-center gap-3 animate-in fade-in duration-200">
              <WorkerInitials name={`${selectedWorker.firstName} ${selectedWorker.lastName}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground truncate">
                  {selectedWorker.firstName} {selectedWorker.lastName}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {selectedWorker.email || "Active Worker"}
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sidebar/10 text-sidebar dark:text-sky-400 border border-sidebar/20 shrink-0">
                Selected
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic px-1">
              No worker currently appointed as head.
            </p>
          )}
        </div>
      </div>

      {/* ── MODAL FOOTER ── */}
      <div className="p-4 sm:p-5 border-t border-border/70 bg-card/95 backdrop-blur-md sticky bottom-0 z-10 flex flex-row items-center justify-end gap-2.5 shrink-0">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="rounded-xl h-10 px-4 sm:px-5 text-xs font-semibold hover:bg-muted/60 transition-colors cursor-pointer flex-1 sm:flex-initial"
        >
          Cancel
        </Button>
        <Button
          onClick={() => onSave(ministry.id, sel === "none" ? null : sel)}
          className="bg-sidebar hover:bg-sidebar/90 text-white rounded-xl h-10 px-5 sm:px-6 text-xs font-bold shadow-xs transition-all active:scale-[0.99] cursor-pointer flex-1 sm:flex-initial"
        >
          Save Leadership
        </Button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function MinistryManagementPage() {
  const { canManageMinistries, canAppointApprovers, workerProfile, isLoading: isRoleLoading } = useUserRole();
  const { ministries, isLoading: ministriesLoading, createMinistry, updateMinistry, deleteMinistry } = useMinistries({ all: true });
  const { workers, isLoading: workersLoading } = useWorkers({ limit: 999999 });
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  const [formOpen, setFormOpen] = useState(false);
  const [selectedMinistry, setSelectedMinistry] = useState<Ministry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ministry | null>(null);
  const [appointOpen, setAppointOpen] = useState(false);
  const [appointTarget, setAppointTarget] = useState<Ministry | null>(null);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<"all" | Department>("all");

  const departments: Department[] = ["Worship", "Outreach", "Relationship", "Discipleship", "Administration"];
  const getWorker = (id?: string | null) => id ? workers?.find(w => w.id === id) : null;
  const isLoading = ministriesLoading || workersLoading || isRoleLoading;

  const handleSaveMinistry = async (data: Partial<Ministry>) => {
    try {
      if (selectedMinistry) {
        await updateMinistry({ id: selectedMinistry.id, data });
        await logAction("Updated Ministry", "Ministries", `Updated "${data.name || selectedMinistry.name}"`);
        toast({ title: "Ministry Updated" });
      } else {
        const id = generateMinistryId(data.name || "New", data.department as string || "Worship");
        await createMinistry({ ...data, id, description: data.description || "", leaderId: data.leaderId || "", headId: data.headId || "" });
        await logAction("Created Ministry", "Ministries", `Created "${data.name}" in ${data.department}`);
        toast({ title: "Ministry Added" });
      }
      setFormOpen(false);
    } catch { toast({ variant: "destructive", title: "Save Failed" }); }
  };

  const handleSaveAppointed = async (ministryId: string, userId: string | null) => {
    try {
      await updateMinistry({ id: ministryId, data: { headId: userId === null ? "" : userId } });
      toast({ title: "Ministry Head Updated" });
      setAppointOpen(false);
    } catch { toast({ variant: "destructive", title: "Update Failed" }); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMinistry(deleteTarget.id);
      await logAction("Deleted Ministry", "Ministries", `Deleted "${deleteTarget.name}"`);
      toast({ title: "Ministry Deleted" });
      setDeleteTarget(null);
    } catch { toast({ variant: "destructive", title: "Delete Failed" }); }
  };

  const filteredMinistries = (ministries as Ministry[] || []).filter(m => {
    const q = search.trim().toLowerCase();
    if (q && !m.name.toLowerCase().includes(q)) return false;
    if (deptFilter !== "all" && m.department !== deptFilter) return false;
    return true;
  }).sort((a, b) => { const wa = a.weight ?? 0, wb = b.weight ?? 0; return wa !== wb ? wb - wa : a.name.localeCompare(b.name); });

  if (isLoading) return <AppLayout><div className="flex justify-center py-10"><LoaderCircle className="h-8 w-8 animate-spin" /></div></AppLayout>;
  if (!canManageMinistries) return <AppLayout><Card><CardHeader><CardTitle>Access Denied</CardTitle><CardDescription>No permission.</CardDescription></CardHeader></Card></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 pb-12 w-full">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight text-foreground">
              Ministry Management
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Manage ministries, leaders and weekly allocations.
            </p>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 h-9 px-3.5 sm:px-4 rounded-xl border border-border/60 bg-white dark:bg-card text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors shrink-0 shadow-2xs self-end sm:self-auto sm:ml-auto"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>

        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Controls Row (Search Left, Filter & Add Ministry Right - White Container, No Shadow) */}
        <div className="bg-white dark:bg-card rounded-2xl border border-border/60 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search bar (Left side) */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search ministries...."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 text-xs font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 h-10 bg-background dark:bg-muted/30 border border-slate-200/90 dark:border-border rounded-xl focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar w-full transition-all focus:outline-none"
            />
          </div>

          {/* Filter Tabs & Add Ministry Button (Right side) */}
          <div className="flex items-center gap-3 flex-wrap justify-between lg:justify-end">
            {/* Dept filter dropdown */}
            <Select value={deptFilter} onValueChange={(val: any) => setDeptFilter(val)}>
              <SelectTrigger className="h-10 w-[180px] text-xs rounded-xl border-slate-200/90 dark:border-border bg-background dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {(["all", ...departments] as const).map(d => (
                  <SelectItem key={d} value={d} className="text-xs font-medium cursor-pointer">
                    {d === "all" ? "All Departments" : d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Add Ministry Button */}
            <button
              type="button"
              onClick={() => { setSelectedMinistry(null); setFormOpen(true); }}
              className="h-10 px-4 flex items-center gap-2 rounded-xl bg-sidebar hover:bg-sidebar/90 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Add Ministry</span>
            </button>
          </div>
        </div>

        {/* Ministry cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMinistries.length === 0 ? (
            <p className="col-span-full py-12 text-center text-sm text-muted-foreground">No ministries found.</p>
          ) : filteredMinistries.map(ministry => {
            const head = getWorker(ministry.headId);
            const memberCount = (workers || []).filter(w => w.majorMinistryId === ministry.id || w.minorMinistryId === ministry.id).length;
            const weeklyPool = (ministry as any).mealStubWeeklyLimit || 0;

            return (
              <div key={ministry.id} className="bg-white dark:bg-card rounded-2xl border border-border/60 shadow-card-dark p-5 flex flex-col gap-4 justify-between">
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-foreground font-headline">{ministry.name}</h3>
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sidebar/10 text-sidebar dark:text-sky-400 border border-sidebar/20 mt-1">{ministry.department}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="p-2 rounded-xl bg-sidebar/10 text-sidebar dark:text-sky-400 border border-sidebar/20 shrink-0">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5 shadow-xl border-border/80">
                        {canManageMinistries && (
                          <DropdownMenuItem
                            onClick={() => { setSelectedMinistry(ministry); setFormOpen(true); }}
                            className="cursor-pointer rounded-lg text-xs font-semibold py-2"
                          >
                            <Edit className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Edit
                          </DropdownMenuItem>
                        )}
                        {canManageMinistries && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer rounded-lg text-xs font-semibold py-2"
                            onClick={() => setDeleteTarget(ministry)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Ministry Head */}
                <div className="rounded-xl border border-border/60 bg-muted/[0.12] px-3 py-2.5 flex items-center gap-2.5">
                  {head ? (
                    <>
                      <WorkerInitials name={`${head.firstName} ${head.lastName}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{head.firstName} {head.lastName}</p>
                        <p className="text-[10px] text-muted-foreground">Ministry Head</p>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span className="text-xs italic">No head assigned</span>
                    </div>
                  )}
                </div>

                {/* Members */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <Users className="h-3.5 w-3.5 text-sidebar dark:text-sky-400" /> {memberCount} members
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>

      {/* Ministry Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl border border-border/80 shadow-2xl bg-card [&>button:last-child]:hidden">
          <MinistryForm ministry={selectedMinistry} workers={workers || []} departments={departments} onSave={handleSaveMinistry} onClose={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Appoint Dialog */}
      <Dialog open={appointOpen} onOpenChange={setAppointOpen}>
        <DialogContent className="sm:max-w-md max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl border border-border/80 shadow-2xl bg-card [&>button:last-child]:hidden">
          {appointTarget && <AppointDialog ministry={appointTarget} workers={workers || []} onSave={handleSaveAppointed} onClose={() => setAppointOpen(false)} />}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <DeleteConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Ministry?"
        itemName={deleteTarget?.name}
        confirmLabel="Delete Ministry"
        description={
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground leading-relaxed text-center">
              Are you sure you want to delete <strong className="font-bold text-foreground">{deleteTarget?.name}</strong>? This action is permanent and cannot be undone.
            </p>
            <div className="rounded-xl border border-rose-200/60 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20 p-2.5 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2 text-left">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>Assigned members will have their ministry affiliation unlinked.</span>
            </div>
          </div>
        }
      />
    </AppLayout>
  );
}

