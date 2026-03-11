"use client";

import {
  StatusBadge as SystemStatusBadge,
  type StatusBadgeVariant as SystemStatusBadgeVariant,
} from "@/components/ui-system/tables/StatusBadge";

export type StatusBadgeVariant = "info" | "success" | "warning" | "danger" | "neutral";

type StatusBadgeProps = {
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
    <SystemStatusBadge variant={variant as SystemStatusBadgeVariant} className={className}>
      {children}
    </SystemStatusBadge>
  );
}
