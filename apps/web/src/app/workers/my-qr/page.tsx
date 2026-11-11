"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useAuthStore } from "@studio/store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@studio/ui";
import {
  QrCode,
  RefreshCw,
  Printer,
  Download,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  User,
  Building,
  CalendarDays,
  UtensilsCrossed,
  Key,
  Info,
  Shield,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useUserRole } from "@/hooks/use-user-role";
import { useMinistries } from "@/hooks/use-ministries";
import { updateWorker as updateWorkerSql, regenerateWorkerQrToken } from "@/actions/db";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { saveFileUniversal } from "@/lib/save-file-native";
import { useQueryClient } from "@tanstack/react-query";

export default function MyQRCodePage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { workerProfile, allRoles, isSuperAdmin, isLoading: roleLoading } = useUserRole();
  const { ministries } = useMinistries();
  const { toast } = useToast();

  const isUUID = (str?: string | null) =>
    str ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim()) : false;

  const roleName = isSuperAdmin
    ? "Administrator"
    : (workerProfile as any)?.role?.name ||
      (workerProfile as any)?.roles?.[0]?.role?.name ||
      allRoles?.find((r: any) => r.id === workerProfile?.roleId)?.name ||
      (!isUUID(workerProfile?.roleId) && workerProfile?.roleId) ||
      (workerProfile as any)?.role ||
      "General Member";

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isConfirmRegenOpen, setIsConfirmRegenOpen] = useState(false);
  const [localToken, setLocalToken] = useState<string | null>(null);

  const activeUserId = workerProfile?.id || user?.uid || "";
  const activeToken =
    localToken ?? workerProfile?.qrToken ?? activeUserId ?? "";
  const combinedData = activeToken
    ? `COG_USER:${activeUserId}:${activeToken}`
    : "";
  const combinedQrUrl = combinedData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
        combinedData
      )}`
    : "";

  const userMinistry = ministries.find(
    (m) =>
      m.id === workerProfile?.majorMinistryId ||
      m.id === workerProfile?.minorMinistryId
  );

  const refreshCodes = async () => {
    const targetId = workerProfile?.id || user?.uid || user?.email;
    if (!targetId) {
      toast({
        variant: "destructive",
        title: "Regeneration failed",
        description: "Worker profile could not be loaded. Please refresh the page.",
      });
      return;
    }
    setIsRegenerating(true);
    try {
      const newToken =
        Math.random().toString(36).slice(2) + Date.now().toString(36);

      await regenerateWorkerQrToken(targetId, newToken);

      setLocalToken(newToken);
      setIsConfirmRegenOpen(false);
      queryClient.invalidateQueries({ queryKey: ["worker"] });
      queryClient.invalidateQueries({ queryKey: ["worker-view-as"] });
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast({
        title: "QR Code regenerated",
        description: "Your identification token has been securely updated.",
      });
    } catch (e: any) {
      console.error("QR Regeneration failed:", e);
      toast({
        variant: "destructive",
        title: "Regeneration failed",
        description: e?.message || "Could not update your QR token. Please try again.",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!combinedQrUrl) return;
    try {
      const filename = `COG-Pass-${workerProfile?.workerId || "my-qr"}.png`;
      const response = await fetch(combinedQrUrl);
      const blob = await response.blob();
      await saveFileUniversal(blob, filename, "image/png");
      toast({
        title: "QR Code Downloaded",
        description: "Your digital pass QR code has been saved to your device.",
      });
    } catch {
      window.open(combinedQrUrl, "_blank");
    }
  };

  return (
    <AppLayout>
      <div className="w-full space-y-6 pb-12 print:pb-0 print:space-y-0">
        {/* Header Section (Room Reservations Style) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold font-headline tracking-tight text-gray-900 dark:text-white">
              My QR Code
            </h1>
            <p className="text-sm text-muted-foreground">
              Official digital identification pass for attendance logging, meal stub claims, and venue access.
            </p>
          </div>

          {/* Top Actions Controls */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 print:hidden w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-9 px-3.5 text-xs font-semibold rounded-xl border border-slate-200/90 dark:border-border bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted text-slate-700 dark:text-slate-200 shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
              <span>Print Pass</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="h-9 px-3.5 text-xs font-semibold rounded-xl border border-slate-200/90 dark:border-border bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted text-slate-700 dark:text-slate-200 shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
              <span>Download QR</span>
            </Button>
          </div>
        </div>

        {/* Main Card Container with Entrance Animation */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card-dark p-5 sm:p-6 md:p-8 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 print:border-none print:shadow-none print:p-0 print:bg-transparent print:m-0 print:overflow-visible">
          {/* Main Grid: Digital Pass & Credential Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start print:block print:w-full">
            {/* Left Column: Digital Pass Badge Card */}
            <div className="lg:col-span-6 flex justify-center w-full print:w-full print:max-w-none print:m-0 print:flex print:flex-col print:items-center">
              {/* Cutting Guide for Standard ID Sleeve */}
              <div className="hidden print:block text-center text-[9px] text-slate-400 font-mono mb-2">
                ✂ Cut along the outer border to fit standard ID lanyard holder / badge sleeve (88mm × 135mm)
              </div>

              <div className="print-badge-card w-full max-w-md bg-slate-50/70 dark:bg-muted/20 border border-slate-200/80 dark:border-border/80 rounded-2xl p-6 sm:p-7 text-center space-y-5 shadow-xs relative overflow-hidden print:bg-white print:border-2 print:border-slate-900 print:rounded-2xl print:p-6 print:space-y-4 print:shadow-none">
                {/* Decorative Subtle Accent Bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sidebar via-primary to-sidebar print:bg-slate-900" />

                {/* Identification Header */}
                <div className="space-y-1.5 pt-1">
                  <div className="bg-primary/10 dark:bg-primary/20 text-primary p-2.5 rounded-xl mx-auto w-fit border border-primary/20 shadow-xs flex items-center justify-center print:border-slate-300 print:text-slate-900 print:bg-slate-100 print:p-2">
                    <QrCode className="h-7 w-7 print:h-6 print:w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-headline font-bold text-gray-900 dark:text-white tracking-tight print:text-slate-900 print:text-lg">
                      COG App Identification
                    </h2>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5 print:text-slate-600 print:text-[9.5px]">
                      Church Operations & Governance
                    </p>
                  </div>
                </div>

                {/* QR Code Container */}
                <div className="flex justify-center">
                  {combinedQrUrl ? (
                    <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/90 dark:border-border inline-block overflow-hidden max-w-[270px] sm:max-w-[300px] w-full aspect-square print:p-2.5 print:max-w-[195px] print:rounded-xl print:border-slate-300 print:shadow-none">
                      <Image
                        key={activeToken}
                        src={combinedQrUrl}
                        alt="Unified Digital QR Pass"
                        width={300}
                        height={300}
                        unoptimized
                        className="rounded-lg w-full h-full object-contain print:rounded-none"
                      />
                    </div>
                  ) : (
                    <div className="h-60 w-60 flex items-center justify-center">
                      <RefreshCw className="h-9 w-9 animate-spin text-primary/40" />
                    </div>
                  )}
                </div>

                {/* User Profile Summary */}
                <div className="space-y-2 border-t border-slate-200/70 dark:border-border/60 pt-4 print:pt-3 print:space-y-1.5 print:border-slate-200">
                  <h3 className="text-lg font-bold font-headline text-gray-900 dark:text-white print:text-slate-900 print:text-base">
                    {workerProfile?.firstName || user?.name || "System"}{" "}
                    {workerProfile?.lastName || "User"}
                  </h3>
                  {/* Role Badge and Worker ID — hidden on print */}
                  <div className="flex items-center justify-center gap-2 flex-wrap print:hidden">
                    <Badge className="bg-sidebar text-white hover:bg-sidebar/90 text-[11px] font-semibold px-2.5 py-0.5 rounded-md capitalize">
                      {roleName}
                    </Badge>
                    {workerProfile?.workerId && (
                      <span className="text-xs font-mono text-muted-foreground bg-white dark:bg-card border border-slate-200/80 dark:border-border px-2 py-0.5 rounded-md shadow-2xs">
                        {String(workerProfile.workerId).replace(/^COG-?/i, "").padStart(6, "0")}
                      </span>
                    )}
                  </div>

                  {/* Ministry Name — hidden on print */}
                  {userMinistry?.name && (
                    <p className="text-[11px] text-muted-foreground font-semibold print:hidden">
                      {userMinistry.name}
                    </p>
                  )}

                  {/* Regenerate Button directly below role badge — hidden on print */}
                  <div className="pt-1.5 flex justify-center print:hidden">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setIsConfirmRegenOpen(true)}
                      disabled={isRegenerating}
                      className="h-8 px-4 text-xs font-semibold rounded-xl bg-sidebar hover:bg-sidebar/90 text-white shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    >
                      <RefreshCw
                        className={cn(
                          "h-3.5 w-3.5",
                          isRegenerating && "animate-spin"
                        )}
                      />
                      <span>Regenerate QR</span>
                    </Button>
                  </div>
                </div>

                {/* Authorized Ecosystem Pills — hidden on print */}
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold pt-1 print:hidden">
                  <div className="p-2.5 bg-white dark:bg-card rounded-xl border border-slate-200/80 dark:border-border/60 flex items-center justify-center gap-1.5 text-slate-700 dark:text-slate-300 shadow-2xs">
                    <span>📅</span> Attendance
                  </div>
                  <div className="p-2.5 bg-white dark:bg-card rounded-xl border border-slate-200/80 dark:border-border/60 flex items-center justify-center gap-1.5 text-slate-700 dark:text-slate-300 shadow-2xs">
                    <span>🍽️</span> Meal Stubs
                  </div>
                </div>

                {/* Print-Only Official Card Verification Footer */}
                <div className="hidden print:block pt-3 border-t border-slate-200 text-center space-y-0.5">
                  <p className="text-[8.5px] font-bold tracking-widest text-slate-800 uppercase">
                    Official Digital ID Pass
                  </p>
                  <p className="text-[7.5px] text-slate-500">
                    Church Operations &amp; Governance &bull; Non-Transferable &bull; Valid for System Verification
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Information Cards & Credentials */}
            <div className="lg:col-span-6 space-y-4 print:hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold font-headline text-foreground">
                    Credential Overview
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Your unique credentials and assignments recognized across the system.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0 -mt-0.5 shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Active Pass
                </span>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50/70 dark:bg-muted/30 p-4 rounded-xl border border-slate-200/70 dark:border-border/60 space-y-1 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                    <User className="h-3.5 w-3.5 text-primary" />
                    <span>Full Name</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {workerProfile?.firstName || user?.name || "System"}{" "}
                    {workerProfile?.lastName || "User"}
                  </p>
                </div>

                <div className="bg-slate-50/70 dark:bg-muted/30 p-4 rounded-xl border border-slate-200/70 dark:border-border/60 space-y-1 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    <span>Assigned Role</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {roleName}
                  </p>
                </div>

                <div className="bg-slate-50/70 dark:bg-muted/30 p-4 rounded-xl border border-slate-200/70 dark:border-border/60 space-y-1 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                    <Building className="h-3.5 w-3.5 text-primary" />
                    <span>Ministry / Department</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {userMinistry?.name || "Church Administration"}
                  </p>
                </div>

                <div className="bg-slate-50/70 dark:bg-muted/30 p-4 rounded-xl border border-slate-200/70 dark:border-border/60 space-y-1 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                    <Key className="h-3.5 w-3.5 text-primary" />
                    <span>Worker ID</span>
                  </div>
                  <p className="text-sm font-mono font-semibold text-foreground">
                    {workerProfile?.workerId
                      ? String(workerProfile.workerId).replace(/^COG-?/i, "").padStart(6, "0")
                      : (workerProfile?.biometricsId ? `W-${String(workerProfile.biometricsId).padStart(4, "0")}` : "Not Assigned")}
                  </p>
                </div>
              </div>

              {/* Info Callout Box (Room Reservations Style) */}
              <div className="bg-blue-50/60 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-200/70 dark:border-blue-900/40 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-1.5 text-blue-900 dark:text-blue-300 font-bold text-xs">
                  <Info className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>How to use your QR code</span>
                </div>
                <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-300/90">
                  Present this QR code on your mobile screen or printed pass when logging your attendance or claiming meal stubs.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-xs text-muted-foreground opacity-60 uppercase tracking-widest pt-2 font-semibold print:hidden">
          Property of Church Operations and Governance &bull; Official Digital Identification
        </div>
      </div>

      {/* Confirmation Dialog for Regenerating QR Code */}
      <Dialog open={isConfirmRegenOpen} onOpenChange={setIsConfirmRegenOpen}>
        <DialogContent className="max-w-sm rounded-2xl p-6 text-center shadow-card-dark border border-border/60">
          {/* Top Circular Badge Icon */}
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-2 bg-primary/10 text-primary border border-primary/20 shadow-2xs">
            <RefreshCw className={cn("h-6 w-6 text-primary", isRegenerating && "animate-spin")} />
          </div>

          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold text-center text-foreground font-headline">
              Regenerate QR Identification?
            </DialogTitle>
            <DialogDescription className="text-xs text-center text-muted-foreground mt-1 leading-relaxed">
              Regenerating your QR token will immediately invalidate your current QR code and any previously printed identification cards. You will need to use or print the new QR code.
            </DialogDescription>
          </DialogHeader>

          {/* Action Buttons */}
          <DialogFooter className="flex flex-row gap-2.5 sm:justify-center mt-5">
            <Button
              type="button"
              variant="outline"
              disabled={isRegenerating}
              className="flex-1 rounded-xl text-xs h-9 font-semibold cursor-pointer border-slate-200 dark:border-border hover:bg-slate-50 dark:hover:bg-muted text-foreground shadow-2xs"
              onClick={() => setIsConfirmRegenOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isRegenerating}
              className="flex-1 rounded-xl text-xs h-9 font-bold cursor-pointer bg-sidebar hover:bg-sidebar/90 text-white shadow-xs transition-all active:scale-[0.99] inline-flex items-center justify-center gap-1.5"
              onClick={refreshCodes}
            >
              {isRegenerating ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                "Yes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Stylesheet */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm 10mm;
          }
          html,
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide everything by default */
          body > * {
            display: none !important;
          }
          /* Show only the app layout and its main content */
          body > #__next,
          body > div {
            display: block !important;
          }
          /* Hide sidebar, header, nav, all chrome */
          .sidebar-container,
          [data-sidebar],
          [data-sidebar="sidebar"],
          aside,
          header,
          nav,
          footer,
          button,
          .print\\:hidden {
            display: none !important;
          }
          /* Make main take full width, centered */
          main {
            padding: 0 !important;
            margin: 0 auto !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: flex-start !important;
            width: 100% !important;
            max-width: 100% !important;
            background: transparent !important;
            min-height: 0 !important;
          }
          /* The outer page wrapper — make invisible container */
          .w-full.space-y-6 {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            padding: 0 !important;
            margin: 0 !important;
            gap: 0 !important;
            width: 100% !important;
          }
          /* The main card container — strip everything */
          .bg-card.rounded-2xl,
          .animate-in {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            animation: none !important;
            transform: none !important;
            width: 100% !important;
          }
          /* The grid — make it block so only left column shows */
          .grid.grid-cols-1 {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            width: 100% !important;
            gap: 0 !important;
          }
          /* Left column wrapper */
          .lg\\:col-span-6 {
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
          }
          /* The official ID Badge Card */
          .print-badge-card {
            width: 88mm !important;
            max-width: 88mm !important;
            margin: 4mm auto 0 auto !important;
            padding: 6mm 6mm 5mm 6mm !important;
            border: 2px solid #0f172a !important;
            border-radius: 4.5mm !important;
            background-color: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
        }
      `}</style>
    </AppLayout>
  );
}

