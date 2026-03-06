"use client";

import Link from "next/link";
import { DMSCard, DMSCardContent } from "@/components/ui/dms-card";
import { summaryGrid3 } from "@/lib/ui/recipes/layout";
import { cn } from "@/lib/utils";

const CARD_ACCENT = "var(--accent-leads)";

export type CustomersSummaryCardsProps = {
  totalCustomers: number;
  activeLeads: number;
  creditApps: number;
  className?: string;
};

function SummaryCard({
  title,
  value,
  href,
  accentColor,
  className,
}: {
  title: string;
  value: number | string;
  href: string;
  accentColor?: string;
  className?: string;
}) {
  const pct = typeof value === "number" ? Math.min(100, Math.max(0, (value / 200) * 100)) || 0 : 0;
  return (
    <Link
      href={href}
      className={cn("block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]", className)}
    >
      <DMSCard className="h-full transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]">
        <DMSCardContent className="pb-4 pt-1">
          <div className="text-sm font-semibold text-[var(--text)] text-left">{title}</div>
          <div className="mt-2 text-[28px] font-bold leading-[1] text-[var(--text)]">
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          <div className="mt-2 h-[6px] w-full rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: accentColor ?? CARD_ACCENT }}
              aria-hidden
            />
          </div>
        </DMSCardContent>
      </DMSCard>
    </Link>
  );
}

export function CustomersSummaryCards({
  totalCustomers,
  activeLeads,
  creditApps,
  className,
}: CustomersSummaryCardsProps) {
  return (
    <div
      className={cn(summaryGrid3, className)}
      role="region"
      aria-label="Customers summary"
    >
      <SummaryCard title="Total Customers" value={totalCustomers} href="/customers" accentColor={CARD_ACCENT} />
      <SummaryCard title="Active Leads" value={activeLeads} href="/customers?status=LEAD" accentColor={CARD_ACCENT} />
      <SummaryCard title="Credit Apps" value={creditApps} href="/customers" accentColor={CARD_ACCENT} />
    </div>
  );
}
