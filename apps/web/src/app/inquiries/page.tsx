"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Dialog,
  DialogContent,
  DialogTitle,
} from "@studio/ui";
import {
  MessageSquareHeart,
  Search,
  Mail,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  Archive,
  ArchiveRestore,
  RefreshCw,
  Eye,
  Inbox,
  Check,
  FileText,
  User,
  ShieldAlert,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getInquiries, updateInquiryStatus, archiveInquiry, unarchiveInquiry } from "@/actions/db";
import type { Inquiry } from "@studio/types";
import { useUserRole } from "@/hooks/use-user-role";

// ── Stat Card Component ───────────────────────────────────────────────────────
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor,
  iconBg,
  iconColor,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  accentColor: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card border border-border/70 p-3.5 sm:p-5 shadow-xs transition-all hover:shadow-md">
      <div className={cn("absolute top-0 left-0 right-0 h-1", accentColor)} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
            {title}
          </p>
          <div className="mt-1 sm:mt-2 text-2xl sm:text-3xl lg:text-4xl font-black text-foreground">
            {value}
          </div>
          <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
        <div className={cn("p-2 sm:p-3 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
          <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5", iconColor)} />
        </div>
      </div>
    </div>
  );
}

function parseDateSafe(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val?.toDate === "function") return val.toDate();
  if (typeof val?.seconds === "number") return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getGmailComposeUrl(email: string, subject?: string, body?: string): string {
  const params = new URLSearchParams();
  params.set("view", "cm");
  params.set("fs", "1");
  if (email) params.set("to", email.trim());
  if (subject) params.set("su", subject.trim());
  if (body) params.set("body", body.trim());
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export default function InquiriesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workerProfile, isSuperAdmin, isLoading: isRoleLoading } = useUserRole();

  // Filters & State
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [archiveCandidate, setArchiveCandidate] = useState<Inquiry | null>(null);
  const [restoreCandidate, setRestoreCandidate] = useState<Inquiry | null>(null);
  const [statusCandidate, setStatusCandidate] = useState<{
    inquiry: Inquiry;
    targetStatus: "Pending" | "Responded";
  } | null>(null);

  // Fetch inquiries
  const {
    data: rawInquiries = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["inquiries"],
    queryFn: async () => {
      const data = await getInquiries({ excludeProblemReports: true });
      return (data || []) as Inquiry[];
    },
  });

  // Guarantee that internal worker problem reports never appear in public inquiries
  const inquiries = useMemo(() => {
    return rawInquiries.filter((item) => !item.type?.startsWith("Problem Report"));
  }, [rawInquiries]);

  // Helper: Determine if an inquiry is archived (either manually archived or > 30 days old)
  const isItemArchived = (item: Inquiry) => {
    if (item.status === "Archived") return true;
    const daysOld = differenceInDays(new Date(), parseDateSafe(item.createdAt));
    return daysOld >= 30;
  };

  // Status update mutation (e.g. Mark as Responded)
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: string;
    }) => {
      const responder = workerProfile
        ? `${workerProfile.firstName} ${workerProfile.lastName}`
        : "Staff Member";
      return await updateInquiryStatus(id, status, undefined, responder);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      toast({
        title: "Updated Successfully",
        description: "Inquiry status has been updated.",
      });
      if (selectedInquiry) {
        setIsDetailsOpen(false);
      }
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: err?.message || "Could not update status.",
      });
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return await archiveInquiry(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      toast({
        title: "Message Archived",
        description: "The message has been moved to the archive.",
      });
      setArchiveCandidate(null);
      if (selectedInquiry?.id === archiveCandidate?.id) {
        setIsDetailsOpen(false);
      }
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Archive Failed",
        description: err?.message || "Could not archive this message.",
      });
    },
  });

  // Unarchive mutation
  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return await unarchiveInquiry(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      toast({
        title: "Message Restored",
        description: "The message has been restored to Active messages.",
      });
      setRestoreCandidate(null);
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Restore Failed",
        description: err?.message || "Could not restore this message.",
      });
    },
  });

  // Split into active vs archived
  const activeInquiries = useMemo(() => {
    return inquiries.filter((i) => !isItemArchived(i));
  }, [inquiries]);

  const archivedInquiries = useMemo(() => {
    return inquiries.filter((i) => isItemArchived(i));
  }, [inquiries]);

  // Current tab list filtered by search
  const displayedInquiries = useMemo(() => {
    const list = activeTab === "active" ? activeInquiries : archivedInquiries;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return list;

    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query) ||
        (item.phone && item.phone.toLowerCase().includes(query)) ||
        item.message.toLowerCase().includes(query)
    );
  }, [activeTab, activeInquiries, archivedInquiries, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = inquiries.length;
    const active = activeInquiries.length;
    const responded = inquiries.filter(
      (i) => i.status === "Responded" || i.status === "Resolved"
    ).length;
    const archived = archivedInquiries.length;

    return { total, active, responded, archived };
  }, [inquiries, activeInquiries, archivedInquiries]);

  const handleOpenDetails = (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    setIsDetailsOpen(true);
  };

  if (!isRoleLoading && !isSuperAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4 shadow-xs">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-6">
            The Inquiries & Requests tab is restricted to Administrator accounts only.
          </p>
          <Button asChild className="rounded-xl px-6">
            <Link href="/dashboard">Return to Dashboard</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6 pb-16 sm:pb-12">
        {/* Header Title & Actions */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">
            Inquiries & Requests
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage and follow up on messages and requests submitted through the website.
          </p>
        </div>

        {/* Top Summary Stat Cards (2x2 on mobile, 4 columns on large screens) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <StatCard
            title="Total Inquiries"
            value={stats.total}
            subtitle="All received messages"
            icon={Inbox}
            accentColor="bg-blue-500"
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            title="Active Messages"
            value={stats.active}
            subtitle="Under 30 days & active"
            icon={AlertCircle}
            accentColor="bg-amber-500"
            iconBg="bg-amber-500/10"
            iconColor="text-amber-500"
          />
          <StatCard
            title="Responded"
            value={stats.responded}
            subtitle="Handled & followed up"
            icon={CheckCircle2}
            accentColor="bg-emerald-500"
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
          <StatCard
            title="Archived"
            value={stats.archived}
            subtitle="30+ days old & archived"
            icon={Archive}
            accentColor="bg-slate-500"
            iconBg="bg-slate-500/10"
            iconColor="text-slate-500"
          />
        </div>

        {/* Main Content Card Container (Unified Dashboard Design) */}
        <div className="bg-white dark:bg-card rounded-2xl border border-border/60 shadow-card-dark p-3.5 sm:p-6 overflow-hidden flex flex-col gap-3.5 sm:gap-4">
          {/* Top Controls Row (Search & Active/Archived segmented tabs) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search bar */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search name, email, phone, message..."
                className="pl-9 pr-4 text-xs font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 h-10 bg-background dark:bg-muted/30 border border-slate-200/90 dark:border-border rounded-2xl shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar w-full transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Active vs Archived Segmented Tabs */}
            <div className="flex items-center p-1 bg-muted/60 dark:bg-muted/30 rounded-2xl border border-border/60 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveTab("active")}
                className={cn(
                  "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                  activeTab === "active"
                    ? "bg-sidebar text-white shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Active</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                    activeTab === "active"
                      ? "bg-white/20 text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {stats.active}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("archived")}
                className={cn(
                  "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                  activeTab === "archived"
                    ? "bg-sidebar text-white shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archived</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                    activeTab === "archived"
                      ? "bg-white/20 text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {stats.archived}
                </span>
              </button>
            </div>
          </div>

          {/* Table / Card Container */}
          <div className="border border-border/60 rounded-2xl overflow-hidden flex flex-col bg-card">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
                <RefreshCw className="w-8 h-8 animate-spin text-primary mb-3" />
                <p className="font-medium text-xs">Loading messages...</p>
              </div>
            ) : displayedInquiries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-3">
                  {activeTab === "active" ? (
                    <Inbox className="w-6 h-6" />
                  ) : (
                    <Archive className="w-6 h-6" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  {activeTab === "active" ? "No active messages" : "No archived messages"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  {searchQuery
                    ? "No messages match your search query."
                    : activeTab === "active"
                      ? "Messages submitted via the Contact Us form will appear here. Messages automatically move to archive after 30 days."
                      : "Archived messages and messages older than 30 days will appear here."}
                </p>
                {searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="mt-3.5 h-8 text-xs rounded-xl"
                  >
                    Clear Search
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* ── Mobile Card List View (Visible on screens < md) ── */}
                <div className="md:hidden p-3.5 sm:p-4 space-y-3 bg-slate-50/50 dark:bg-muted/10">
                  {displayedInquiries.map((inquiry) => {
                    const daysOld = differenceInDays(new Date(), parseDateSafe(inquiry.createdAt));
                    const isResponded = inquiry.status === "Responded" || inquiry.status === "Resolved";
                    const initials = inquiry.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    return (
                      <div
                        key={inquiry.id}
                        className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xs hover:shadow-xs transition-all"
                      >
                        {/* Navy header: ID + Status + Actions Menu */}
                        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-sidebar text-white">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-white tracking-wide">
                              INQ-{inquiry.id.slice(0, 4).toUpperCase()}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isResponded ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-200 bg-emerald-400/20 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                                <Check className="w-3 h-3" /> Responded
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-200 bg-amber-400/20 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                                <Clock className="w-3 h-3 animate-pulse" /> Pending
                              </span>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                  <span className="sr-only">Actions</span>
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52 rounded-xl">
                                <DropdownMenuItem
                                  onClick={() => handleOpenDetails(inquiry)}
                                  className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2 text-foreground"
                                >
                                  <Eye className="w-4 h-4 text-muted-foreground" />
                                  <span>View Details</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  asChild
                                  className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2 text-foreground"
                                >
                                  <a
                                    href={getGmailComposeUrl(
                                      inquiry.email,
                                      `Re: Church of God Dasmariñas - Your Message`,
                                      `Dear ${inquiry.name},\n\nThank you for contacting Church of God Dasmariñas regarding your message:\n"${inquiry.message}"\n\n`
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 w-full text-foreground"
                                  >
                                    <Mail className="w-4 h-4 text-violet-500" />
                                    <span>Reply via Gmail</span>
                                  </a>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() =>
                                    setStatusCandidate({
                                      inquiry,
                                      targetStatus: isResponded ? "Pending" : "Responded",
                                    })
                                  }
                                  className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2 text-foreground"
                                >
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                  <span>{isResponded ? "Mark as Pending" : "Mark as Responded"}</span>
                                </DropdownMenuItem>

                                {activeTab === "active" ? (
                                  <DropdownMenuItem
                                    onClick={() => setArchiveCandidate(inquiry)}
                                    className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2 text-foreground"
                                  >
                                    <Archive className="w-4 h-4 text-amber-500" />
                                    <span>Archive</span>
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => setRestoreCandidate(inquiry)}
                                    className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2 text-foreground"
                                  >
                                    <ArchiveRestore className="w-4 h-4 text-emerald-500" />
                                    <span>Restore to Active</span>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Card body */}
                        <div className="p-4 space-y-3 bg-white dark:bg-card">
                          {/* Sender row: Avatar + Name + Date */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-sidebar/10 text-sidebar dark:bg-sidebar/30 dark:text-sidebar-foreground font-bold text-xs flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-sm text-foreground truncate">{inquiry.name}</p>
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{format(parseDateSafe(inquiry.createdAt), "MMM d, yyyy • h:mm a")}</span>
                              </p>
                            </div>
                          </div>

                          {/* Contact Info Box */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50/70 dark:bg-muted/30 p-2.5 rounded-xl border border-border/40">
                            <div className="flex items-center gap-1.5 truncate">
                              <Mail className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                              <span className="text-[11px] text-muted-foreground truncate select-text">{inquiry.email}</span>
                            </div>
                            <div className="flex items-center gap-1.5 truncate">
                              <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span className="text-[11px] text-muted-foreground select-text">{inquiry.phone || "No phone"}</span>
                            </div>
                          </div>

                          {/* Message preview block */}
                          <div
                            onClick={() => handleOpenDetails(inquiry)}
                            className="p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors border border-border/50 cursor-pointer"
                          >
                            <p className="text-xs text-foreground/90 line-clamp-3 leading-relaxed select-text">
                              {inquiry.message}
                            </p>
                          </div>

                          {/* Footer: relative time badge */}
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                            <span>{formatDistanceToNow(parseDateSafe(inquiry.createdAt), { addSuffix: true })}</span>
                            {daysOld >= 30 && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                (30+ days)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Desktop Table View (Hidden on mobile, visible on >= md) ── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[720px]">
                    <thead className="bg-sidebar">
                      <tr className="bg-sidebar hover:bg-sidebar border-b border-sidebar-border/40">
                        <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap">
                          REQUESTER
                        </th>
                        <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap">
                          CONTACT
                        </th>
                        <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap">
                          MESSAGE
                        </th>
                        <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap">
                          DATE RECEIVED
                        </th>
                        <th className="px-5 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap">
                          ACTIONS
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {displayedInquiries.map((inquiry) => {
                        const daysOld = differenceInDays(new Date(), parseDateSafe(inquiry.createdAt));
                        const isResponded = inquiry.status === "Responded" || inquiry.status === "Resolved";

                        return (
                          <tr
                            key={inquiry.id}
                            className="border-b border-gray-100 dark:border-border/60 hover:bg-slate-50/70 dark:hover:bg-muted/30 transition-colors"
                          >
                            {/* Requester (Name & Avatar) */}
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20">
                                  {inquiry.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .slice(0, 2)
                                    .join("")
                                    .toUpperCase()}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-foreground whitespace-nowrap">{inquiry.name}</span>
                                  {isResponded && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                      <Check className="w-3 h-3" /> Responded
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Contact (Static non-clickable text) */}
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <div className="space-y-0.5">
                                <div className="text-xs font-medium text-foreground flex items-center gap-1.5 select-text">
                                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                  <span>{inquiry.email}</span>
                                </div>
                                {inquiry.phone ? (
                                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 select-text">
                                    <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <span>{inquiry.phone}</span>
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-muted-foreground/60 italic">
                                    No phone provided
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Message Preview */}
                            <td className="px-5 py-3.5 max-w-sm sm:max-w-md">
                              <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 select-text">
                                {inquiry.message}
                              </p>
                            </td>

                            {/* Date */}
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <div className="space-y-0.5">
                                <p className="text-xs font-semibold text-foreground">
                                  {format(parseDateSafe(inquiry.createdAt), "MMM d, yyyy")}
                                </p>
                                <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                                  <span>
                                    {format(parseDateSafe(inquiry.createdAt), "h:mm a")} ({formatDistanceToNow(parseDateSafe(inquiry.createdAt), { addSuffix: true })})
                                  </span>
                                </p>
                                {daysOld >= 30 && (
                                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                    Auto-archived (30+ days)
                                  </p>
                                )}
                              </div>
                            </td>

                            {/* Actions: Centered 3 Dots Menu */}
                            <td
                              className="px-5 py-3.5 text-center whitespace-nowrap"
                            >
                              <div className="flex items-center justify-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-52 rounded-xl">
                                    <DropdownMenuItem
                                      onClick={() => handleOpenDetails(inquiry)}
                                      className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2 text-foreground"
                                    >
                                      <Eye className="w-4 h-4 text-muted-foreground" />
                                      <span>View Details</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      asChild
                                      className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2 text-foreground"
                                    >
                                      <a
                                        href={getGmailComposeUrl(
                                          inquiry.email,
                                          `Re: Church of God Dasmariñas - Your Message`,
                                          `Dear ${inquiry.name},\n\nThank you for contacting Church of God Dasmariñas regarding your message:\n"${inquiry.message}"\n\n`
                                        )}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 w-full text-foreground"
                                      >
                                        <Mail className="w-4 h-4 text-violet-500" />
                                        <span>Reply via Gmail</span>
                                      </a>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      onClick={() =>
                                        setStatusCandidate({
                                          inquiry,
                                          targetStatus: isResponded ? "Pending" : "Responded",
                                        })
                                      }
                                      className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2 text-foreground"
                                    >
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                      <span>{isResponded ? "Mark as Pending" : "Mark as Responded"}</span>
                                    </DropdownMenuItem>

                                    {activeTab === "active" ? (
                                      <DropdownMenuItem
                                        onClick={() => setArchiveCandidate(inquiry)}
                                        className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2 text-foreground"
                                      >
                                        <Archive className="w-4 h-4 text-amber-500" />
                                        <span>Archive</span>
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        onClick={() => setRestoreCandidate(inquiry)}
                                        className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2 text-foreground"
                                      >
                                        <ArchiveRestore className="w-4 h-4 text-emerald-500" />
                                        <span>Restore to Active</span>
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Enhanced View Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent
            className="w-[calc(100%-2.5rem)] max-w-md p-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 shadow-2xl gap-0 bg-background flex flex-col h-auto"
            style={{
              maxHeight: "min(540px, calc(100dvh - 140px))",
            }}
          >
            <DialogTitle className="sr-only">Message Details</DialogTitle>
            {selectedInquiry && (
              <>
                {/* Modal Top Bar Header with Icon & Badge */}
                <div className="p-4 sm:p-5 pr-12 pb-3.5 sm:pb-4 border-b border-border/70 bg-card/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <MessageSquareHeart className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <h2 className="text-base sm:text-lg font-bold font-headline tracking-tight text-foreground whitespace-nowrap">
                          Message Details
                        </h2>
                        {selectedInquiry.status === "Responded" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap shadow-2xs shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            Responded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap shadow-2xs shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            Pending Response
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          Received {format(parseDateSafe(selectedInquiry.createdAt), "MMM d, yyyy • h:mm a")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Body Content with enhanced spacing */}
                <div className="p-4 sm:p-5 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1">
                  {/* Sender Information Card */}
                  <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-border/75 bg-slate-50/70 dark:bg-muted/20 space-y-3 shadow-2xs">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      <User className="h-3.5 w-3.5 text-primary" />
                      <span>Sender Information</span>
                    </div>

                    <div className="space-y-3 divide-y divide-border/40 pt-1">
                      {/* Full Name */}
                      <div className="flex items-center gap-3.5 pt-2 first:pt-0">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-2xs">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-muted-foreground font-semibold">Full Name</p>
                          <p className="text-sm font-bold text-foreground break-words select-text mt-0.5">
                            {selectedInquiry.name}
                          </p>
                        </div>
                      </div>

                      {/* Email Address */}
                      <div className="flex items-center gap-3.5 pt-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-2xs">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-muted-foreground font-semibold">Email Address</p>
                          <p className="text-sm font-semibold text-foreground break-all select-text mt-0.5">
                            {selectedInquiry.email}
                          </p>
                        </div>
                      </div>

                      {/* Ticket Category / Type */}
                      {selectedInquiry.type && (
                        <div className="flex items-center gap-3.5 pt-3">
                          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20 shadow-2xs">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-muted-foreground font-semibold">Category / Type</p>
                            <p className="text-sm font-semibold text-foreground break-words select-text mt-0.5">
                              {selectedInquiry.type}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Contact Number */}
                      <div className="flex items-center gap-3.5 pt-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-2xs">
                          <Phone className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-muted-foreground font-semibold">Contact Number</p>
                          <p className="text-sm font-semibold text-foreground select-text mt-0.5">
                            {selectedInquiry.phone ? (
                              <span>{selectedInquiry.phone}</span>
                            ) : (
                              <span className="text-muted-foreground/60 italic font-normal text-xs">
                                Not provided
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message Content Block */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-border/75 bg-slate-50/70 dark:bg-muted/20 space-y-2.5 shadow-2xs">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <span>Message / Request</span>
                    </div>
                    <div className="p-3.5 sm:p-4 rounded-xl bg-background/90 dark:bg-card border border-border/70 text-xs sm:text-sm font-normal text-foreground leading-relaxed whitespace-pre-wrap break-words min-h-[72px] select-text shadow-2xs">
                      {selectedInquiry.message}
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Archive Confirmation Dialog */}
        <AlertDialog
          open={!!archiveCandidate}
          onOpenChange={(open) => !open && setArchiveCandidate(null)}
        >
          <AlertDialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg rounded-2xl p-5 sm:p-7 border-border/80 shadow-2xl space-y-4 sm:space-y-5">
            <AlertDialogHeader className="space-y-2 pb-1 border-b border-border/40 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0 shadow-2xs">
                    <Archive className="h-5 w-5" />
                  </div>
                  <div>
                    <AlertDialogTitle className="text-xl font-bold font-headline text-foreground">
                      Archive Message
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Move this message to the archived records tab.
                    </AlertDialogDescription>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setArchiveCandidate(null)}
                  className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer shrink-0"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>
              </div>
            </AlertDialogHeader>

            {archiveCandidate && (
              <div className="rounded-2xl border border-border/70 bg-slate-50/60 dark:bg-muted/20 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-foreground">{archiveCandidate.name}</span>
                  <span className="text-[11px] text-muted-foreground">{archiveCandidate.email}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-white dark:bg-background border border-border/60 text-xs text-foreground leading-relaxed italic">
                  "{archiveCandidate.message}"
                </div>
                <p className="text-[11px] text-muted-foreground">
                  You can restore this message back to Active at any time from the Archived tab.
                </p>
              </div>
            )}

            <AlertDialogFooter className="flex flex-row items-center justify-end gap-2 pt-3 border-t border-border/40">
              <AlertDialogCancel className="h-10 rounded-xl px-4 sm:px-5 text-xs font-semibold cursor-pointer mt-0 shrink-0">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => archiveCandidate && archiveMutation.mutate(archiveCandidate.id)}
                className="h-10 rounded-xl px-4 sm:px-5 text-xs font-semibold bg-sidebar hover:bg-sidebar/90 text-white shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive Message
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Restore to Active Confirmation Dialog */}
        <AlertDialog
          open={!!restoreCandidate}
          onOpenChange={(open) => !open && setRestoreCandidate(null)}
        >
          <AlertDialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg rounded-2xl p-5 sm:p-7 border border-border/80 shadow-2xl space-y-4 sm:space-y-5 bg-background">
            <AlertDialogHeader className="space-y-2 pb-1 border-b border-border/40 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0 shadow-2xs">
                    <ArchiveRestore className="h-5 w-5" />
                  </div>
                  <div>
                    <AlertDialogTitle className="text-xl font-bold font-headline text-foreground">
                      Restore Message to Active?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Move this inquiry back to the active messages list.
                    </AlertDialogDescription>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRestoreCandidate(null)}
                  className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer shrink-0"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>
              </div>
            </AlertDialogHeader>

            {restoreCandidate && (
              <div className="rounded-2xl border border-border/70 bg-slate-50/60 dark:bg-muted/20 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-foreground">{restoreCandidate.name}</span>
                  <span className="text-[11px] text-muted-foreground">{restoreCandidate.email}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-white dark:bg-background border border-border/60 text-xs text-foreground leading-relaxed italic">
                  "{restoreCandidate.message}"
                </div>
                <p className="text-[11px] text-muted-foreground">
                  This message will reappear under the Active Messages tab and can receive replies and updates.
                </p>
              </div>
            )}

            <AlertDialogFooter className="flex items-center justify-end gap-2.5 pt-2">
              <AlertDialogCancel
                onClick={() => setRestoreCandidate(null)}
                className="h-10 rounded-xl px-4 sm:px-5 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (restoreCandidate) {
                    unarchiveMutation.mutate(restoreCandidate.id);
                  }
                }}
                disabled={unarchiveMutation.isPending}
                className="h-10 rounded-xl px-4 sm:px-5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
              >
                <ArchiveRestore className="w-3.5 h-3.5" />
                Restore to Active
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Mark as Responded / Pending Confirmation Dialog */}
        <AlertDialog
          open={!!statusCandidate}
          onOpenChange={(open) => !open && setStatusCandidate(null)}
        >
          <AlertDialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg rounded-2xl p-5 sm:p-7 border-border/80 shadow-2xl space-y-4 sm:space-y-5">
            <AlertDialogHeader className="space-y-2 pb-1 border-b border-border/40 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "p-2.5 rounded-xl border shrink-0 shadow-2xs",
                      statusCandidate?.targetStatus === "Responded"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-sidebar/10 text-sidebar dark:text-sky-400 border-sidebar/20"
                    )}
                  >
                    {statusCandidate?.targetStatus === "Responded" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Clock className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <AlertDialogTitle className="text-xl font-bold font-headline text-foreground">
                      {statusCandidate?.targetStatus === "Responded"
                        ? "Mark as Responded"
                        : "Revert to Pending"}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                      {statusCandidate?.targetStatus === "Responded"
                        ? "Update inquiry status and record responder signature."
                        : "Revert this inquiry back to pending for further follow-up."}
                    </AlertDialogDescription>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStatusCandidate(null)}
                  className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer shrink-0"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>
              </div>
            </AlertDialogHeader>

            {statusCandidate && (
              <div className="rounded-2xl border border-border/70 bg-slate-50/60 dark:bg-muted/20 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-foreground">{statusCandidate.inquiry.name}</span>
                  <span className="text-[11px] text-muted-foreground">{statusCandidate.inquiry.email}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-white dark:bg-background border border-border/60 text-xs text-foreground leading-relaxed italic">
                  "{statusCandidate.inquiry.message}"
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {statusCandidate.targetStatus === "Responded"
                    ? "This marks the message as attended by staff."
                    : "This returns the message to the active pending queue."}
                </p>
              </div>
            )}

            <AlertDialogFooter className="flex flex-row items-center justify-end gap-2 pt-3 border-t border-border/40">
              <AlertDialogCancel className="h-10 rounded-xl px-4 sm:px-5 text-xs font-semibold cursor-pointer mt-0 shrink-0">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (statusCandidate) {
                    updateStatusMutation.mutate({
                      id: statusCandidate.inquiry.id,
                      status: statusCandidate.targetStatus,
                    });
                    setStatusCandidate(null);
                  }
                }}
                className="h-10 rounded-xl px-4 sm:px-5 text-xs font-semibold bg-sidebar hover:bg-sidebar/90 text-white shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
              >
                {statusCandidate?.targetStatus === "Responded" ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Mark as Responded
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    Set to Pending
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
