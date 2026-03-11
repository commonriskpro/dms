"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/http";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DealListItem } from "@/modules/deals/ui/types";
import type { Opportunity } from "@/modules/crm-pipeline-automation/ui/types";

type DealsResponse = { data: DealListItem[]; meta: { total: number } };
type OpportunitiesResponse = { data: Opportunity[]; meta: { total: number } };

export type ActiveOpportunityDealCardProps = {
  customerId: string;
  canReadDeals: boolean;
  canReadCrm: boolean;
  returnTo?: string | null;
};

/**
 * One primary active item only: most recent non-CANCELED deal, or most recent OPEN opportunity.
 * Uses existing GET /api/deals and GET /api/crm/opportunities with customerId and limit=1.
 */
export function ActiveOpportunityDealCard({
  customerId,
  canReadDeals,
  canReadCrm,
  returnTo,
}: ActiveOpportunityDealCardProps) {
  const [deal, setDeal] = React.useState<DealListItem | null | "loading">("loading");
  const [opportunity, setOpportunity] = React.useState<Opportunity | null | "loading">("loading");

  React.useEffect(() => {
    if (!canReadDeals) {
      setDeal(null);
      return;
    }
    let mounted = true;
    const params = new URLSearchParams({
      customerId,
      limit: "1",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    apiFetch<DealsResponse>(`/api/deals?${params.toString()}`)
      .then((res) => {
        if (!mounted) return;
        const first = res.data?.[0];
        setDeal(first && first.status !== "CANCELED" ? first : null);
      })
      .catch(() => {
        if (mounted) setDeal(null);
      });
    return () => {
      mounted = false;
    };
  }, [customerId, canReadDeals]);

  React.useEffect(() => {
    if (!canReadCrm) {
      setOpportunity(null);
      return;
    }
    let mounted = true;
    const params = new URLSearchParams({
      customerId,
      limit: "1",
      sortBy: "updatedAt",
      sortOrder: "desc",
    });
    apiFetch<OpportunitiesResponse>(`/api/crm/opportunities?${params.toString()}`)
      .then((res) => {
        if (!mounted) return;
        const first = res.data?.[0];
        setOpportunity(first && first.status === "OPEN" ? first : null);
      })
      .catch(() => {
        if (mounted) setOpportunity(null);
      });
    return () => {
      mounted = false;
    };
  }, [customerId, canReadCrm]);

  const primary = React.useMemo(() => {
    if (deal && deal !== "loading") {
      const v = deal.vehicle;
      const label = v?.stockNumber
        ? `Stock #${v.stockNumber}`
        : v?.year && v?.make && v?.model
          ? `${v.year} ${v.make} ${v.model}`
          : "Deal";
      return { type: "deal" as const, id: deal.id, label, status: deal.status };
    }
    if (opportunity && opportunity !== "loading") {
      const label = opportunity.stage?.name ?? "Opportunity";
      return { type: "opportunity" as const, id: opportunity.id, label, status: opportunity.status };
    }
    return null;
  }, [deal, opportunity]);

  const loading = deal === "loading" || (canReadCrm && opportunity === "loading");
  const withReturnTo = React.useCallback(
    (href: string) => {
      if (!returnTo) return href;
      const [base, existingQuery = ""] = href.split("?");
      const params = new URLSearchParams(existingQuery);
      params.set("returnTo", returnTo);
      const nextQuery = params.toString();
      return nextQuery ? `${base}?${nextQuery}` : base;
    },
    [returnTo]
  );

  if (!canReadDeals && !canReadCrm) return null;

  return (
    <DMSCard>
      <DMSCardHeader>
        <DMSCardTitle>Active deal or opportunity</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent>
        {loading ? (
          <Skeleton className="h-5 w-48" />
        ) : primary ? (
          <div className="space-y-2">
            <p className="text-sm text-[var(--text)]">
              {primary.type === "deal" ? (
                <Link
                  href={withReturnTo(`/deals/${primary.id}`)}
                  className="text-[var(--accent)] hover:underline font-medium"
                >
                  Active deal — {primary.label}
                </Link>
              ) : (
                <Link
                  href={withReturnTo(`/crm/opportunities/${primary.id}`)}
                  className="text-[var(--accent)] hover:underline font-medium"
                >
                  Active opportunity — {primary.label}
                </Link>
              )}
              <span className="text-[var(--text-soft)] ml-1">· {primary.status}</span>
            </p>
            {canReadCrm ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Link
                  href={withReturnTo(`/crm/inbox?customerId=${encodeURIComponent(customerId)}`)}
                  className="font-medium text-[var(--accent)] hover:underline"
                >
                  Open inbox
                </Link>
                {primary.type === "opportunity" ? (
                  <Link
                    href={withReturnTo(`/crm/opportunities?view=list&customerId=${encodeURIComponent(customerId)}`)}
                    className="font-medium text-[var(--accent)] hover:underline"
                  >
                    Open pipeline context
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-soft)]">No active deal or opportunity.</p>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
