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
  { id: "overview", label: "Details" },
  { id: "costs", label: "Cost" },
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
        "flex items-end gap-1",
        className
      )}
      aria-label="Vehicle detail sections"
    >
      {TABS.map(({ id, label }) => {
        const isActive = activeTab === id;
        const isCostsLink = id === "costs" && costsFullPageHref;
        const base = "relative px-3 pb-2.5 pt-1 text-sm font-medium transition-colors";
        const activeClass = "text-[var(--accent)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[var(--accent)] after:rounded-full";
        const inactiveClass = "text-[var(--text-soft)] hover:text-[var(--text)]";

        if (isCostsLink) {
          return (
            <Link
              key={id}
              href={costsFullPageHref}
              className={cn(base, inactiveClass)}
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
            className={cn(base, isActive ? activeClass : inactiveClass)}
            aria-current={isActive ? "page" : undefined}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
