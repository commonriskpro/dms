"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "@/lib/ui/icons";
import { StatusBadge } from "@/components/ui-system/tables";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VehicleDetailTabId } from "./VehicleDetailTabs";

const STATUS_VARIANT: Record<string, "info" | "success" | "warning" | "danger" | "neutral"> = {
  AVAILABLE: "success",
  HOLD: "warning",
  SOLD: "neutral",
  WHOLESALE: "info",
  REPAIR: "warning",
  ARCHIVED: "danger",
};

const TABS: { id: VehicleDetailTabId; label: string }[] = [
  { id: "costs", label: "Overview" },
  { id: "overview", label: "Details" },
  { id: "media", label: "Media" },
  { id: "pricing", label: "Pricing" },
  { id: "recon", label: "Recon" },
  { id: "history", label: "History" },
];

export type VehiclePageHeaderProps = {
  vehicleId: string;
  title: string;
  vin: string | null;
  status: string | null;
  thumbnailUrl?: string | null;
  canWrite?: boolean;
  activeTab: VehicleDetailTabId;
  onTabChange: (tab: VehicleDetailTabId) => void;
  className?: string;
};

/**
 * Normalized vehicle page header for ALL tabs.
 * Back link, thumbnail, vehicle name, VIN, status chip,
 * actions (Print, Edit, Edit Vehicle), then tab row.
 */
export function VehiclePageHeader({
  vehicleId,
  title,
  vin,
  status,
  thumbnailUrl,
  canWrite = false,
  activeTab,
  onTabChange,
  className,
}: VehiclePageHeaderProps) {
  return (
    <header
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]",
        "px-4 py-4 sm:px-6 sm:py-5",
        "space-y-4",
        className
      )}
    >
      {/* Row: back + thumbnail + title/vin/status + actions */}
      <div className="flex flex-wrap items-start gap-3 sm:gap-4">
        <Link
          href="/inventory"
          className="flex items-center gap-1 text-sm font-medium text-[var(--text-soft)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-[var(--radius-button)] mt-0.5"
          aria-label="Back to inventory"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Back</span>
        </Link>

        <div
          className="h-12 w-16 sm:h-14 sm:w-20 shrink-0 rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden"
          aria-hidden
        >
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-xl font-semibold leading-tight text-[var(--text)] sm:text-2xl">
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted-text)]">
            {vin ? <span>VIN: {vin}</span> : null}
            {status ? (
              <StatusBadge variant={STATUS_VARIANT[status] ?? "neutral"}>
                {status}
              </StatusBadge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm" type="button" className="gap-1.5" aria-label="Print">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            </svg>
            Print
          </Button>
          {canWrite && (
            <>
              <Link href={`/inventory/${vehicleId}/edit`}>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit
                </Button>
              </Link>
              <Link href={`/inventory/${vehicleId}/edit`}>
                <Button size="sm">Edit Vehicle</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Tab row */}
      <nav className="flex flex-wrap items-center gap-0 border-t border-[var(--border)] pt-0 -mb-px" aria-label="Vehicle sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.id
                ? "text-[var(--accent)] border-[var(--accent)] font-semibold bg-[var(--surface-2)]/50"
                : "text-[var(--text-soft)] hover:text-[var(--text)] border-transparent hover:bg-[var(--surface-2)]"
            )}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            {tab.label}
          </button>
        ))}
        <span className="px-3 py-2.5 text-sm text-[var(--muted-text)]" aria-hidden>…</span>
      </nav>
    </header>
  );
}
