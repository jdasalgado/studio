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
} from "@studio/ui";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Copy,
  Check,
} from "lucide-react";
import { useSubmissionModalStore } from "@/hooks/use-submission-modal";
import { cn } from "@/lib/utils";

export function SubmissionConfirmationModal() {
  const { isOpen, options, closeModal } = useSubmissionModalStore();
  const [copied, setCopied] = useState(false);

  // Reset copied state whenever modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  const handleCopyReference = (refId: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(refId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConfirm = () => {
    if (options.onConfirm) {
      options.onConfirm();
    }
    closeModal();
  };

  const handleSecondary = () => {
    if (options.onSecondary) {
      options.onSecondary();
    }
    closeModal();
  };

  const isSuccess = options.type === "success" || !options.type;
  const isError = options.type === "error";
  const isWarning = options.type === "warning";
  const isInfo = options.type === "info";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent
        className={cn(
          "sm:max-w-md p-6 rounded-3xl border shadow-2xl overflow-hidden gap-0",
          "bg-white dark:bg-card border-border/80"
        )}
      >
        <DialogHeader className="flex flex-col items-center text-center space-y-4 pt-2 pb-2">
          {/* Status Icon Badge */}
          <div className="relative flex items-center justify-center">
            {isSuccess && (
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm animate-in zoom-in-75 duration-200">
                <CheckCircle2 className="h-8 w-8 stroke-[2.5]" />
              </div>
            )}
            {isError && (
              <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-sm animate-in zoom-in-75 duration-200">
                <XCircle className="h-8 w-8 stroke-[2.5]" />
              </div>
            )}
            {isWarning && (
              <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-sm animate-in zoom-in-75 duration-200">
                <AlertTriangle className="h-8 w-8 stroke-[2.5]" />
              </div>
            )}
            {isInfo && (
              <div className="w-16 h-16 rounded-3xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-sm animate-in zoom-in-75 duration-200">
                <Info className="h-8 w-8 stroke-[2.5]" />
              </div>
            )}
          </div>

          {/* Reference ID Pill if provided */}
          {options.referenceId && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-muted text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-border font-mono">
              <span className="text-muted-foreground font-sans font-normal">Reference:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {options.referenceId}
              </span>
              <button
                type="button"
                onClick={() => handleCopyReference(options.referenceId!)}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded cursor-pointer"
                title="Copy Reference ID"
                aria-label="Copy Reference ID"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )}

          {/* Title & Description */}
          <div className="space-y-1.5 w-full">
            <DialogTitle className="text-xl sm:text-2xl font-bold font-headline text-center text-foreground tracking-tight">
              {options.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-center text-muted-foreground leading-relaxed">
              {options.description}
            </DialogDescription>
          </div>

          {/* Key-Value Details (optional) */}
          {options.details && options.details.length > 0 && (
            <div className="w-full bg-slate-50 dark:bg-muted/40 rounded-2xl border border-border/60 p-3.5 space-y-2 text-left mt-2 text-xs">
              {options.details.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground font-medium">{item.label}</span>
                  <span className="font-semibold text-foreground text-right">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* Action Buttons */}
        <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-2">
          {options.secondaryText && (
            <Button
              type="button"
              variant="outline"
              onClick={handleSecondary}
              className="w-full sm:flex-1 h-11 rounded-xl text-sm font-semibold border-border/80 hover:bg-muted/50 cursor-pointer"
            >
              {options.secondaryText}
            </Button>
          )}
          <Button
            type="button"
            onClick={handleConfirm}
            className={cn(
              "w-full sm:flex-1 h-11 rounded-xl text-sm font-bold shadow-none cursor-pointer transition-all",
              isSuccess && "bg-emerald-600 hover:bg-emerald-700 text-white",
              isError && "bg-rose-600 hover:bg-rose-700 text-white",
              isWarning && "bg-amber-600 hover:bg-amber-700 text-white",
              isInfo && "bg-primary hover:bg-primary/90 text-white"
            )}
          >
            {options.confirmText || "OK"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

