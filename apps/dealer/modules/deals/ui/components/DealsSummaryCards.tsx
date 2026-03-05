"use client";

import Link from "next/link";
import { DMSCard, DMSCardContent } from "@/components/ui/dms-card";
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
