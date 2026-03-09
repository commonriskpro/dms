import * as React from "react";
import { cn } from "@/lib/utils";
import { severityBadgeClasses, neutralBadge } from "@/lib/ui/tokens";

export type StatusBadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

const variantClasses: Record<StatusBadgeVariant, string> = {
  info: severityBadgeClasses.info,
  success: severityBadgeClasses.success,
  warning: severityBadgeClasses.warning,
  danger: severityBadgeClasses.danger,
  neutral: neutralBadge,
};

export function StatusBadge({
  variant,
  children,
  className,
}: {
  variant: StatusBadgeVariant;
  children: React.ReactNode;
  className?: string;
}) {
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
