"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { WriteGuard } from "@/components/write-guard";
import { getDealMode, type DealDetail, type DealStatus } from "../types";
import { DEAL_STATUS_OPTIONS } from "../types";

const ALLOWED_NEXT: Record<DealStatus, DealStatus[]> = {
  DRAFT: ["STRUCTURED", "CANCELED"],
  STRUCTURED: ["APPROVED", "CANCELED"],
  APPROVED: ["CONTRACTED", "CANCELED"],
  CONTRACTED: ["CANCELED"],
  CANCELED: [],
};

function statusVariant(status: DealStatus): "info" | "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "DRAFT":
      return "neutral";
    case "STRUCTURED":
      return "info";
    case "APPROVED":
      return "warning";
    case "CONTRACTED":
      return "success";
    case "CANCELED":
      return "danger";
    default:
      return "neutral";
  }
}

export interface DealHeaderProps {
  deal: DealDetail;
  onStageChange?: (status: DealStatus) => void;
  stageSubmitting?: boolean;
  signalHeader?: React.ReactNode;
}

export function DealHeader({
  deal,
  onStageChange,
  stageSubmitting = false,
  signalHeader,
}: DealHeaderProps) {
  const nextStatuses = ALLOWED_NEXT[deal.status] ?? [];
  const mode = getDealMode(deal);

  return (
    <div className="space-y-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
        <Link
          href="/deals"
          className="text-sm text-[var(--muted-text)] hover:text-[var(--text)]"
        >
          ← Deals
        </Link>
        <span className="text-[var(--muted-text)]">/</span>
        <span className="font-medium text-[var(--text)]">
          Deal {deal.vehicle?.stockNumber ?? deal.id.slice(0, 8)}
        </span>
        <StatusBadge variant={mode === "FINANCE" ? "info" : "neutral"}>
          {mode === "FINANCE" ? "Finance deal" : "Cash deal"}
        </StatusBadge>
        <StatusBadge variant={statusVariant(deal.status)}>
          {DEAL_STATUS_OPTIONS.find((o) => o.value === deal.status)?.label ?? deal.status}
        </StatusBadge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {nextStatuses.map((status) => {
            const option = DEAL_STATUS_OPTIONS.find((o) => o.value === status);
            return (
              <WriteGuard key={status}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={stageSubmitting}
                  onClick={() => onStageChange?.(status)}
                  className="border-[var(--border)] text-[var(--text)]"
                >
                  {option?.label ?? status}
                </Button>
              </WriteGuard>
            );
          })}
        </div>
      </div>
      {signalHeader ? <div>{signalHeader}</div> : null}
    </div>
  );
}
