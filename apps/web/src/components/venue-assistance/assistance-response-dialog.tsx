"use client";

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@studio/ui";
import { Button } from "@studio/ui";
import { Badge } from "@studio/ui";
import { Label } from "@studio/ui";
import { Input } from "@studio/ui";
import { Textarea } from "@studio/ui";
import { Switch } from "@studio/ui";
import { Separator } from "@studio/ui";
import { CheckCircle2, XCircle, LoaderCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
    respondToAssistanceRequest,
    bulkRespondToRecurringRequests,
    type ItemStatusUpdate,
} from "@/actions/venue-assistance";
import { assistanceRequestKeys } from "@/hooks/use-assistance-requests";
import { venueBookingKeys } from "@/hooks/use-venue-bookings";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssistanceRequestItem {
    id: string;
    name: string;
    description?: string | null;
    quantity: number;
    isRequired: boolean;
    status: string;
    adjustedQty?: number | null;
    adjustedDesc?: string | null;
}

export interface AssistanceRequest {
    id: string;
    ministryId: string;
    status: string;
    explanation?: string | null;
    items: AssistanceRequestItem[];
    booking?: {
        id: string;
        recurringBookingId?: string | null;
    };
}

interface ItemState {
    itemId: string;
    name: string;
    status: "Approved" | "Declined";
    adjustedQty: string;
    adjustedDesc: string;
    originalQty: number;
    originalDesc: string;
}

interface AssistanceResponseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    request: AssistanceRequest | null;
    responderId: string;
    bookingId: string;
    /** If set, shows the bulk-apply toggle for recurring bookings */
    recurringBookingId?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function derivePreviewStatus(items: ItemState[]): "Approved" | "Partial" | "Declined" {
    const allApproved = items.every((i) => i.status === "Approved");
    const allDeclined = items.every((i) => i.status === "Declined");
    if (allApproved) return "Approved";
    if (allDeclined) return "Declined";
    return "Partial";
}

function previewStatusVariant(
    status: "Approved" | "Partial" | "Declined",
): "default" | "secondary" | "destructive" {
    if (status === "Approved") return "default";
    if (status === "Declined") return "destructive";
    return "secondary";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssistanceResponseDialog({
    open,
    onOpenChange,
    request,
    responderId,
    bookingId,
    recurringBookingId,
}: AssistanceResponseDialogProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [explanation, setExplanation] = useState("");
    const [bulkApply, setBulkApply] = useState(false);
    const [itemStates, setItemStates] = useState<ItemState[]>([]);

    // Initialise item states when request changes
    useEffect(() => {
        if (!request) return;
        setItemStates(
            request.items.map((item) => ({
                itemId: item.id,
                name: item.name,
                status: "Approved",
                adjustedQty: "",
                adjustedDesc: "",
                originalQty: item.quantity,
                originalDesc: item.description ?? "",
            })),
        );
        setExplanation("");
        setBulkApply(false);
    }, [request]);

    if (!request) return null;

    const previewStatus = derivePreviewStatus(itemStates);
    const hasItems = itemStates.length > 0;

    function toggleItemStatus(itemId: string) {
        setItemStates((prev) =>
            prev.map((i) =>
                i.itemId === itemId
                    ? { ...i, status: i.status === "Approved" ? "Declined" : "Approved" }
                    : i,
            ),
        );
    }

    function updateAdjustedQty(itemId: string, value: string) {
        setItemStates((prev) =>
            prev.map((i) => (i.itemId === itemId ? { ...i, adjustedQty: value } : i)),
        );
    }

    function updateAdjustedDesc(itemId: string, value: string) {
        setItemStates((prev) =>
            prev.map((i) => (i.itemId === itemId ? { ...i, adjustedDesc: value } : i)),
        );
    }

    async function handleSubmit() {
        if (!hasItems || !request) return;
        setIsSubmitting(true);

        const updates: ItemStatusUpdate[] = itemStates.map((i) => ({
            itemId: i.itemId,
            status: i.status,
            adjustedQty: i.adjustedQty ? parseInt(i.adjustedQty, 10) : undefined,
            adjustedDesc: i.adjustedDesc || undefined,
        }));

        try {
            if (bulkApply && recurringBookingId) {
                await bulkRespondToRecurringRequests(
                    recurringBookingId,
                    request.ministryId,
                    updates,
                    explanation || undefined,
                    responderId,
                );
                toast({
                    title: "Bulk response submitted",
                    description: "Your response has been applied to all pending occurrences.",
                });
            } else {
                await respondToAssistanceRequest(
                    request.id,
                    updates,
                    explanation || undefined,
                    responderId,
                );
                toast({
                    title: "Response submitted",
                    description: "Your response has been recorded.",
                });
            }

            // Invalidate relevant queries
            queryClient.invalidateQueries({
                queryKey: assistanceRequestKeys.forBooking(bookingId),
            });
            queryClient.invalidateQueries({
                queryKey: venueBookingKeys.detail(bookingId),
            });

            onOpenChange(false);
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Submission failed",
                description: err?.message ?? "Could not submit response.",
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Respond to Assistance Request</DialogTitle>
                    <DialogDescription>
                        Review each item and set your response. You can adjust quantities or
                        descriptions before submitting.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Item list */}
                    {itemStates.map((item, idx) => (
                        <div key={item.itemId}>
                            {idx > 0 && <Separator className="mb-4" />}
                            <div className="space-y-3">
                                {/* Item header: name + approve/decline toggle */}
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-medium text-sm truncate">{item.name}</p>
                                        {item.originalDesc && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {item.originalDesc}
                                            </p>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                            Qty: {item.originalQty}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => toggleItemStatus(item.itemId)}
                                        className="flex items-center gap-1.5 shrink-0 rounded-md px-2 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        aria-label={`Toggle ${item.name} status`}
                                    >
                                        {item.status === "Approved" ? (
                                            <>
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                <span className="text-green-600 dark:text-green-400">
                                                    Approved
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <XCircle className="h-4 w-4 text-destructive" />
                                                <span className="text-destructive">Declined</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Adjustment fields (only when approved) */}
                                {item.status === "Approved" && (
                                    <div className="grid grid-cols-2 gap-3 pl-1">
                                        <div className="space-y-1">
                                            <Label
                                                htmlFor={`qty-${item.itemId}`}
                                                className="text-xs text-muted-foreground"
                                            >
                                                Adjusted qty
                                            </Label>
                                            <Input
                                                id={`qty-${item.itemId}`}
                                                type="number"
                                                min={1}
                                                max={10000}
                                                placeholder={String(item.originalQty)}
                                                value={item.adjustedQty}
                                                onChange={(e) =>
                                                    updateAdjustedQty(item.itemId, e.target.value)
                                                }
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label
                                                htmlFor={`desc-${item.itemId}`}
                                                className="text-xs text-muted-foreground"
                                            >
                                                Adjusted description
                                            </Label>
                                            <Input
                                                id={`desc-${item.itemId}`}
                                                maxLength={250}
                                                placeholder={item.originalDesc || "Optional"}
                                                value={item.adjustedDesc}
                                                onChange={(e) =>
                                                    updateAdjustedDesc(item.itemId, e.target.value)
                                                }
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {!hasItems && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No items to respond to.
                        </p>
                    )}

                    <Separator />

                    {/* Explanation textarea */}
                    <div className="space-y-1.5">
                        <Label htmlFor="explanation" className="text-sm">
                            Explanation{" "}
                            <span className="text-muted-foreground font-normal">(optional)</span>
                        </Label>
                        <Textarea
                            id="explanation"
                            maxLength={500}
                            placeholder="Add a note for the booking requester…"
                            value={explanation}
                            onChange={(e) => setExplanation(e.target.value)}
                            rows={3}
                            className="resize-none text-sm"
                        />
                    </div>

                    {/* Bulk apply toggle (only for recurring bookings) */}
                    {recurringBookingId && (
                        <div className="flex items-center justify-between rounded-lg border p-3 gap-3">
                            <div className="space-y-0.5">
                                <Label htmlFor="bulk-apply" className="text-sm font-medium">
                                    Apply to all occurrences
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Submit this response for every pending occurrence of this
                                    recurring booking.
                                </p>
                            </div>
                            <Switch
                                id="bulk-apply"
                                checked={bulkApply}
                                onCheckedChange={setBulkApply}
                            />
                        </div>
                    )}

                    {/* Preview status */}
                    {hasItems && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Response will be:</span>
                            <Badge variant={previewStatusVariant(previewStatus)}>
                                {previewStatus}
                            </Badge>
                            {bulkApply && recurringBookingId && (
                                <span className="text-xs">(all occurrences)</span>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !hasItems}>
                        {isSubmitting ? (
                            <>
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                Submitting…
                            </>
                        ) : (
                            "Submit Response"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
