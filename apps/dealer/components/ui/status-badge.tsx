"use client";

import { cn } from "@/lib/utils";
import { severityBadgeClasses, neutralBadge } from "@/lib/ui/tokens";

export type StatusBadgeVariant = "info" | "success" | "warning" | "danger" | "neutral";

const variantClasses: Record<StatusBadgeVariant, string> = {
  info: severityBadgeClasses.info,
  success: severityBadgeClasses.success,
  warning: severityBadgeClasses.warning,
  danger: severityBadgeClasses.danger,
  neutral: neutralBadge,
};

export type StatusBadgeProps = {
  variant: StatusBadgeVariant;
  children: React.ReactNode;
  className?: string;
};

/**
 * Shared status badge. Token-only (no Tailwind palette classes).
 * Map domain status to variant in the calling module.
 */
export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
