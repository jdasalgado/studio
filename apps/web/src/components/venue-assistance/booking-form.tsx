"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@studio/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@studio/ui";
import { Label } from "@studio/ui";
import { Input } from "@studio/ui";
import { Textarea } from "@studio/ui";
import { Checkbox } from "@studio/ui";
import { Badge } from "@studio/ui";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@studio/ui";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@studio/ui";
import { Calendar } from "@studio/ui";
import { Switch } from "@studio/ui";
import { Separator } from "@studio/ui";
import { format } from "date-fns";
import { MAX_LENGTHS } from "@/lib/validation";
import { CalendarIcon, RefreshCw, Users, Bell, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getRooms, getMinistries } from "@/actions/db";
import { getAssistanceConfigsForRoom } from "@/actions/venue-assistance";
import type { CreateVenueBookingData, CreateRecurringBookingData } from "@/actions/venue-assistance";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Room = Awaited<ReturnType<typeof getRooms>>[number];
type Ministry = Awaited<ReturnType<typeof getMinistries>>[number];

export interface BookingFormValues {
    title: string;
    purpose: string;
    roomId: string;
    date: Date | undefined;
    startTime: string;
    endTime: string;
    pax: number;
    numTables: number;
    numChairs: number;
    isRecurring: boolean;
    recurrenceFrequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
    recurrenceDays: string[]; // e.g. ["SU", "MO"]
    recurrenceEndDate: Date | undefined;
    recurrenceCount: number | undefined;
}

interface BookingFormProps {
    workerProfileId: string;
    onSubmit: (
        data: CreateVenueBookingData | CreateRecurringBookingData,
        isRecurring: boolean,
    ) => Promise<void>;
    isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS_OF_WEEK = [
    { value: "SU", label: "Sun" },
    { value: "MO", label: "Mon" },
    { value: "TU", label: "Tue" },
    { value: "WE", label: "Wed" },
    { value: "TH", label: "Thu" },
    { value: "FR", label: "Fri" },
    { value: "SA", label: "Sat" },
];

const TIME_SLOTS = (() => {
    const slots = [];
    for (let h = 6; h <= 21; h++) {
        for (let m = 0; m < 60; m += 30) {
            if (h === 21 && m > 0) continue;
            const value = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
            const displayHour = h % 12 || 12;
            const ampm = h < 12 ? "AM" : "PM";
            const display = `${displayHour}:${m.toString().padStart(2, "0")} ${ampm}`;
            slots.push({ value, display });
        }
    }
    return slots;
})();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BookingForm({ workerProfileId, onSubmit, isSubmitting = false }: BookingFormProps) {
    // ── Form state ────────────────────────────────────────────────────────────
    const [title, setTitle] = useState("");
    const [purpose, setPurpose] = useState("");
    const [branchId, setBranchId] = useState("");
    const [areaId, setAreaId] = useState("");
    const [roomId, setRoomId] = useState("");
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [pax, setPax] = useState(0);
    const [numTables, setNumTables] = useState(0);
    const [numChairs, setNumChairs] = useState(0);

    // Recurring
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrenceFrequency, setRecurrenceFrequency] = useState<"WEEKLY" | "BIWEEKLY" | "MONTHLY">("WEEKLY");
    const [recurrenceDays, setRecurrenceDays] = useState<string[]>([]);
    const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>(undefined);
    const [isEndCalendarOpen, setIsEndCalendarOpen] = useState(false);
    const [recurrenceCount, setRecurrenceCount] = useState<number | undefined>(undefined);
    const [recurrenceEndMode, setRecurrenceEndMode] = useState<"date" | "count">("date");

    // ── Data fetching ─────────────────────────────────────────────────────────
    const { data: allRooms = [] } = useQuery({ queryKey: ["rooms"], queryFn: getRooms });
    const { data: allMinistries = [] } = useQuery<any[]>({ queryKey: ["ministries"], queryFn: () => getMinistries() });
    const { data: roomConfigs = [] } = useQuery({
        queryKey: ["assistanceConfigs", "room", roomId],
        queryFn: () => getAssistanceConfigsForRoom(roomId),
        enabled: !!roomId,
    });

    // ── Derived data ──────────────────────────────────────────────────────────
    const branches = useMemo(() => {
        const seen = new Set<string>();
        const result: { id: string; name: string }[] = [];
        for (const room of allRooms) {
            const branch = room.area?.branch;
            if (branch && !seen.has(branch.id)) {
                seen.add(branch.id);
                result.push({ id: branch.id, name: branch.name });
            }
        }
        return result;
    }, [allRooms]);

    const areas = useMemo(() => {
        if (!branchId) return [];
        const seen = new Set<string>();
        const result: { id: string; name: string }[] = [];
        for (const room of allRooms) {
            const area = room.area;
            if (area && area.branch?.id === branchId && !seen.has(area.id)) {
                seen.add(area.id);
                result.push({ id: area.id, name: area.name });
            }
        }
        return result;
    }, [allRooms, branchId]);

    const filteredRooms = useMemo(() => {
        if (!areaId) return [];
        return allRooms.filter((r) => r.area?.id === areaId);
    }, [allRooms, areaId]);

    // Ministries that will be notified based on room configs
    const notifiedMinistries = useMemo(() => {
        return roomConfigs.map((config) => {
            const ministry = allMinistries.find((m) => m.id === config.ministryId);
            return {
                ministryId: config.ministryId,
                ministryName: ministry?.name ?? config.ministryId,
                itemCount: config.items.length,
            };
        });
    }, [roomConfigs, allMinistries]);

    // Reset area/room when branch changes
    useEffect(() => {
        setAreaId("");
        setRoomId("");
    }, [branchId]);

    useEffect(() => {
        setRoomId("");
    }, [areaId]);

    // ── Recurrence rule builder ───────────────────────────────────────────────
    const buildRrule = (): string => {
        const parts: string[] = [];
        if (recurrenceFrequency === "BIWEEKLY") {
            parts.push("FREQ=WEEKLY;INTERVAL=2");
        } else {
            parts.push(`FREQ=${recurrenceFrequency}`);
        }
        if (recurrenceDays.length > 0) {
            parts.push(`BYDAY=${recurrenceDays.join(",")}`);
        }
        if (recurrenceEndMode === "count" && recurrenceCount) {
            parts.push(`COUNT=${recurrenceCount}`);
        }
        return parts.join(";");
    };

    const toggleDay = (day: string) => {
        setRecurrenceDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
        );
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!date || !startTime || !endTime || !roomId || !title) return;

        if (title.trim().length > MAX_LENGTHS.TITLE) {
            alert(`Event Title must not exceed ${MAX_LENGTHS.TITLE} characters.`);
            return;
        }

        if (purpose && purpose.trim().length > 500) {
            alert("Purpose must not exceed 500 characters.");
            return;
        }

        const targetRoom = allRooms.find((r) => r.id === roomId);
        if ((targetRoom as any)?.status === "Maintenance") {
            alert(`Room "${targetRoom?.name || 'Selected'}" is currently under maintenance and cannot be reserved.`);
            return;
        }

        const [startH, startM] = startTime.split(":").map(Number);
        const [endH, endM] = endTime.split(":").map(Number);

        if (isRecurring) {
            const data: CreateRecurringBookingData = {
                roomId,
                workerProfileId,
                title,
                purpose: purpose || undefined,
                recurrenceRule: buildRrule(),
                startTime,
                endTime,
                startDate: date,
                endDate: recurrenceEndMode === "date" ? recurrenceEndDate : undefined,
                pax,
                guidelinesAccepted: true,
            };
            await onSubmit(data, true);
        } else {
            const start = new Date(date);
            start.setHours(startH, startM, 0, 0);
            const end = new Date(date);
            end.setHours(endH, endM, 0, 0);

            const data: CreateVenueBookingData = {
                roomId,
                workerProfileId,
                title,
                purpose: purpose || undefined,
                start,
                end,
                pax,
                numTables,
                numChairs,
                guidelinesAccepted: true,
            };
            await onSubmit(data, false);
        }
    };

    const isValid =
        !!title && !!roomId && !!date && !!startTime && !!endTime &&
        (!isRecurring || recurrenceDays.length > 0);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic info */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-headline">Event Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">
                            Event Title <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="title"
                            maxLength={MAX_LENGTHS.TITLE}
                            value={title}
                            onChange={(e) => setTitle(e.target.value.slice(0, MAX_LENGTHS.TITLE))}
                            placeholder="e.g., Sunday Service"
                            required
                        />
                        <div className="flex justify-end">
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="purpose">Purpose / Description</Label>
                        <Textarea
                            id="purpose"
                            maxLength={500}
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value.slice(0, 500))}
                            placeholder="Describe the event or meeting..."
                            className="min-h-[80px] resize-none"
                        />
                        <div className="flex justify-end">
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Room selection — branch → area → room cascade */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-headline">Room Selection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Branch</Label>
                            <Select value={branchId} onValueChange={setBranchId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select branch" />
                                </SelectTrigger>
                                <SelectContent>
                                    {branches.map((b) => (
                                        <SelectItem key={b.id} value={b.id}>
                                            {b.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Area</Label>
                            <Select value={areaId} onValueChange={setAreaId} disabled={!branchId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select area" />
                                </SelectTrigger>
                                <SelectContent>
                                    {areas.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>
                                            {a.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>
                                Room <span className="text-destructive">*</span>
                            </Label>
                            <Select value={roomId} onValueChange={setRoomId} disabled={!areaId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select room" />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredRooms.map((r) => {
                                        const isMaint = (r as any).status === 'Maintenance';
                                        return (
                                            <SelectItem key={r.id} value={r.id} disabled={isMaint}>
                                                <div className="flex items-center justify-between w-full gap-2">
                                                    <span className={cn(isMaint && "text-muted-foreground")}>
                                                        {r.name}
                                                    </span>
                                                    {isMaint && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                                                            Maintenance
                                                        </span>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Date & time */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-headline">Date &amp; Time</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>
                                {isRecurring ? "Start Date" : "Date"}{" "}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !date && "text-muted-foreground",
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, "PPP") : "Pick a date"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={(d) => {
                                            if (d) {
                                                setDate(d);
                                                setIsCalendarOpen(false);
                                            }
                                        }}
                                        disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>
                                Start Time <span className="text-destructive">*</span>
                            </Label>
                            <Select value={startTime} onValueChange={setStartTime}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Start" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TIME_SLOTS.map((s) => (
                                        <SelectItem key={`start-${s.value}`} value={s.value}>
                                            {s.display}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>
                                End Time <span className="text-destructive">*</span>
                            </Label>
                            <Select value={endTime} onValueChange={setEndTime}>
                                <SelectTrigger>
                                    <SelectValue placeholder="End" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TIME_SLOTS.slice(1).map((s) => (
                                        <SelectItem key={`end-${s.value}`} value={s.value}>
                                            {s.display}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Capacity */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-headline flex items-center gap-2">
                        <Users className="h-4 w-4" /> Capacity &amp; Setup
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="pax">Pax</Label>
                            <Input
                                id="pax"
                                type="number"
                                min={0}
                                value={pax || ""}
                                onChange={(e) => setPax(parseInt(e.target.value) || 0)}
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tables">Tables</Label>
                            <Input
                                id="tables"
                                type="number"
                                min={0}
                                value={numTables || ""}
                                onChange={(e) => setNumTables(parseInt(e.target.value) || 0)}
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="chairs">Chairs</Label>
                            <Input
                                id="chairs"
                                type="number"
                                min={0}
                                value={numChairs || ""}
                                onChange={(e) => setNumChairs(parseInt(e.target.value) || 0)}
                                placeholder="0"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Recurring toggle */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-headline flex items-center gap-2">
                        <RefreshCw className="h-4 w-4" /> Recurrence
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Switch
                            id="recurring-toggle"
                            checked={isRecurring}
                            onCheckedChange={setIsRecurring}
                        />
                        <Label htmlFor="recurring-toggle" className="cursor-pointer">
                            This is a recurring booking
                        </Label>
                    </div>

                    {isRecurring && (
                        <div className="space-y-4 pt-2">
                            <Separator />

                            {/* Frequency */}
                            <div className="space-y-2">
                                <Label>Frequency</Label>
                                <Select
                                    value={recurrenceFrequency}
                                    onValueChange={(v) =>
                                        setRecurrenceFrequency(v as "WEEKLY" | "BIWEEKLY" | "MONTHLY")
                                    }
                                >
                                    <SelectTrigger className="w-48">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                                        <SelectItem value="BIWEEKLY">Every 2 weeks</SelectItem>
                                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Days of week */}
                            <div className="space-y-2">
                                <Label>
                                    Days of Week <span className="text-destructive">*</span>
                                </Label>
                                <div className="flex flex-wrap gap-2">
                                    {DAYS_OF_WEEK.map((day) => (
                                        <button
                                            key={day.value}
                                            type="button"
                                            onClick={() => toggleDay(day.value)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors",
                                                recurrenceDays.includes(day.value)
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "bg-background text-foreground border-input hover:bg-muted",
                                            )}
                                        >
                                            {day.label}
                                        </button>
                                    ))}
                                </div>
                                {recurrenceDays.length === 0 && (
                                    <p className="text-xs text-destructive">Select at least one day.</p>
                                )}
                            </div>

                            {/* End condition */}
                            <div className="space-y-2">
                                <Label>End Condition</Label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="endMode"
                                            value="date"
                                            checked={recurrenceEndMode === "date"}
                                            onChange={() => setRecurrenceEndMode("date")}
                                        />
                                        <span className="text-sm">End by date</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="endMode"
                                            value="count"
                                            checked={recurrenceEndMode === "count"}
                                            onChange={() => setRecurrenceEndMode("count")}
                                        />
                                        <span className="text-sm">End after N occurrences</span>
                                    </label>
                                </div>

                                {recurrenceEndMode === "date" ? (
                                    <Popover open={isEndCalendarOpen} onOpenChange={setIsEndCalendarOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-48 justify-start text-left font-normal",
                                                    !recurrenceEndDate && "text-muted-foreground",
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {recurrenceEndDate
                                                    ? format(recurrenceEndDate, "PPP")
                                                    : "Pick end date"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={recurrenceEndDate}
                                                onSelect={(d) => {
                                                    if (d) {
                                                        setRecurrenceEndDate(d);
                                                        setIsEndCalendarOpen(false);
                                                    }
                                                }}
                                                disabled={(d) =>
                                                    date ? d <= date : d < new Date()
                                                }
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            min={1}
                                            max={52}
                                            value={recurrenceCount ?? ""}
                                            onChange={(e) =>
                                                setRecurrenceCount(
                                                    parseInt(e.target.value) || undefined,
                                                )
                                            }
                                            placeholder="e.g. 12"
                                            className="w-24"
                                        />
                                        <span className="text-sm text-muted-foreground">occurrences</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Ministry notification preview */}
            {roomId && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-headline flex items-center gap-2">
                            <Bell className="h-4 w-4" /> Ministries to be Notified
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {notifiedMinistries.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No assistance configurations found for this room. No ministries will be
                                notified.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground mb-3">
                                    The following ministries will receive an assistance request when you
                                    submit this booking:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {notifiedMinistries.map((m) => (
                                        <Badge key={m.ministryId} variant="secondary" className="gap-1">
                                            {m.ministryName}
                                            <span className="text-muted-foreground text-xs">
                                                ({m.itemCount} item{m.itemCount !== 1 ? "s" : ""})
                                            </span>
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <div className="flex justify-end">
                <Button type="submit" disabled={!isValid || isSubmitting} className="min-w-32">
                    {isSubmitting ? "Submitting…" : "Submit Booking"}
                </Button>
            </div>
        </form>
    );
}
