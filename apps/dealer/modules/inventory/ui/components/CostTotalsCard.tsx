"use client";

import * as React from "react";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { typography } from "@/lib/ui/tokens";
import { formatCents } from "@/lib/money";
import type { VehicleCostTotalsResponse } from "../types";

export type CostTotalsCardProps = {
  cost: VehicleCostTotalsResponse["data"] | null;
};

export function CostTotalsCard({ cost }: CostTotalsCardProps) {
  return (
    <DMSCard className="p-4">
      <DMSCardHeader className="flex flex-row items-center justify-between p-0 pb-3">
        <DMSCardTitle className={typography.cardTitle}>Cost Totals</DMSCardTitle>
        <button
          type="button"
          className="text-xs font-medium text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded"
          aria-label="View cost breakdown"
        >
          View breakdown
        </button>
      </DMSCardHeader>
      <DMSCardContent className="p-0">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-[var(--muted-text)] mb-0.5">Acquisition</dt>
            <dd className="text-base font-semibold text-[var(--text)] tabular-nums leading-tight">
              {cost ? formatCents(cost.acquisitionSubtotalCents) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted-text)] mb-0.5">Recon</dt>
            <dd className="text-base font-semibold text-[var(--text)] tabular-nums leading-tight">
              {cost ? formatCents(cost.reconSubtotalCents) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted-text)] mb-0.5">Fees</dt>
            <dd className="text-base font-semibold text-[var(--text)] tabular-nums leading-tight">
              {cost ? formatCents(cost.feesSubtotalCents) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted-text)] mb-0.5">Total Invested</dt>
            <dd className="text-lg font-bold text-[var(--accent)] tabular-nums leading-tight">
              {cost ? formatCents(cost.totalInvestedCents) : "—"}
            </dd>
          </div>
        </dl>
      </DMSCardContent>
    </DMSCard>
  );
}
