"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@studio/ui";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { updateBooking } from "@/actions/db";
import { useToast } from "@/hooks/use-toast";
import { toJsDate } from "@/lib/utils";
import { isValidEmail, isValidName, cleanName, MAX_LENGTHS } from "@/lib/validation";
import type { Booking, Ministry, Worker } from "@studio/types";
import { LoaderCircle } from "lucide-react";

interface EditReservationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | any | null;
  ministries: Ministry[];
  workers: Worker[];
}

export function EditReservationDialog({
  isOpen,
  onClose,
  booking,
  ministries,
  workers,
}: EditReservationDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [requesterName, setRequesterName] = useState("");
  const [ministryId, setMinistryId] = useState("");
  const [email, setEmail] = useState("");
  const [purpose, setPurpose] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (booking) {
      const worker = workers?.find((w) => w.id === booking.workerProfileId);
      const name = worker
        ? `${worker.firstName} ${worker.lastName}`
        : booking.name || "";

      setRequesterName(name);
      setMinistryId(booking.ministryId || "");
      setEmail(worker?.email || booking.email || "");
      setPurpose(booking.purpose || "");
    }
  }, [booking, workers]);

  if (!booking) return null;

  const dateRequested = booking.dateRequested
    ? toJsDate(booking.dateRequested)
    : toJsDate(booking.start);

  const formattedDateRequested = format(dateRequested, "MMM d, yyyy");
  const requestId = booking.requestId || `REQ-${booking.id?.slice(0, 4) || "1000"}`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!requesterName.trim() || !purpose.trim()) {
      toast({
        variant: "destructive",
        title: "Required Fields Missing",
        description: "Please enter both requester name and purpose.",
      });
      return;
    }

    if (requesterName.trim().length > MAX_LENGTHS.NAME) {
      toast({
        variant: "destructive",
        title: "Name Too Long",
        description: `Requester name must not exceed ${MAX_LENGTHS.NAME} characters.`,
      });
      return;
    }

    if (!isValidName(requesterName.trim(), 2, MAX_LENGTHS.NAME)) {
      toast({
        variant: "destructive",
        title: "Invalid Requester Name",
        description: `Please enter a valid name (letters only, up to ${MAX_LENGTHS.NAME} characters).`,
      });
      return;
    }

    if (purpose.trim().length > MAX_LENGTHS.PURPOSE) {
      toast({
        variant: "destructive",
        title: "Purpose Too Long",
        description: `Purpose must not exceed ${MAX_LENGTHS.PURPOSE} characters.`,
      });
      return;
    }

    if (email.trim() && !isValidEmail(email.trim(), MAX_LENGTHS.EMAIL)) {
      toast({
        variant: "destructive",
        title: "Invalid Email Address",
        description: `Please enter a valid email format (up to ${MAX_LENGTHS.EMAIL} characters).`,
      });
      return;
    }

    setIsSaving(true);

    try {
      await updateBooking(booking.id, {
        name: requesterName,
        ministryId,
        email,
        purpose,
      });

      await queryClient.invalidateQueries({ queryKey: ["bookings"] });

      toast({
        title: "Reservation Updated",
        description: "The reservation details have been updated successfully.",
      });

      onClose();
    } catch (error: any) {
      console.error("Failed to update booking:", error);
      toast({
        title: "Update Failed",
        description: error?.message || "Failed to update reservation.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-lg max-h-[92dvh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl md:rounded-3xl border-border/80 shadow-2xl gap-0 bg-background [&>button:last-child]:hidden">
        {/* ── STICKY MODAL HEADER ── */}
        <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 border-b border-border/70 bg-card shrink-0 text-left space-y-0 w-full min-w-0">
          <div className="flex items-start justify-between gap-2.5 w-full min-w-0">
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold font-headline text-foreground">
                Edit Reservation
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Update the reservation details below.
              </DialogDescription>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer shrink-0 -mt-1 -mr-1"
              title="Close modal"
            >
              <span className="sr-only">Close</span>
              ✕
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden w-full">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 w-full min-w-0">
            {/* Row 1: Request ID & Date Requested */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Request ID
                </label>
                <Input
                  value={requestId}
                  disabled
                  className="bg-slate-50/90 dark:bg-muted/30 border border-slate-200/80 dark:border-border text-slate-600 dark:text-slate-300 rounded-xl h-10 text-xs font-medium cursor-not-allowed shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Date Requested
                </label>
                <Input
                  value={formattedDateRequested}
                  disabled
                  className="bg-slate-50/90 dark:bg-muted/30 border border-slate-200/80 dark:border-border text-slate-600 dark:text-slate-300 rounded-xl h-10 text-xs font-medium cursor-not-allowed shadow-2xs"
                />
              </div>
            </div>

            {/* Row 2: Requester Name & Ministry */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Requester Name
                </label>
                <Input
                  maxLength={MAX_LENGTHS.NAME}
                  value={requesterName}
                  onChange={(e) => setRequesterName(cleanName(e.target.value, MAX_LENGTHS.NAME))}
                  placeholder="Requester Name"
                  className="bg-background dark:bg-muted/30 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 border border-slate-200/90 dark:border-border rounded-xl h-10 text-xs font-normal shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Ministry
                </label>
                <Select value={ministryId} onValueChange={setMinistryId}>
                  <SelectTrigger className="bg-background dark:bg-muted/30 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-border rounded-xl h-10 text-xs font-normal shadow-2xs focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all">
                    <SelectValue placeholder="Select Ministry" />
                  </SelectTrigger>
                  <SelectContent>
                    {ministries.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3: Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="bg-background dark:bg-muted/30 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 border border-slate-200/90 dark:border-border rounded-xl h-10 text-xs font-normal shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar transition-all"
              />
            </div>

            {/* Row 4: Purpose of Reservation */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Purpose of Reservation
              </label>
              <Textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Describe the event or meeting...."
                className="bg-background dark:bg-muted/30 border border-slate-200/90 dark:border-border rounded-xl min-h-[100px] p-3 text-xs leading-relaxed font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar transition-all"
              />
            </div>
          </div>

          {/* ── STICKY MODAL FOOTER ── */}
          <DialogFooter className="p-3.5 sm:p-4 border-t border-border/70 bg-card/95 backdrop-blur-md shrink-0 flex flex-row items-center justify-end gap-2 sm:gap-2.5 w-full min-w-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="min-h-[2.25rem] sm:min-h-[2.5rem] h-9 sm:h-10 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold rounded-xl border-border/80 hover:bg-muted/50 cursor-pointer flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="min-h-[2.25rem] sm:min-h-[2.5rem] h-9 sm:h-10 px-4 sm:px-5 text-xs sm:text-sm font-bold rounded-xl bg-sidebar hover:bg-sidebar/90 text-white shadow-xs cursor-pointer flex-1 sm:flex-initial gap-1.5"
            >
              {isSaving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
