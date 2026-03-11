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
    <div className={`${dashboardCard} flex min-h-[260px] flex-col ${spacingTokens.cardPad}`}>
      <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-2">
        <h3 className={typography.cardTitle}>{status}</h3>
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-text)]">
          {leads.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {leads.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border)] bg-[var(--surface-2)]/30 px-4 py-5 text-sm text-[var(--muted-text)]">
            No leads in this stage.
          </div>
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
