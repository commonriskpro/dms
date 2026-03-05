"use client";

import { DMSCard, DMSCardContent } from "@/components/ui/dms-card";
import { cn } from "@/lib/utils";
import type { CustomerSummaryMetrics } from "@/modules/customers/service/customer";

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
    <DMSCard className="h-full transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]">
      <DMSCardContent className="pb-4 pt-4 px-4 flex flex-col">
        <div className="text-sm font-medium text-[var(--text-soft)] text-left">{label}</div>
        <div className="mt-2 text-[28px] font-bold leading-[1] text-[var(--text)]">
          {value.toLocaleString()}
        </div>
        <div className="mt-auto pt-3 flex justify-end">
          <div
            className="h-8 w-8 rounded-full shrink-0"
            style={{ background: accentVar }}
            aria-hidden
          />
        </div>
      </DMSCardContent>
    </DMSCard>
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
