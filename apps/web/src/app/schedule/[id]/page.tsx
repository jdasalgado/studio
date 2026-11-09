"use client";

import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@studio/ui";
import { Badge } from "@studio/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@studio/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@studio/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@studio/ui";
import { Input } from "@studio/ui";
import { Label } from "@studio/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@studio/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@studio/ui";import {
    ArrowLeft, LoaderCircle, UserPlus, X, LayoutTemplate,
    CheckCircle2, Circle, ChevronDown, ChevronUp, Plus, Trash2,
    Send, ShieldCheck, AlertTriangle, Globe, GlobeLock, Printer, History,
} from "lucide-react";
import { useServiceSchedule, useServiceTemplates, useScheduleHistory, useWorshipSlots } from "@/hooks/use-schedule";
import { useMinistries } from "@/hooks/use-ministries";
import { useWorkers } from "@/hooks/use-workers";
import { useAuthStore } from "@studio/store";
import { useUserRole } from "@/hooks/use-user-role";
import { useToast } from "@/hooks/use-toast";
import { findWorkerByWorkerId } from "@/actions/schedule";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

export default function ScheduleDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useAuthStore();
    const { canManageSchedule, canConfirmSchedule, canAssignSchedulers, workerProfile } = useUserRole();

    const { schedule, isLoading, upsertAssignment, deleteAssignment, applyTemplate, isApplyingTemplate, publishSchedule, isPublishing, confirmAssignment, confirmationStatus, conflicts, togglePublic, setAttendanceStatus } = useServiceSchedule(id);
    const { ministries } = useMinistries();
    const { workers } = useWorkers({ limit: 500 });
    const { templates } = useServiceTemplates();
    const { data: history } = useScheduleHistory();
    const { slots: worshipSlots, createSlot, deleteSlot, addWorker: addWorshipWorker, removeWorker: removeWorshipWorker } = useWorshipSlots(id);

    const [expandedMinistries, setExpandedMinistries] = useState<Set<string>>(new Set());
    const [assignDialog, setAssignDialog] = useState<{ assignmentId: string; ministryId: string; roleName: string } | null>(null);
    const [workerSearch, setWorkerSearch] = useState("");
    const [workerIdSearch, setWorkerIdSearch] = useState("");
    const [workerIdResult, setWorkerIdResult] = useState<any>(null);
    const [workerIdSearching, setWorkerIdSearching] = useState(false);
    const [applyTemplateDialog, setApplyTemplateDialog] = useState<string | null>(null); // ministryId
    const [addRoleDialog, setAddRoleDialog] = useState<string | null>(null); // ministryId
    const [newRoleName, setNewRoleName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Worship slot state
    const [newSlotName, setNewSlotName] = useState("");
    const [addSlotOpen, setAddSlotOpen] = useState(false);

    // Group assignments by ministry
    const byMinistry = useMemo(() => {
        if (!schedule) return {} as Record<string, NonNullable<typeof schedule>['assignments']>;
        return schedule.assignments.reduce<Record<string, typeof schedule.assignments>>((acc: Record<string, typeof schedule.assignments>, a: (typeof schedule.assignments)[0]) => {
            if (!acc[a.ministryId]) acc[a.ministryId] = [];
            acc[a.ministryId].push(a);
            return acc;
        }, {});
    }, [schedule]);

    const getMinistryName = (id: string) => {
        const name = ministries.find(m => m.id === id)?.name || id;
        return name.replace(/^[WORDA]-/i, '');
    };

    const ministryIds = Object.keys(byMinistry);
    const allMinistryIds = useMemo(() => {
        const fromAssignments = new Set(ministryIds);
        let ids = [...fromAssignments];
        if (canManageSchedule && !canAssignSchedulers && workerProfile?.majorMinistryId) {
            ids = ids.filter(id => id === workerProfile.majorMinistryId || id === workerProfile.minorMinistryId);
        }
        return ids.sort((a, b) => getMinistryName(a).localeCompare(getMinistryName(b)));
    }, [ministryIds, canManageSchedule, canAssignSchedulers, workerProfile, ministries]);

    // Detect if schedule has any Worship (W) department ministries
    const hasWorshipMinistries = useMemo(() => {
        return allMinistryIds.some(mid => {
            const m = ministries.find((x: any) => x.id === mid);
            const code = (m as any)?.departmentCode || '';
            return code === 'W';
        });
    }, [allMinistryIds, ministries]);

    // Workers scoped to Worship department for slot assignment (used in slot cards display only)
    const worshipWorkers = useMemo(() => {
        return workers.filter((w: any) => {
            if (w.status !== 'Active') return false;
            const m = ministries.find((x: any) => x.id === w.majorMinistryId);
            return (m as any)?.departmentCode === 'W';
        });
    }, [workers, ministries]);

    const toggleMinistry = (id: string) => {
        setExpandedMinistries(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const filteredWorkers = useMemo(() => {
        const targetMinistryId = assignDialog?.ministryId;
        const targetMinistry = targetMinistryId ? ministries.find((m: any) => m.id === targetMinistryId) : null;
        const targetDept = targetMinistry?.department || (targetMinistry as any)?.departmentCode;

        // First: workers directly in the target ministry
        const inMinistry = workers.filter((w: any) => {
            if (w.status !== "Active") return false;
            return w.majorMinistryId === targetMinistryId || w.minorMinistryId === targetMinistryId;
        });

        // Use ministry-scoped list; only fall back to dept if ministry has zero workers
        const scoped = inMinistry.length > 0 ? inMinistry : workers.filter((w: any) => {
            if (w.status !== "Active") return false;
            if (!targetDept) return false;
            const workerMinistry = ministries.find((m: any) => m.id === w.majorMinistryId);
            const workerDept = workerMinistry?.department || (workerMinistry as any)?.departmentCode;
            return workerDept === targetDept;
        });

        // Apply name search within scoped list
        if (!workerSearch.trim()) return scoped;
        const q = workerSearch.toLowerCase();
        return scoped.filter((w: any) =>
            `${w.firstName} ${w.lastName}`.toLowerCase().includes(q) ||
            (w.workerId || '').includes(q)
        );
    }, [workers, workerSearch, assignDialog?.ministryId, ministries]);

    const handleAssign = async (workerId: string | null) => {
        if (!assignDialog) return;
        const worker = workerId ? workers.find((w: any) => w.id === workerId) : null;

        // Conflict check — warn if worker already assigned to another ministry
        if (workerId && schedule) {
            const existingSlot = schedule.assignments.find(
                (a: any) => a.workerId === workerId && a.ministryId !== assignDialog.ministryId
            );
            if (existingSlot) {
                const conflictMinistry = getMinistryName(existingSlot.ministryId);
                toast({
                    variant: "destructive",
                    title: "Conflict detected",
                    description: `${worker ? `${(worker as any).firstName} ${(worker as any).lastName}` : "This worker"} is already assigned as ${existingSlot.roleName} in ${conflictMinistry} for this service.`,
                });
                // Still allow — just warn
            }
        }

        try {
            await upsertAssignment({
                scheduleId: id,
                ministryId: assignDialog.ministryId,
                roleName: assignDialog.roleName,
                workerId: workerId ?? null,
                workerName: worker ? `${(worker as any).firstName} ${(worker as any).lastName}` : null,
                order: schedule?.assignments.filter(
                    (a: any) => a.ministryId === assignDialog.ministryId && a.roleName === assignDialog.roleName
                ).findIndex((a: any) => a.id === assignDialog.assignmentId) ?? 0,
            });
            toast({ title: workerId ? "Worker assigned" : "Assignment cleared" });
            setAssignDialog(null);
        } catch {
            toast({ variant: "destructive", title: "Failed to assign" });
        }
    };

    const handleAddRole = async () => {
        if (!addRoleDialog || !newRoleName.trim()) return;
        setIsSaving(true);
        try {
            await upsertAssignment({
                scheduleId: id,
                ministryId: addRoleDialog,
                roleName: newRoleName.trim(),
                order: (byMinistry[addRoleDialog]?.length ?? 0),
            });
            toast({ title: "Role slot added" });
            setAddRoleDialog(null);
            setNewRoleName("");
        } catch {
            toast({ variant: "destructive", title: "Failed to add role" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleApplyTemplate = async (templateId: string) => {
        try {
            await applyTemplate({ templateId });
            toast({ title: "Template applied" });
            setApplyTemplateDialog(null);
        } catch {
            toast({ variant: "destructive", title: "Failed to apply template" });
        }
    };

    const handlePublish = async () => {
        try {
            const result = await publishSchedule({ publishedBy: workerProfile?.id || user?.uid || 'system' });
            toast({ title: `Schedule published — ${result.notified} worker(s) notified by email` });
        } catch {
            toast({ variant: "destructive", title: "Failed to publish" });
        }
    };

    const handleWorkerIdSearch = async () => {
        if (!workerIdSearch.trim()) return;
        setWorkerIdSearching(true);
        setWorkerIdResult(null);
        try {
            const w = await findWorkerByWorkerId(workerIdSearch.trim());
            setWorkerIdResult(w || 'not_found');
        } finally {
            setWorkerIdSearching(false);
        }
    };

    const handleConfirmAssignment = async (assignmentId: string) => {
        try {
            await confirmAssignment({ assignmentId, confirmedBy: workerProfile?.id || user?.uid || 'system' });
            toast({ title: "Assignment confirmed" });
        } catch {
            toast({ variant: "destructive", title: "Failed to confirm" });
        }
    };

    const handleTogglePublic = async () => {
        try {
            const updated = await togglePublic({ isPublic: !(schedule as any)?.isPublic });
            toast({
                title: (updated as any).isPublic ? "Schedule is now public" : "Schedule is now private",
                description: (updated as any).isPublic
                    ? `Public link: ${APP_URL}/public/schedule/${(updated as any).publicToken}`
                    : undefined,
            });
        } catch {
            toast({ variant: "destructive", title: "Failed to update visibility" });
        }
    };

    const handlePrint = () => window.open(`/schedule/${id}/print`, '_blank');

    if (isLoading) {
        return (
            <AppLayout>
                <div className="flex justify-center py-10">
                    <LoaderCircle className="h-8 w-8 animate-spin" />
                </div>
            </AppLayout>
        );
    }

    if (!schedule) {
        return (
            <AppLayout>
                <p className="text-muted-foreground">Schedule not found.</p>
            </AppLayout>
        );
    }

    const totalSlots = schedule.assignments.length;
    const filledSlots = schedule.assignments.filter((a: any) => a.workerId).length;

    return (
        <AppLayout>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.push("/schedule")}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-headline font-bold">{schedule.title}</h1>
                        <p className="text-sm text-muted-foreground">
                            {format(new Date(schedule.date), "EEEE, MMMM d, yyyy")}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={schedule.status === "Published" ? "default" : "secondary"}>
                        {schedule.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{filledSlots}/{totalSlots} filled</span>
                    {conflicts.length > 0 && (
                        <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
                        </Badge>
                    )}
                    {canManageSchedule && (
                        <Button size="sm" variant="outline" onClick={handlePrint}>
                            <Printer className="mr-1 h-4 w-4" /> Print
                        </Button>
                    )}
                    {canManageSchedule && schedule.status === "Published" && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleTogglePublic}
                            className={(schedule as any).isPublic ? "text-green-600 border-green-300" : ""}
                        >
                            {(schedule as any).isPublic
                                ? <><Globe className="mr-1 h-4 w-4" /> Public</>
                                : <><GlobeLock className="mr-1 h-4 w-4" /> Private</>
                            }
                        </Button>
                    )}
                    {schedule.status === "Draft" && canManageSchedule && (
                        <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
                            {isPublishing && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                            <Send className="mr-2 h-4 w-4" /> Publish & Notify
                        </Button>
                    )}
                </div>
            </div>

            {/* Public link banner */}
            {(schedule as any).isPublic && (schedule as any).publicToken && (
                <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-lg border border-green-200 bg-green-50 text-sm">
                    <Globe className="h-4 w-4 text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <span className="font-medium text-green-800">Public link: </span>
                        <a
                            href={`${APP_URL}/public/schedule/${(schedule as any).publicToken}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-700 underline truncate"
                        >
                            {APP_URL}/public/schedule/{(schedule as any).publicToken}
                        </a>
                    </div>
                </div>
            )}

            {/* Conflict warnings */}
            {conflicts.length > 0 && (
                <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                    <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> Scheduling Conflicts
                    </p>
                    {conflicts.map((c: any) => (
                        <p key={c.workerId} className="text-xs text-destructive">
                            <strong>{c.workerName}</strong> is assigned to multiple ministries:{" "}
                            {c.slots.map((s: any) => `${s.roleName} (${getMinistryName(s.ministryId)})`).join(", ")}
                        </p>
                    ))}
                </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="assignments" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <TabsList>
                    <TabsTrigger value="assignments">Assignments</TabsTrigger>
                    {(canConfirmSchedule || schedule.status === "Published") && (
                        <TabsTrigger value="confirmation">
                            Confirmation Status
                            {confirmationStatus.length > 0 && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                    {confirmationStatus.filter((a: any) => a.acknowledgedAt).length}/{confirmationStatus.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="history"><History className="mr-1 h-3.5 w-3.5" />History</TabsTrigger>
                </TabsList>

                <TabsContent value="assignments">
            {/* Add Ministry */}
            <div className="mt-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ministries</h2>
                {canManageSchedule && (
                <Select onValueChange={(ministryId) => {
                    upsertAssignment({ scheduleId: id, ministryId, roleName: "Role", order: 0 });
                    setExpandedMinistries(prev => new Set([...prev, ministryId]));
                }}>
                    <SelectTrigger className="w-[200px] h-8 text-sm">
                        <SelectValue placeholder="+ Add Ministry" />
                    </SelectTrigger>
                    <SelectContent>
                        {ministries
                            .filter(m => !allMinistryIds.includes(m.id))
                            .map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                    </SelectContent>
                </Select>
                )}
            </div>

            {/* Ministry Cards */}
            <div className="mt-3 space-y-3">
                {allMinistryIds.length === 0 && (
                    <Card>
                        <CardContent className="py-10 text-center text-muted-foreground">
                            No ministries added yet. Use the dropdown above to add one.
                        </CardContent>
                    </Card>
                )}

                {allMinistryIds.map(ministryId => {
                    const assignments = (byMinistry[ministryId] || []) as NonNullable<typeof schedule>['assignments'];
                    const filled = assignments.filter((a: any) => a.workerId).length;
                    const isExpanded = expandedMinistries.has(ministryId);
                    const ministryTemplates = templates.filter((t: any) => t.ministryId === ministryId);

                    // Group by role name
                    const byRole = assignments.reduce<Record<string, typeof assignments>>((acc: Record<string, typeof assignments>, a: any) => {
                        if (!acc[a.roleName]) acc[a.roleName] = [];
                        acc[a.roleName].push(a);
                        return acc;
                    }, {});

                    return (
                        <Card key={ministryId}>
                            <CardHeader
                                className="cursor-pointer py-3 px-4"
                                onClick={() => toggleMinistry(ministryId)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        <CardTitle className="text-base">{getMinistryName(ministryId)}</CardTitle>
                                        <span className="text-xs text-muted-foreground">{filled}/{assignments.length} filled</span>
                                    </div>
                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        {ministryTemplates.length > 0 && (
                                            <Button variant="outline" size="sm" className="h-7 text-xs"
                                                onClick={() => setApplyTemplateDialog(ministryId)}>
                                                <LayoutTemplate className="mr-1 h-3 w-3" /> Apply Template
                                            </Button>
                                        )}
                                        <Button variant="outline" size="sm" className="h-7 text-xs"
                                            onClick={() => { setAddRoleDialog(ministryId); setNewRoleName(""); }}>
                                            <Plus className="mr-1 h-3 w-3" /> Add Role
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                            onClick={() => {
                                                assignments.forEach((a: any) => deleteAssignment(a.id));
                                            }}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>

                            {isExpanded && (
                                <CardContent className="pt-0 pb-4 px-4">
                                    <div className="space-y-4">
                                        {Object.entries(byRole).map(([roleName, slots]) => (
                                            <div key={roleName}>
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                                    {roleName}
                                                </p>
                                                <div className="space-y-1.5">
                                                    {(slots as any[]).map((slot: any) => {
                                                        const status = slot.attendanceStatus || 'Pending';
                                                        const statusDot = status === 'Confirmed'
                                                            ? 'bg-green-500'
                                                            : status === 'Not Attending'
                                                            ? 'bg-red-500'
                                                            : 'bg-yellow-400';
                                                        return (
                                                        <div key={slot.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                                                            {slot.workerId ? (
                                                                <>
                                                                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot}`} title={status} />
                                                                    <Avatar className="h-6 w-6">
                                                                        <AvatarImage src={workers.find((w: any) => w.id === slot.workerId)?.avatarUrl} />
                                                                        <AvatarFallback className="text-[10px]">
                                                                            {slot.workerName?.split(" ").map((n: string) => n[0]).join("") || "?"}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <span className="text-sm flex-1">{slot.workerName}</span>
                                                                    {canConfirmSchedule && (
                                                                        <Select
                                                                            value={status}
                                                                            onValueChange={(v: any) => setAttendanceStatus({ assignmentId: slot.id, status: v, updatedBy: workerProfile?.id || user?.uid || 'system' })}
                                                                        >
                                                                            <SelectTrigger className="h-6 w-32 text-xs border-0 bg-transparent p-0 focus:ring-0">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="Pending">⏳ Pending</SelectItem>
                                                                                <SelectItem value="Confirmed">✅ Confirmed</SelectItem>
                                                                                <SelectItem value="Not Attending">❌ Not Attending</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    )}
                                                                    {!canConfirmSchedule && (
                                                                        <span className="text-xs text-muted-foreground">{status}</span>
                                                                    )}
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6"
                                                                        onClick={() => setAssignDialog({ assignmentId: slot.id, ministryId, roleName })}>
                                                                        <UserPlus className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                                                                        onClick={() => deleteAssignment(slot.id)}>
                                                                        <X className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                                                                    <span className="text-sm text-muted-foreground flex-1">Unassigned</span>
                                                                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                                                                        onClick={() => setAssignDialog({ assignmentId: slot.id, ministryId, roleName })}>
                                                                        <UserPlus className="mr-1 h-3 w-3" /> Assign
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                                                                        onClick={() => deleteAssignment(slot.id)}>
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    );
                })}
            </div>

            {/* Worship Slots — shown inline under ministry cards when Worship dept is present */}
            {hasWorshipMinistries && (
                <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Service Slots</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                The service type for this Sunday (e.g. TWS, Mid Slot, Empowered Night). Assign Worship workers per slot.
                            </p>
                        </div>
                        {canManageSchedule && (
                            <Button size="sm" onClick={() => { setNewSlotName(""); setAddSlotOpen(true); }}>
                                <Plus className="mr-1 h-4 w-4" /> Add Slot
                            </Button>
                        )}
                    </div>

                    {worshipSlots.length === 0 && (
                        <Card>
                            <CardContent className="py-8 text-center text-muted-foreground text-sm">
                                No slots yet. Add a slot like "TWS", "Mid Slot", or "Empowered Night".
                            </CardContent>
                        </Card>
                    )}

                    {worshipSlots.map((slot: any) => {
                        // Group workers by role
                        const bySlotRole = (slot.workers as any[]).reduce<Record<string, any[]>>((acc, sw) => {
                            const key = sw.role || '(No Role)';
                            if (!acc[key]) acc[key] = [];
                            acc[key].push(sw);
                            return acc;
                        }, {});
                        const roleKeys = Object.keys(bySlotRole);
                        const totalWorkers = slot.workers.length;

                        return (
                        <Card key={slot.id}>
                            <CardHeader className="py-3 px-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-base">{slot.slotName}</CardTitle>
                                        <span className="text-xs text-muted-foreground">{totalWorkers} worker{totalWorkers !== 1 ? 's' : ''}</span>
                                    </div>
                                    {canManageSchedule && (
                                        <div className="flex items-center gap-1">
                                            <Button size="sm" variant="outline" className="h-7 text-xs"
                                                onClick={() => router.push(`/schedule/${id}/slots/${slot.id}`)}>
                                                <Plus className="mr-1 h-3 w-3" /> Manage Roles
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                                onClick={() => deleteSlot(slot.id)}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                {slot.notes && <p className="text-xs text-muted-foreground mt-1">{slot.notes}</p>}
                            </CardHeader>
                            {roleKeys.length > 0 && (
                                <CardContent className="pt-0 pb-4 px-4">
                                    <div className="space-y-4">
                                        {roleKeys.map(roleName => (
                                            <div key={roleName}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{roleName}</p>
                                                    {canManageSchedule && (
                                                        <Button variant="ghost" size="sm" className="h-6 text-xs"
                                                            onClick={() => router.push(`/schedule/${id}/slots/${slot.id}`)}>
                                                            <UserPlus className="mr-1 h-3 w-3" /> Assign
                                                        </Button>
                                                    )}
                                                </div>
                                                <div className="space-y-1.5">
                                                    {bySlotRole[roleName].map((sw: any) => (
                                                        <div key={sw.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                                                            <Avatar className="h-6 w-6">
                                                                <AvatarImage src={workers.find((w: any) => w.id === sw.workerId)?.avatarUrl} />
                                                                <AvatarFallback className="text-[10px]">
                                                                    {sw.workerName.split(" ").map((n: string) => n[0]).join("")}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <span className="text-sm flex-1">{sw.workerName}</span>
                                                            {canManageSchedule && (
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                                                                    onClick={() => removeWorshipWorker(sw.id)}>
                                                                    <X className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            )}
                            {roleKeys.length === 0 && canManageSchedule && (
                                <CardContent className="pt-0 pb-4 px-4">
                                    <p className="text-xs text-muted-foreground">No roles yet. Click "Add Role" to define roles for this slot.</p>
                                </CardContent>
                            )}
                        </Card>
                        );
                    })}
                </div>
            )}

                </TabsContent>

                {(canConfirmSchedule || schedule.status === "Published") && (
                <TabsContent value="confirmation">
                    <div className="mt-4 space-y-2">
                        {confirmationStatus.length === 0 ? (
                            <Card>
                                <CardContent className="py-10 text-center text-muted-foreground">
                                    No assigned workers yet.
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <div className="divide-y">
                                    {confirmationStatus.map((a: any) => (
                                        <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">{a.workerName || "—"}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {getMinistryName(a.ministryId)} · {a.roleName}
                                                </p>
                                            </div>
                                            {(() => {
                                                const st = a.attendanceStatus || (a.acknowledgedAt ? 'Confirmed' : 'Pending');
                                                if (st === 'Confirmed') return (
                                                    <div className="flex items-center gap-1.5 text-green-600">
                                                        <span className="w-2 h-2 rounded-full bg-green-500" />
                                                        <span className="text-xs">Confirmed {a.acknowledgedAt ? format(new Date(a.acknowledgedAt), "MMM d, h:mm a") : ""}</span>
                                                    </div>
                                                );
                                                if (st === 'Not Attending') return (
                                                    <div className="flex items-center gap-1.5 text-red-600">
                                                        <span className="w-2 h-2 rounded-full bg-red-500" />
                                                        <span className="text-xs">Not Attending</span>
                                                    </div>
                                                );
                                                return (
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-yellow-400" />
                                                        <span className="text-xs text-muted-foreground">Pending</span>
                                                        {canConfirmSchedule && (
                                                            <Button size="sm" variant="outline" className="h-7 text-xs"
                                                                onClick={() => setAttendanceStatus({ assignmentId: a.id, status: 'Confirmed', updatedBy: workerProfile?.id || user?.uid || 'system' })}>
                                                                <ShieldCheck className="mr-1 h-3 w-3" /> Confirm
                                                            </Button>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}
                    </div>
                </TabsContent>
                )}

                <TabsContent value="history">
                    <div className="mt-4 space-y-3">
                        {!history || history.length === 0 ? (
                            <Card>
                                <CardContent className="py-10 text-center text-muted-foreground">
                                    No past schedules yet.
                                </CardContent>
                            </Card>
                        ) : (
                            history.map((h: any) => (
                                <Card key={h.id} className="cursor-pointer hover:bg-muted/30" onClick={() => router.push(`/schedule/${h.id}`)}>
                                    <CardHeader className="py-3 px-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-sm">{h.title}</p>
                                                <p className="text-xs text-muted-foreground">{format(new Date(h.date), "EEEE, MMMM d, yyyy")}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">
                                                    {h.assignments.filter((a: any) => a.workerId).length}/{h.assignments.length} filled
                                                </span>
                                                <Badge variant="outline" className="text-xs">{h.status}</Badge>
                                            </div>
                                        </div>
                                    </CardHeader>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Assign Worker Dialog */}
            <Dialog open={!!assignDialog} onOpenChange={() => { setAssignDialog(null); setWorkerIdSearch(""); setWorkerIdResult(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Worker — {assignDialog?.roleName}</DialogTitle>
                    </DialogHeader>
                    <Tabs defaultValue="search">
                        <TabsList className="w-full">
                            <TabsTrigger value="search" className="flex-1">Search by Name</TabsTrigger>
                            <TabsTrigger value="workerid" className="flex-1">Search by Worker ID</TabsTrigger>
                        </TabsList>
                        <TabsContent value="search">
                            <div className="space-y-3 mt-2">
                                <Input
                                    placeholder="Search workers..."
                                    value={workerSearch}
                                    onChange={e => setWorkerSearch(e.target.value)}
                                    autoFocus
                                />
                                <p className="text-xs text-muted-foreground">
                                    Showing workers from <strong>{assignDialog ? getMinistryName(assignDialog.ministryId) : ""}</strong>. Search by name or Worker ID.
                                </p>
                                <div className="max-h-64 overflow-y-auto space-y-1">
                                    <button
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-sm text-muted-foreground"
                                        onClick={() => handleAssign(null)}
                                    >
                                        <X className="h-4 w-4" /> Clear assignment
                                    </button>
                                    {filteredWorkers.map((w: any) => (
                                        <button
                                            key={w.id}
                                            className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-left"
                                            onClick={() => handleAssign(w.id)}
                                        >
                                            <Avatar className="h-7 w-7">
                                                <AvatarImage src={w.avatarUrl} />
                                                <AvatarFallback className="text-[10px]">{w.firstName[0]}{w.lastName[0]}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-medium">{w.firstName} {w.lastName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {ministries.find((m: any) => m.id === w.majorMinistryId)?.name || "—"}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="workerid">
                            <div className="space-y-3 mt-2">
                                <div className="flex gap-2">
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        placeholder="Enter Worker ID (e.g. 3320)"
                                        value={workerIdSearch}
                                        onChange={e => setWorkerIdSearch(e.target.value.replace(/\D/g, ""))}
                                        onKeyDown={e => e.key === "Enter" && handleWorkerIdSearch()}
                                        autoFocus
                                    />
                                    <Button onClick={handleWorkerIdSearch} disabled={workerIdSearching} size="sm">
                                        {workerIdSearching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Find"}
                                    </Button>
                                </div>
                                {workerIdResult === 'not_found' && (
                                    <p className="text-sm text-destructive">No worker found with that ID.</p>
                                )}
                                {workerIdResult && workerIdResult !== 'not_found' && (() => {
                                    const workerMinistryId = workerIdResult.majorMinistryId;
                                    const targetMinistryId = assignDialog?.ministryId;
                                    const isSameMinistry = workerMinistryId === targetMinistryId || workerIdResult.minorMinistryId === targetMinistryId;
                                    const workerMinistryName = ministries.find((m: any) => m.id === workerMinistryId)?.name || "—";
                                    return (
                                        <div className="space-y-2">
                                            <button
                                                className="w-full flex items-center gap-3 px-3 py-3 rounded-md border hover:bg-muted text-left"
                                                onClick={() => handleAssign(workerIdResult.id)}
                                            >
                                                <CheckCircle2 className={`h-5 w-5 shrink-0 ${isSameMinistry ? "text-green-500" : "text-amber-500"}`} />
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium">{workerIdResult.firstName} {workerIdResult.lastName}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {workerMinistryName} · {workerIdResult.status}
                                                    </p>
                                                </div>
                                            </button>
                                            {!isSameMinistry && (
                                                <p className="text-xs text-amber-600 flex items-center gap-1">
                                                    ⚠ This worker is from <strong>{workerMinistryName}</strong>, not the assigned ministry. You can still assign them.
                                                </p>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* Apply Template Dialog */}
            <Dialog open={!!applyTemplateDialog} onOpenChange={() => setApplyTemplateDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Apply Template — {applyTemplateDialog ? getMinistryName(applyTemplateDialog) : ""}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This will replace all current role slots for this ministry with the template's roles.
                    </p>
                    <div className="space-y-2 mt-2">
                        {templates
                            .filter((t: any) => t.ministryId === applyTemplateDialog)
                            .map((t: any) => (
                                <button
                                    key={t.id}
                                    className="w-full flex items-center justify-between px-4 py-3 rounded-md border hover:bg-muted text-left"
                                    onClick={() => handleApplyTemplate(t.id)}
                                    disabled={isApplyingTemplate}
                                >
                                    <div>
                                        <p className="font-medium text-sm">{t.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {t.roles.reduce((s: number, r: any) => s + r.count, 0)} slots · {t.roles.map((r: any) => r.roleName).join(", ")}
                                        </p>
                                    </div>
                                    {t.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
                                </button>
                            ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add Role Dialog */}
            <Dialog open={!!addRoleDialog} onOpenChange={() => setAddRoleDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Role Slot</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                            <Label>Role Name</Label>
                            <Input
                                value={newRoleName}
                                onChange={e => setNewRoleName(e.target.value)}
                                placeholder="e.g. Worship Leader, Sound Engineer"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddRoleDialog(null)}>Cancel</Button>
                        <Button onClick={handleAddRole} disabled={isSaving || !newRoleName.trim()}>
                            {isSaving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                            Add Slot
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Worship Slot Dialog */}
            <Dialog open={addSlotOpen} onOpenChange={setAddSlotOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Service Slot</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                            <Label>Slot Name</Label>
                            <Input
                                value={newSlotName}
                                onChange={e => setNewSlotName(e.target.value)}
                                placeholder="e.g. TWS, Mid Slot, Empowered Night"
                                autoFocus
                            />
                            <p className="text-xs text-muted-foreground">Enter any name — TWS, Mid Slot, Empowered Night, or a custom name.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddSlotOpen(false)}>Cancel</Button>
                        <Button
                            disabled={!newSlotName.trim()}
                            onClick={async () => {
                                await createSlot({ slotName: newSlotName.trim(), order: worshipSlots.length });
                                setAddSlotOpen(false);
                                setNewSlotName("");
                            }}
                        >
                            Add Slot
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </AppLayout>
    );
}
