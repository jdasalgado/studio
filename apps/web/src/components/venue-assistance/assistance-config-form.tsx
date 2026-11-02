"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@studio/ui";
import {
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@studio/ui";
import { Label } from "@studio/ui";
import { Input } from "@studio/ui";
import { Checkbox } from "@studio/ui";
import { Textarea } from "@studio/ui";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@studio/ui";
import { PlusCircle, Trash2, Wrench, Package, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { upsertAssistanceConfig, type AssistanceConfigItemInput } from "@/actions/venue-assistance";

interface Room {
    id: string;
    name: string;
    area?: { name: string; branch?: { name: string } } | null;
}

interface Ministry {
    id: string;
    name: string;
}

interface ConfigItem {
    id?: string;
    name: string;
    description: string;
    quantity: number;
    isRequired: boolean;
}

interface AssistanceConfigFormProps {
    /** Existing config being edited, or null for create */
    existingConfig?: {
        id: string;
        roomId: string;
        ministryId: string;
        items: ConfigItem[];
    } | null;
    rooms: Room[];
    ministries: Ministry[];
    actorId: string;
    /** If set, lock the room selector to this value */
    lockedRoomId?: string;
    /** If set, lock the ministry selector to this value */
    lockedMinistryId?: string;
    onSuccess: () => void;
    onClose: () => void;
}

const emptyItem = (): ConfigItem => ({
    name: "",
    description: "",
    quantity: 1,
    isRequired: true,
});

export function AssistanceConfigForm({
    existingConfig,
    rooms,
    ministries,
    actorId,
    lockedRoomId,
    lockedMinistryId,
    onSuccess,
    onClose,
}: AssistanceConfigFormProps) {
    const { toast } = useToast();
    const [roomId, setRoomId] = useState(existingConfig?.roomId ?? lockedRoomId ?? "");
    const [ministryId, setMinistryId] = useState(existingConfig?.ministryId ?? lockedMinistryId ?? "");
    const [items, setItems] = useState<ConfigItem[]>(
        existingConfig?.items?.length
            ? existingConfig.items.map((i) => ({
                  id: i.id,
                  name: i.name,
                  description: i.description ?? "",
                  quantity: i.quantity,
                  isRequired: i.isRequired,
              }))
            : [emptyItem()]
    );
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (existingConfig) {
            setRoomId(existingConfig.roomId);
            setMinistryId(existingConfig.ministryId);
            setItems(
                existingConfig.items.length
                    ? existingConfig.items.map((i) => ({
                          id: i.id,
                          name: i.name,
                          description: i.description ?? "",
                          quantity: i.quantity,
                          isRequired: i.isRequired,
                      }))
                    : [emptyItem()]
            );
        }
    }, [existingConfig]);

    const addItem = () => setItems((prev) => [...prev, emptyItem()]);

    const removeItem = (index: number) =>
        setItems((prev) => prev.filter((_, i) => i !== index));

    const updateItem = (index: number, patch: Partial<ConfigItem>) =>
        setItems((prev) =>
            prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
        );

    const handleSubmit = async () => {
        if (!roomId) {
            toast({ variant: "destructive", title: "Room required", description: "Please select a room." });
            return;
        }
        if (!ministryId) {
            toast({ variant: "destructive", title: "Ministry required", description: "Please select a ministry." });
            return;
        }
        const validItems = items.filter((i) => i.name.trim());
        if (validItems.length === 0) {
            toast({ variant: "destructive", title: "Items required", description: "Add at least one assistance item." });
            return;
        }

        setIsSaving(true);
        try {
            const payload: AssistanceConfigItemInput[] = validItems.map((i) => ({
                name: i.name.trim(),
                description: i.description.trim() || undefined,
                quantity: i.quantity,
                isRequired: i.isRequired,
            }));
            await upsertAssistanceConfig(roomId, ministryId, payload, actorId);
            toast({ title: existingConfig ? "Configuration updated" : "Configuration created" });
            onSuccess();
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Save failed",
                description: err?.message ?? "Could not save configuration.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const isRoomLocked = !!lockedRoomId || !!existingConfig;
    const isMinistryLocked = !!lockedMinistryId || !!existingConfig;

    return (
        <div className="space-y-6">
            <DialogHeader className="space-y-2 pb-1 border-b border-border/40">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-sidebar/10 text-sidebar dark:text-sky-400 border border-sidebar/20 shrink-0">
                        <Wrench className="h-5 w-5" />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-bold font-headline text-foreground">
                            {existingConfig ? "Edit Assistance Configuration" : "New Assistance Configuration"}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                            Configure which items and support a ministry provides for a specific room.
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto px-0.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Room selector */}
                    <div className="space-y-1.5">
                        <Label htmlFor="config-room" className="text-xs font-bold text-foreground">Room</Label>
                        <Select
                            value={roomId}
                            onValueChange={setRoomId}
                            disabled={isRoomLocked}
                        >
                            <SelectTrigger id="config-room" className="h-10 rounded-xl border-slate-200/90 dark:border-border text-xs bg-white dark:bg-background shadow-2xs focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar cursor-pointer">
                                <SelectValue placeholder="Select a room" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-border shadow-xl max-h-56">
                                {rooms.map((r) => (
                                    <SelectItem key={r.id} value={r.id} className="text-xs font-medium cursor-pointer">
                                        {r.name}
                                        {r.area ? ` — ${r.area.name}` : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Ministry selector */}
                    <div className="space-y-1.5">
                        <Label htmlFor="config-ministry" className="text-xs font-bold text-foreground">Providing Ministry</Label>
                        <Select
                            value={ministryId}
                            onValueChange={setMinistryId}
                            disabled={isMinistryLocked}
                        >
                            <SelectTrigger id="config-ministry" className="h-10 rounded-xl border-slate-200/90 dark:border-border text-xs bg-white dark:bg-background shadow-2xs focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar cursor-pointer">
                                <SelectValue placeholder="Select a ministry" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-border shadow-xl max-h-56">
                                {ministries.map((m) => (
                                    <SelectItem key={m.id} value={m.id} className="text-xs font-medium cursor-pointer">
                                        {m.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Items list */}
                <div className="space-y-3 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-foreground">Assistance Items & Requirements</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addItem}
                            className="h-8 px-3 rounded-xl border-border/70 text-xs font-semibold hover:bg-muted/50 transition-colors cursor-pointer gap-1.5"
                        >
                            <PlusCircle className="h-3.5 w-3.5" /> Add Item
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {items.map((item, index) => (
                            <div
                                key={index}
                                className="rounded-2xl border border-border/70 p-4 space-y-3 bg-slate-50/60 dark:bg-muted/20"
                            >
                                <div className="flex items-center justify-between pb-1 border-b border-border/30">
                                    <span className="text-xs font-bold text-sidebar dark:text-sky-400">
                                        Item #{index + 1}
                                    </span>
                                    {items.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                                            onClick={() => removeItem(index)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="sm:col-span-2 space-y-1">
                                        <Label htmlFor={`item-name-${index}`} className="text-xs font-semibold text-muted-foreground">
                                            Item Name <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id={`item-name-${index}`}
                                            maxLength={100}
                                            value={item.name}
                                            onChange={(e) => updateItem(index, { name: e.target.value })}
                                            placeholder="e.g., Projector, Tech Support"
                                            className="h-9 rounded-xl border-slate-200/90 dark:border-border text-xs bg-white dark:bg-background shadow-2xs"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <Label htmlFor={`item-qty-${index}`} className="text-xs font-semibold text-muted-foreground">
                                            Quantity
                                        </Label>
                                        <Input
                                            id={`item-qty-${index}`}
                                            type="number"
                                            min={1}
                                            max={10000}
                                            value={item.quantity}
                                            onChange={(e) =>
                                                updateItem(index, {
                                                    quantity: Math.min(10000, Math.max(1, parseInt(e.target.value, 10) || 1)),
                                                })
                                            }
                                            className="h-9 rounded-xl border-slate-200/90 dark:border-border text-xs bg-white dark:bg-background shadow-2xs font-semibold"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor={`item-desc-${index}`} className="text-xs font-semibold text-muted-foreground">
                                        Description (optional)
                                    </Label>
                                    <Textarea
                                        id={`item-desc-${index}`}
                                        maxLength={500}
                                        value={item.description}
                                        onChange={(e) => updateItem(index, { description: e.target.value })}
                                        placeholder="Specific instructions, specs or models required..."
                                        className="h-16 rounded-xl border-slate-200/90 dark:border-border text-xs bg-white dark:bg-background shadow-2xs resize-none"
                                    />
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                    <Checkbox
                                        id={`item-required-${index}`}
                                        checked={item.isRequired}
                                        onCheckedChange={(checked) =>
                                            updateItem(index, { isRequired: !!checked })
                                        }
                                        className="rounded-[4px]"
                                    />
                                    <Label htmlFor={`item-required-${index}`} className="text-xs font-medium cursor-pointer">
                                        Mandatory / Required for all bookings in this room
                                    </Label>
                                </div>
                            </div>
                        ))}
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
                    onClick={handleSubmit}
                    disabled={isSaving}
                    className="h-10 px-5 rounded-xl bg-sidebar hover:bg-sidebar/90 text-white text-xs font-bold shadow-xs transition-all active:scale-[0.99] cursor-pointer"
                >
                    {isSaving ? "Saving…" : existingConfig ? "Save Changes" : "Create Configuration"}
                </Button>
            </DialogFooter>
        </div>
    );
}
