"use client";

import { SummaryCard } from "@/components/ui/summary-card";
import { summaryGrid3 } from "@/lib/ui/recipes/layout";
import { cn } from "@/lib/utils";

const CARD_ACCENT = "var(--accent-leads)";

export type CustomersSummaryCardsProps = {
  totalCustomers: number;
  activeLeads: number;
  creditApps: number;
  className?: string;
};

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
