"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { confirm } from "@/components/ui/confirm-dialog";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { typography, spacingTokens } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";
import type { FloorplanGetResponse, FloorplanResponse } from "../types";
import type { Lender } from "@/lib/types/lenders";

function formatDollars(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "short" });
  } catch {
    return iso;
  }
}

function formatAprBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export type VehicleFloorplanCardProps = {
  vehicleId: string;
  className?: string;
};

export function VehicleFloorplanCard({ vehicleId, className }: VehicleFloorplanCardProps) {
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const canRead = hasPermission("finance.read");
  const canWrite = hasPermission("finance.write");
  const canReadLenders = hasPermission("lenders.read");

  const [floorplan, setFloorplan] = React.useState<FloorplanResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lenders, setLenders] = React.useState<Lender[]>([]);
  const [lendersLoading, setLendersLoading] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [addSubmitting, setAddSubmitting] = React.useState(false);
  const [addLenderId, setAddLenderId] = React.useState("");
  const [addPrincipal, setAddPrincipal] = React.useState("");
  const [addApr, setAddApr] = React.useState("");
  const [addStartDate, setAddStartDate] = React.useState("");
  const [addNextCurtailment, setAddNextCurtailment] = React.useState("");
  const [curtailmentOpen, setCurtailmentOpen] = React.useState(false);
  const [curtailmentAmount, setCurtailmentAmount] = React.useState("");
  const [curtailmentPaidAt, setCurtailmentPaidAt] = React.useState(
    () => new Date().toISOString().slice(0, 16)
  );
  const [curtailmentSubmitting, setCurtailmentSubmitting] = React.useState(false);
  const [payoffOpen, setPayoffOpen] = React.useState(false);
  const [payoffAmount, setPayoffAmount] = React.useState("");
  const [payoffExpires, setPayoffExpires] = React.useState("");
  const [payoffSubmitting, setPayoffSubmitting] = React.useState(false);

  const fetchFloorplan = React.useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<FloorplanGetResponse>(`/api/inventory/${vehicleId}/floorplan`);
      setFloorplan(res.data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [vehicleId, canRead]);

  React.useEffect(() => {
    fetchFloorplan();
  }, [fetchFloorplan]);

  const fetchLenders = React.useCallback(async () => {
    if (!canReadLenders) return;
    setLendersLoading(true);
    try {
      const res = await apiFetch<{ data: Lender[]; meta: { total: number } }>(
        "/api/lenders?activeOnly=true&limit=100&offset=0"
      );
      setLenders(res.data ?? []);
    } finally {
      setLendersLoading(false);
    }
  }, [canReadLenders]);

  React.useEffect(() => {
    if (addOpen && canReadLenders) fetchLenders();
  }, [addOpen, canReadLenders, fetchLenders]);

  const handleAddFloorplan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !addLenderId) return;
    const principalCents = Math.round(parseFloat(addPrincipal || "0") * 100);
    if (Number.isNaN(principalCents) || principalCents < 0) {
      addToast("error", "Enter a valid principal.");
      return;
    }
    const aprBps = Math.round(parseFloat(addApr || "0") * 100);
    if (Number.isNaN(aprBps) || aprBps < 0) {
      addToast("error", "Enter a valid APR.");
      return;
    }
    if (!addStartDate.trim()) {
      addToast("error", "Start date is required.");
      return;
    }
    setAddSubmitting(true);
    try {
      const body: {
        lenderId: string;
        principalCents: number;
        aprBps: number;
        startDate: string;
        nextCurtailmentDueDate?: string | null;
      } = {
        lenderId: addLenderId,
        principalCents,
        aprBps,
        startDate: new Date(addStartDate + "T12:00:00.000Z").toISOString(),
      };
      if (addNextCurtailment.trim()) {
        body.nextCurtailmentDueDate = new Date(
          addNextCurtailment + "T12:00:00.000Z"
        ).toISOString();
      }
      const res = await apiFetch<FloorplanGetResponse>(
        `/api/inventory/${vehicleId}/floorplan`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        }
      );
      setFloorplan(res.data);
      setAddOpen(false);
      setAddLenderId("");
      setAddPrincipal("");
      setAddApr("");
      setAddStartDate("");
      setAddNextCurtailment("");
      addToast("success", "Floorplan added.");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleCurtailment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !floorplan) return;
    const amountCents = Math.round(parseFloat(curtailmentAmount || "0") * 100);
    if (Number.isNaN(amountCents) || amountCents < 0) {
      addToast("error", "Enter a valid amount.");
      return;
    }
    if (!curtailmentPaidAt.trim()) {
      addToast("error", "Paid at is required.");
      return;
    }
    setCurtailmentSubmitting(true);
    try {
      await apiFetch(`/api/inventory/${vehicleId}/floorplan/curtailments`, {
        method: "POST",
        body: JSON.stringify({
          amountCents,
          paidAt: new Date(curtailmentPaidAt).toISOString(),
        }),
      });
      addToast("success", "Curtailment recorded.");
      setCurtailmentOpen(false);
      setCurtailmentAmount("");
      setCurtailmentPaidAt(new Date().toISOString().slice(0, 16));
      await fetchFloorplan();
    } catch (e: unknown) {
      const status = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : 0;
      if (status === 429) {
        addToast("warning", "Too many requests. Please try again later.");
      } else {
        addToast("error", getApiErrorMessage(e));
      }
    } finally {
      setCurtailmentSubmitting(false);
    }
  };

  const handlePayoffQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !floorplan) return;
    const payoffQuoteCents = Math.round(parseFloat(payoffAmount || "0") * 100);
    if (Number.isNaN(payoffQuoteCents) || payoffQuoteCents < 0) {
      addToast("error", "Enter a valid payoff amount.");
      return;
    }
    if (!payoffExpires.trim()) {
      addToast("error", "Expiry is required.");
      return;
    }
    setPayoffSubmitting(true);
    try {
      await apiFetch(`/api/inventory/${vehicleId}/floorplan/payoff-quote`, {
        method: "POST",
        body: JSON.stringify({
          payoffQuoteCents,
          payoffQuoteExpiresAt: new Date(payoffExpires).toISOString(),
        }),
      });
      addToast("success", "Payoff quote stored.");
      setPayoffOpen(false);
      setPayoffAmount("");
      setPayoffExpires("");
      await fetchFloorplan();
    } catch (e: unknown) {
      const status = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : 0;
      if (status === 429) {
        addToast("warning", "Too many requests. Please try again later.");
      } else {
        addToast("error", getApiErrorMessage(e));
      }
    } finally {
      setPayoffSubmitting(false);
    }
  };

  if (!canRead) return null;

  return (
    <DMSCard className={cn(className)}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DMSCardTitle className={typography.cardTitle}>Floorplan</DMSCardTitle>
          {canWrite && !floorplan && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAddOpen((v) => !v)}
              aria-expanded={addOpen}
              aria-label={addOpen ? "Close add floorplan" : "Add floorplan"}
            >
              {addOpen ? "Cancel" : "Add floorplan"}
            </Button>
          )}
        </div>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        {canWrite && addOpen && (
          <form
            onSubmit={handleAddFloorplan}
            className="mb-4 rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-3"
          >
            <Select
              label="Lender"
              options={lenders.map((l) => ({ value: l.id, label: l.name }))}
              value={addLenderId}
              onChange={setAddLenderId}
              disabled={lendersLoading}
            />
            {lendersLoading && <p className="text-xs text-[var(--text-soft)]">Loading lenders…</p>}
            <Input
              label="Principal ($)"
              type="number"
              step="0.01"
              min="0"
              value={addPrincipal}
              onChange={(e) => setAddPrincipal(e.target.value)}
              required
            />
            <Input
              label="APR (%)"
              type="number"
              step="0.01"
              min="0"
              value={addApr}
              onChange={(e) => setAddApr(e.target.value)}
            />
            <Input
              label="Start date"
              type="date"
              value={addStartDate}
              onChange={(e) => setAddStartDate(e.target.value)}
              required
            />
            <Input
              label="Next curtailment due (optional)"
              type="date"
              value={addNextCurtailment}
              onChange={(e) => setAddNextCurtailment(e.target.value)}
            />
            <Button type="submit" disabled={addSubmitting}>
              {addSubmitting ? "Saving…" : "Save floorplan"}
            </Button>
          </form>
        )}
        {loading ? (
          <Skeleton className="h-20 w-full" aria-hidden />
        ) : error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : !floorplan ? (
          <p className="text-sm text-[var(--text-soft)]">
            No floorplan. {canWrite ? "Use Add floorplan to add one." : ""}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 mb-3">
              <div>
                <dt className={typography.muted}>Lender</dt>
                <dd className="text-[var(--text)]">{floorplan.lenderName ?? floorplan.lenderId}</dd>
              </div>
              <div>
                <dt className={typography.muted}>Principal</dt>
                <dd className="text-[var(--text)]">{formatDollars(floorplan.principalCents)}</dd>
              </div>
              <div>
                <dt className={typography.muted}>APR</dt>
                <dd className="text-[var(--text)]">{formatAprBps(floorplan.aprBps)}</dd>
              </div>
              <div>
                <dt className={typography.muted}>Start date</dt>
                <dd className="text-[var(--text)]">{formatDate(floorplan.startDate)}</dd>
              </div>
              {floorplan.nextCurtailmentDueDate && (
                <div>
                  <dt className={typography.muted}>Next curtailment due</dt>
                  <dd className="text-[var(--text)]">
                    {formatDate(floorplan.nextCurtailmentDueDate)}
                  </dd>
                </div>
              )}
            </dl>
            {floorplan.curtailments.length > 0 && (
              <div className="mb-3">
                <p className={typography.muted + " mb-1"}>Curtailments</p>
                <ul className="space-y-1" role="list">
                  {floorplan.curtailments.map((c) => (
                    <li
                      key={c.id}
                      className="flex justify-between text-sm text-[var(--text)]"
                    >
                      <span>{formatDollars(c.amountCents)}</span>
                      <span className="text-[var(--text-soft)]">{formatDate(c.paidAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(floorplan.payoffQuoteCents != null || floorplan.payoffQuoteExpiresAt != null) && (
              <p className="text-sm text-[var(--text-soft)] mb-2">
                Payoff quote:{" "}
                {floorplan.payoffQuoteCents != null
                  ? formatDollars(floorplan.payoffQuoteCents)
                  : "—"}{" "}
                {floorplan.payoffQuoteExpiresAt != null &&
                  `(expires ${formatDate(floorplan.payoffQuoteExpiresAt)})`}
              </p>
            )}
            {canWrite && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurtailmentOpen((v) => !v)}
                  aria-expanded={curtailmentOpen}
                  aria-label={curtailmentOpen ? "Close record curtailment" : "Record curtailment"}
                >
                  {curtailmentOpen ? "Cancel" : "Record curtailment"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPayoffOpen((v) => !v)}
                  aria-expanded={payoffOpen}
                  aria-label={payoffOpen ? "Close store payoff quote" : "Store payoff quote"}
                >
                  {payoffOpen ? "Cancel" : "Store payoff quote"}
                </Button>
              </div>
            )}
            {canWrite && curtailmentOpen && (
              <form
                onSubmit={handleCurtailment}
                className="mt-2 rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-2"
              >
                <Input
                  label="Amount ($)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={curtailmentAmount}
                  onChange={(e) => setCurtailmentAmount(e.target.value)}
                  required
                />
                <Input
                  label="Paid at"
                  type="datetime-local"
                  value={curtailmentPaidAt}
                  onChange={(e) => setCurtailmentPaidAt(e.target.value)}
                  required
                />
                <Button type="submit" size="sm" disabled={curtailmentSubmitting}>
                  {curtailmentSubmitting ? "Saving…" : "Save"}
                </Button>
              </form>
            )}
            {canWrite && payoffOpen && (
              <form
                onSubmit={handlePayoffQuote}
                className="mt-2 rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-2"
              >
                <Input
                  label="Payoff amount ($)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={payoffAmount}
                  onChange={(e) => setPayoffAmount(e.target.value)}
                  required
                />
                <Input
                  label="Expires at"
                  type="datetime-local"
                  value={payoffExpires}
                  onChange={(e) => setPayoffExpires(e.target.value)}
                  required
                />
                <Button type="submit" size="sm" disabled={payoffSubmitting}>
                  {payoffSubmitting ? "Saving…" : "Save"}
                </Button>
              </form>
            )}
          </>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
