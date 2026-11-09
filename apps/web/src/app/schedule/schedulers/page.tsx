"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@studio/ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@studio/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@studio/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@studio/ui";
import { Input } from "@studio/ui";
import { Badge } from "@studio/ui";
import { ArrowLeft, LoaderCircle, UserPlus, X, Users } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMinistries } from "@/hooks/use-ministries";
import { useWorkers } from "@/hooks/use-workers";
import { useUserRole } from "@/hooks/use-user-role";
import { useToast } from "@/hooks/use-toast";
import { assignMinistryScheduler, getMinistrySchedulers } from "@/actions/schedule";

export default function SchedulersPage() {
    const router = useRouter();
    const { toast } = useToast();
    const qc = useQueryClient();
    const { canAssignSchedulers, isSuperAdmin, workerProfile } = useUserRole();

    const { ministries, isLoading: ministriesLoading } = useMinistries();
    const { workers } = useWorkers({ limit: 500 });

    const { data: schedulerData, isLoading: schedulersLoading } = useQuery({
        queryKey: ['ministry-schedulers'],
        queryFn: () => getMinistrySchedulers(),
    });

    const assignMutation = useMutation({
        mutationFn: ({ ministryId, workerId }: { ministryId: string; workerId: string | null }) =>
            assignMinistryScheduler(ministryId, workerId, workerProfile?.id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['ministry-schedulers'] });
            toast({ title: "Scheduler updated" });
        },
        onError: () => toast({ variant: "destructive", title: "Failed to update scheduler" }),
    });

    const [assignDialog, setAssignDialog] = useState<{ ministryId: string; ministryName: string } | null>(null);
    const [workerSearch, setWorkerSearch] = useState("");

    // Department Schedulers can only manage ministries in their department, sorted alpha
    const visibleMinistries = useMemo(() => {
        // Super admins see everything
        if (isSuperAdmin) {
            return [...ministries].sort((a: any, b: any) => stripPrefix(a.name).localeCompare(stripPrefix(b.name)));
        }
        // Department Schedulers: scope to their department
        const userMinistry = ministries.find((m: any) =>
            m.id === workerProfile?.majorMinistryId || m.id === workerProfile?.minorMinistryId
        );
        const userDept = (userMinistry as any)?.department || (userMinistry as any)?.departmentCode;
        if (!userDept) return []; // no ministry set — show nothing
        return ministries
            .filter((m: any) => m.department === userDept || m.departmentCode === userDept)
            .sort((a: any, b: any) => stripPrefix(a.name).localeCompare(stripPrefix(b.name)));
    }, [ministries, isSuperAdmin, workerProfile]);

    const stripPrefix = (name: string) => name.replace(/^[WORDA]-/i, '');

    // Filter workers to only those in the target ministry (major or minor)
    const filteredWorkers = useMemo(() => {
        const targetMinistryId = assignDialog?.ministryId;
        return workers.filter((w: any) => {
            if (w.status !== "Active") return false;
            if (workerSearch && !`${w.firstName} ${w.lastName}`.toLowerCase().includes(workerSearch.toLowerCase())) return false;
            if (!targetMinistryId) return true;
            return w.majorMinistryId === targetMinistryId || w.minorMinistryId === targetMinistryId;
        });
    }, [workers, workerSearch, assignDialog?.ministryId]);

    const getScheduler = (ministryId: string) => {
        const schedulerId = schedulerData?.find(s => s.id === ministryId)?.schedulerId;
        return schedulerId ? workers.find((w: any) => w.id === schedulerId) : null;
    };

    const isLoading = ministriesLoading || schedulersLoading;

    if (!canAssignSchedulers && !isSuperAdmin) {
        return (
            <AppLayout>
                <Card>
                    <CardHeader>
                        <CardTitle>Access Denied</CardTitle>
                        <CardDescription>Only Department Schedulers can manage ministry schedulers.</CardDescription>
                    </CardHeader>
                </Card>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">
                        Ministry Schedulers
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Assign a Ministry Scheduler to each ministry.
                    </p>
                </div>
                <Button variant="outline" onClick={() => router.push("/schedule")} className="self-start sm:self-auto">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Schedules
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-10">
                    <LoaderCircle className="h-8 w-8 animate-spin" />
                </div>
            ) : (
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {visibleMinistries.map((ministry: any) => {
                        const scheduler = getScheduler(ministry.id);
                        return (
                            <Card key={ministry.id}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-semibold">{stripPrefix(ministry.name)}</CardTitle>
                                    <CardDescription className="text-xs">{ministry.department || ministry.departmentCode}</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    {scheduler ? (
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={(scheduler as any).avatarUrl} />
                                                <AvatarFallback className="text-xs">
                                                    {(scheduler as any).firstName[0]}{(scheduler as any).lastName[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                    {(scheduler as any).firstName} {(scheduler as any).lastName}
                                                </p>
                                                <Badge variant="secondary" className="text-xs">Ministry Scheduler</Badge>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0"
                                                onClick={() => assignMutation.mutate({ ministryId: ministry.id, workerId: null })}>
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Users className="h-4 w-4" />
                                            <span className="text-sm flex-1">No scheduler assigned</span>
                                            <Button variant="outline" size="sm" className="h-7 text-xs"
                                                onClick={() => { setAssignDialog({ ministryId: ministry.id, ministryName: stripPrefix(ministry.name) }); setWorkerSearch(""); }}>
                                                <UserPlus className="mr-1 h-3 w-3" /> Assign
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Assign Dialog */}
            <Dialog open={!!assignDialog} onOpenChange={() => setAssignDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Scheduler — {assignDialog?.ministryName}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Input
                            placeholder="Search workers..."
                            value={workerSearch}
                            onChange={e => setWorkerSearch(e.target.value)}
                            autoFocus
                        />
                        <div className="max-h-72 overflow-y-auto space-y-1">
                            {filteredWorkers.map((w: any) => (
                                <button
                                    key={w.id}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-left"
                                    onClick={() => {
                                        assignMutation.mutate({ ministryId: assignDialog!.ministryId, workerId: w.id });
                                        setAssignDialog(null);
                                    }}
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
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
