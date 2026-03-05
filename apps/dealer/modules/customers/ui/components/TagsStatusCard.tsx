"use client";

import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { getStageLabel } from "@/lib/constants/crm-stages";
import type { CustomerDetail } from "@/lib/types/customers";

const stageBadgeClass = (status: string): string =>
  status === "SOLD"
    ? "bg-[var(--success)]/15 text-[var(--success)]"
    : status === "INACTIVE"
      ? "bg-[var(--danger)]/15 text-[var(--danger)]"
      : status === "ACTIVE"
        ? "bg-[var(--accent)]/15 text-[var(--accent)]"
        : "bg-[var(--muted)] text-[var(--text-soft)]";

export function TagsStatusCard({ customer }: { customer: CustomerDetail }) {
  return (
    <DMSCard>
      <DMSCardHeader>
        <DMSCardTitle>Status & tags</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className="space-y-3">
        <span className={`inline-block rounded px-2 py-0.5 text-sm font-medium ${stageBadgeClass(customer.status)}`}>
          {getStageLabel(customer.status)}
        </span>
        {customer.tags?.length ? (
          <div className="flex flex-wrap gap-1">
            {customer.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-[var(--muted)] px-2 py-0.5 text-xs text-[var(--text)]"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-soft)]">No tags</p>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
