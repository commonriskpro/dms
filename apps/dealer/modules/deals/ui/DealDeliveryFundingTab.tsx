"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents, parseDollarsToCents, isValidDollarInput } from "@/lib/money";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { MutationButton, WriteGuard } from "@/components/write-guard";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDealMode, type DealDetail, type DealFundingDetail } from "./types";

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  READY_FOR_DELIVERY: "Ready for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const FUNDING_STATUS_LABELS: Record<string, string> = {
  NONE: "None",
  PENDING: "Pending",
  APPROVED: "Approved",
  FUNDED: "Funded",
  FAILED: "Failed",
};

export type DealDeliveryFundingTabProps = {
  deal: DealDetail;
  dealId: string;
  onDealUpdated: (updated: DealDetail) => void;
  canWriteDeals: boolean;
  canWriteFunding: boolean;
};

export function DealDeliveryFundingTab({
  deal,
  dealId,
  onDealUpdated,
  canWriteDeals,
  canWriteFunding,
}: DealDeliveryFundingTabProps) {
  const { addToast } = useToast();
  const dealMode = getDealMode(deal);
  const isFinanceDeal = dealMode === "FINANCE";
  const [deliveryLoading, setDeliveryLoading] = React.useState(false);
  const [fundingLoading, setFundingLoading] = React.useState(false);
  const [createFundingAmount, setCreateFundingAmount] = React.useState("");
  const [createFundingNotes, setCreateFundingNotes] = React.useState("");
  const [createFundingSubmitting, setCreateFundingSubmitting] = React.useState(false);

  const markReady = async () => {
    if (!canWriteDeals) return;
    setDeliveryLoading(true);
    try {
      const res = await apiFetch<{ data: DealDetail }>(`/api/deals/${dealId}/delivery/ready`, {
        method: "POST",
      });
      onDealUpdated(res.data);
      addToast("success", "Marked ready for delivery");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setDeliveryLoading(false);
    }
  };

  const markDelivered = async () => {
    if (!canWriteDeals) return;
    setDeliveryLoading(true);
    try {
      const res = await apiFetch<{ data: DealDetail }>(`/api/deals/${dealId}/delivery/complete`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      onDealUpdated(res.data);
      addToast("success", "Marked as delivered");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setDeliveryLoading(false);
    }
  };

  const createFunding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWriteFunding) return;
    const cents = parseDollarsToCents(createFundingAmount || "0");
    if (!isValidDollarInput(createFundingAmount || "0") || cents === "0" || cents === "") {
      addToast("error", "Enter a valid funding amount.");
      return;
    }
    setCreateFundingSubmitting(true);
    try {
      await apiFetch(`/api/deals/${dealId}/funding`, {
        method: "POST",
        body: JSON.stringify({
          fundingAmountCents: String(cents),
          notes: createFundingNotes.trim() || null,
        }),
      });
      const res = await apiFetch<{ data: DealDetail }>(`/api/deals/${dealId}`);
      onDealUpdated(res.data);
      setCreateFundingAmount("");
      setCreateFundingNotes("");
      addToast("success", "Funding record created");
    } catch (err) {
      addToast("error", getApiErrorMessage(err));
    } finally {
      setCreateFundingSubmitting(false);
    }
  };

  const markFunded = async (fundingId: string) => {
    if (!canWriteFunding) return;
    setFundingLoading(true);
    try {
      await apiFetch(`/api/deals/${dealId}/funding/status`, {
        method: "PATCH",
        body: JSON.stringify({ fundingId, fundingStatus: "FUNDED" }),
      });
      const res = await apiFetch<{ data: DealDetail }>(`/api/deals/${dealId}`);
      onDealUpdated(res.data);
      addToast("success", "Marked as funded");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setFundingLoading(false);
    }
  };

  const isContracted = deal.status === "CONTRACTED";
  const deliveryStatus = deal.deliveryStatus ?? null;
  const dealFundings = deal.dealFundings ?? [];
  const primaryFunding = dealFundings[0];

  return (
    <div className="space-y-6">
      {!isContracted && (
        <p className="text-sm text-[var(--text-soft)]">
          Delivery and funding are available after the deal is contracted.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-[var(--text-soft)]">Status</dt>
              <dd>
                {deliveryStatus ? (
                  <StatusBadge variant={deliveryStatus === "DELIVERED" ? "success" : "info"}>
                    {DELIVERY_STATUS_LABELS[deliveryStatus] ?? deliveryStatus}
                  </StatusBadge>
                ) : (
                  <span className="text-[var(--text-soft)]">Not started</span>
                )}
              </dd>
            </div>
            {deal.deliveredAt && (
              <div>
                <dt className="text-[var(--text-soft)]">Delivered at</dt>
                <dd>{new Date(deal.deliveredAt).toLocaleString()}</dd>
              </div>
            )}
          </dl>
          {isContracted && canWriteDeals && (
            <div className="flex flex-wrap gap-2 pt-2">
              {(!deliveryStatus || deliveryStatus === "CANCELLED") && (
                <WriteGuard>
                  <MutationButton onClick={markReady} disabled={deliveryLoading}>
                    {deliveryLoading ? "Updating…" : "Mark ready for delivery"}
                  </MutationButton>
                </WriteGuard>
              )}
              {deliveryStatus === "READY_FOR_DELIVERY" && (
                <WriteGuard>
                  <MutationButton onClick={markDelivered} disabled={deliveryLoading}>
                    {deliveryLoading ? "Updating…" : "Mark delivered"}
                  </MutationButton>
                </WriteGuard>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isFinanceDeal ? "Funding" : "Settlement"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isFinanceDeal ? (
            <p className="text-sm text-[var(--text-soft)]">
              Cash deals skip lender funding. Move from delivery into title and DMV once funds are
              collected.
            </p>
          ) : dealFundings.length === 0 ? (
            <p className="text-sm text-[var(--text-soft)]">No funding record yet.</p>
          ) : (
            <ul className="space-y-3" role="list">
              {dealFundings.map((f) => (
                <FundingRow
                  key={f.id}
                  funding={f}
                  onMarkFunded={f.fundingStatus !== "FUNDED" && f.fundingStatus !== "FAILED" ? () => markFunded(f.id) : undefined}
                  loading={fundingLoading}
                  canWriteFunding={canWriteFunding}
                />
              ))}
            </ul>
          )}
          {isFinanceDeal && isContracted && canWriteFunding && (
            <form onSubmit={createFunding} className="space-y-3 pt-2 border-t border-[var(--border)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Funding amount ($)"
                  value={createFundingAmount}
                  onChange={(e) => setCreateFundingAmount(e.target.value)}
                  placeholder="0.00"
                />
                <Input
                  label="Notes"
                  value={createFundingNotes}
                  onChange={(e) => setCreateFundingNotes(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <MutationButton type="submit" disabled={createFundingSubmitting}>
                {createFundingSubmitting ? "Creating…" : "Create funding"}
              </MutationButton>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Queues</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--text-soft)] mb-2">
            View deals in the next execution queue for this sale type.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/deals/delivery">
              <Button variant="secondary" size="sm">Delivery queue</Button>
            </Link>
            {isFinanceDeal ? (
              <Link href="/deals/funding">
                <Button variant="secondary" size="sm">Funding queue</Button>
              </Link>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stipulations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--text-soft)]">
            View and manage stipulations on the <strong>Lenders</strong> and <strong>Credit</strong> tabs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function FundingRow({
  funding,
  onMarkFunded,
  loading,
  canWriteFunding,
}: {
  funding: DealFundingDetail;
  onMarkFunded?: () => void;
  loading: boolean;
  canWriteFunding: boolean;
}) {
  return (
    <li className="border border-[var(--border)] rounded-lg p-3">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        {funding.lenderName && (
          <div>
            <dt className="text-[var(--text-soft)]">Lender</dt>
            <dd>{funding.lenderName}</dd>
          </div>
        )}
        <div>
          <dt className="text-[var(--text-soft)]">Status</dt>
          <dd>
            <StatusBadge
              variant={
                funding.fundingStatus === "FUNDED"
                  ? "success"
                  : funding.fundingStatus === "FAILED"
                    ? "danger"
                    : "warning"
              }
            >
              {FUNDING_STATUS_LABELS[funding.fundingStatus] ?? funding.fundingStatus}
            </StatusBadge>
          </dd>
        </div>
        <div>
          <dt className="text-[var(--text-soft)]">Amount</dt>
          <dd>{formatCents(funding.fundingAmountCents)}</dd>
        </div>
        {funding.fundingDate && (
          <div>
            <dt className="text-[var(--text-soft)]">Funding date</dt>
            <dd>{new Date(funding.fundingDate).toLocaleDateString()}</dd>
          </div>
        )}
      </dl>
      {onMarkFunded && canWriteFunding && (
        <div className="mt-2">
          <MutationButton onClick={onMarkFunded} disabled={loading}>
            {loading ? "Updating…" : "Mark funded"}
          </MutationButton>
        </div>
      )}
    </li>
  );
}
