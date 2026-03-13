"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { X } from "@/lib/ui/icons";

const sizeMaxWidth = {
  md: "max-w-[720px]",
  lg: "max-w-[900px]",
  xl: "max-w-[1040px]",
  "2xl": "max-w-[1200px]",
  "3xl": "max-w-[1400px]",
  "4xl": "max-w-[1680px]",
} as const;

type AppModalSize = "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

type AppModalCloseBehavior = "back" | "push" | "controlled";

interface AppModalProps {
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
  /** When true, the header strip (title + close) is not rendered. Close via Escape or back. */
  hideHeader?: boolean;
  /** When true, body padding is removed so the child owns the full surface. */
  flushBody?: boolean;
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
  hideHeader = false,
  flushBody = false,
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
    "relative z-50 flex flex-col w-[calc(100vw-8px)] sm:w-[calc(100vw-16px)] lg:w-[calc(100vw-24px)]",
    sizeMaxWidth[size],
    "max-h-[92vh] h-[100dvh] sm:h-auto sm:max-h-[92vh]",
    "rounded-none sm:rounded-[var(--radius-card)]",
    "border-0 sm:border border-[var(--border)]",
    "bg-[linear-gradient(180deg,rgba(8,24,54,0.985),rgba(6,18,40,0.985))] shadow-[0_28px_90px_rgba(2,8,23,0.52)]",
    "p-0 overflow-hidden"
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} contentClassName={contentClassName}>
      {!hideHeader && (
        <div className="flex flex-row items-center justify-between shrink-0 gap-4 border-b border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4">
          <div className={typeof title === "string" ? "min-w-0" : "min-w-0 flex-1"}>
            {typeof title === "string" ? (
              <>
                <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--text)] text-left leading-tight sm:text-[1.6rem]">
                  {title}
                </h2>
                {description != null && (
                  <p className="mt-1 text-sm text-[var(--muted-text)] text-left">{description}</p>
                )}
              </>
            ) : (
              title
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {headerActions}
            <button
              type="button"
              onClick={handleClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--muted-text)] transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--text)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0"
              aria-label="Close"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {hideHeader && (
        <div className="pointer-events-none absolute right-4 top-4 z-10">
          <button
            type="button"
            onClick={handleClose}
            className="pointer-events-auto h-9 w-9 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] flex items-center justify-center text-[var(--muted-text)] backdrop-blur transition-colors hover:bg-[var(--muted)] hover:text-[var(--text)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0"
            aria-label="Close"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      )}

      {/* Body: scrollable; 2xl/3xl use tighter padding for density */}
      <div
        className={cn(
          "flex-1 min-h-0 overflow-auto",
          flushBody
            ? "px-0 py-0"
            : size === "2xl" || size === "3xl" || size === "4xl"
              ? "px-4 py-3 sm:px-6 sm:py-5"
              : "px-4 py-4 sm:px-6 sm:py-6"
        )}
      >
        {children}
      </div>

      {/* Optional footer */}
      {footer != null && (
        <div className="shrink-0 px-4 py-3 sm:px-6 sm:py-4 border-t border-[var(--border)]">
          {footer}
        </div>
      )}
    </Dialog>
  );
}
