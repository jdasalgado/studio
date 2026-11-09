"use client";

import React, { useState } from "react";
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@studio/ui";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@studio/ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@studio/ui";
import { MoreHorizontal, PlusCircle, LoaderCircle, Wrench, Users, Package, Pencil, Trash2, Layers } from "lucide-react";
import { Label } from "@studio/ui";
import { Input } from "@studio/ui";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@studio/ui";
import type { VenueElement, Ministry } from "@studio/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getVenueElements, createVenueElement, updateVenueElement, deleteVenueElement, getMinistries } from "@/actions/db";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";
import { useAuditLog } from "@/hooks/use-audit-log";
import { DeleteConfirmationDialog } from "@/components/common/delete-confirmation-dialog";

const CategoryIcon = ({ category }: { category: string }) => {
    switch (category) {
        case 'Equipment': return <Wrench className="h-4 w-4" />;
        case 'Manpower': return <Users className="h-4 w-4" />;
        default: return <Package className="h-4 w-4" />;
    }
};

const ElementForm = ({
    element,
    ministries,
    onSave,
    onClose,
}: {
    element: Partial<VenueElement> | null;
    ministries: Ministry[];
    onSave: (data: Partial<VenueElement>) => void;
    onClose: () => void;
}) => {
    const [formData, setFormData] = useState<Partial<VenueElement>>({
        id: element?.id,
        name: element?.name || '',
        category: element?.category || 'Equipment',
        providerMinistryId: element?.providerMinistryId || '',
    });

    return (
        <div className="space-y-6">
            <DialogHeader className="space-y-2 pb-1 border-b border-border/40">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-sidebar/10 text-sidebar dark:text-sky-400 border border-sidebar/20 shrink-0">
                        <Layers className="h-5 w-5" />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-bold font-headline text-foreground">
                            {element ? 'Edit Venue Element' : 'Add Venue Element'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                            Configure requirements that can be requested for venues and rooms.
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            <div className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="element-name" className="text-xs font-bold text-foreground">Element Name</Label>
                    <Input
                        id="element-name"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., TV, LED Wall, Sound System, Operator"
                        className="h-10 rounded-xl border-slate-200/90 dark:border-border text-xs bg-white dark:bg-background shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="element-category" className="text-xs font-bold text-foreground">Category</Label>
                        <Select value={formData.category} onValueChange={(value: any) => setFormData({ ...formData, category: value })}>
                            <SelectTrigger id="element-category" className="h-10 rounded-xl border-slate-200/90 dark:border-border text-xs bg-white dark:bg-background shadow-2xs focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar cursor-pointer">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-border shadow-xl">
                                <SelectItem value="Equipment" className="text-xs font-medium cursor-pointer">
                                    <div className="flex items-center gap-2">
                                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" /> Equipment
                                    </div>
                                </SelectItem>
                                <SelectItem value="Manpower" className="text-xs font-medium cursor-pointer">
                                    <div className="flex items-center gap-2">
                                        <Users className="h-3.5 w-3.5 text-muted-foreground" /> Manpower
                                    </div>
                                </SelectItem>
                                <SelectItem value="Other" className="text-xs font-medium cursor-pointer">
                                    <div className="flex items-center gap-2">
                                        <Package className="h-3.5 w-3.5 text-muted-foreground" /> Other
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="element-ministry" className="text-xs font-bold text-foreground">Provider Ministry</Label>
                        <Select value={formData.providerMinistryId} onValueChange={value => setFormData({ ...formData, providerMinistryId: value })}>
                            <SelectTrigger id="element-ministry" className="h-10 rounded-xl border-slate-200/90 dark:border-border text-xs bg-white dark:bg-background shadow-2xs focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar cursor-pointer">
                                <SelectValue placeholder="Select providing ministry" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-border shadow-xl max-h-56">
                                {ministries.map(ministry => (
                                    <SelectItem key={ministry.id} value={ministry.id} className="text-xs font-medium cursor-pointer">{ministry.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <DialogFooter className="pt-2 border-t border-border/40 flex items-center justify-end gap-2.5">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="h-10 px-4 rounded-xl border-border/70 text-xs font-semibold hover:bg-muted/50 transition-colors cursor-pointer"
                >
                    Cancel
                </Button>
                <Button
                    onClick={() => onSave(formData)}
                    className="h-10 px-5 rounded-xl bg-sidebar hover:bg-sidebar/90 text-white text-xs font-bold shadow-xs transition-all active:scale-[0.99] cursor-pointer"
                >
                    Save Changes
                </Button>
            </DialogFooter>
        </div>
    );
};

export default function VenueElementsManagementPage() {
    const { canManageFacilities, isLoading: isRoleLoading, myMinistryIds, isSuperAdmin } = useUserRole();
    const { toast } = useToast();
    const { logAction } = useAuditLog();
    const queryClient = useQueryClient();

    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [selectedElement, setSelectedElement] = useState<VenueElement | null>(null);
    const [elementToDelete, setElementToDelete] = useState<VenueElement | null>(null);

    const { data: elements, isLoading: elementsLoading } = useQuery({
        queryKey: ["venue-elements"],
        queryFn: () => getVenueElements(),
    });

    const { data: ministriesData, isLoading: ministriesLoading } = useQuery({
        queryKey: ["ministries"],
        queryFn: () => getMinistries(),
    });
    const ministries = (ministriesData || []) as Ministry[];

    const saveMutation = useMutation({
        mutationFn: async (data: Partial<VenueElement>) => {
            if (data.id) {
                return updateVenueElement(data.id, data);
            } else {
                return createVenueElement(data);
            }
        },
        onSuccess: async (_, data) => {
            queryClient.invalidateQueries({ queryKey: ["venue-elements"] });
            const action = data.id ? 'Updated Venue Element' : 'Created Venue Element';
            await logAction(
                action,
                'Facilities',
                `${action} "${data.name}" (Category: ${data.category})`,
                data.id || undefined,
                data.name
            );
            toast({ title: data.id ? 'Element Updated' : 'Element Added' });
            setIsSheetOpen(false);
        },
        onError: () => {
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save venue element.' });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteVenueElement(id),
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ["venue-elements"] });
            if (elementToDelete) {
                await logAction(
                    'Deleted Venue Element',
                    'Facilities',
                    `Deleted venue element "${elementToDelete.name}"`,
                    elementToDelete.id,
                    elementToDelete.name
                );
            }
            toast({ title: 'Element Deleted' });
        },
        onError: () => {
            toast({ variant: 'destructive', title: 'Delete Failed', description: 'Could not delete venue element.' });
        },
    });

    const isLoading = elementsLoading || ministriesLoading || isRoleLoading;

    const filteredElements = React.useMemo(() => {
        if (!elements) return [];
        const base = isSuperAdmin ? elements : elements.filter((e: any) => myMinistryIds.includes(e.providerMinistryId));
        return [...base].reverse();
    }, [elements, isSuperAdmin, myMinistryIds]);

    const availableMinistries = React.useMemo(() => {
        if (isSuperAdmin) return ministries;
        return ministries.filter(m => myMinistryIds.includes(m.id));
    }, [ministries, isSuperAdmin, myMinistryIds]);

    const handleSave = (data: Partial<VenueElement>) => {
        if (!data.name || !data.providerMinistryId || !data.category) {
            toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill out all required fields.' });
            return;
        }
        saveMutation.mutate(data);
    };

    const handleDelete = (element: VenueElement) => {
        setElementToDelete(element);
    };

    const handleConfirmDelete = () => {
        if (elementToDelete) {
            deleteMutation.mutate(elementToDelete.id);
            setElementToDelete(null);
        }
    };

    if (isLoading) {
        return <AppLayout><div className="flex justify-center py-10"><LoaderCircle className="h-8 w-8 animate-spin" /></div></AppLayout>;
    }

    if (!canManageFacilities) {
        return <AppLayout><Card><CardHeader><CardTitle>Access Denied</CardTitle><CardDescription>You do not have permission to view this page.</CardDescription></CardHeader></Card></AppLayout>;
    }

    const getMinistryName = (id: string) => ministries?.find(m => m.id === id)?.name || 'Unknown';

    return (
        <AppLayout>
            <div className="space-y-1 mb-6">
                <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">
                    Venue Elements
                </h1>
                <p className="text-sm text-muted-foreground">
                    Manage deployable requirements and assignments for your venues.
                </p>
            </div>

            <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Elements Directory</CardTitle>
                        <CardDescription>Items arrayed across categories like equipment or manpower.</CardDescription>
                    </div>
                    <Button onClick={() => { setSelectedElement(null); setIsSheetOpen(true); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Element
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Element</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Provider</TableHead>
                                <TableHead className="w-[100px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredElements.map((element: any) => (
                                <TableRow key={element.id}>
                                    <TableCell className="font-medium">{element.name}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <CategoryIcon category={element.category} />
                                            {element.category}
                                        </div>
                                    </TableCell>
                                    <TableCell>{getMinistryName(element.providerMinistryId)}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button type="button" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-36 p-1 rounded-xl shadow-lg border-border/80">
                                                <DropdownMenuItem onSelect={() => { setSelectedElement(element); setIsSheetOpen(true); }} className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2">
                                                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => handleDelete(element)} className="text-destructive cursor-pointer gap-2 rounded-lg text-xs font-medium py-2 focus:text-destructive focus:bg-destructive/10">
                                                    <Trash2 className="h-3.5 w-3.5 text-destructive" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredElements.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                                        No elements found. Add your first venue element above.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <DialogContent className="sm:max-w-lg rounded-2xl p-6 sm:p-7 border-border/80 shadow-2xl">
                    {isSheetOpen && (
                        <ElementForm
                            element={selectedElement}
                            ministries={availableMinistries}
                            onSave={handleSave}
                            onClose={() => setIsSheetOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmationDialog
                isOpen={!!elementToDelete}
                onClose={() => setElementToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Venue Element"
                itemName={elementToDelete?.name}
                confirmLabel="Delete Element"
                isLoading={deleteMutation.isPending}
            />
        </AppLayout>
    );
}
