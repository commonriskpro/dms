"use client";

import * as React from "react";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { typography } from "@/lib/ui/tokens";
import { formatCents } from "@/lib/money";
import type { VehicleCostEntryResponse, VehicleCostTotalsResponse } from "../types";
import { VENDOR_TYPE_LABELS } from "../types";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export type AcquisitionSummaryCardProps = {
  acquisitionEntry: VehicleCostEntryResponse | null;
  cost: VehicleCostTotalsResponse["data"] | null;
  onEdit?: () => void;
};

export function AcquisitionSummaryCard({
  acquisitionEntry,
  cost: _cost,
  onEdit,
}: AcquisitionSummaryCardProps) {
  return (
    <DMSCard className="p-0 overflow-hidden">
      {/* Title row */}
      <DMSCardHeader className="flex flex-row items-center justify-between px-5 pt-4 pb-3">
        <DMSCardTitle className={typography.cardTitle}>Acquisition Summary</DMSCardTitle>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-soft)] hover:text-[var(--text)] border border-[var(--border)] rounded-[var(--radius-input)] px-2.5 py-1 transition-colors"
            aria-label="Edit acquisition entry"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
        )}
      </DMSCardHeader>

      {/* Values row: 4-column horizontal layout separated by border */}
      <DMSCardContent className="p-0">
        <dl className="flex border-t border-[var(--border)]">
          <div className="flex-1 px-5 py-4">
            <dt className="text-xs text-[var(--muted-text)] mb-1">Purchase Price</dt>
            <dd className="text-xl font-semibold text-[var(--text)] tabular-nums leading-tight">
              {acquisitionEntry ? formatCents(acquisitionEntry.amountCents) : "—"}
            </dd>
          </div>
          <span className="my-2 divider-fade" aria-hidden />
          <div className="flex-1 px-5 py-4">
            <dt className="text-xs text-[var(--muted-text)] mb-1">Vendor</dt>
            <dd className="flex items-center gap-1.5 text-base font-semibold text-[var(--text)]">
              {acquisitionEntry?.vendorName ? (
                <>
                  <span>{acquisitionEntry.vendorName}</span>
                  {acquisitionEntry.vendorType && (
                    <span className="inline-flex items-center rounded bg-[var(--info-muted)] text-[var(--info-muted-fg)] px-1.5 py-0.5 text-[10px] font-bold leading-none">
                      {VENDOR_TYPE_LABELS[acquisitionEntry.vendorType]}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[var(--muted-text)] font-normal">—</span>
              )}
            </dd>
          </div>
          <span className="my-2 divider-fade" aria-hidden />
          <div className="flex-1 px-5 py-4">
            <dt className="text-xs text-[var(--muted-text)] mb-1">Purchase Date</dt>
            <dd className="text-base font-semibold text-[var(--text)]">
              {acquisitionEntry ? formatDate(acquisitionEntry.occurredAt) : "—"}
            </dd>
          </div>
          <span className="my-2 divider-fade" aria-hidden />
          <div className="flex-1 px-5 py-4">
            <dt className="text-xs text-[var(--muted-text)] mb-1">Location</dt>
            <dd className="text-base font-semibold text-[var(--text)]">
              {acquisitionEntry?.memo ? acquisitionEntry.memo.slice(0, 20) : "—"}
            </dd>
          </div>
        </dl>
      </DMSCardContent>
    </DMSCard>
  );
}
