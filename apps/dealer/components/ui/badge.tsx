"use client";

import * as React from "react";
import { severityBadgeClasses, neutralBadge, radiusTokens } from "@/lib/ui/tokens";

type BadgeVariant = "default" | "secondary" | "info" | "success" | "warning" | "danger" | "outline";

const variantClasses: Record<BadgeVariant, string> = {
  default: `bg-[var(--accent)] text-white`,
  secondary: neutralBadge,
  info: severityBadgeClasses.info,
  success: severityBadgeClasses.success,
  warning: severityBadgeClasses.warning,
  danger: severityBadgeClasses.danger,
  outline: "border border-[var(--border)] bg-transparent text-[var(--text)]",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = "", variant = "secondary", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`inline-flex items-center justify-center font-medium ${radiusTokens.button} px-2 py-0.5 text-xs whitespace-nowrap ${variantClasses[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";
