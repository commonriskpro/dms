"use client";

import * as React from "react";

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

const defaultContentClass =
  "relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[24px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(8,24,54,0.985),rgba(6,18,40,0.985))] shadow-[0_28px_90px_rgba(2,8,23,0.52)] p-4";

export function Dialog({
  open,
  onOpenChange,
  children,
  contentClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    },
    [onOpenChange]
  );
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:px-2 sm:py-3 lg:px-3"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => onOpenChange(false)}
          />
          <div
            className={contentClassName ?? defaultContentClass}
            onKeyDown={handleKeyDown}
          >
            {children}
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function DialogContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function DialogHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? "flex flex-col space-y-1.5 mb-4"}>
      {children}
    </div>
  );
}

export function DialogTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={className ?? "text-lg font-semibold text-left"}>
      {children}
    </h2>
  );
}

export function DialogDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--text-soft)]">{children}</p>;
}

export function DialogFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        className ?? "flex justify-end gap-2 mt-4 pt-4 border-t border-[var(--border)]"
      }
    >
      {children}
    </div>
  );
}

export function DialogClose({ children, className }: { children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(DialogContext);
  if (!ctx) return null;
  return (
    <button type="button" className={className} onClick={() => ctx.onOpenChange(false)}>
      {children}
    </button>
  );
}
