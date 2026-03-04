"use client";

import * as React from "react";
import { radiusTokens, shadowTokens } from "@/lib/ui/tokens";

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}

export function DropdownMenu({
  trigger,
  children,
  align = "start",
  className = "",
}: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      const el = containerRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const alignClass =
    align === "end" ? "right-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "left-0";

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {React.isValidElement(trigger)
        ? React.cloneElement(trigger as React.ReactElement<{ onClick?: () => void }>, {
            onClick: () => setOpen((o) => !o),
          })
        : <span onClick={() => setOpen((o) => !o)}>{trigger}</span>}
      {open && (
        <div
          role="menu"
          className={`absolute top-full z-50 mt-1 min-w-[160px] ${radiusTokens.button} border border-[var(--border)] bg-[var(--panel)] py-1 ${shadowTokens.popover} ${alignClass}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export interface DropdownMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function DropdownMenuItem({
  children,
  onClick,
  disabled,
  className = "",
}: DropdownMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--muted)] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
