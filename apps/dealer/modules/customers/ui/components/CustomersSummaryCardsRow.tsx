"use client";

import { widgetTokens } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";
import type { CustomerSummaryMetrics } from "@/modules/customers/service/customer";

const cardLabelClass = "text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]";

export type CustomersSummaryCardsRowProps = CustomerSummaryMetrics & {
  className?: string;
};

const cardConfig: {
  key: keyof CustomerSummaryMetrics;
  label: string;
  accentVar: string;
}[] = [
  { key: "totalCustomers", label: "Customers", accentVar: "var(--accent)" },
  { key: "totalLeads", label: "Leads", accentVar: "var(--accent-leads)" },
  { key: "activeCustomers", label: "Active Customers", accentVar: "var(--warning-muted)" },
  { key: "activeCount", label: "Active", accentVar: "var(--warning-muted)" },
  { key: "inactiveCustomers", label: "Inactive Customers", accentVar: "var(--surface-2)" },
];

function SummaryCard({
  label,
  value,
  accentVar,
}: {
  label: string;
  value: number;
  accentVar: string;
}) {
  return (
    <section className={cn(widgetTokens.widget, "h-full flex flex-col")}>
      <div className="space-y-2.5 flex-1">
        <p className={cardLabelClass}>{label}</p>
        <div className="tabular-nums font-bold text-[40px] leading-none text-[var(--text)]">
          {value.toLocaleString()}
        </div>
      </div>
      <div className="mt-auto pt-3 flex justify-end">
        <div
          className="h-8 w-8 rounded-full shrink-0"
          style={{ background: accentVar }}
          aria-hidden
        />
      </div>
    </section>
  );
}

export function CustomersSummaryCardsRow({
  totalCustomers,
  totalLeads,
  activeCustomers,
  activeCount,
  inactiveCustomers,
  className,
}: CustomersSummaryCardsRowProps) {
  const values = {
    totalCustomers,
    totalLeads,
    activeCustomers,
    activeCount,
    inactiveCustomers,
  };
  return (
    <div
      className={cn(
        "grid gap-[var(--space-grid)] grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 items-stretch",
        className
      )}
      role="region"
      aria-label="Customers summary"
    >
      {cardConfig.map(({ key, label, accentVar }) => (
        <SummaryCard
          key={key}
          label={label}
          value={values[key]}
          accentVar={accentVar}
        />
      ))}
    </div>
  );
}
