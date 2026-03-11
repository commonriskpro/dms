"use client";

import * as React from "react";

interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  /** Optional alignment: "start" | "center" | "end" relative to trigger. */
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * Minimal popover: trigger opens/closes content. Click outside or Escape closes.
 * Content is positioned below the trigger. Accessible: focus trap not included;
 * use for simple menus where trigger refocus is sufficient.
 */
export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  align = "start",
  className = "",
}: PopoverProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      const el = containerRef.current;
      if (el && !el.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, onOpenChange]);

  const alignClass =
    align === "end"
      ? "right-0"
      : align === "center"
        ? "left-1/2 -translate-x-1/2"
        : "left-0";

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {trigger}
      {open && (
        <div
          ref={contentRef}
          role="dialog"
          aria-label="Stage options"
          className={`absolute top-full z-50 mt-1 min-w-[160px] rounded-md border border-[var(--border)] bg-[var(--panel)] py-1 shadow-lg ${alignClass}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
