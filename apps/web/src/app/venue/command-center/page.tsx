"use client";

import React, { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@studio/ui";
import { Badge } from "@studio/ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@studio/ui";
import { Separator } from "@studio/ui";
import { Input } from "@studio/ui";
import { Label } from "@studio/ui";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@studio/ui";
import { Alert, AlertDescription } from "@studio/ui";
import { usePermissionsStore } from "@studio/store";
import { useShallow } from "zustand/react/shallow";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuditLogsForRequest, updateVenueAssistanceSetting } from "@/actions/venue-assistance";
import { CommandCenterTable } from "@/components/venue-assistance/command-center-table";
import { useToast } from "@/hooks/use-toast";
import { getMinistries } from "@/actions/db";
import {
    LoaderCircle,
    ShieldAlert,
    CalendarDays,
    Clock,
    Users,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Settings2,
} from "lucide-react";
import { format } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuditLog = Awaited<ReturnType<typeof getAuditLogsForRequest>>[number];

type SelectedRequest = {
    id: string;
    ministryId: string;
    status: string;
    explanation?: string | null;
    respondedAt?: Date | string | null;
    respondedBy?: string | null;
    createdAt: Date | string;
    items: {
        id: string;
        name: string;
        description?: string | null;
        quantity: number;
        isRequired: boolean;
        status: string;
        adjustedQty?: number | null;
        adjustedDesc?: string | null;
    }[];
    booking: {
        id: string;
        title: string;
        start: Date | string;
        end: Date | string;
        pax: number;
        room?: { name: string } | null;
        worker?: {
            id: string;
            firstName?: string | null;
            lastName?: string | null;
            email?: string | null;
        } | null;
    };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
        case "Approved": return "default";
        case "Partial": return "secondary";
        case "Declined": return "destructive";
        case "Cancelled": return "destructive";
        case "In_Progress": return "default";
        case "Fulfilled": return "secondary";
        default: return "outline";
    }
}

function statusLabel(status: string): string {
    if (status === "In_Progress") return "In Progress";
    return status;
}

function itemStatusIcon(status: string) {
    switch (status) {
        case "Approved":
            return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
        case "Declined":
            return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
        default:
            return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
}

function auditActionLabel(action: string): string {
    const labels: Record<string, string> = {
        request_created: "Request created",
        request_responded: "Response submitted",
        request_cancelled: "Request cancelled",
        status_changed: "Status changed",
        booking_created: "Booking created",
        booking_cancelled: "Booking cancelled",
        config_created: "Config created",
        config_updated: "Config updated",
        config_deleted: "Config deleted",
        recurring_series_cancelled: "Series cancelled",
    };
    return labels[action] ?? action;
}

// ---------------------------------------------------------------------------
// Request detail panel
// ---------------------------------------------------------------------------

function RequestDetailPanel({
    request,
    auditLogs,
    isLoadingLogs,
}: {
    request: SelectedRequest;
    auditLogs: AuditLog[];
    isLoadingLogs: boolean;
}) {
    const requesterName = request.booking.worker
        ? `${request.booking.worker.firstName ?? ""} ${request.booking.worker.lastName ?? ""}`.trim() ||
          request.booking.worker.email
        : "—";

    return (
        <div className="space-y-5">
            {/* Booking info */}
            <div>
                <h3 className="text-sm font-semibold mb-2">Booking</h3>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">{request.booking.title}</p>
                    <p>{request.booking.room?.name ?? "Unknown room"}</p>
                    <div className="flex flex-wrap gap-3">
                        <span className="flex items-center gap-1 whitespace-nowrap">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {format(new Date(request.booking.start), "PPP")}
                        </span>
                        <span className="flex items-center gap-1 whitespace-nowrap">
                            <Clock className="h-3.5 w-3.5" />
                            {format(new Date(request.booking.start), "p")} –{" "}
                            {format(new Date(request.booking.end), "p")}
                        </span>
                        {request.booking.pax > 0 && (
                            <span className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                {request.booking.pax} attendees
                            </span>
                        )}
                    </div>
                    <p>Requester: {requesterName}</p>
                </div>
            </div>

            <Separator />

            {/* Request status */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">
                        {request.ministryId} — Assistance Request
                    </h3>
                    <Badge variant={statusVariant(request.status)}>
                        {statusLabel(request.status)}
                    </Badge>
                </div>

                {/* Items */}
                {request.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No items.</p>
                ) : (
                    <ul className="space-y-2">
                        {request.items.map((item) => (
                            <li key={item.id} className="flex items-start gap-2 text-sm">
                                {itemStatusIcon(item.status)}
                                <div className="min-w-0 flex-1">
                                    <span className="font-medium">{item.name}</span>
                                    {item.isRequired && (
                                        <span className="ml-1 text-xs text-muted-foreground">(required)</span>
                                    )}
                                    {item.adjustedDesc || item.description ? (
                                        <p className="text-muted-foreground text-xs mt-0.5">
                                            {item.adjustedDesc ?? item.description}
                                        </p>
                                    ) : null}
                                    <p className="text-muted-foreground text-xs">
                                        Qty: {item.adjustedQty ?? item.quantity}
                                    </p>
                                </div>
                                <Badge
                                    variant={statusVariant(item.status)}
                                    className="text-xs shrink-0"
                                >
                                    {item.status}
                                </Badge>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Explanation */}
                {request.explanation && (
                    <div className="mt-3 flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-muted-foreground">{request.explanation}</p>
                    </div>
                )}

                {request.respondedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                        Responded {format(new Date(request.respondedAt), "PPP p")}
                    </p>
                )}
            </div>

            <Separator />

            {/* Audit log */}
            <div>
                <h3 className="text-sm font-semibold mb-2">Audit Log</h3>
                {isLoadingLogs ? (
                    <div className="flex justify-center py-4">
                        <LoaderCircle className="h-5 w-5 animate-spin" />
                    </div>
                ) : auditLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No audit entries.</p>
                ) : (
                    <ol className="space-y-2">
                        {auditLogs.map((log) => (
                            <li key={log.id} className="text-xs border-l-2 border-muted pl-3 py-0.5">
                                <p className="font-medium text-foreground">
                                    {auditActionLabel(log.action)}
                                </p>
                                <p className="text-muted-foreground">
                                    {format(new Date(log.createdAt), "PPP p")}
                                    {log.triggerSource ? ` · ${log.triggerSource}` : ""}
                                </p>
                                {log.actorId && log.actorId !== "system" && (
                                    <p className="text-muted-foreground">Actor: {log.actorId}</p>
                                )}
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// SLA settings form
// ---------------------------------------------------------------------------

function SlaSettingsForm({
    actorId,
    currentSlaDays,
    onSaved,
}: {
    actorId: string;
    currentSlaDays: number;
    onSaved: (days: number) => void;
}) {
    const { toast } = useToast();
    const [slaDays, setSlaDays] = useState(String(currentSlaDays));
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        const days = parseInt(slaDays, 10);
        if (isNaN(days) || days < 1) {
            toast({ variant: "destructive", title: "Invalid value", description: "SLA days must be at least 1." });
            return;
        }
        setIsSaving(true);
        try {
            await updateVenueAssistanceSetting(days, actorId);
            toast({ title: "SLA setting saved" });
            onSaved(days);
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Save failed",
                description: err?.message ?? "Could not save SLA setting.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex items-end gap-3">
            <div className="space-y-1">
                <Label htmlFor="sla-days" className="text-sm">
                    SLA (days before escalation)
                </Label>
                <Input
                    id="sla-days"
                    type="number"
                    min={1}
                    value={slaDays}
                    onChange={(e) => setSlaDays(e.target.value)}
                    className="w-24"
                />
            </div>
            <Button onClick={handleSave} disabled={isSaving} size="sm">
                {isSaving ? (
                    <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Saving…
                    </>
                ) : (
                    "Save"
                )}
            </Button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CommandCenterPage() {
    const { isLoading: isPermissionsLoading, canManageVenueAssistance, workerProfile } =
        usePermissionsStore(
            useShallow((s) => ({
                isLoading: s.isLoading,
                canManageVenueAssistance: s.canManageVenueAssistance,
                workerProfile: s.workerProfile,
            }))
        );

    const { toast } = useToast();
    const [selectedRequest, setSelectedRequest] = useState<SelectedRequest | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [slaDays, setSlaDays] = useState(3);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Fetch ministries for filter dropdown
    const { data: ministries = [] } = useQuery({
        queryKey: ["ministries"],
        queryFn: () => getMinistries(),
        enabled: canManageVenueAssistance,
    });

    // Fetch audit logs for selected request
    const { data: auditLogs = [], isLoading: isLoadingLogs } = useQuery({
        queryKey: ["auditLogs", selectedRequest?.id],
        queryFn: () => getAuditLogsForRequest(selectedRequest!.id),
        enabled: !!selectedRequest?.id,
    });

    const handleSelectRequest = (request: SelectedRequest) => {
        setSelectedRequest(request);
        setIsDetailOpen(true);
    };

    // ── Loading / access guard ────────────────────────────────────────────────

    if (isPermissionsLoading) {
        return (
            <AppLayout>
                <div className="flex justify-center py-10">
                    <LoaderCircle className="h-8 w-8 animate-spin" />
                </div>
            </AppLayout>
        );
    }

    if (!canManageVenueAssistance) {
        return (
            <AppLayout>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-destructive" />
                            Access Denied
                        </CardTitle>
                        <CardDescription>
                            You need the <strong>manage_venue_assistance</strong> permission to access
                            the Command Center. Contact an administrator to request access.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">
                        Command Center
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Monitor all venue assistance requests across bookings.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSettingsOpen(true)}
                    className="self-start sm:self-auto"
                >
                    <Settings2 className="mr-2 h-4 w-4" />
                    SLA Settings
                </Button>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Color legend */}
            <div className="flex flex-wrap gap-4 mb-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-red-500" />
                    SLA exceeded
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" />
                    Event within 3 days, not approved
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-green-500" />
                    All approved
                </span>
            </div>

            {/* Table */}
            <CommandCenterTable
                slaDays={slaDays}
                onSelectRequest={handleSelectRequest as any}
                selectedRequestId={selectedRequest?.id}
                ministries={ministries.map((m) => ({ id: m.id, name: m.name }))}
            />
            </div>

            {/* Request detail sheet */}
            <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <SheetContent className="sm:max-w-lg overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle className="font-headline">Request Detail</SheetTitle>
                        <SheetDescription>
                            Full assistance request details and audit log.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="mt-4">
                        {selectedRequest && (
                            <RequestDetailPanel
                                request={selectedRequest}
                                auditLogs={auditLogs}
                                isLoadingLogs={isLoadingLogs}
                            />
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* SLA settings sheet */}
            <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <SheetContent className="sm:max-w-sm">
                    <SheetHeader>
                        <SheetTitle className="font-headline">SLA Settings</SheetTitle>
                        <SheetDescription>
                            Configure the number of days before an unresponded request triggers an
                            escalation notification.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6">
                        {workerProfile && (
                            <SlaSettingsForm
                                actorId={workerProfile.id}
                                currentSlaDays={slaDays}
                                onSaved={(days) => {
                                    setSlaDays(days);
                                    setIsSettingsOpen(false);
                                }}
                            />
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </AppLayout>
    );
}
