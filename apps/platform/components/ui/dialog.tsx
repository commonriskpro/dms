"use client";

import * as React from "react";

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
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
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => onOpenChange(false)}
          />
          <div
            className="relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-lg p-4"
            onKeyDown={handleKeyDown}
          >
            {children}
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col space-y-1.5 mb-4">{children}</div>;
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold">{children}</h2>;
}

export function DialogDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--text-soft)]">{children}</p>;
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-[var(--border)]">
      {children}
    </div>
  );
}
