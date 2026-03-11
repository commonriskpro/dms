"use client";

import * as React from "react";
import { radiusTokens, shadowTokens } from "@/lib/ui/tokens";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export function Tooltip({ children, content, side = "top", className = "" }: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const positionClass =
    side === "top"
      ? "bottom-full left-1/2 -translate-x-1/2 mb-1"
      : side === "bottom"
        ? "top-full left-1/2 -translate-x-1/2 mt-1"
        : side === "left"
          ? "right-full top-1/2 -translate-y-1/2 mr-1"
          : "left-full top-1/2 -translate-y-1/2 ml-1";

  return (
    <div
      ref={wrapperRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <div
          role="tooltip"
          className={`absolute z-50 px-2 py-1 text-xs rounded ${radiusTokens.button} bg-[var(--text)] text-white ${shadowTokens.popover} ${positionClass}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
