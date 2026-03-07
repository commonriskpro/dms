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

export function CustomerOverviewCard({ customer }: { customer: CustomerDetail }) {
  const primaryPhone = customer.phones?.find((p) => p.isPrimary) ?? customer.phones?.[0];
  const primaryEmail = customer.emails?.find((e) => e.isPrimary) ?? customer.emails?.[0];

  return (
    <DMSCard>
      <DMSCardHeader>
        <DMSCardTitle>{customer.name}</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${stageBadgeClass(customer.status)}`}>
            {getStageLabel(customer.status)}
          </span>
          {customer.leadSource || customer.leadCampaign || customer.leadMedium ? (
            <span className="text-sm text-[var(--text-soft)]">
              Lead: {[customer.leadSource, customer.leadCampaign, customer.leadMedium].filter(Boolean).join(" / ") || "—"}
            </span>
          ) : null}
        </div>
        {customer.phones?.length ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-[var(--text-soft)]">Phone</p>
            {customer.phones.map((p) => (
              <a
                key={p.id}
                href={`tel:${p.value.replace(/\D/g, "")}`}
                className="block text-sm text-[var(--accent)] hover:underline"
              >
                {p.value}
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-soft)]">—</p>
        )}
        {customer.emails?.length ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-[var(--text-soft)]">Email</p>
            <a
              href={`mailto:${primaryEmail?.value ?? customer.emails[0].value}`}
              className="block text-sm text-[var(--accent)] hover:underline"
            >
              {primaryEmail?.value ?? customer.emails[0].value}
            </a>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-soft)]">—</p>
        )}
        <p className="text-xs text-[var(--text-soft)]">
          Last activity: {customer.updatedAt ? new Date(customer.updatedAt).toLocaleString() : "—"}
        </p>
      </DMSCardContent>
    </DMSCard>
  );
}
