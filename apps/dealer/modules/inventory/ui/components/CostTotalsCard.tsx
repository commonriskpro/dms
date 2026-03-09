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
    <DMSCard className="p-0 overflow-hidden">
      <DMSCardHeader className="flex flex-row items-center justify-between px-5 pt-4 pb-3">
        <DMSCardTitle className={typography.cardTitle}>Cost Totals</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className="p-0">
        <dl className="flex border-t border-[var(--border)]">
          <div className="flex-1 px-5 py-4">
            <dt className="text-xs text-[var(--muted-text)] mb-1">Acquisition</dt>
            <dd className="text-xl font-bold text-[var(--text)] tabular-nums leading-tight">
              {cost ? formatCents(cost.acquisitionSubtotalCents) : "—"}
            </dd>
          </div>
          <span className="my-2 divider-fade" aria-hidden />
          <div className="flex-1 px-5 py-4">
            <dt className="text-xs text-[var(--muted-text)] mb-1">Recon</dt>
            <dd className="text-xl font-bold text-[var(--text)] tabular-nums leading-tight">
              {cost ? formatCents(cost.reconSubtotalCents) : "—"}
            </dd>
          </div>
          <span className="my-2 divider-fade" aria-hidden />
          <div className="flex-1 px-5 py-4">
            <dt className="text-xs text-[var(--muted-text)] mb-1">Fees</dt>
            <dd className="text-xl font-bold text-[var(--text)] tabular-nums leading-tight">
              {cost ? formatCents(cost.feesSubtotalCents) : "—"}
            </dd>
          </div>
          <span className="my-2 divider-fade" aria-hidden />
          <div className="flex-1 px-5 py-4">
            <dt className="text-xs text-[var(--muted-text)] mb-1">Total Invested</dt>
            <dd className="text-xl font-bold text-[var(--accent)] tabular-nums leading-tight">
              {cost ? formatCents(cost.totalInvestedCents) : "—"}
            </dd>
          </div>
        </dl>
      </DMSCardContent>
    </DMSCard>
  );
}
