"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type VehicleDetailTabId =
  | "overview"
  | "media"
  | "pricing"
  | "recon"
  | "costs"
  | "history";

const TABS: { id: VehicleDetailTabId; label: string }[] = [
  { id: "costs", label: "Overview" },
  { id: "overview", label: "Details" },
  { id: "media", label: "Media" },
  { id: "pricing", label: "Pricing" },
  { id: "recon", label: "Recon" },
  { id: "history", label: "History" },
];

export type VehicleDetailTabsProps = {
  activeTab: VehicleDetailTabId;
  onTabChange: (tab: VehicleDetailTabId) => void;
  /** When set, the Costs tab renders as a link to this URL (full-page costs view). */
  costsFullPageHref?: string | null;
  className?: string;
};

export function VehicleDetailTabs({
  activeTab,
  onTabChange,
  costsFullPageHref,
  className,
}: VehicleDetailTabsProps) {
  return (
    <nav
      className={cn(
        "flex flex-wrap items-center gap-1 border-b border-[var(--border)] pb-0",
        className
      )}
      aria-label="Vehicle detail sections"
    >
      {TABS.map(({ id, label }) => {
        const isCostsLink = id === "costs" && costsFullPageHref;
        if (isCostsLink) {
          return (
            <Link
              key={id}
              href={costsFullPageHref}
              className={cn(
                "relative px-3 py-2.5 text-sm font-medium transition-colors rounded-t-[var(--radius-card)] -mb-px",
                "text-[var(--text-soft)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
              )}
            >
              {label}
            </Link>
          );
        }
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={cn(
              "relative px-3 py-2.5 text-sm font-medium transition-colors rounded-t-[var(--radius-card)] -mb-px",
              activeTab === id
                ? "text-[var(--accent)] bg-[var(--surface)] border border-[var(--border)] border-b-transparent"
                : "text-[var(--text-soft)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
            )}
            aria-current={activeTab === id ? "page" : undefined}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
