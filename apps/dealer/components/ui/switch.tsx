"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className = "", checked = false, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "inline-flex items-center h-6 w-11 shrink-0 rounded-full border border-[var(--border)] transition-colors duration-150 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          checked
            ? "bg-[var(--accent)] border-[var(--accent)]"
            : "bg-[var(--muted)]",
          className
        )}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-[margin] duration-150",
            checked ? "ml-auto mr-0.5" : "ml-0.5 mr-auto"
          )}
        />
      </button>
    );
  }
);
Switch.displayName = "Switch";
