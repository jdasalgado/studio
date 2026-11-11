"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Button,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  Checkbox,
  DatePicker,
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
  Calendar as CalendarIcon,
  CheckCircle2,
  LoaderCircle,
  XCircle,
  Info,
  MapPin,
  Clock,
  ArrowRight,
  RotateCcw,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/use-user-role";
import { useAuthStore } from "@studio/store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getRooms,
  getAreas,
  getMinistries,
  getVenueElements,
  getBookingsForRoomOnDate,
  createBooking,
  createApproval,
  submitRoomReservation,
} from "@/actions/db";
import { useToast } from "@/hooks/use-toast";
import { isValidEmail, isValidName, cleanName, MAX_LENGTHS } from "@/lib/validation";
import { showSubmitSuccess, showSubmitError } from "@/hooks/use-submission-modal";
import type { Room, Area, Ministry, VenueElement } from "@studio/types";

const EMPTY_BOOKINGS: any[] = [];

export default function NewReservationPage() {
  const { user } = useAuthStore();
  const { workerProfile, isSuperAdmin, isMinistryHead, myMinistryIds, isLoading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Prefetch destinations immediately on page mount so tab/button click is 0ms
  useEffect(() => {
    router.prefetch("/reservations/my");
    router.prefetch("/reservations/masterview/daily");
  }, [router]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState("Pending Ministry Approval");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedRequestId, setGeneratedRequestId] = useState("");

  // Form states
  const [requesterName, setRequesterName] = useState("");
  const [ministryId, setMinistryId] = useState("");
  const [email, setEmail] = useState("");
  const [purpose, setPurpose] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [roomId, setRoomId] = useState("");
  const [pax, setPax] = useState("");
  const [numTables, setNumTables] = useState("");
  const [numChairs, setNumChairs] = useState("");
  const [requestedElements, setRequestedElements] = useState<string[]>([]);
  const [guidelinesAccepted, setGuidelinesAccepted] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  // Initialize Request ID and User defaults
  useEffect(() => {
    setGeneratedRequestId(
      `REQ-${Math.floor(1000 + Math.random() * 9000)}`
    );
  }, []);

  // Data fetching
  const { data: rooms } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => getRooms(),
  });

  const { data: areas } = useQuery({
    queryKey: ["areas"],
    queryFn: () => getAreas(),
  });

  const { data: ministries } = useQuery({
    queryKey: ["ministries"],
    queryFn: () => getMinistries(),
  });

  const isAdminUser = useMemo(() => {
    return Boolean(
      isSuperAdmin ||
      (workerProfile as any)?.role === "Administrator" ||
      (workerProfile as any)?.role === "Super Admin" ||
      (workerProfile as any)?.role?.name?.toLowerCase().includes("admin") ||
      (workerProfile as any)?.role?.isSuperAdmin ||
      user?.email?.toLowerCase().includes("admin") ||
      user?.email === "jdeyb300@gmail.com" ||
      workerProfile?.email === "jdeyb300@gmail.com"
    );
  }, [isSuperAdmin, workerProfile, user]);

  const generalMinistry = useMemo(() => {
    if (!ministries || ministries.length === 0) return null;
    return (
      ministries.find(
        (m: any) =>
          m.id === "A-GENERAL" ||
          m.name?.toLowerCase() === "general"
      ) || null
    );
  }, [ministries]);

  useEffect(() => {
    if (workerProfile) {
      setRequesterName(
        `${workerProfile.firstName} ${workerProfile.lastName}`
      );
      setEmail(workerProfile.email || user?.email || "");
      if (isAdminUser) {
        setMinistryId(generalMinistry?.id || "A-GENERAL");
      } else if (workerProfile.majorMinistryId) {
        setMinistryId(workerProfile.majorMinistryId);
      } else if (myMinistryIds && myMinistryIds.length > 0) {
        setMinistryId(myMinistryIds[0]);
      }
    } else if (user) {
      setRequesterName(user.email?.split("@")[0] || "System Admin");
      setEmail(user.email || "admin@gmail.com");
      if (isAdminUser) {
        setMinistryId(generalMinistry?.id || "A-GENERAL");
      }
    }
  }, [workerProfile, user, myMinistryIds, isAdminUser, generalMinistry]);

  const userMinistry = useMemo(() => {
    if (isAdminUser) {
      return generalMinistry || { id: "A-GENERAL", name: "General" };
    }
    if (!ministries || ministries.length === 0) return null;
    const targetId =
      ministryId ||
      workerProfile?.majorMinistryId ||
      (myMinistryIds && myMinistryIds.length > 0 ? myMinistryIds[0] : null);
    if (targetId) {
      return ministries.find((m: any) => m.id === targetId) || generalMinistry || ministries[0];
    }
    return generalMinistry || ministries[0] || null;
  }, [ministries, ministryId, workerProfile, myMinistryIds, isAdminUser, generalMinistry]);

  useEffect(() => {
    if (isAdminUser) {
      const gId = generalMinistry?.id || "A-GENERAL";
      if (ministryId !== gId) {
        setMinistryId(gId);
      }
      return;
    }
    if (!ministryId && ministries && ministries.length > 0) {
      const targetId =
        workerProfile?.majorMinistryId ||
        (myMinistryIds && myMinistryIds.length > 0 ? myMinistryIds[0] : null) ||
        generalMinistry?.id ||
        ministries[0].id;
      if (targetId) {
        setMinistryId(targetId);
      }
    }
  }, [ministryId, ministries, workerProfile, myMinistryIds, isAdminUser, generalMinistry]);

  const { data: venueElements } = useQuery({
    queryKey: ["venue-elements"],
    queryFn: () => getVenueElements(),
  });

  const selectedRoom = useMemo(() => {
    return rooms?.find((r) => r.id === roomId);
  }, [rooms, roomId]);

  // Auto-adjust chairs and pax if they exceed the selected room's capacity
  useEffect(() => {
    if (selectedRoom?.capacity) {
      if (numChairs && parseInt(numChairs) > selectedRoom.capacity) {
        setNumChairs(selectedRoom.capacity.toString());
      }
      if (pax && parseInt(pax) > selectedRoom.capacity) {
        setPax(selectedRoom.capacity.toString());
      }
    }
  }, [selectedRoom?.capacity]);

  // Fetch existing bookings for selected room on selected date
  const { data: existingBookings = EMPTY_BOOKINGS, isLoading: isCheckingBookings } = useQuery({
    queryKey: ["room-bookings", roomId, selectedDate],
    queryFn: async () => {
      if (!roomId || !selectedDate) return [];
      return getBookingsForRoomOnDate(roomId, selectedDate);
    },
    enabled: !!roomId && !!selectedDate && !isSubmitted,
  });

  const getMinutesInManila = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    const manilaStr = d.toLocaleTimeString("en-US", {
      timeZone: "Asia/Manila",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    const [h, m] = manilaStr.split(":").map(Number);
    return h * 60 + m;
  };

  // Calculate booked minute ranges (excluding Rejected and Cancelled)
  const bookedRanges = useMemo(() => {
    if (!existingBookings || existingBookings.length === 0) return [];
    return (existingBookings as any[])
      .filter((res) => res.status !== "Rejected" && res.status !== "Cancelled")
      .map((res) => {
        const startMin = getMinutesInManila(res.start);
        const endMin = getMinutesInManila(res.end);
        return {
          startMin,
          endMin,
          name: res.name || "Reserved",
          status: res.status || "Reserved",
          title: res.title || res.purpose || "Reservation",
        };
      });
  }, [existingBookings]);

  const timeToMinutes = (timeVal: string) => {
    if (!timeVal) return 0;
    const [h, m] = timeVal.split(":").map(Number);
    return h * 60 + m;
  };

  const formatTime12 = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
  };

  // Reset startTime/endTime if the newly selected room/date makes them unavailable
  useEffect(() => {
    if (isSubmitted || isSubmitting) return;
    if (startTime && bookedRanges.length > 0) {
      const startMin = timeToMinutes(startTime);
      const isStartBooked = bookedRanges.some(
        (r) => startMin >= r.startMin && startMin < r.endMin
      );
      if (isStartBooked) {
        setStartTime("");
        setEndTime("");
        toast({
          variant: "destructive",
          title: "Time Slot Reset",
          description: "The selected time slot is already reserved for this room. Please pick an available time.",
        });
      }
    }
  }, [roomId, selectedDate, bookedRanges, startTime, isSubmitted, isSubmitting, toast]);

  useEffect(() => {
    if (isSubmitted || isSubmitting) return;
    if (startTime && endTime) {
      const startMin = timeToMinutes(startTime);
      const endMin = timeToMinutes(endTime);
      const isConflict =
        endMin <= startMin ||
        bookedRanges.some((r) => startMin < r.endMin && endMin > r.startMin);
      if (isConflict) {
        setEndTime("");
      }
    }
  }, [startTime, endTime, bookedRanges, isSubmitted, isSubmitting]);

  // Time slots from 8:00 AM to 8:00 PM (in 30-min intervals)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 8; h <= 20; h++) {
      for (let m = 0; m < 60; m += 30) {
        if (h === 20 && m > 0) continue;
        const hour24 = h.toString().padStart(2, "0");
        const minute = m.toString().padStart(2, "0");
        const val = `${hour24}:${minute}`;

        const period = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 === 0 ? 12 : h % 12;
        const disp = `${h12}:${minute} ${period}`;
        slots.push({ value: val, display: disp });
      }
    }
    return slots;
  }, []);

  // Check if selected date is in the past (before today)
  const isDateInPast = useMemo(() => {
    if (!selectedDate) return false;
    const [y, m, d] = selectedDate.split("-").map(Number);
    const resDate = new Date(y, m - 1, d);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return resDate < todayStart;
  }, [selectedDate]);

  // Helper to check if a specific time slot on the selected date is in the past
  const isSlotInPast = (timeVal: string) => {
    if (!selectedDate) return false;
    const [y, m, d] = selectedDate.split("-").map(Number);
    const resDate = new Date(y, m - 1, d);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (resDate < todayStart) return true;
    if (resDate.getTime() === todayStart.getTime()) {
      const [h, min] = timeVal.split(":").map(Number);
      const slotTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min, 0, 0);
      return slotTime <= now;
    }
    return false;
  };

  // Check if current start time is already in the past
  const isTimeInPast = useMemo(() => {
    if (!startTime) return false;
    return isSlotInPast(startTime);
  }, [selectedDate, startTime]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!requesterName.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Requester Name",
        description: "Please enter the requester name.",
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
        description: `Please enter a valid requester name (letters only, up to ${MAX_LENGTHS.NAME} characters).`,
      });
      return;
    }

    const effectiveMinistryId =
      (isAdminUser ? (generalMinistry?.id || "A-GENERAL") : "") ||
      ministryId ||
      userMinistry?.id ||
      workerProfile?.majorMinistryId ||
      (myMinistryIds && myMinistryIds[0]) ||
      (generalMinistry?.id || "A-GENERAL");

    if (!effectiveMinistryId) {
      toast({
        variant: "destructive",
        title: "Missing Ministry",
        description: "Your worker profile does not have an assigned ministry.",
      });
      return;
    }

    if (!email.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Email",
        description: "Please provide an email address.",
      });
      return;
    }

    if (!isValidEmail(email.trim(), MAX_LENGTHS.EMAIL)) {
      toast({
        variant: "destructive",
        title: "Invalid Email Address",
        description: `Please provide a valid email address (up to ${MAX_LENGTHS.EMAIL} characters).`,
      });
      return;
    }

    if (!purpose.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Purpose",
        description: "Please provide the purpose of your reservation.",
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

    if (!selectedDate) {
      toast({
        variant: "destructive",
        title: "Missing Date",
        description: "Please select a date for the reservation.",
      });
      return;
    }

    if (isDateInPast) {
      toast({
        variant: "destructive",
        title: "Past Date Not Allowed",
        description: "Room reservations cannot be made for past dates. Please pick today or a future date.",
      });
      return;
    }

    if (!startTime || !endTime) {
      toast({
        variant: "destructive",
        title: "Missing Time",
        description: "Please specify both start and end times.",
      });
      return;
    }

    if (isTimeInPast) {
      toast({
        variant: "destructive",
        title: "Past Time Not Allowed",
        description: "The selected reservation start time has already passed. Please select an upcoming time slot.",
      });
      return;
    }

    if (!roomId) {
      toast({
        variant: "destructive",
        title: "Missing Room",
        description: "Please select a floor and room.",
      });
      return;
    }

    if (selectedRoom?.status === "Maintenance") {
      toast({
        variant: "destructive",
        title: "Room Under Maintenance",
        description: `Room "${selectedRoom.name}" is currently under maintenance and cannot be reserved. Please select another room.`,
      });
      return;
    }

    const paxNum = parseInt(pax);
    if (!pax || isNaN(paxNum) || paxNum <= 0) {
      toast({
        variant: "destructive",
        title: "Missing Pax",
        description: "Please enter the number of attendees (Pax).",
      });
      return;
    }

    if (selectedRoom && paxNum > selectedRoom.capacity) {
      toast({
        variant: "destructive",
        title: "Capacity Exceeded",
        description: `This room holds a maximum of ${selectedRoom.capacity} people. Please pick a larger room.`,
      });
      return;
    }

    const tablesNum = parseInt(numTables);
    if (numTables === "" || isNaN(tablesNum) || tablesNum < 0) {
      toast({
        variant: "destructive",
        title: "Missing Tables Count",
        description: "Please specify the number of tables (enter 0 if none).",
      });
      return;
    }
    if (tablesNum > 5) {
      toast({
        variant: "destructive",
        title: "Tables Limit Exceeded",
        description: "Maximum of 5 tables allowed per reservation.",
      });
      return;
    }

    const chairsNum = parseInt(numChairs);
    if (numChairs === "" || isNaN(chairsNum) || chairsNum < 0) {
      toast({
        variant: "destructive",
        title: "Missing Chairs Count",
        description: "Please specify the number of chairs (enter 0 if none).",
      });
      return;
    }
    if (chairsNum > 60) {
      toast({
        variant: "destructive",
        title: "Chairs Limit Exceeded",
        description: "Maximum of 60 chairs allowed per reservation.",
      });
      return;
    }

    if (!guidelinesAccepted) {
      toast({
        variant: "destructive",
        title: "Guidelines Required",
        description:
          "Please accept the ORS Guidelines before submitting your request.",
      });
      return;
    }

    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);

    const [y, m, d] = selectedDate.split("-").map(Number);
    const start = new Date(y, m - 1, d, startH, startM, 0, 0);
    const end = new Date(y, m - 1, d, endH, endM, 0, 0);

    if (start <= new Date()) {
      toast({
        variant: "destructive",
        title: "Invalid Start Time",
        description: "The reservation start time has already passed. Please select a future time slot.",
      });
      return;
    }

    if (start >= end) {
      toast({
        variant: "destructive",
        title: "Invalid Time",
        description: "End time must be after start time.",
      });
      return;
    }

    setIsConfirmDialogOpen(true);
  };

  const handleConfirmSubmit = async () => {
    setIsConfirmDialogOpen(false);
    setIsSubmitting(true);

    try {
      const [startH, startM] = startTime.split(":").map(Number);
      const [endH, endM] = endTime.split(":").map(Number);

      const [y, m, d] = selectedDate.split("-").map(Number);
      const parsedDate = new Date(y, m - 1, d);
      const start = new Date(y, m - 1, d, startH, startM, 0, 0);
      const end = new Date(y, m - 1, d, endH, endM, 0, 0);

      const effectiveMinistryId =
        (isAdminUser ? (generalMinistry?.id || "A-GENERAL") : "") ||
        ministryId ||
        userMinistry?.id ||
        workerProfile?.majorMinistryId ||
        (myMinistryIds && myMinistryIds[0]) ||
        (generalMinistry?.id || "A-GENERAL");

      const effectiveWorkerId =
        workerProfile?.id || "worker-system-admin";

      // If user is Admin or Ministry Head, skip Ministry approval and go directly to Admin approval
      const isPrivileged = Boolean(isAdminUser || isMinistryHead);
      const initialStatus = isPrivileged
        ? "Pending Admin Approval"
        : "Pending Ministry Approval";

      const bookingData = {
        requestId: generatedRequestId,
        roomId,
        title: purpose,
        purpose,
        start,
        end,
        status: initialStatus,
        workerProfileId: effectiveWorkerId,
        name: requesterName || "System Admin",
        ministryId: effectiveMinistryId,
        email: email || "admin@gmail.com",
        pax: parseInt(pax) || 0,
        numTables: parseInt(numTables) || 0,
        numChairs: parseInt(numChairs) || 0,
        requestedElements: [
          ...requestedElements,
        ],
        equipment_TV: false,
        equipment_Mic: false,
        equipment_Speakers: false,
        guidelinesAccepted: true,
      };

      const approvalData = {
        requester: requesterName || "System Admin",
        type: "Room Booking",
        details: purpose || selectedRoom?.name || "Room Booking",
        status: initialStatus,
        roomId,
        workerId: effectiveWorkerId,
        requestId: generatedRequestId,
      };

      // Single atomic fast execution with background non-blocking notification (~100ms)
      const res = await submitRoomReservation({
        bookingData,
        approvalData,
      });

      if (res && (!res.success || (res as any).error)) {
        const errorDesc =
          (res as any).error ||
          "This room is already reserved for the selected time slot.";
        showSubmitError({
          title: "Reservation Request Failed",
          description: errorDesc,
        });
        return;
      }

      if (res?.booking?.id) {
        // Instant in-memory cache update so navigating to "My Reservations" or "Approvals" is 0ms
        queryClient.setQueriesData({ queryKey: ["bookings"] }, (old: any) => {
          if (!Array.isArray(old)) return [res.booking];
          return [res.booking, ...old];
        });
        if (res?.approval) {
          queryClient.setQueriesData({ queryKey: ["approvals"] }, (old: any) => {
            if (!Array.isArray(old)) return [res.approval];
            return [res.approval, ...old];
          });
        }
        queryClient.invalidateQueries({ queryKey: ["bookings"], refetchType: "none" });
        queryClient.invalidateQueries({ queryKey: ["approvals"], refetchType: "none" });

        setSubmittedStatus(initialStatus);
        setIsSubmitted(true);
        showSubmitSuccess({
          title: "Room Reservation Request Submitted!",
          description:
            initialStatus === "Pending Ministry Approval"
              ? "Your room reservation request has been submitted successfully and is now waiting for Ministry Head review."
              : "Your room reservation request has been submitted successfully and is now waiting for administrative review.",
          referenceId: generatedRequestId,
          confirmText: "View My Reservations",
          onConfirm: () => router.push("/reservations/my"),
          secondaryText: "Submit Another",
          onSecondary: () => {
            setIsSubmitted(false);
            setPurpose("");
            setStartTime("");
            setEndTime("");
            setRequestedElements([]);
            setGeneratedRequestId(`REQ-${Math.floor(1000 + Math.random() * 9000)}`);
          },
        });
      }
    } catch (error: any) {
      console.error("Error submitting reservation:", error);
      const rawMsg = String(error?.message || error || "");
      const cleanMsg = rawMsg.includes("Minified React error #441")
        ? "This room is already reserved for this time slot. Please choose another time."
        : rawMsg || "There was an error submitting your request. Please try again.";
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: cleanMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    const reservedRoom = rooms?.find((r: any) => r.id === roomId);

    return (
      <AppLayout>
        <div className="w-full max-w-xl mx-auto py-10 sm:py-16 px-4">
          <div className="bg-white dark:bg-card rounded-3xl border border-gray-200/90 dark:border-border shadow-lg p-6 sm:p-8 text-center space-y-6">
            {/* Success Icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="h-8 w-8 stroke-[2.25]" />
                </div>
              </div>
            </div>

            {/* Request ID Tag */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-muted text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-border font-mono">
              <span className="text-muted-foreground font-sans font-normal">Reference:</span>
              <span className="font-bold text-slate-900 dark:text-white">{generatedRequestId}</span>
            </div>

            {/* Title & Description */}
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold font-headline text-gray-900 dark:text-white">
                Request Submitted!
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                {submittedStatus === "Pending Ministry Approval"
                  ? "Your room reservation request has been submitted successfully and is now waiting for Ministry Head review."
                  : "Your room reservation request has been submitted successfully and is now waiting for administrative review."}
              </p>
            </div>

            {/* Reservation Summary Box */}
            <div className="bg-slate-50 dark:bg-muted/30 rounded-2xl p-4 sm:p-5 border border-slate-100 dark:border-border/60 text-left space-y-3">
              <div className="flex flex-row items-center justify-between sm:grid sm:grid-cols-2 gap-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <span className="truncate">Reservation Details</span>
                <div className="flex items-center sm:justify-start justify-end">
                  {submittedStatus === "Pending Ministry Approval" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40 whitespace-nowrap shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                      Pending Ministry Head
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 whitespace-nowrap shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      Pending Admin Approval
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1">
                {reservedRoom && (
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium truncate">{reservedRoom.name}</span>
                  </div>
                )}
                {selectedDate && (
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <CalendarIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium">
                      {(() => {
                        try {
                          return format(new Date(selectedDate), "MMM dd, yyyy");
                        } catch {
                          return selectedDate;
                        }
                      })()}
                    </span>
                  </div>
                )}
                {(startTime || endTime) && (
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium">{startTime || "--"} - {endTime || "--"}</span>
                  </div>
                )}
                {pax && (
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium">{pax} attendees expected</span>
                  </div>
                )}
                {purpose && (
                  <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300 sm:col-span-2 pt-1 border-t border-slate-200/50 dark:border-border/40">
                    <span className="text-muted-foreground text-[11px] shrink-0">Purpose:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 text-xs truncate">{purpose}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <Button
                variant="outline"
                className="w-full sm:w-auto rounded-xl px-4 h-10 text-xs font-semibold cursor-pointer border-slate-200 dark:border-border hover:bg-slate-50 dark:hover:bg-muted"
                onClick={() => router.push("/reservations/masterview/daily")}
              >
                <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                View Calendar
              </Button>
              <Button
                className="w-full sm:w-auto bg-sidebar hover:bg-sidebar/90 text-white rounded-xl px-5 h-10 text-xs font-semibold shadow-xs cursor-pointer gap-1.5"
                onClick={() => router.push("/reservations/my")}
              >
                <span>Go to My Reservations</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div>
              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                  setPurpose("");
                  setStartTime("");
                  setEndTime("");
                  setRoomId("");
                  setGeneratedRequestId(`REQ-${Math.floor(1000 + Math.random() * 9000)}`);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100 transition-colors pt-1 cursor-pointer font-medium"
              >
                <RotateCcw className="h-3 w-3" />
                Submit another reservation
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="w-full space-y-6 pb-12">
        {/* Header Section */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-headline text-gray-900 dark:text-white">
            Reserve a Room
          </h1>
          <p className="text-sm text-muted-foreground">
            Fill out the form below to request a facility for your event or ministry.
          </p>
        </div>

        {/* Main Form Card */}
        <div className="bg-white dark:bg-card rounded-2xl border border-border/60 p-6 sm:p-8 shadow-card-dark w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Card Title & Notice */}
          <div className="mb-6 space-y-0.5">
            <h2 className="text-xl font-bold font-headline text-gray-900 dark:text-white">
              Request Information
            </h2>
            <p className="text-xs italic text-red-500 font-medium">
              All fields are required to be filled out.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Row 1: Request ID & Date Requested */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Request ID
                </label>
                <Input
                  value={generatedRequestId || "REQ-1000"}
                  disabled
                  className="bg-slate-50/90 dark:bg-muted/30 border border-slate-200/80 dark:border-border text-slate-600 dark:text-slate-300 rounded-xl h-10 text-xs font-normal cursor-not-allowed shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Date Requested
                </label>
                <Input
                  value={format(new Date(), "MMM d, yyyy")}
                  disabled
                  className="bg-slate-50/90 dark:bg-muted/30 border border-slate-200/80 dark:border-border text-slate-600 dark:text-slate-300 rounded-xl h-10 text-xs font-normal cursor-not-allowed shadow-2xs"
                />
              </div>
            </div>

            {/* Row 2: Requester Name & Ministry */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Requester Name <span className="text-red-500 ml-0.5">*</span>
                </label>
                <Input
                  required
                  disabled
                  maxLength={MAX_LENGTHS.NAME}
                  value={requesterName}
                  placeholder="System Admin"
                  className="bg-slate-50/90 dark:bg-muted/30 border border-slate-200/80 dark:border-border text-slate-600 dark:text-slate-300 rounded-xl h-10 text-xs font-normal cursor-not-allowed shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Ministry
                </label>
                <Input
                  value={isAdminUser ? "General" : (userMinistry?.name || "General")}
                  disabled
                  className="bg-slate-50/90 dark:bg-muted/30 border border-slate-200/80 dark:border-border text-slate-600 dark:text-slate-300 rounded-xl h-10 text-xs font-normal cursor-not-allowed shadow-2xs"
                />
              </div>
            </div>

            {/* Row 3: Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Email <span className="text-red-500 ml-0.5">*</span>
              </label>
              <Input
                type="email"
                required
                maxLength={MAX_LENGTHS.EMAIL}
                value={email}
                onChange={(e) => setEmail(e.target.value.slice(0, MAX_LENGTHS.EMAIL))}
                placeholder="admin@gmail.com"
                className="bg-background dark:bg-muted/30 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 border border-slate-200/90 dark:border-border rounded-xl h-10 text-xs font-normal shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar transition-all"
              />
            </div>

            {/* Row 4: Purpose of Reservation */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Purpose of Reservation <span className="text-red-500 ml-0.5">*</span>
              </label>
              <Textarea
                required
                maxLength={MAX_LENGTHS.PURPOSE}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value.slice(0, MAX_LENGTHS.PURPOSE))}
                placeholder="Describe the event or meeting...."
                className="bg-background dark:bg-muted/30 border border-slate-200/90 dark:border-border rounded-xl min-h-[110px] p-3 text-xs leading-relaxed font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar transition-all"
              />
              <div className="flex justify-end">
              </div>
            </div>

            {/* Row 5: Floor / Room */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Floor / Room <span className="text-red-500 ml-0.5">*</span>
              </label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger className="bg-background dark:bg-muted/30 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-border rounded-xl h-10 text-xs font-normal shadow-2xs focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all">
                  <SelectValue placeholder="Select floor / room" />
                </SelectTrigger>
                <SelectContent>
                  {areas?.map((area) => {
                    const areaRooms = (rooms || []).filter(
                      (r) => r.areaId === area.id || r.areaId === area.areaId
                    );
                    if (areaRooms.length === 0) return null;

                    return (
                      <SelectGroup key={area.id}>
                        <SelectLabel className="text-xs font-bold text-gray-500 dark:text-gray-400">
                          {area.name}
                        </SelectLabel>
                        {areaRooms.map((room) => {
                          const isUnderMaintenance = room.status === "Maintenance";
                          return (
                            <SelectItem
                              key={room.id}
                              value={room.id}
                              disabled={isUnderMaintenance}
                              className={cn(
                                "text-xs",
                                isUnderMaintenance && "opacity-60 cursor-not-allowed bg-amber-50/40 dark:bg-amber-950/20"
                              )}
                            >
                              <div className="flex items-center justify-between w-full gap-2">
                                <span className={cn(isUnderMaintenance && "text-muted-foreground")}>
                                  {area.name} – {room.name} (Cap: {room.capacity})
                                </span>
                                {isUnderMaintenance && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                                    Maintenance
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedRoom?.status === "Maintenance" && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs shadow-2xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <p className="font-bold">Room Under Maintenance</p>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                      <strong>{selectedRoom.name}</strong> is temporarily unavailable for reservations due to ongoing maintenance. Please choose another room.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Row 6: Select Date, Start Time, End Time */}
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Select Date <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <DatePicker
                    value={selectedDate}
                    onChange={(d) => {
                      setSelectedDate(d);
                      if (startTime && isSlotInPast(startTime)) {
                        setStartTime("");
                      }
                      if (endTime && isSlotInPast(endTime)) {
                        setEndTime("");
                      }
                    }}
                    disablePastDates={true}
                    className="w-full h-10 rounded-xl border-slate-200/90 dark:border-border bg-background dark:bg-muted/30 shadow-2xs text-xs font-normal"
                    align="start"
                  />
                  {isDateInPast && (
                    <p className="text-xs font-semibold text-red-500 mt-1 flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5 shrink-0" />
                      Past dates are not allowed.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Start Time <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <Select value={startTime} onValueChange={setStartTime}>
                    <SelectTrigger className="bg-background dark:bg-muted/30 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-border rounded-xl h-10 text-xs font-normal shadow-2xs focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all">
                      <SelectValue placeholder="Start" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const available = timeSlots.filter((slot) => {
                          const slotMin = timeToMinutes(slot.value);
                          if (slotMin >= 20 * 60) return false;
                          const passed = isSlotInPast(slot.value);
                          if (passed) return false;
                          const isBooked = bookedRanges.some(
                            (r) => slotMin >= r.startMin && slotMin < r.endMin
                          );
                          if (isBooked) return false;
                          return true;
                        });

                        if (available.length === 0) {
                          return (
                            <div className="py-3 px-3 text-center text-xs text-muted-foreground font-medium">
                              No time slots available for this date.
                            </div>
                          );
                        }

                        return available.map((slot) => (
                          <SelectItem
                            key={`start-${slot.value}`}
                            value={slot.value}
                            className="text-xs"
                          >
                            {slot.display}
                          </SelectItem>
                        ));
                      })()}
                    </SelectContent>
                  </Select>
                  {isTimeInPast && (
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                      <Info className="h-3.5 w-3.5 shrink-0" />
                      Time has already passed.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    End Time <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <Select value={endTime} onValueChange={setEndTime}>
                    <SelectTrigger className="bg-background dark:bg-muted/30 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-border rounded-xl h-10 text-xs font-normal shadow-2xs focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all">
                      <SelectValue placeholder="End" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const available = timeSlots.filter((slot) => {
                          const passed = isSlotInPast(slot.value);
                          if (passed) return false;
                          const slotMin = timeToMinutes(slot.value);
                          if (startTime) {
                            const startMin = timeToMinutes(startTime);
                            if (slotMin <= startMin) return false;
                            const isConflict = bookedRanges.some(
                              (r) => startMin < r.endMin && slotMin > r.startMin
                            );
                            if (isConflict) return false;
                          } else {
                            const isConflict = bookedRanges.some(
                              (r) => slotMin > r.startMin && slotMin <= r.endMin
                            );
                            if (isConflict) return false;
                          }
                          return true;
                        });

                        if (available.length === 0) {
                          return (
                            <div className="py-3 px-3 text-center text-xs text-muted-foreground font-medium">
                              {startTime ? "No valid end time slots available" : "Select start time first"}
                            </div>
                          );
                        }

                        return available.map((slot) => (
                          <SelectItem
                            key={`end-${slot.value}`}
                            value={slot.value}
                            className="text-xs"
                          >
                            {slot.display}
                          </SelectItem>
                        ));
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs italic text-red-500 font-medium mt-1.5">
                Note: Room reservations are until 8:00 pm only.
              </p>

              {/* Live Room Schedule / Reserved Times Summary */}
              {roomId && selectedDate && (
                <div className="mt-2.5">
                  {isCheckingBookings ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse py-1">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      <span>Checking room schedule...</span>
                    </div>
                  ) : bookedRanges.length > 0 ? (
                    <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/25 p-3 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-300">
                        <Info className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>Already reserved for {selectedRoom?.name || "this room"} on {selectedDate}:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {bookedRanges.map((range, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-card border border-amber-200/90 dark:border-amber-800/80 text-xs font-medium text-gray-800 dark:text-gray-200 shadow-2xs"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                            <span className="font-semibold text-red-600 dark:text-red-400">
                              {formatTime12(range.startMin)} – {formatTime12(range.endMin)}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-normal">
                              ({range.status})
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium py-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{selectedRoom?.name || "This room"} is fully available on this date.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Row 7: Pax, No. of Tables, No. of Chairs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Pax <span className="text-red-500 ml-0.5">*</span>
                </label>
                <Input
                  type="number"
                  required
                  min={1}
                  value={pax}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    const maxCapacity = selectedRoom?.capacity || 999;
                    if (val <= maxCapacity || e.target.value === "") {
                      setPax(e.target.value);
                    }
                  }}
                  placeholder="Number of people"
                  max={selectedRoom?.capacity || undefined}
                  className="bg-background dark:bg-muted/30 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 border border-slate-200/90 dark:border-border rounded-xl h-10 text-xs font-normal shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar transition-all"
                />
                {selectedRoom && (
                  <p className="text-xs font-medium mt-1 text-muted-foreground">
                    Max room capacity: {selectedRoom.capacity}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  No. of Tables <span className="text-red-500 ml-0.5">*</span>
                </label>
                <Input
                  type="number"
                  required
                  min={0}
                  value={numTables}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val <= 5 || e.target.value === "") {
                      setNumTables(e.target.value);
                    }
                  }}
                  placeholder="0"
                  max={5}
                  className="bg-background dark:bg-muted/30 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 border border-slate-200/90 dark:border-border rounded-xl h-10 text-xs font-normal shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar transition-all"
                />
                {selectedRoom && (
                  <p className="text-xs font-medium text-muted-foreground mt-1">
                    Maximum: 5 tables
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  No. of Chairs <span className="text-red-500 ml-0.5">*</span>
                </label>
                <Input
                  type="number"
                  required
                  min={0}
                  value={numChairs}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    const maxChairs = selectedRoom?.capacity || 60;
                    if (val <= maxChairs || e.target.value === "") {
                      setNumChairs(e.target.value);
                    }
                  }}
                  placeholder="0"
                  max={selectedRoom?.capacity || 60}
                  className="bg-background dark:bg-muted/30 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 border border-slate-200/90 dark:border-border rounded-xl h-10 text-xs font-normal shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar transition-all"
                />
                {selectedRoom && (
                  <p className="text-xs font-medium text-muted-foreground mt-1">
                    Maximum: {selectedRoom.capacity ? `${selectedRoom.capacity} chairs` : "60 chairs"}
                  </p>
                )}
              </div>
            </div>

            {/* ── REQUESTED ELEMENTS & AV (OPTIONAL) ── */}
            {/* ── REQUEST & AV (OPTIONAL) ── */}
            <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-border/60">
              {/* Room Specific Facility Elements if any */}
              {selectedRoom &&
                selectedRoom.elements &&
                selectedRoom.elements.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Available Room Elements:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {selectedRoom.elements.map((elementId: string) => {
                        const element = venueElements?.find(
                          (e) => e.id === elementId
                        );
                        if (!element) return null;
                        return (
                          <div
                            key={element.id}
                            className="flex items-center space-x-2.5 bg-slate-50/80 dark:bg-muted/30 p-2.5 rounded-xl border border-slate-200/70 dark:border-border/60 hover:border-sidebar/30 transition-all cursor-pointer"
                          >
                            <Checkbox
                              id={`element-${element.id}`}
                              checked={requestedElements.includes(element.id)}
                              onCheckedChange={(c) => {
                                if (c) {
                                  setRequestedElements((prev) => [
                                    ...prev,
                                    element.id,
                                  ]);
                                } else {
                                  setRequestedElements((prev) =>
                                    prev.filter((id) => id !== element.id)
                                  );
                                }
                              }}
                            />
                            <label
                              htmlFor={`element-${element.id}`}
                              className="cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300 select-none"
                            >
                              {element.name}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>

            {/* ORS Guidelines Section (Retained before Submit & Cancel buttons) */}
            <div className="bg-slate-50/90 dark:bg-muted/30 p-4 rounded-xl border border-slate-200/90 dark:border-border space-y-2.5 mt-6 shadow-2xs">
              <div className="font-bold text-xs text-slate-900 dark:text-white">
                ORS Guidelines
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                1. Rooms must be left clean and tidy after use.
                <br />
                2. Switch off all lights, AC, and equipment before leaving.
                <br />
                3. Report any damage immediately to the facilities manager.
              </p>
              <div className="flex items-center space-x-2 pt-2 border-t border-slate-200/70 dark:border-border/60">
                <Checkbox
                  id="guidelines"
                  checked={guidelinesAccepted}
                  onCheckedChange={(c) => setGuidelinesAccepted(!!c)}
                />
                <label
                  htmlFor="guidelines"
                  className="text-xs font-semibold cursor-pointer text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white select-none transition-colors"
                >
                  I understand and will follow the ORS guidelines
                </label>
              </div>
            </div>

            {/* Footer Buttons (Cancel & Submit) */}
            <div className="pt-4 border-t border-gray-100 dark:border-border/60 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="rounded-xl px-6 h-10 text-xs font-semibold border-slate-200/90 dark:border-border hover:bg-slate-100 dark:hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !guidelinesAccepted || isDateInPast || isTimeInPast || selectedRoom?.status === "Maintenance"}
                className={cn(
                  "rounded-xl px-7 h-10 text-xs font-bold shadow-xs gap-1.5 transition-all",
                  guidelinesAccepted && !isDateInPast && !isTimeInPast
                    ? "bg-sidebar hover:bg-sidebar/90 text-white cursor-pointer shadow-sm"
                    : "bg-sidebar/40 text-white dark:bg-sidebar/40 dark:text-white/80 cursor-not-allowed"
                )}
              >
                {isSubmitting && (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                )}
                Submit
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent className="rounded-2xl max-w-md p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-gray-900 dark:text-gray-100">
              Confirm Reservation Request
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to submit this room reservation request? Please review your details before confirming.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-2 p-3.5 rounded-xl bg-slate-50 dark:bg-muted/40 border border-slate-200/80 dark:border-border/60 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Room:</span>
              <span className="font-semibold text-foreground">{selectedRoom?.name || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date:</span>
              <span className="font-semibold text-foreground">{selectedDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time:</span>
              <span className="font-semibold text-foreground">
                {startTime} - {endTime}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pax:</span>
              <span className="font-semibold text-foreground">{pax || 0} people</span>
            </div>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              disabled={isSubmitting}
              className="rounded-xl h-9 text-xs font-semibold cursor-pointer border-slate-200/90 dark:border-border"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmSubmit();
              }}
              disabled={isSubmitting}
              className="rounded-xl h-9 text-xs font-bold bg-sidebar hover:bg-sidebar/90 text-white cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Submitting...
                </>
              ) : (
                "Yes, Submit Request"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
