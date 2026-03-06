"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { typography, spacingTokens } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";
import type { ValuationsListResponse, ValuationSnapshot } from "../types";

const VALUATION_SOURCES = [
  { value: "KBB", label: "KBB" },
  { value: "NADA", label: "NADA" },
  { value: "MOCK", label: "MOCK" },
] as const;

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
    return new Date(iso).toLocaleDateString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export type VehicleValuationsCardProps = {
  vehicleId: string;
  className?: string;
};

export function VehicleValuationsCard({
  vehicleId,
  className,
}: VehicleValuationsCardProps) {
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const canGetValue = hasPermission("finance.read");

  const [list, setList] = React.useState<ValuationSnapshot[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [source, setSource] = React.useState<string>("KBB");
  const [condition, setCondition] = React.useState("");
  const [odometer, setOdometer] = React.useState("");

  const fetchValuations = React.useCallback(async () => {
    if (!hasPermission("inventory.read")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ValuationsListResponse>(
        `/api/inventory/${vehicleId}/valuations?limit=20&offset=0`
      );
      setList(res.data ?? []);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [vehicleId, hasPermission]);

  React.useEffect(() => {
    fetchValuations();
  }, [fetchValuations]);

  const handleRequestValuation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canGetValue) return;
    setSubmitting(true);
    try {
      const body: { source: "KBB" | "NADA" | "MOCK"; condition?: string; odometer?: number } = {
        source: source as "KBB" | "NADA" | "MOCK",
      };
      if (condition.trim()) body.condition = condition.trim();
      const odometerNum = parseInt(odometer, 10);
      if (!Number.isNaN(odometerNum) && odometerNum >= 0) body.odometer = odometerNum;
      await apiFetch(`/api/inventory/${vehicleId}/valuations`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      addToast("success", "Valuation requested.");
      setShowForm(false);
      setCondition("");
      setOdometer("");
      await fetchValuations();
    } catch (e: unknown) {
      const status = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : 0;
      if (status === 429) {
        addToast("warning", "Too many valuation requests. Please try again later.");
      } else {
        addToast("error", getApiErrorMessage(e));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DMSCard className={cn(className)}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DMSCardTitle className={typography.cardTitle}>Valuations</DMSCardTitle>
          {canGetValue && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowForm((v) => !v)}
              aria-expanded={showForm}
              aria-label={showForm ? "Close get value form" : "Get value"}
            >
              {showForm ? "Cancel" : "Get value"}
            </Button>
          )}
        </div>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        {canGetValue && showForm && (
          <form
            onSubmit={handleRequestValuation}
            className="mb-4 rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-3"
          >
            <Select
              label="Source"
              options={VALUATION_SOURCES.map((s) => ({ value: s.value, label: s.label }))}
              value={source}
              onChange={setSource}
            />
            <Input
              label="Condition (optional)"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="e.g. Good"
            />
            <Input
              label="Odometer (optional)"
              type="number"
              min={0}
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              placeholder="Miles"
            />
            <Button type="submit" disabled={submitting}>
              {submitting ? "Requesting…" : "Request valuation"}
            </Button>
          </form>
        )}
        {loading ? (
          <Skeleton className="h-20 w-full" aria-hidden />
        ) : error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-[var(--text-soft)]">
            No valuations yet.
            {canGetValue ? " Use Get value to add one." : ""}
          </p>
        ) : (
          <ul className="space-y-2" role="list">
            {list.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-[var(--radius-input)] border border-[var(--border)] p-2 text-sm"
              >
                <span className="font-medium text-[var(--text)]">{v.source}</span>
                <span className="text-[var(--text)]">{formatDollars(v.valueCents)}</span>
                <span className="text-[var(--text-soft)] w-full sm:w-auto">
                  {formatDate(v.capturedAt)}
                  {v.condition != null && v.condition !== "" && ` · ${v.condition}`}
                  {v.odometer != null && ` · ${v.odometer.toLocaleString()} mi`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
