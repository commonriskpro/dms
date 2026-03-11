"use client";

import * as React from "react";
import { shadowTokens } from "@/lib/ui/tokens";

interface SheetContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: "left" | "right";
}

export function Sheet({ open, onOpenChange, children, side = "right" }: SheetProps) {
  React.useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <SheetContext.Provider value={{ open, onOpenChange }}>
      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/50"
            aria-hidden
            onClick={() => onOpenChange(false)}
          />
          <div
            className={`relative z-50 flex flex-col w-full max-w-sm bg-[var(--panel)] ${shadowTokens.popover} ${
              side === "right" ? "ml-auto rounded-l-xl" : "mr-auto rounded-r-xl"
            }`}
          >
            {children}
          </div>
        </div>
      )}
    </SheetContext.Provider>
  );
}

export function SheetHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col space-y-1.5 p-4 border-b border-[var(--border)] ${className}`}>{children}</div>;
}

export function SheetTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-[var(--text)]">{children}</h2>;
}

export function SheetContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex-1 overflow-y-auto p-4 ${className}`}>{children}</div>;
}
