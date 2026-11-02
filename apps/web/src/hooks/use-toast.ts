"use client";

import { useToast as useUiToast, toast as uiToast } from "@studio/ui";
import {
  showSubmissionModal,
  closeSubmissionModal,
  useSubmissionModalStore,
} from "./use-submission-modal";

// Global tracker for recent form submissions to ensure "sa lahat ng submit button" is covered
let lastSubmitTime = 0;

if (typeof window !== "undefined") {
  window.addEventListener(
    "submit",
    () => {
      lastSubmitTime = Date.now();
    },
    true
  );

  window.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest("button[type='submit']") ||
        target?.closest("input[type='submit']") ||
        target?.closest("[data-submit='true']") ||
        target?.closest("button")?.textContent?.toLowerCase().includes("submit")
      ) {
        lastSubmitTime = Date.now();
      }
    },
    true
  );
}

function shouldTriggerModal(props: any): boolean {
  if (props?.isModal === true || props?.isSubmission === true) return true;
  if (props?.isModal === false) return false;

  const now = Date.now();
  const recentlySubmitted = now - lastSubmitTime < 8000;

  const titleStr = typeof props?.title === "string" ? props.title.toLowerCase() : "";
  const descStr = typeof props?.description === "string" ? props.description.toLowerCase() : "";
  const combined = `${titleStr} ${descStr}`;

  // Check for submission keywords
  const hasSubmitKeywords =
    /submitted|submission|request sent|booking created|reservation|worker registered|devotion.*recorded|devotion.*submitted|inquiry.*sent|saved successfully|record submitted|profile updated|changes saved/i.test(
      combined
    );

  const hasFailureKeywords =
    props?.variant === "destructive" &&
    /failed|error|rejected|not allowed|exceeded|already reserved|already booked|invalid|cannot|missing/i.test(
      combined
    );

  // If a submit button was clicked recently, any outcome triggers the confirmation modal
  if (recentlySubmitted && (hasSubmitKeywords || hasFailureKeywords || props?.variant === "destructive")) {
    return true;
  }

  return hasSubmitKeywords;
}

export function toast(props: any) {
  // If the submission modal is already open, do not show duplicate floating toast banner
  if (useSubmissionModalStore.getState().isOpen) {
    return {
      id: "suppressed-toast",
      dismiss: () => {},
      update: () => {},
    };
  }

  // If this action triggers the modal, show ONLY the modal (suppress floating toast banner to prevent duplicate)
  if (shouldTriggerModal(props)) {
    const isError = props?.variant === "destructive";
    showSubmissionModal({
      type: isError ? "error" : "success",
      title:
        typeof props?.title === "string"
          ? props.title
          : isError
          ? "Submission Failed"
          : "Submission Successful",
      description:
        typeof props?.description === "string"
          ? props.description
          : isError
          ? "An error occurred during submission. Please try again."
          : "Your request has been submitted successfully.",
      confirmText: isError ? "Dismiss" : "OK",
    });

    return {
      id: "submission-modal",
      dismiss: () => closeSubmissionModal(),
      update: () => {},
    };
  }

  // Otherwise, display standard floating toast
  return uiToast(props);
}

export function useToast() {
  const ui = useUiToast();
  return {
    ...ui,
    toast,
  };
}
