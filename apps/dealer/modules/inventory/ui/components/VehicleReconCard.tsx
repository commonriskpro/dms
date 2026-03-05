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
import type { ReconGetResponse, ReconStatus, ReconLineItem } from "../types";

const RECON_STATUS_OPTIONS: { value: ReconStatus; label: string }[] = [
  { value: "NOT_STARTED", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETE", label: "Complete" },
];

function formatDollars(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Parse dollars input to cents (e.g. "100" or "100.50" -> 10050). */
function parseDollarsToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = parseFloat(trimmed);
  if (Number.isNaN(num) || num < 0) return null;
  return Math.round(num * 100);
}

export type VehicleReconCardProps = {
  vehicleId: string;
  /** Recon cost from vehicle for display/sync. */
  vehicleReconCostCents: string | undefined;
  className?: string;
};

export function VehicleReconCard({
  vehicleId,
  vehicleReconCostCents,
  className,
}: VehicleReconCardProps) {
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const canWrite = hasPermission("inventory.write");

  const [recon, setRecon] = React.useState<ReconGetResponse["data"]>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [updating, setUpdating] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [addDesc, setAddDesc] = React.useState("");
  const [addCostDollars, setAddCostDollars] = React.useState("");
  const [addCategory, setAddCategory] = React.useState("");
  const [addSubmitting, setAddSubmitting] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDesc, setEditDesc] = React.useState("");
  const [editCostDollars, setEditCostDollars] = React.useState("");
  const [editCategory, setEditCategory] = React.useState("");

  const fetchRecon = React.useCallback(async () => {
    if (!hasPermission("inventory.read")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ReconGetResponse>(`/api/inventory/${vehicleId}/recon`);
      setRecon(res.data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [vehicleId, hasPermission]);

  React.useEffect(() => {
    fetchRecon();
  }, [fetchRecon]);

  const totalCents = recon
    ? recon.lineItems.reduce((s, i) => s + i.costCents, 0)
    : parseInt(vehicleReconCostCents ?? "0", 10) || 0;

  const handleStartRecon = async () => {
    if (!canWrite) return;
    setUpdating(true);
    try {
      const res = await apiFetch<ReconGetResponse>(`/api/inventory/${vehicleId}/recon`, {
        method: "PATCH",
        body: JSON.stringify({ status: "NOT_STARTED" }),
      });
      setRecon(res.data);
      addToast("success", "Reconditioning started.");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = async (status: ReconStatus) => {
    if (!canWrite || !recon) return;
    setUpdating(true);
    try {
      const res = await apiFetch<ReconGetResponse>(`/api/inventory/${vehicleId}/recon`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setRecon(res.data);
      addToast("success", "Status updated.");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setUpdating(false);
    }
  };

  const handleDueDateChange = async (dueDate: string | null) => {
    if (!canWrite || !recon) return;
    const value = dueDate === "" ? null : dueDate;
    const body =
      value == null
        ? { dueDate: null }
        : { dueDate: new Date(value + "T12:00:00.000Z").toISOString() };
    setUpdating(true);
    try {
      const res = await apiFetch<ReconGetResponse>(`/api/inventory/${vehicleId}/recon`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setRecon(res.data);
      addToast("success", "Due date updated.");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setUpdating(false);
    }
  };

  const handleAddLineItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !addDesc.trim()) return;
    const costCents = parseDollarsToCents(addCostDollars);
    if (costCents == null) {
      addToast("error", "Enter a valid cost.");
      return;
    }
    setAddSubmitting(true);
    try {
      await apiFetch(`/api/inventory/${vehicleId}/recon/line-items`, {
        method: "POST",
        body: JSON.stringify({
          description: addDesc.trim(),
          costCents,
          category: addCategory.trim() || undefined,
        }),
      });
      addToast("success", "Line item added.");
      setAddDesc("");
      setAddCostDollars("");
      setAddCategory("");
      setAddOpen(false);
      await fetchRecon();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setAddSubmitting(false);
    }
  };

  const startEdit = (item: ReconLineItem) => {
    setEditingId(item.id);
    setEditDesc(item.description);
    setEditCostDollars((item.costCents / 100).toFixed(2));
    setEditCategory(item.category ?? "");
  };

  const handleUpdateLineItem = async (lineItemId: string) => {
    if (!canWrite || !editDesc.trim()) return;
    const costCents = parseDollarsToCents(editCostDollars);
    if (costCents == null) {
      addToast("error", "Enter a valid cost.");
      return;
    }
    setUpdating(true);
    try {
      const res = await apiFetch<{ data: ReconLineItem }>(
        `/api/inventory/${vehicleId}/recon/line-items/${lineItemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            description: editDesc.trim(),
            costCents,
            category: editCategory.trim() || null,
          }),
        }
      );
      setRecon((prev) =>
        prev
          ? {
              ...prev,
              lineItems: prev.lineItems.map((i) => (i.id === lineItemId ? res.data : i)),
            }
          : null
      );
      setEditingId(null);
      addToast("success", "Line item updated.");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteLineItem = async (lineItemId: string, description: string) => {
    if (!canWrite) return;
    const ok = await confirm({
      title: "Remove line item",
      description: `Remove "${description}"?`,
      confirmText: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    setUpdating(true);
    try {
      await apiFetch(`/api/inventory/${vehicleId}/recon/line-items/${lineItemId}`, {
        method: "DELETE",
      });
      setRecon((prev) =>
        prev
          ? {
              ...prev,
              lineItems: prev.lineItems.filter((i) => i.id !== lineItemId),
            }
          : null
      );
      addToast("success", "Line item removed.");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setUpdating(false);
    }
  };

  const displayDueDate = recon?.dueDate
    ? new Date(recon.dueDate).toISOString().slice(0, 10)
    : "";

  return (
    <DMSCard className={cn(className)}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <DMSCardTitle className={typography.cardTitle}>Reconditioning</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        {loading ? (
          <Skeleton className="h-24 w-full" aria-hidden />
        ) : error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : !recon ? (
          <>
            <p className="text-sm text-[var(--text-soft)] mb-3">No reconditioning record yet.</p>
            {canWrite && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleStartRecon}
                disabled={updating}
                aria-label="Start recon"
              >
                {updating ? "Starting…" : "Start recon"}
              </Button>
            )}
          </>
        ) : (
          <>
            {canWrite && (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <Select
                    label="Status"
                    options={RECON_STATUS_OPTIONS}
                    value={recon.status}
                    onChange={(v) => handleStatusChange(v as ReconStatus)}
                    disabled={updating}
                  />
                  <div className="flex items-end gap-2">
                    <Input
                      label="Due date"
                      type="date"
                      value={displayDueDate}
                      onChange={(e) => handleDueDateChange(e.target.value || null)}
                      disabled={updating}
                    />
                  </div>
                </div>
              </>
            )}
            {!canWrite && (
              <p className="text-sm text-[var(--muted-text)] mb-2">
                Status: {RECON_STATUS_OPTIONS.find((o) => o.value === recon.status)?.label ?? recon.status}
                {recon.dueDate && (
                  <> · Due {new Date(recon.dueDate).toLocaleDateString()}</>
                )}
              </p>
            )}
            <p className="text-sm font-medium text-[var(--text)] mb-2">
              Total: {formatDollars(totalCents)}
            </p>
            <ul className="space-y-2" role="list">
              {recon.lineItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-[var(--radius-input)] border border-[var(--border)] p-2 text-sm"
                >
                  {editingId === item.id ? (
                    <div className="space-y-2">
                      <Input
                        label="Description"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                      />
                      <Input
                        label="Cost ($)"
                        type="number"
                        step="0.01"
                        min="0"
                        value={editCostDollars}
                        onChange={(e) => setEditCostDollars(e.target.value)}
                      />
                      <Input
                        label="Category (optional)"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleUpdateLineItem(item.id)}
                          disabled={updating}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[var(--text)]">{item.description}</span>
                        {item.category && (
                          <span className="text-[var(--text-soft)] ml-2">· {item.category}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text)]">{formatDollars(item.costCents)}</span>
                        {canWrite && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(item)}
                              aria-label={`Edit ${item.description}`}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteLineItem(item.id, item.description)}
                              aria-label={`Remove ${item.description}`}
                            >
                              Remove
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {canWrite && (
              <>
                {!addOpen ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    onClick={() => setAddOpen(true)}
                    aria-label="Add line item"
                  >
                    Add line item
                  </Button>
                ) : (
                  <form
                    onSubmit={handleAddLineItem}
                    className="mt-3 rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-2"
                  >
                    <Input
                      label="Description"
                      value={addDesc}
                      onChange={(e) => setAddDesc(e.target.value)}
                      required
                    />
                    <Input
                      label="Cost ($)"
                      type="number"
                      step="0.01"
                      min="0"
                      value={addCostDollars}
                      onChange={(e) => setAddCostDollars(e.target.value)}
                      required
                    />
                    <Input
                      label="Category (optional)"
                      value={addCategory}
                      onChange={(e) => setAddCategory(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={addSubmitting}>
                        {addSubmitting ? "Adding…" : "Add"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setAddOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </>
            )}
          </>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
