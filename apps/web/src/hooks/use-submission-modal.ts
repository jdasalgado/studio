"use client";

import { create } from "zustand";

export type SubmissionModalType = "success" | "error" | "warning" | "info";

export interface SubmissionModalDetail {
  label: string;
  value: string;
}

export interface SubmissionModalOptions {
  type?: SubmissionModalType;
  title: string;
  description: string;
  referenceId?: string;
  details?: SubmissionModalDetail[];
  confirmText?: string;
  onConfirm?: () => void;
  secondaryText?: string;
  onSecondary?: () => void;
}

interface SubmissionModalState {
  isOpen: boolean;
  options: SubmissionModalOptions;
  openModal: (options: SubmissionModalOptions) => void;
  closeModal: () => void;
}

const defaultOptions: SubmissionModalOptions = {
  type: "success",
  title: "Request Submitted",
  description: "Your request has been submitted successfully.",
  confirmText: "OK",
};

export const useSubmissionModalStore = create<SubmissionModalState>((set) => ({
  isOpen: false,
  options: defaultOptions,
  openModal: (options: SubmissionModalOptions) =>
    set({
      isOpen: true,
      options: {
        ...defaultOptions,
        ...options,
        type: options.type || "success",
      },
    }),
  closeModal: () => set({ isOpen: false }),
}));

/**
 * Programmatic helpers callable anywhere in client components
 */
export function showSubmissionModal(options: SubmissionModalOptions) {
  useSubmissionModalStore.getState().openModal(options);
}

export function showSubmitSuccess(
  options: Omit<SubmissionModalOptions, "type">
) {
  showSubmissionModal({
    type: "success",
    confirmText: options.confirmText || "OK",
    ...options,
  });
}

export function showSubmitError(
  options: Omit<SubmissionModalOptions, "type">
) {
  showSubmissionModal({
    type: "error",
    confirmText: options.confirmText || "Dismiss",
    ...options,
  });
}

export function closeSubmissionModal() {
  useSubmissionModalStore.getState().closeModal();
}

export function useSubmissionModal() {
  const store = useSubmissionModalStore();
  return {
    isOpen: store.isOpen,
    options: store.options,
    showModal: store.openModal,
    showSuccess: showSubmitSuccess,
    showError: showSubmitError,
    closeModal: store.closeModal,
  };
}

