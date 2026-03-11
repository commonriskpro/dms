"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { widgetRowSurface, typography } from "@/lib/ui/tokens";
import { formatCents } from "@/lib/money";
import type { AcquisitionLeadRow } from "./page";

const STAGE_OPTIONS: SelectOption[] = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "NEGOTIATING", label: "Negotiating" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

export type AcquisitionCardProps = {
  lead: AcquisitionLeadRow;
  canWrite: boolean;
  onMutate: () => void;
};

export function AcquisitionCard({ lead, canWrite, onMutate }: AcquisitionCardProps) {
  const { addToast } = useToast();
  const [moving, setMoving] = React.useState(false);

  const handleStageChange = async (newStatus: string) => {
    if (newStatus === lead.status) return;
    setMoving(true);
    try {
      await apiFetch(`/api/inventory/acquisition/${lead.id}/move-stage`, {
        method: "POST",
        body: JSON.stringify({ status: newStatus }),
      });
      addToast("success", "Stage updated");
      onMutate();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className={`${widgetRowSurface} flex flex-col gap-2.5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="font-mono text-[13px] font-semibold text-[var(--text)]">{lead.vin}</div>
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--muted-text)]">
          {lead.status}
        </span>
      </div>
      <div className="text-xs text-[var(--muted-text)]">
        {lead.sourceType.replace(/_/g, " ")}
        {lead.sellerName && ` · ${lead.sellerName}`}
      </div>
      {lead.askingPriceCents != null && (
        <div className="text-sm text-[var(--text)]">
          Ask: {formatCents(lead.askingPriceCents)}
          {lead.negotiatedPriceCents != null && (
            <span className="text-[var(--muted-text)]"> · Neg: {formatCents(lead.negotiatedPriceCents)}</span>
          )}
        </div>
      )}
      {lead.appraisal && (
        <Link
          href={`/inventory/appraisals?search=${encodeURIComponent(lead.appraisal.vin)}`}
          className="text-xs text-[var(--accent)] hover:underline"
        >
          Linked appraisal
        </Link>
      )}
      <div className="text-xs text-[var(--muted-text)]">
        Updated {new Date(lead.updatedAt).toLocaleDateString()}
      </div>
      {canWrite && (
        <div className="mt-1">
          <Select
            value={lead.status}
            onChange={handleStageChange}
            options={STAGE_OPTIONS}
            className="text-xs"
            disabled={moving}
          />
        </div>
      )}
    </div>
  );
}
