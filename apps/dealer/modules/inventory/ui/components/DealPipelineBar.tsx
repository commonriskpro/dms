"use client";

import Link from "next/link";
import type { DealPipelineStages } from "@/modules/deals/service/deal-pipeline";
import { cn } from "@/lib/utils";

export type DealPipelineBarProps = {
  pipeline: DealPipelineStages;
  className?: string;
};

const STAGES: { key: keyof DealPipelineStages; label: string; href: string }[] = [
  { key: "leads", label: "Leads", href: "/customers?status=LEAD" },
  { key: "appointments", label: "Appointments", href: "/deals" },
  { key: "workingDeals", label: "Working Deals", href: "/deals?status=DRAFT" },
  { key: "pendingFunding", label: "Pending Funding", href: "/deals?status=APPROVED" },
  { key: "soldToday", label: "Sold Today", href: "/deals?status=CONTRACTED" },
];

export function DealPipelineBar({ pipeline, className }: DealPipelineBarProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]",
        className
      )}
      role="region"
      aria-label="Deal pipeline"
    >
      <div className="text-left text-sm font-bold text-[var(--text)]">Deal Pipeline</div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:gap-x-3">
        {STAGES.map((stage, i) => (
          <span key={stage.key} className="inline-flex flex-wrap items-baseline gap-x-1">
            <span className="text-sm font-medium text-[var(--muted-text)]">{stage.label}</span>
            <Link
              href={stage.href}
              className="text-base font-semibold tabular-nums text-[var(--text)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 rounded"
              aria-label={`${stage.label}: ${pipeline[stage.key]} — view list`}
            >
              {pipeline[stage.key].toLocaleString()}
            </Link>
            {i < STAGES.length - 1 && (
              <span className="shrink-0 text-[var(--muted-text)]/70" aria-hidden>
                →
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
