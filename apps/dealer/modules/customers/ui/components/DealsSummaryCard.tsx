"use client";

import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";

/** Placeholder: deals list for customer (future). */
export function DealsSummaryCard() {
  return (
    <DMSCard>
      <DMSCardHeader>
        <DMSCardTitle>Deals</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent>
        <p className="text-sm text-[var(--text-soft)]">No deals yet.</p>
      </DMSCardContent>
    </DMSCard>
  );
}
