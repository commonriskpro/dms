"use client";

import Link from "next/link";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export type AlertRow = {
  id: string;
  label: string;
  count?: number;
  href: string;
};

export type InventoryAlertsCardProps = {
  alerts?: AlertRow[];
  className?: string;
};

const DEFAULT_ALERTS: AlertRow[] = [
  { id: "missing-photos", label: "Missing Photos", count: 0, href: "/inventory" },
  { id: "units-90", label: "Units > 90 days", count: 0, href: "/inventory/aging" },
  { id: "units-recon", label: "Units Need Recon", count: 0, href: "/inventory" },
];

export function InventoryAlertsCard({ alerts = DEFAULT_ALERTS, className }: InventoryAlertsCardProps) {
  return (
    <DMSCard className={cn("transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]", className)}>
      <DMSCardHeader className="gap-2 mb-0">
        <DMSCardTitle>Alerts</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className="pt-0">
        <ul className="space-y-1" role="list">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <Link
                href={alert.href}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-input)] px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <span>{alert.label}</span>
                {alert.count != null && alert.count > 0 && (
                  <StatusBadge variant="warning">{alert.count}</StatusBadge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </DMSCardContent>
    </DMSCard>
  );
}
