"use client";

import * as React from "react";
import Link from "next/link";
import type { DealDetail } from "../types";
import type { SignalSurfaceItem } from "@/components/ui-system/signals";

export type DealProgressStripProps = {
  deal: DealDetail;
  dealId: string;
  blockerSignals: SignalSurfaceItem[];
};

function fundingState(deal: DealDetail, signals: SignalSurfaceItem[]): { label: string; hasIssue: boolean } {
  const funded = deal.dealFundings?.some((f) => f.fundingStatus === "FUNDED");
  if (funded) return { label: "Done", hasIssue: false };
  const issue = signals.some((s) => s.code.includes("funding"));
  return { label: issue ? "1 issue" : "Pending", hasIssue: !!issue };
}

function titleState(deal: DealDetail, signals: SignalSurfaceItem[]): { label: string; hasIssue: boolean } {
  const hasTitle = deal.dealTitle != null;
  if (hasTitle && !signals.some((s) => s.code.includes("title_backlog")))
    return { label: "Done", hasIssue: false };
  const issue = signals.some((s) => s.code.includes("title"));
  return { label: issue ? "1 issue" : "Pending", hasIssue: !!issue };
}

function deliveryState(deal: DealDetail, signals: SignalSurfaceItem[]): { label: string; hasIssue: boolean } {
  if (deal.deliveryStatus === "DELIVERED") return { label: "Done", hasIssue: false };
  const issue = signals.some((s) => s.code.includes("delivery"));
  return { label: issue ? "1 issue" : "Pending", hasIssue: !!issue };
}

const segmentClass = "text-sm font-medium text-[var(--text)]";
const issueClass = "text-sm font-medium text-[var(--warning-text)]";

export function DealProgressStrip({ deal, dealId, blockerSignals }: DealProgressStripProps) {
  const funding = React.useMemo(() => fundingState(deal, blockerSignals), [deal, blockerSignals]);
  const title = React.useMemo(() => titleState(deal, blockerSignals), [deal, blockerSignals]);
  const delivery = React.useMemo(() => deliveryState(deal, blockerSignals), [deal, blockerSignals]);

  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 shadow-[var(--shadow-card)]"
      role="region"
      aria-label="Deal progress"
    >
      <span className={funding.hasIssue ? issueClass : segmentClass}>
        Funding: {funding.label}
      </span>
      <span className={title.hasIssue ? issueClass : segmentClass}>
        Title: {title.label}
      </span>
      <span className={delivery.hasIssue ? issueClass : segmentClass}>
        Delivery: {delivery.label}
      </span>
      <span className="text-xs text-[var(--text-soft)]">
        <Link href={`/deals/${dealId}`} className="text-[var(--accent)] hover:underline">
          Delivery & Funding
        </Link>
        {" · "}
        <Link href="/queues/title" className="text-[var(--accent)] hover:underline">
          Title queue
        </Link>
      </span>
    </div>
  );
}
