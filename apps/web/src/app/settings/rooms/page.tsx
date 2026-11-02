
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@studio/ui";
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
} from "@studio/ui";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@studio/ui";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@studio/ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@studio/ui";
import { DeleteConfirmationDialog } from "@/components/common/delete-confirmation-dialog";
import { MoreHorizontal, PlusCircle, LoaderCircle, MapPin, Search, Pencil, Trash2, X, Layers, ArrowLeft, Building, Building2, Users, ArrowUpDown, Sparkles, Wrench } from "lucide-react";
import { Label } from "@studio/ui";
import { Input } from "@studio/ui";
import { Checkbox } from "@studio/ui";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectGroup,
    SelectLabel,
} from "@studio/ui";
import type { Room, Branch, Area, VenueElement } from "@studio/types";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";
import { useAuditLog } from "@/hooks/use-audit-log";
import { useRooms } from "@/hooks/use-rooms";
import { useVenueElements } from "@/hooks/use-venue-elements";
import { Badge } from "@studio/ui";
import { Textarea } from "@studio/ui";
import { cn } from "@/lib/utils";

// --- Satellite (Branch) Management ---

const BranchForm = ({ branch, onSave, onClose }: { branch: Partial<Branch> | null; onSave: (data: Partial<Branch>) => void; onClose: () => void; }) => {
    const [name, setName] = useState(branch?.name || '');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!name.trim()) {
            setError('Satellite Name is required.');
            return;
        }
        if (name.trim().length > 50) {
            setError('Satellite Name must not exceed 50 characters.');
            return;
        }
        onSave({ ...branch, name: name.trim() });
    };

    return (
        <div className="space-y-6">
            <DialogHeader>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sidebar/10 text-sidebar dark:bg-sidebar/25 flex items-center justify-center shrink-0">
                        <Building className="h-5 w-5" />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-bold tracking-tight text-foreground font-headline">
                            {branch ? 'Edit Satellite' : 'Add New Satellite'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                            {branch ? 'Update satellite campus details and building location.' : 'Register a new physical satellite or campus.'}
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            <div className="space-y-4">
                {error && (
                    <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                        {error}
                    </div>
                )}
                <div className="rounded-2xl border border-border/70 bg-slate-50/60 dark:bg-muted/20 p-4 sm:p-5 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="branch-name" className="text-xs font-bold text-foreground">
                            Satellite Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="branch-name"
                            value={name}
                            maxLength={50}
                            onChange={e => { setName(e.target.value); setError(''); }}
                            placeholder="e.g., Main Campus, North Annex"
                            className="h-10 text-xs rounded-xl border-slate-200/90 dark:border-border bg-background shadow-2xs"
                        />
                    </div>
                </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onClose} className="rounded-xl h-10 px-5 text-xs font-semibold">
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    disabled={!name.trim()}
                    className="bg-sidebar hover:bg-sidebar/90 text-white rounded-xl h-10 px-5 text-xs font-bold shadow-xs"
                >
                    {branch ? 'Update Satellite' : 'Create Satellite'}
                </Button>
            </DialogFooter>
        </div>
    );
};

const BranchesTab = ({ branches, areas, isLoading, onAdd, onEdit, onDelete }: { branches: Branch[], areas: Area[], isLoading: boolean, onAdd: () => void, onEdit: (loc: Branch) => void, onDelete: (loc: Branch) => void }) => {
    const getAreaCount = (branchId: string) => areas.filter(a => a.branchId === branchId).length;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Satellites</CardTitle>
                    <CardDescription>Manage physical satellites and buildings.</CardDescription>
                </div>
                <Button onClick={onAdd}><PlusCircle className="mr-2 h-4 w-4" /> Add Satellite</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Areas</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && <TableRow><TableCell colSpan={3} className="text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>}
                        {branches.map(branch => {
                            const areaCount = getAreaCount(branch.id);
                            return (
                                <TableRow key={branch.id}>
                                    <TableCell className="font-medium">{branch.name}</TableCell>
                                    <TableCell>{areaCount}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button type="button" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-36 p-1 rounded-xl shadow-lg border-border/80">
                                                <DropdownMenuItem onSelect={() => setTimeout(() => onEdit(branch), 100)} className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2">
                                                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => setTimeout(() => onDelete(branch), 100)} disabled={areaCount > 0} className="text-destructive cursor-pointer gap-2 rounded-lg text-xs font-medium py-2 focus:text-destructive focus:bg-destructive/10">
                                                    <Trash2 className="h-3.5 w-3.5 text-destructive" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};



const AreaForm = ({ area, branches, onSave, onClose }: { area: Partial<Area> | null; branches: Branch[]; onSave: (data: Partial<Area>) => void; onClose: () => void; }) => {
    const [formData, setFormData] = useState<Partial<Area>>({
        id: area?.id,
        areaId: area?.areaId || '',
        name: area?.name || '',
        branchId: area?.branchId || branches[0]?.id || ''
    });
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!formData.name?.trim()) {
            setError('Area Name is required.');
            return;
        }
        if (formData.name.trim().length > 50) {
            setError('Area Name must not exceed 50 characters.');
            return;
        }
        if (!formData.branchId) {
            setError('Please select a satellite campus.');
            return;
        }
        onSave({ ...formData, name: formData.name.trim() });
    };

    return (
        <div className="flex flex-col h-full max-h-[92vh] overflow-hidden">
            {/* ΓöÇΓöÇ MODAL HEADER ΓöÇΓöÇ */}
            <div className="p-5 pb-4 border-b border-border/70 bg-card/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-2xl bg-sidebar/10 text-sidebar dark:text-sky-400 flex items-center justify-center font-bold shrink-0 border border-sidebar/20 shadow-xs mt-0.5">
                            <Layers className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                            <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground font-headline">
                                {area ? 'Edit Area' : 'Add New Area'}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                {area ? 'Modify area details and configuration.' : 'Add a floor, wing, or section to the facility.'}
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

            {/* ΓöÇΓöÇ SCROLLABLE BODY ΓöÇΓöÇ */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {error && (
                    <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                        {error}
                    </div>
                )}
                <div className="rounded-2xl border border-border/70 bg-slate-50/60 dark:bg-muted/20 p-4 sm:p-5 space-y-4 shadow-2xs">
                    <div className="space-y-1.5">
                        <Label htmlFor="area-name" className="text-xs font-bold text-foreground">
                            Area Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="area-name"
                            value={formData.name}
                            maxLength={50}
                            onChange={e => { setFormData({ ...formData, name: e.target.value }); setError(''); }}
                            placeholder="e.g., Second Floor, Youth Wing"
                            className="h-10 text-xs rounded-xl border-slate-200/90 dark:border-border bg-background shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar"
                        />
                    </div>
                </div>
            </div>

            {/* ΓöÇΓöÇ FOOTER ACTIONS ΓöÇΓöÇ */}
            <div className="p-4 sm:p-5 border-t border-border/70 bg-card/80 backdrop-blur-md flex items-center justify-end gap-2.5 shrink-0">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="rounded-xl h-10 px-5 text-xs font-semibold hover:bg-muted/60 transition-colors cursor-pointer"
                >
                    Cancel
                </Button>
                <Button
                    onClick={() => onSave({ ...formData, branchId: formData.branchId || branches[0]?.id || '' })}
                    disabled={!formData.name?.trim()}
                    className="bg-sidebar hover:bg-sidebar/90 text-white rounded-xl h-10 px-6 text-xs font-bold shadow-xs transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                    {area ? 'Update Area' : 'Create Area'}
                </Button>
            </div>
        </div>
    );
};

const getFloorRank = (name: string): number => {
    const lower = (name || '').toLowerCase().trim();
    if (lower.includes('basement 2') || lower.includes('b2')) return -2;
    if (lower.includes('basement') || lower.includes('b1')) return -1;
    if (lower.includes('ground') || lower.includes('lower ground') || lower.includes('ug') || lower.includes('lg') || lower.includes('g/f') || lower.includes('gf')) return 0;

    const ordinalMap: Record<string, number> = {
        'first': 1, '1st': 1, 'one': 1,
        'second': 2, '2nd': 2, 'two': 2,
        'third': 3, '3rd': 3, 'three': 3,
        'fourth': 4, '4th': 4, 'four': 4,
        'fifth': 5, '5th': 5, 'five': 5,
        'sixth': 6, '6th': 6, 'six': 6,
        'seventh': 7, '7th': 7, 'seven': 7,
        'eighth': 8, '8th': 8, 'eight': 8,
        'ninth': 9, '9th': 9, 'nine': 9,
        'tenth': 10, '10th': 10, 'ten': 10,
        'eleventh': 11, '11th': 11,
        'twelfth': 12, '12th': 12,
    };

    for (const [key, val] of Object.entries(ordinalMap)) {
        const regex = new RegExp(`\\b${key}\\b`, 'i');
        if (regex.test(lower)) return val;
    }

    const numMatch = lower.match(/(\d+)/);
    if (numMatch) {
        return parseInt(numMatch[1], 10);
    }

    if (lower.includes('roof') || lower.includes('deck') || lower.includes('penthouse')) return 999;
    return 100;
};

const AreasTab = ({ areas, branches, rooms, isLoading, onAdd, onEdit, onDelete }: { areas: Area[], branches: Branch[], rooms: Room[], isLoading: boolean, onAdd: () => void, onEdit: (area: Area) => void, onDelete: (area: Area) => void }) => {
    const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || 'N/A';
    const getRoomCount = (areaId: string) => rooms.filter(r => r.areaId === areaId).length;

    const [search, setSearch] = useState('');

    const sortedAreas = useMemo(() => {
        return [...areas].sort((a, b) => {
            const rankA = getFloorRank(a.name || a.areaId || '');
            const rankB = getFloorRank(b.name || b.areaId || '');
            if (rankA !== rankB) return rankA - rankB;
            return (a.name || '').localeCompare(b.name || '');
        });
    }, [areas]);

    const filtered = sortedAreas.filter(area => {
        const matchesSearch = !search || area.name.toLowerCase().includes(search.toLowerCase()) || (area.areaId || area.id).toLowerCase().includes(search.toLowerCase());
        return matchesSearch;
    });

    return (
        <div className="bg-white dark:bg-card rounded-2xl border border-border/60 shadow-card-dark p-5 sm:p-6 overflow-hidden flex flex-col gap-4">
            {/* Top Toolbar Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                    <Input
                        type="text"
                        placeholder="Search areas..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 pr-8 h-10 text-xs font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 border border-slate-200/90 dark:border-border rounded-2xl bg-background dark:bg-muted/30 shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar w-full transition-all"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Right Actions & Filters */}
                <div className="flex items-center justify-end gap-2.5 shrink-0 self-end sm:self-auto sm:ml-auto">
                    {/* Add Area Button */}
                    <Button
                        type="button"
                        onClick={onAdd}
                        className="bg-sidebar hover:bg-sidebar/90 text-white shadow-xs font-semibold text-xs h-10 px-4 gap-1.5 rounded-2xl shrink-0 transition-colors cursor-pointer"
                    >
                        <PlusCircle className="h-4 w-4" />
                        <span>Add Area</span>
                    </Button>
                </div>
            </div>

            {/* Table Container */}
            <div className="border border-border/60 rounded-2xl overflow-hidden flex flex-col bg-card mt-1">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-sidebar hover:bg-sidebar border-b border-sidebar-border/40">
                                <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-5 text-left w-[22%]">AREA ID</TableHead>
                                <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-5 text-left w-[32%]">NAME</TableHead>
                                <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-5 text-left w-[24%]">SATELLITE</TableHead>
                                <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-5 text-center w-[12%]">ROOMS</TableHead>
                                <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-5 text-center w-[10%]">ACTIONS</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="py-14 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="py-14 text-center text-sm text-muted-foreground">No areas found.</TableCell></TableRow>
                            ) : filtered.map(area => {
                                const roomCount = getRoomCount(area.id);
                                return (
                                    <TableRow key={area.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                                        <TableCell className="px-5 py-3.5 align-middle">
                                            <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-muted/50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-border">
                                                {area.areaId || area.id}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-5 py-3.5 align-middle">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-sidebar/10 text-sidebar dark:bg-sidebar/30 dark:text-sidebar-foreground text-xs font-bold flex items-center justify-center shrink-0 border border-sidebar/20">
                                                    <Layers className="h-4 w-4" />
                                                </div>
                                                <span className="font-bold text-foreground text-xs sm:text-sm">{area.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-5 py-3.5 align-middle">
                                            <Badge variant="outline" className="text-[11px] font-semibold bg-slate-100 dark:bg-muted/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-border rounded-lg px-2.5 py-0.5">
                                                {getBranchName(area.branchId)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-5 py-3.5 text-center align-middle">
                                            <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                {roomCount} {roomCount === 1 ? 'room' : 'rooms'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-5 py-3.5 text-center align-middle">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-36 p-1 rounded-xl shadow-lg border-border/80">
                                                    <DropdownMenuItem
                                                        onClick={() => onEdit(area)}
                                                        className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Edit Area
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => onDelete(area)}
                                                        disabled={roomCount > 0}
                                                        className="text-destructive cursor-pointer gap-2 rounded-lg text-xs font-medium py-2 focus:text-destructive focus:bg-destructive/10"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 text-destructive" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
};




const RoomForm = ({ room, areas, branches, venueElements, onSave, onClose }: { room: Partial<Room> | null; areas: Area[]; branches: Branch[]; venueElements: VenueElement[]; onSave: (data: Partial<Room>) => void; onClose: () => void; }) => {
    const [error, setError] = useState('');
    const [formData, setFormData] = useState<Partial<Room>>({
        id: room?.id,
        name: room?.name || '',
        capacity: room?.capacity || 0,
        elements: room?.elements || [],
        areaId: room?.areaId || '',
        weight: room?.weight || 0,
        status: room?.status || 'Active',
        numChairs: room?.numChairs ?? null,
        numTables: room?.numTables ?? null,
    });

    const handleElementChange = (elementId: string, checked: boolean) => {
        setFormData(prev => {
            const currentElements = prev.elements || [];
            if (checked) {
                return { ...prev, elements: [...currentElements, elementId] };
            } else {
                return { ...prev, elements: currentElements.filter(id => id !== elementId) };
            }
        });
    };

    const groupedAreas = useMemo(() => {
        return branches.map(branch => ({
            branchName: branch.name,
            areas: areas
                .filter(area => area.branchId === branch.id)
                .sort((a, b) => {
                    const rankA = getFloorRank(a.name || a.areaId || '');
                    const rankB = getFloorRank(b.name || b.areaId || '');
                    if (rankA !== rankB) return rankA - rankB;
                    return (a.name || '').localeCompare(b.name || '');
                })
        })).filter(group => group.areas.length > 0);
    }, [areas, branches]);

    return (
        <div className="flex flex-col h-full max-h-[92vh] overflow-hidden">
            {/* ΓöÇΓöÇ MODAL HEADER ΓöÇΓöÇ */}
            <div className="p-5 pb-4 border-b border-border/70 bg-card/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-2xl bg-sidebar/10 text-sidebar dark:text-sky-400 flex items-center justify-center font-bold shrink-0 border border-sidebar/20 shadow-xs mt-0.5">
                            <MapPin className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                            <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground font-headline">
                                {room ? 'Edit Room' : 'Add New Room'}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                {room ? 'Update room capacity, location, and equipment configuration.' : 'Configure a new room for reservation and scheduling.'}
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

            {/* ΓöÇΓöÇ SCROLLABLE BODY ΓöÇΓöÇ */}
            <div className="p-5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
                {error && (
                    <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                        {error}
                    </div>
                )}
                {/* 1. Basic Details Card */}
                <div className="rounded-2xl border border-border/70 bg-slate-50/60 dark:bg-muted/20 p-4 sm:p-5 space-y-4 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sidebar dark:text-sky-400">
                        <Building2 className="h-4 w-4" />
                        <span>Room Specifications</span>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="room-name" className="text-xs font-bold text-foreground">
                            Room Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="room-name"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            maxLength={50}
                            placeholder="e.g., Studio, Conference Room A, Main Sanctuary"
                            className="h-10 text-xs rounded-xl border-slate-200/90 dark:border-border bg-background shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="room-area" className="text-xs font-bold text-foreground">
                            Area / Location <span className="text-destructive">*</span>
                        </Label>
                        <Select value={formData.areaId} onValueChange={value => setFormData({ ...formData, areaId: value })}>
                            <SelectTrigger id="room-area" className="h-10 text-xs rounded-xl border-slate-200/90 dark:border-border bg-background shadow-2xs font-medium focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar cursor-pointer">
                                <SelectValue placeholder="Select an area / floor" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl max-h-72 overflow-y-auto shadow-xl border-border/80">
                                {groupedAreas.map(group => (
                                    <SelectGroup key={group.branchName}>
                                        <SelectLabel className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider bg-muted/40 my-1 px-2 py-1.5 rounded-sm">
                                            {group.branchName}
                                        </SelectLabel>
                                        {group.areas.map(area => (
                                            <SelectItem key={area.id} value={area.id} className="text-xs cursor-pointer">
                                                {area.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="room-capacity" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Seating Capacity</span>
                            <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="room-capacity"
                            type="number"
                            min={0}
                            max={5000}
                            value={formData.capacity === 0 ? '' : formData.capacity}
                            onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) || 0 })}
                            placeholder="e.g., 50"
                            className="h-10 text-xs rounded-xl border-slate-200/90 dark:border-border bg-background shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar"
                        />
                    </div>

                    {/* Chairs & Tables Row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="room-chairs" className="text-xs font-bold text-foreground">
                                No. of Chairs
                            </Label>
                            <Input
                                id="room-chairs"
                                type="number"
                                min={0}
                                max={5000}
                                value={formData.numChairs == null ? '' : formData.numChairs}
                                onChange={e => setFormData({ ...formData, numChairs: e.target.value === '' ? null : parseInt(e.target.value, 10) || 0 })}
                                placeholder="e.g., 30"
                                className="h-10 text-xs rounded-xl border-slate-200/90 dark:border-border bg-background shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="room-tables" className="text-xs font-bold text-foreground">
                                No. of Tables
                            </Label>
                            <Input
                                id="room-tables"
                                type="number"
                                min={0}
                                max={1000}
                                value={formData.numTables == null ? '' : formData.numTables}
                                onChange={e => setFormData({ ...formData, numTables: e.target.value === '' ? null : parseInt(e.target.value, 10) || 0 })}
                                placeholder="e.g., 10"
                                className="h-10 text-xs rounded-xl border-slate-200/90 dark:border-border bg-background shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar"
                            />
                        </div>
                    </div>

                    {/* Room Status */}
                    <div className="space-y-1.5">
                        <Label htmlFor="room-status" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Room Status</span>
                        </Label>
                        <Select
                            value={formData.status || 'Active'}
                            onValueChange={value => setFormData({ ...formData, status: value as 'Active' | 'Maintenance' })}
                        >
                            <SelectTrigger id="room-status" className="h-10 text-xs rounded-xl border-slate-200/90 dark:border-border bg-background shadow-2xs font-medium focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar cursor-pointer">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl shadow-xl border-border/80">
                                <SelectItem value="Active" className="text-xs cursor-pointer">
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                        Active
                                    </span>
                                </SelectItem>
                                <SelectItem value="Maintenance" className="text-xs cursor-pointer">
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                                        Maintenance
                                    </span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* 2. Venue Elements Card */}
                <div className="rounded-2xl border border-border/70 bg-slate-50/60 dark:bg-muted/20 p-4 sm:p-5 space-y-3.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-3 flex-nowrap">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sidebar dark:text-sky-400 min-w-0">
                            <Sparkles className="h-4 w-4 shrink-0" />
                            <span className="truncate sm:whitespace-normal">Included Venue Elements / Amenities</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold bg-sidebar/10 text-sidebar dark:text-sky-400 border-sidebar/20 rounded-full px-2.5 py-0.5 whitespace-nowrap shrink-0 inline-flex items-center justify-center">
                            {formData.elements?.length || 0} selected
                        </Badge>
                    </div>

                    {venueElements.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic text-center py-4">
                            No venue amenities configured yet.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto p-1">
                            {venueElements.map(item => {
                                const isChecked = formData.elements?.includes(item.id);
                                return (
                                    <label
                                        key={item.id}
                                        htmlFor={`elem-${item.id}`}
                                        className={cn(
                                            "flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer text-xs",
                                            isChecked
                                                ? "bg-sidebar/5 border-sidebar/40 text-foreground font-semibold shadow-2xs ring-1 ring-sidebar/20"
                                                : "bg-background border-slate-200/80 dark:border-border text-muted-foreground hover:border-slate-300"
                                        )}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <Checkbox
                                                id={`elem-${item.id}`}
                                                checked={isChecked}
                                                onCheckedChange={(checked) => handleElementChange(item.id, !!checked)}
                                                className="rounded-md"
                                            />
                                            <span className="truncate max-w-[130px] font-medium">{item.name}</span>
                                        </div>
                                        <Badge variant="secondary" className="text-[10px] uppercase font-bold shrink-0 px-2 py-0.5">
                                            {item.category}
                                        </Badge>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ΓöÇΓöÇ FOOTER ACTIONS ΓöÇΓöÇ */}
            <div className="p-4 sm:p-5 border-t border-border/70 bg-card/80 backdrop-blur-md flex items-center justify-end gap-2.5 shrink-0">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="rounded-xl h-10 px-5 text-xs font-semibold hover:bg-muted/60 transition-colors cursor-pointer"
                >
                    Cancel
                </Button>
                <Button
                    onClick={() => {
                    if (!formData.name?.trim()) {
                        setError('Room Name is required.');
                        return;
                    }
                    if (formData.name.trim().length > 50) {
                        setError('Room Name must not exceed 50 characters.');
                        return;
                    }
                    if (!formData.areaId) {
                        setError('Area / Location is required. Please select an area.');
                        return;
                    }
                    if (formData.capacity !== undefined && formData.capacity > 5000) {
                        setError('Capacity cannot exceed 5,000.');
                        return;
                    }
                    if (formData.numChairs !== null && formData.numChairs !== undefined && formData.numChairs > 5000) {
                        setError('Number of chairs cannot exceed 5,000.');
                        return;
                    }
                    if (formData.numTables !== null && formData.numTables !== undefined && formData.numTables > 1000) {
                        setError('Number of tables cannot exceed 1,000.');
                        return;
                    }
                    onSave({ ...formData, name: formData.name.trim() });
                }}
                    className="bg-sidebar hover:bg-sidebar/90 text-white rounded-xl h-10 px-6 text-xs font-bold shadow-xs transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                    {room ? 'Update Room' : 'Create Room'}
                </Button>
            </div>
        </div>
    );
};

const RoomsTab = ({ rooms, areas, branches, venueElements, isLoading, onAdd, onEdit, onDelete }: { rooms: Room[], areas: Area[], branches: Branch[], venueElements: VenueElement[], isLoading: boolean, onAdd: () => void, onEdit: (room: Room) => void, onDelete: (room: Room) => void }) => {
    const getAreaAndBranch = (areaIdValue: string) => {
        const area = areas.find(a => a.id === areaIdValue);
        if (!area) return { areaName: 'N/A', branchName: 'N/A' };
        const branch = branches.find(b => b.id === area.branchId);
        return { areaName: area.name, branchName: branch ? branch.name : 'N/A' };
    };

    const [search, setSearch] = useState('');
    const [areaFilter, setAreaFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    const sortedAreasForFilter = useMemo(() => {
        return [...areas].sort((a, b) => {
            const rankA = getFloorRank(a.name || a.areaId || '');
            const rankB = getFloorRank(b.name || b.areaId || '');
            if (rankA !== rankB) return rankA - rankB;
            return (a.name || '').localeCompare(b.name || '');
        });
    }, [areas]);

    const filtered = useMemo(() => {
        return rooms
            .filter(room => {
                const matchesSearch = !search || room.name.toLowerCase().includes(search.toLowerCase());
                const matchesArea = areaFilter === 'all' || room.areaId === areaFilter;
                const roomStatus = room.status || 'Active';
                const matchesStatus = statusFilter === 'all' || roomStatus === statusFilter;
                return matchesSearch && matchesArea && matchesStatus;
            })
            .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
    }, [rooms, search, areaFilter, statusFilter]);

    return (
        <div className="bg-white dark:bg-card rounded-2xl border border-border/60 shadow-card-dark p-5 sm:p-6 overflow-hidden flex flex-col gap-4">
            {/* Top Toolbar Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                    <Input
                        type="text"
                        placeholder="Search rooms..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 pr-8 h-10 text-xs font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 border border-slate-200/90 dark:border-border rounded-2xl bg-background dark:bg-muted/30 shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar w-full transition-all"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Right Actions & Filters */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full sm:w-auto">
                    {/* Filter Dropdowns */}
                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                        {/* Area Filter */}
                        <Select value={areaFilter} onValueChange={setAreaFilter}>
                            <SelectTrigger className="h-10 w-full sm:w-40 text-xs rounded-2xl border-slate-200/90 dark:border-border bg-background dark:bg-muted/30 font-medium shadow-2xs px-3 shrink-0">
                                <SelectValue placeholder="All Areas" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72 overflow-y-auto">
                                <SelectItem value="all" className="text-xs font-semibold cursor-pointer">
                                    All Areas
                                </SelectItem>
                                {sortedAreasForFilter.map(a => (
                                    <SelectItem key={a.id} value={a.id} className="text-xs cursor-pointer">
                                        {a.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Status Filter */}
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-10 w-full sm:w-36 text-xs rounded-2xl border-slate-200/90 dark:border-border bg-background dark:bg-muted/30 font-medium shadow-2xs px-3 shrink-0">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="text-xs cursor-pointer">All Statuses</SelectItem>
                                <SelectItem value="Active" className="text-xs cursor-pointer">Active</SelectItem>
                                <SelectItem value="Maintenance" className="text-xs cursor-pointer">Maintenance</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Add Room Button */}
                    <Button
                        type="button"
                        onClick={onAdd}
                        className="bg-sidebar hover:bg-sidebar/90 text-white shadow-xs font-semibold text-xs h-10 px-4 gap-1.5 rounded-2xl shrink-0 transition-colors cursor-pointer self-end sm:self-auto"
                    >
                        <PlusCircle className="h-4 w-4" />
                        <span>Add Room</span>
                    </Button>
                </div>
            </div>

            {/* Table / Mobile Cards Container */}
            <div className="border border-border/60 rounded-2xl overflow-hidden flex flex-col bg-card mt-1">
                {/* ΓöÇΓöÇ Mobile Card View (md:hidden) ΓöÇΓöÇ */}
                <div className="md:hidden p-3 space-y-3 bg-muted/15 dark:bg-muted/10">
                    {isLoading ? (
                        <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
                            <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
                            <p className="text-xs text-muted-foreground font-medium">Loading rooms...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                            No rooms found.
                        </div>
                    ) : filtered.map(room => {
                        const { areaName, branchName } = getAreaAndBranch(room.areaId);
                        const status = room.status || 'Active';
                        const isMaintenance = status === 'Maintenance';
                        return (
                            <div
                                key={room.id}
                                className="rounded-2xl border border-slate-200/80 dark:border-border/80 bg-card overflow-hidden shadow-xs transition-colors"
                            >
                                {/* Top Navy Blue Banner */}
                                <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-sidebar text-white">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-2.5 h-2.5 rounded-[3px] border border-white/60 bg-white/20 shrink-0" />
                                        <span className="text-xs font-mono font-bold text-white tracking-wide truncate">
                                            {room.id}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {isMaintenance ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-400/20 text-amber-200 border border-amber-400/30">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                                Maintenance
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                Active
                                            </span>
                                        )}

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer shrink-0 outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none ring-0"
                                                    title="Room actions"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-40 p-1.5 rounded-xl shadow-xl border-border/80">
                                                <DropdownMenuItem
                                                    onClick={() => onEdit(room)}
                                                    className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2"
                                                >
                                                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Edit Room
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => onDelete(room)}
                                                    className="text-destructive cursor-pointer gap-2 rounded-lg text-xs font-medium py-2 focus:text-destructive focus:bg-destructive/10"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-destructive" /> Delete Room
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>

                                {/* Card Body */}
                                <div className="p-4 space-y-3 bg-white dark:bg-card">
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-foreground text-base font-headline leading-tight">
                                            {room.name}
                                        </h4>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                                            <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                            <span>{branchName !== 'N/A' ? branchName : 'Main Campus'}</span>
                                        </p>
                                    </div>

                                    {/* Aligned Row: Second floor & Seats capacity */}
                                    <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-border/60">
                                        <Badge
                                            variant="outline"
                                            className="text-[11px] font-semibold bg-slate-100 dark:bg-muted/50 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-border/70 rounded-lg px-2.5 py-1 inline-flex items-center gap-1.5"
                                        >
                                            <Layers className="h-3 w-3 text-slate-400 shrink-0" />
                                            <span>{areaName}</span>
                                        </Badge>

                                        <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-2xs whitespace-nowrap shrink-0">
                                            <Users className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                            <span>{room.capacity} seats</span>
                                        </span>
                                    </div>
                                    {/* Chairs / Tables */}
                                    {(room.numChairs != null || room.numTables != null) && (
                                        <div className="flex items-center gap-2 pt-2 flex-wrap">
                                            {room.numChairs != null && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700 dark:bg-muted/40 dark:text-slate-300 border border-slate-200 dark:border-border">
                                                    <Users className="h-3 w-3 text-slate-400 shrink-0" />{room.numChairs} chairs
                                                </span>
                                            )}
                                            {room.numTables != null && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700 dark:bg-muted/40 dark:text-slate-300 border border-slate-200 dark:border-border">
                                                    <Layers className="h-3 w-3 text-slate-400 shrink-0" />{room.numTables} tables
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ΓöÇΓöÇ Desktop Table View (hidden md:block) ΓöÇΓöÇ */}
                <div className="hidden md:block overflow-x-auto">
                    <Table className="min-w-[620px]">
                        <TableHeader>
                            <TableRow className="bg-sidebar hover:bg-sidebar border-b border-sidebar-border/40">
                                <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-5 text-left w-[28%]">NAME</TableHead>
                                <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-5 text-left w-[24%]">LOCATION</TableHead>
                                <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-5 text-center w-[13%]">CAPACITY</TableHead>
                                <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-5 text-center w-[16%]">CHAIRS / TABLES</TableHead>
                                <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-5 text-center w-[13%]">STATUS</TableHead>
                                <TableHead className="bg-sidebar font-bold text-white text-[11px] uppercase tracking-wider h-11 px-5 text-center w-[12%]">ACTIONS</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="py-14 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="py-14 text-center text-sm text-muted-foreground">No rooms found.</TableCell></TableRow>
                            ) : filtered.map(room => {
                                const { areaName, branchName } = getAreaAndBranch(room.areaId);
                                const status = room.status || 'Active';
                                const isMaintenance = status === 'Maintenance';
                                return (
                                    <TableRow key={room.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                                        <TableCell className="px-5 py-3.5 align-middle">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-sidebar/10 text-sidebar dark:bg-sidebar/30 dark:text-sidebar-foreground text-xs font-bold flex items-center justify-center shrink-0 border border-sidebar/20">
                                                    <MapPin className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-foreground text-xs sm:text-sm leading-tight">{room.name}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">{branchName !== 'N/A' ? branchName : 'Main Campus'}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-5 py-3.5 align-middle">
                                            <Badge variant="outline" className="text-[11px] font-semibold bg-slate-100 dark:bg-muted/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-border rounded-lg px-2.5 py-0.5">
                                                {areaName}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-5 py-3.5 text-center align-middle whitespace-nowrap">
                                            <span className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-2xs">
                                                {room.capacity} seats
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-5 py-3.5 text-center align-middle whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-2 flex-wrap">
                                                {room.numChairs != null ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700 dark:bg-muted/40 dark:text-slate-300 border border-slate-200 dark:border-border">
                                                        <Users className="h-3 w-3 text-slate-400 shrink-0" />{room.numChairs}c
                                                    </span>
                                                ) : null}
                                                {room.numTables != null ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700 dark:bg-muted/40 dark:text-slate-300 border border-slate-200 dark:border-border">
                                                        <Layers className="h-3 w-3 text-slate-400 shrink-0" />{room.numTables}t
                                                    </span>
                                                ) : null}
                                                {room.numChairs == null && room.numTables == null ? (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-5 py-3.5 text-center align-middle">
                                            <Badge
                                                variant="secondary"
                                                className={cn(
                                                    "px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5",
                                                    isMaintenance
                                                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                                )}
                                            >
                                                <span className={cn("w-1.5 h-1.5 rounded-full", isMaintenance ? "bg-amber-500" : "bg-emerald-500")} />
                                                {status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-5 py-3.5 text-center align-middle">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-36 p-1 rounded-xl shadow-lg border-border/80">
                                                    <DropdownMenuItem
                                                        onClick={() => onEdit(room)}
                                                        className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Edit Room
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => onDelete(room)}
                                                        className="text-destructive cursor-pointer gap-2 rounded-lg text-xs font-medium py-2 focus:text-destructive focus:bg-destructive/10"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 text-destructive" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
};

// --- Main Page Component ---

export default function RoomManagementPage() {
    const { canManageFacilities, isLoading: isRoleLoading } = useUserRole();
    const { logAction } = useAuditLog();
    const { toast } = useToast();

    // SQL Hooks
    const {
        rooms, areas, branches, isLoading: roomsDataLoading,
        createRoom, updateRoom, deleteRoom, createRooms,
        createArea, updateArea, deleteArea, createAreas,
        createBranch, updateBranch, deleteBranch
    } = useRooms();
    const { venueElements, isLoading: venueElementsLoading } = useVenueElements();

    // State for forms and dialogs
    const [isBranchSheetOpen, setIsBranchSheetOpen] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
    const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);

    const [isAreaSheetOpen, setIsAreaSheetOpen] = useState(false);
    const [selectedArea, setSelectedArea] = useState<Area | null>(null);
    const [areaToDelete, setAreaToDelete] = useState<Area | null>(null);

    const [isRoomSheetOpen, setIsRoomSheetOpen] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
    const [activeTab, setActiveTab] = useState<'rooms' | 'areas'>('rooms');

    const isLoading = roomsDataLoading || isRoleLoading || venueElementsLoading;

    // --- Branch Handlers ---
    const handleSaveBranch = async (data: Partial<Branch>) => {
        try {
            if (data.id) {
                const existing = branches?.find(b => b.id === data.id);
                await updateBranch({ id: data.id, data });
                await logAction(
                    'Updated Campus',
                    'Facilities',
                    `Updated satellite campus "${data.name || existing?.name}"`,
                    data.id,
                    data.name || existing?.name
                );
                toast({ title: 'Satellite Updated' });
            } else {
                const customId = `B-${data.name!.trim().replace(/\s+/g, ' ')}`;
                await createBranch({ ...data, id: customId });
                await logAction(
                    'Created Campus',
                    'Facilities',
                    `Created satellite campus "${data.name}"`,
                    customId,
                    data.name
                );
                toast({ title: 'Satellite Added' });
            }
            setIsBranchSheetOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Save Failed', description: (error as any)?.message || 'Could not save satellite.' });
        }
    };

    const handleDeleteBranch = async () => {
        if (!branchToDelete) return;
        try {
            await deleteBranch(branchToDelete.id);
            await logAction(
                'Deleted Campus',
                'Facilities',
                `Deleted satellite campus "${branchToDelete.name}" (${branchToDelete.id})`,
                branchToDelete.id,
                branchToDelete.name
            );
            toast({ title: 'Satellite Deleted' });
            setBranchToDelete(null);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: 'Could not delete satellite.' });
        }
    };

    // --- Area Handlers ---
    const handleSaveArea = async (data: Partial<Area>) => {
        try {
            if (data.id) {
                const existing = areas?.find(a => a.id === data.id);
                await updateArea({ id: data.id, data });
                await logAction(
                    'Updated Area',
                    'Facilities',
                    `Updated facility area "${data.name || existing?.name}"`,
                    data.id,
                    data.name || existing?.name
                );
                toast({ title: 'Area Updated' });
            } else {
                if (!data.name || !data.branchId) {
                    toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill out Name and Satellite.' });
                    return;
                }
                const branchName = branches?.find(b => b.id === data.branchId)?.name || 'X';
                const branchInitial = branchName.charAt(0).toUpperCase();
                const customId = `${branchInitial}-${data.name!.trim()}`;

                await createArea({
                    ...data,
                    id: customId,
                    areaId: customId
                });
                await logAction(
                    'Created Area',
                    'Facilities',
                    `Created facility area "${data.name}" in campus "${branchName}"`,
                    customId,
                    data.name
                );
                toast({ title: 'Area Added' });
            }
            setIsAreaSheetOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Save Failed', description: (error as any)?.message || 'Could not save area.' });
        }
    };

    const handleDeleteArea = async () => {
        if (!areaToDelete) return;
        try {
            await deleteArea(areaToDelete.id);
            await logAction(
                'Deleted Area',
                'Facilities',
                `Deleted facility area "${areaToDelete.name}" (${areaToDelete.id})`,
                areaToDelete.id,
                areaToDelete.name
            );
            toast({ title: 'Area Deleted' });
            setAreaToDelete(null);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: 'Could not delete area.' });
        }
    };

    const handleSaveRoom = async (data: Partial<Room>) => {
        try {
            if (data.id) {
                const existingRoom = rooms?.find(r => r.id === data.id);
                const area = areas?.find(a => a.id === (data.areaId || existingRoom?.areaId));
                const areaName = area?.name || 'Area';

                await updateRoom({ id: data.id, data });

                let actionName = 'Updated Room';
                let changeDesc = `Updated room "${data.name || existingRoom?.name}"`;
                if (existingRoom && data.status && existingRoom.status !== data.status) {
                    actionName = 'Updated Room Status';
                    changeDesc = `Changed room "${data.name || existingRoom.name}" status from "${existingRoom.status || 'Active'}" to "${data.status}"`;
                } else if (existingRoom && data.capacity !== undefined && existingRoom.capacity !== data.capacity) {
                    changeDesc = `Updated room "${data.name || existingRoom.name}" capacity to ${data.capacity} seats`;
                }

                await logAction(
                    actionName,
                    'Facilities',
                    `${changeDesc} (${areaName}, Capacity: ${data.capacity ?? existingRoom?.capacity ?? 0})`,
                    data.id,
                    data.name || existingRoom?.name || 'Room'
                );

                toast({ title: 'Room Updated' });
            } else {
                const area = areas?.find(a => a.id === data.areaId);
                const areaName = area?.name || 'X';
                const areaInitial = areaName.charAt(0).toUpperCase();
                const customId = `${areaInitial}-${data.name!.trim()}`;

                await createRoom({
                    ...data,
                    id: customId
                });

                await logAction(
                    'Created Room',
                    'Facilities',
                    `Created new room "${data.name}" in area "${areaName}" (Status: ${data.status || 'Active'}, Capacity: ${data.capacity || 0})`,
                    customId,
                    data.name
                );

                toast({ title: 'Room Added' });
            }
            setIsRoomSheetOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Save Failed', description: (error as any)?.message || 'Could not save room.' });
        }
    };

    const handleDeleteRoom = async () => {
        if (!roomToDelete) return;
        try {
            await deleteRoom(roomToDelete.id);
            await logAction(
                'Deleted Room',
                'Facilities',
                `Deleted room "${roomToDelete.name}" (${roomToDelete.id})`,
                roomToDelete.id,
                roomToDelete.name
            );
            toast({ title: 'Room Deleted' });
            setRoomToDelete(null);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: 'Could not delete room.' });
        }
    };

    if (isLoading) {
        return <AppLayout><div className="flex justify-center py-10"><LoaderCircle className="h-8 w-8 animate-spin" /></div></AppLayout>;
    }

    if (!canManageFacilities) {
        return <AppLayout><Card><CardHeader><CardTitle>Access Denied</CardTitle><CardDescription>You do not have permission to view this page.</CardDescription></CardHeader></Card></AppLayout>;
    }

    return (
        <AppLayout>
            <div className="space-y-7 pb-12 w-full">

                {/* Header: Facilities Management with Back Button on the right (same row) */}
                <div className="flex items-center justify-between gap-3 w-full">
                    <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
                        <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight text-foreground">
                            Facilities Management
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            Rooms, areas and satellite campuses in one place.
                        </p>
                    </div>

                    {/* Back Button (RIGHT, in same row as Facilities Management) */}
                    <Link
                        href="/settings"
                        className="flex items-center gap-1.5 h-9 px-3.5 sm:px-4 rounded-xl border border-border/60 bg-white dark:bg-card text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors shrink-0 shadow-2xs"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </Link>
                </div>

                {/* Sub-Header Navigation Bar: Rooms/Areas Segmented Tab Selector on the RIGHT */}
                <div className="flex items-center justify-end w-full gap-3">
                    {/* Segmented Tab Selector (RIGHT) */}
                    <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-muted p-1 rounded-xl border border-slate-200/70 dark:border-border/50 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setActiveTab('rooms')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${activeTab === 'rooms' ? 'bg-sidebar text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground'}`}
                        >
                            <span>Rooms</span>
                            <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold ${activeTab === 'rooms' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                                {rooms?.length ?? 0}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('areas')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${activeTab === 'areas' ? 'bg-sidebar text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground'}`}
                        >
                            <span>Areas</span>
                            <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold ${activeTab === 'areas' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                                {areas?.length ?? 0}
                            </span>
                        </button>
                    </div>
                </div>

                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Content */}
                    {activeTab === 'rooms' && (
                        <RoomsTab
                            rooms={[...(rooms || [])].sort((a, b) => { const wa = a.weight ?? 0, wb = b.weight ?? 0; return wa !== wb ? wa - wb : a.name.localeCompare(b.name); })}
                            areas={areas || []}
                            branches={branches || []}
                            venueElements={venueElements || []}
                            isLoading={isLoading}
                            onAdd={() => { setSelectedRoom(null); setIsRoomSheetOpen(true); }}
                            onEdit={(room) => { setSelectedRoom(room); setIsRoomSheetOpen(true); }}
                            onDelete={(room) => setRoomToDelete(room)}
                        />
                    )}
                    {activeTab === 'areas' && (
                        <AreasTab
                            areas={areas || []}
                            branches={branches || []}
                            rooms={rooms || []}
                            isLoading={isLoading}
                            onAdd={() => { setSelectedArea(null); setIsAreaSheetOpen(true); }}
                            onEdit={(area) => { setSelectedArea(area); setIsAreaSheetOpen(true); }}
                            onDelete={(area) => setAreaToDelete(area)}
                        />
                    )}
                </div>
            </div>

            {/* Dialogs for Add/Edit/Import */}
            <Dialog open={isBranchSheetOpen} onOpenChange={setIsBranchSheetOpen}>
                <DialogContent className="sm:max-w-lg p-6 sm:p-7 rounded-2xl border-border/80 shadow-2xl">
                    <BranchForm branch={selectedBranch} onSave={handleSaveBranch} onClose={() => setIsBranchSheetOpen(false)} />
                </DialogContent>
            </Dialog>
            <Dialog open={isAreaSheetOpen} onOpenChange={setIsAreaSheetOpen}>
                <DialogContent className="sm:max-w-lg max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl border border-border/80 shadow-2xl bg-card [&>button:last-child]:hidden">
                    <AreaForm area={selectedArea} branches={branches || []} onSave={handleSaveArea} onClose={() => setIsAreaSheetOpen(false)} />
                </DialogContent>
            </Dialog>

            <Dialog open={isRoomSheetOpen} onOpenChange={setIsRoomSheetOpen}>
                <DialogContent className="sm:max-w-xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl border border-border/80 shadow-2xl bg-card [&>button:last-child]:hidden">
                    <RoomForm
                        key={selectedRoom?.id || 'new'}
                        room={selectedRoom}
                        areas={areas || []}
                        branches={branches || []}
                        venueElements={venueElements || []}
                        onSave={handleSaveRoom}
                        onClose={() => setIsRoomSheetOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialogs */}
            <DeleteConfirmationDialog
                isOpen={!!branchToDelete}
                onClose={() => setBranchToDelete(null)}
                onConfirm={handleDeleteBranch}
                title="Delete Satellite?"
                itemName={branchToDelete?.name}
                confirmLabel="Delete Satellite"
            />
            <DeleteConfirmationDialog
                isOpen={!!areaToDelete}
                onClose={() => setAreaToDelete(null)}
                onConfirm={handleDeleteArea}
                title="Delete Area?"
                itemName={areaToDelete?.name}
                confirmLabel="Delete Area"
            />
            <DeleteConfirmationDialog
                isOpen={!!roomToDelete}
                onClose={() => setRoomToDelete(null)}
                onConfirm={handleDeleteRoom}
                title="Delete Room?"
                itemName={roomToDelete?.name}
                confirmLabel="Delete Room"
            />
        </AppLayout>
    );
}
