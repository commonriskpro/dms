"use client";

import * as React from "react";
import { dashboardCard, spacingTokens, typography } from "@/lib/ui/tokens";
import { AcquisitionCard } from "./AcquisitionCard";
import type { AcquisitionLeadRow } from "./page";

export type AcquisitionColumnProps = {
  status: string;
  leads: AcquisitionLeadRow[];
  canWrite: boolean;
  onMutate: () => void;
};

export function AcquisitionColumn({ status, leads, canWrite, onMutate }: AcquisitionColumnProps) {
  return (
    <div className={`${dashboardCard} flex min-h-[200px] flex-col ${spacingTokens.cardPad}`}>
      <h3 className={`${typography.cardTitle} mb-3`}>{status}</h3>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {leads.length === 0 ? (
          <p className="text-sm text-[var(--muted-text)]">No leads</p>
        ) : (
          leads.map((lead) => (
            <AcquisitionCard
              key={lead.id}
              lead={lead}
              canWrite={canWrite}
              onMutate={onMutate}
            />
          ))
        )}
      </div>
    </div>
  );
}
