"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const sizeMaxWidth = {
  md: "max-w-[720px]",
  lg: "max-w-[900px]",
  xl: "max-w-[1040px]",
} as const;

export type AppModalSize = "md" | "lg" | "xl";

export type AppModalCloseBehavior = "back" | "push" | "controlled";

export interface AppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: AppModalSize;
  closeBehavior?: AppModalCloseBehavior;
  onRequestClose?: () => void;
  /** Optional slot for header actions (left of close button) */
  headerActions?: React.ReactNode;
}

export function AppModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "xl",
  closeBehavior = "controlled",
  onRequestClose,
  headerActions,
}: AppModalProps) {
  const handleClose = React.useCallback(() => {
    if (closeBehavior === "back" || closeBehavior === "push") {
      onRequestClose?.();
    }
    onOpenChange(false);
  }, [closeBehavior, onRequestClose, onOpenChange]);

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) handleClose();
      else onOpenChange(true);
    },
    [handleClose, onOpenChange]
  );

  const contentClassName = cn(
    "relative z-50 flex flex-col w-full",
    sizeMaxWidth[size],
    "max-h-[85vh] h-[100dvh] sm:h-auto sm:max-h-[85vh]",
    "rounded-none sm:rounded-[var(--radius-card)]",
    "border-0 sm:border border-[var(--border)]",
    "bg-[var(--surface)] shadow-[var(--shadow-card-hover)]",
    "p-0 overflow-hidden"
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} contentClassName={contentClassName}>
      {/* Header strip */}
      <div className="flex flex-row items-center justify-between shrink-0 px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b border-[var(--border)]">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--text)] text-left leading-tight">
            {title}
          </h2>
          {description != null && (
            <p className="mt-0.5 text-sm text-[var(--muted-text)] text-left">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {headerActions}
          <button
            type="button"
            onClick={handleClose}
            className="h-8 w-8 rounded-[var(--radius-button)] flex items-center justify-center text-[var(--muted-text)] hover:bg-[var(--muted)] hover:text-[var(--text)] transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Body: scrollable */}
      <div className="flex-1 min-h-0 overflow-auto px-4 py-4 sm:px-6 sm:py-6">{children}</div>

      {/* Optional footer */}
      {footer != null && (
        <div className="shrink-0 px-4 py-3 sm:px-6 sm:py-4 border-t border-[var(--border)]">
          {footer}
        </div>
      )}
    </Dialog>
  );
}
