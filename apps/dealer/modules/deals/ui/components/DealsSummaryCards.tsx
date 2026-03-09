"use client";

import { SummaryCard } from "@/components/ui/summary-card";
import { summaryGrid } from "@/lib/ui/recipes/layout";
import { cn } from "@/lib/utils";

const CARD_ACCENT = "var(--accent-deals)";

export type DealsSummaryCardsProps = {
  openDeals: number;
  submitted: number;
  funded: number;
  contractsPending: number;
  className?: string;
};

export function DealsSummaryCards({
  openDeals,
  submitted,
  funded,
  contractsPending,
  className,
}: DealsSummaryCardsProps) {
  return (
    <div
      className={cn(summaryGrid, className)}
      role="region"
      aria-label="Deals summary"
    >
      <SummaryCard title="Open Deals" value={openDeals} href="/deals" accentColor={CARD_ACCENT} />
      <SummaryCard title="Submitted" value={submitted} href="/deals?status=STRUCTURED" accentColor={CARD_ACCENT} />
      <SummaryCard title="Funded" value={funded} href="/deals?status=CONTRACTED" accentColor={CARD_ACCENT} />
      <SummaryCard title="Contracts Pending" value={contractsPending} href="/deals?status=APPROVED" accentColor={CARD_ACCENT} />
    </div>
  );
}
