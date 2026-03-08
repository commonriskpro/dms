"use client";

import { cn } from "@/lib/utils";
import type { CustomerSummaryMetrics } from "@/modules/customers/service/customer";

export type CustomersSummaryCardsRowProps = CustomerSummaryMetrics & {
  className?: string;
};

function SummaryCard({
  label,
  value,
  subtitle,
  borderColor,
}: {
  label: string;
  value: number;
  subtitle?: string;
  borderColor: string;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]"
      style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]">
        {label}
      </p>
      <p className="mt-1.5 text-[32px] font-bold leading-none tabular-nums text-[var(--text)]">
        {value.toLocaleString()}
      </p>
      {subtitle && (
        <p className="mt-2 text-xs text-[var(--text-soft)]">{subtitle}</p>
      )}
    </section>
  );
}

export function CustomersSummaryCardsRow({
  totalCustomers,
  totalLeads,
  recentlyContacted,
  callbacksToday,
  soldCount,
  newThisWeek,
  className,
}: CustomersSummaryCardsRowProps) {
  return (
    <div
      className={cn(
        "grid gap-[var(--space-grid)] grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 items-stretch",
        className
      )}
      role="region"
      aria-label="Customers summary"
    >
      <SummaryCard
        label="Total Customers"
        value={totalCustomers}
        subtitle={newThisWeek > 0 ? `+${newThisWeek} this week` : undefined}
        borderColor="var(--accent)"
      />
      <SummaryCard
        label="New Leads"
        value={totalLeads}
        subtitle={newThisWeek > 0 ? `${newThisWeek} new this week` : undefined}
        borderColor="var(--accent-leads)"
      />
      <SummaryCard
        label="Recently Contacted"
        value={recentlyContacted}
        subtitle="Last 7 days"
        borderColor="var(--warning)"
      />
      <SummaryCard
        label="Appointments Today"
        value={callbacksToday}
        borderColor="var(--accent-deals)"
      />
      <SummaryCard
        label="Repeat"
        value={soldCount}
        subtitle="Returning customers"
        borderColor="var(--success)"
      />
    </div>
  );
}
