"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { Select, type SelectOption } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCents,
  parseDollarsToCents,
  isValidDollarInput,
  percentToBps,
  bpsToPercent,
  centsToDollarInput,
} from "@/lib/money";
import type {
  DealDetail,
  DealFee,
  DealTrade,
  DealHistoryEntry,
  DealStatus,
} from "./types";
import { MutationButton, WriteGuard } from "@/components/write-guard";
import { DealDocumentsTab } from "@/modules/documents/ui/DealDocumentsTab";
import { DealFinanceTab } from "@/modules/finance-shell/ui/DealFinanceTab";
import { DealLendersTab } from "@/modules/lender-integration/ui/DealLendersTab";

const ALLOWED_NEXT: Record<DealStatus, DealStatus[]> = {
  DRAFT: ["STRUCTURED", "CANCELED"],
  STRUCTURED: ["APPROVED", "CANCELED"],
  APPROVED: ["CONTRACTED", "CANCELED"],
  CONTRACTED: ["CANCELED"],
  CANCELED: [],
};

function statusBadgeClass(status: DealStatus): string {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ";
  switch (status) {
    case "DRAFT":
      return base + "bg-[var(--muted)] text-[var(--text-soft)]";
    case "STRUCTURED":
      return base + "bg-blue-100 text-blue-800";
    case "APPROVED":
      return base + "bg-amber-100 text-amber-800";
    case "CONTRACTED":
      return base + "bg-green-100 text-green-800";
    case "CANCELED":
      return base + "bg-red-100 text-red-800";
    default:
      return base + "bg-[var(--muted)]";
  }
}

export function DealDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const { addToast } = useToast();
  const { hasPermission } = useSession();
  const canRead = hasPermission("deals.read");
  const canWrite = hasPermission("deals.write");

  const [deal, setDeal] = React.useState<DealDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("overview");

  const [structureSaving, setStructureSaving] = React.useState(false);
  const [salePriceDollars, setSalePriceDollars] = React.useState("");
  const [taxRatePercent, setTaxRatePercent] = React.useState("");
  const [docFeeDollars, setDocFeeDollars] = React.useState("");
  const [downPaymentDollars, setDownPaymentDollars] = React.useState("");
  const [structureError, setStructureError] = React.useState<string | null>(null);

  const [feeLabel, setFeeLabel] = React.useState("");
  const [feeAmountDollars, setFeeAmountDollars] = React.useState("");
  const [feeTaxable, setFeeTaxable] = React.useState(false);
  const [feeSubmitting, setFeeSubmitting] = React.useState(false);
  const [editingFeeId, setEditingFeeId] = React.useState<string | null>(null);
  const [editFeeLabel, setEditFeeLabel] = React.useState("");
  const [editFeeAmountDollars, setEditFeeAmountDollars] = React.useState("");
  const [editFeeTaxable, setEditFeeTaxable] = React.useState(false);

  const [tradeDescription, setTradeDescription] = React.useState("");
  const [tradeAllowanceDollars, setTradeAllowanceDollars] = React.useState("");
  const [tradePayoffDollars, setTradePayoffDollars] = React.useState("");
  const [tradeSubmitting, setTradeSubmitting] = React.useState(false);
  const [editingTradeId, setEditingTradeId] = React.useState<string | null>(null);
  const [editTradeDescription, setEditTradeDescription] = React.useState("");
  const [editTradeAllowanceDollars, setEditTradeAllowanceDollars] = React.useState("");
  const [editTradePayoffDollars, setEditTradePayoffDollars] = React.useState("");

  const [statusSubmitting, setStatusSubmitting] = React.useState(false);
  const [history, setHistory] = React.useState<DealHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  const isLocked = deal?.status === "CONTRACTED";
  const canEdit = canWrite && !isLocked;

  const fetchDeal = React.useCallback(async () => {
    if (!canRead) return;
    try {
      const res = await apiFetch<{ data: DealDetail }>(`/api/deals/${id}`);
      setDeal(res.data);
      setStructureError(null);
      setSalePriceDollars(res.data.salePriceCents ? centsToDollarInput(res.data.salePriceCents) : "");
      setTaxRatePercent(bpsToPercent(res.data.taxRateBps));
      setDocFeeDollars(res.data.docFeeCents ? centsToDollarInput(res.data.docFeeCents) : "");
      setDownPaymentDollars(res.data.downPaymentCents ? centsToDollarInput(res.data.downPaymentCents) : "");
      setError(null);
      setNotFound(false);
    } catch (e: unknown) {
      const status = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : 0;
      if (status === 404) {
        setNotFound(true);
        setDeal(null);
      } else {
        setError(e instanceof Error ? e.message : "Failed to load deal");
      }
    } finally {
      setLoading(false);
    }
  }, [id, canRead]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchDeal();
  }, [canRead, id, fetchDeal]);

  React.useEffect(() => {
    if (deal && activeTab === "history") {
      setHistoryLoading(true);
      apiFetch<{ data: DealHistoryEntry[] }>(`/api/deals/${id}/history?limit=50&offset=0`)
        .then((r) => setHistory(r.data ?? []))
        .catch(() => setHistory([]))
        .finally(() => setHistoryLoading(false));
    }
  }, [id, deal, activeTab]);

  const saveStructure = async () => {
    if (!deal || !canEdit) return;
    const saleCents = parseDollarsToCents(salePriceDollars);
    const docCents = parseDollarsToCents(docFeeDollars || "0");
    const downCents = parseDollarsToCents(downPaymentDollars || "0");
    if (!saleCents || !isValidDollarInput(salePriceDollars)) {
      setStructureError("Enter a valid sale price.");
      return;
    }
    const taxBps = percentToBps(taxRatePercent);
    if (taxBps < 0 || taxBps > 10000) {
      setStructureError("Tax rate must be 0–100%.");
      return;
    }
    setStructureSaving(true);
    setStructureError(null);
    try {
      const updated = await apiFetch<{ data: DealDetail }>(`/api/deals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          salePriceCents: saleCents,
          taxRateBps: taxBps,
          docFeeCents: docCents || "0",
          downPaymentCents: downCents || "0",
        }),
      });
      setDeal(updated.data);
      addToast("success", "Deal updated");
    } catch (e) {
      const msg = getApiErrorMessage(e);
      if (msg.toLowerCase().includes("contracted") || msg.toLowerCase().includes("locked")) {
        setStructureError("Deal is contracted and locked.");
      } else {
        setStructureError(msg);
      }
      addToast("error", msg);
    } finally {
      setStructureSaving(false);
    }
  };

  const addFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !feeLabel.trim()) return;
    const cents = parseDollarsToCents(feeAmountDollars || "0");
    if (!isValidDollarInput(feeAmountDollars || "0") && feeAmountDollars.trim()) {
      addToast("error", "Enter a valid fee amount.");
      return;
    }
    setFeeSubmitting(true);
    try {
      await apiFetch<{ data: DealFee }>(`/api/deals/${id}/fees`, {
        method: "POST",
        body: JSON.stringify({
          label: feeLabel.trim(),
          amountCents: cents || "0",
          taxable: feeTaxable,
        }),
      });
      await fetchDeal();
      setFeeLabel("");
      setFeeAmountDollars("");
      setFeeTaxable(false);
      addToast("success", "Fee added");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setFeeSubmitting(false);
    }
  };

  const updateFee = async (feeId: string) => {
    if (!canEdit) return;
    const cents = parseDollarsToCents(editFeeAmountDollars || "0");
    setFeeSubmitting(true);
    try {
      await apiFetch(`/api/deals/${id}/fees/${feeId}`, {
        method: "PATCH",
        body: JSON.stringify({
          label: editFeeLabel.trim(),
          amountCents: cents || "0",
          taxable: editFeeTaxable,
        }),
      });
      await fetchDeal();
      setEditingFeeId(null);
      addToast("success", "Fee updated");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setFeeSubmitting(false);
    }
  };

  const deleteFee = async (feeId: string) => {
    if (!canEdit) return;
    setFeeSubmitting(true);
    try {
      await apiFetch(`/api/deals/${id}/fees/${feeId}`, {
        method: "DELETE",
        expectNoContent: true,
      });
      await fetchDeal();
      addToast("success", "Fee removed");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setFeeSubmitting(false);
    }
  };

  const addOrUpdateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const allowanceCents = parseDollarsToCents(tradeAllowanceDollars || "0");
    const payoffCents = parseDollarsToCents(tradePayoffDollars || "0");
    if (!tradeDescription.trim()) {
      addToast("error", "Enter vehicle description.");
      return;
    }
    setTradeSubmitting(true);
    try {
      if (editingTradeId) {
        await apiFetch(`/api/deals/${id}/trade/${editingTradeId}`, {
          method: "PATCH",
          body: JSON.stringify({
            vehicleDescription: editTradeDescription.trim(),
            allowanceCents: parseDollarsToCents(editTradeAllowanceDollars || "0") || "0",
            payoffCents: parseDollarsToCents(editTradePayoffDollars || "0") || "0",
          }),
        });
        setEditingTradeId(null);
        addToast("success", "Trade updated");
      } else {
        await apiFetch<{ data: DealTrade }>(`/api/deals/${id}/trade`, {
          method: "POST",
          body: JSON.stringify({
            vehicleDescription: tradeDescription.trim(),
            allowanceCents: allowanceCents || "0",
            payoffCents: payoffCents || "0",
          }),
        });
        setTradeDescription("");
        setTradeAllowanceDollars("");
        setTradePayoffDollars("");
        addToast("success", "Trade added");
      }
      await fetchDeal();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setTradeSubmitting(false);
    }
  };

  const changeStatus = async (newStatus: DealStatus) => {
    if (!canWrite || !deal) return;
    setStatusSubmitting(true);
    try {
      const updated = await apiFetch<{ data: DealDetail }>(`/api/deals/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setDeal(updated.data);
      addToast("success", `Status updated to ${newStatus}`);
      if (activeTab === "history") {
        const r = await apiFetch<{ data: DealHistoryEntry[] }>(`/api/deals/${id}/history?limit=50&offset=0`);
        setHistory(r.data ?? []);
      }
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setStatusSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!canWrite || isLocked) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`/api/deals/${id}`, { method: "DELETE", expectNoContent: true });
      addToast("success", "Deal deleted");
      router.push("/deals");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
      setDeleteLoading(false);
    }
  };

  if (!canRead) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-[var(--text-soft)]">You don&apos;t have access to deals.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (notFound || !deal) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Deal</h1>
        <ErrorState title="Deal not found" onRetry={() => fetchDeal()} />
        <Link href="/deals">
          <Button variant="secondary">Back to Deals</Button>
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Deal</h1>
        <ErrorState message={error} onRetry={() => fetchDeal()} />
      </div>
    );
  }

  const nextStatusOptions = ALLOWED_NEXT[deal.status] ?? [];
  const vehicleDisplay = deal.vehicle
    ? [deal.vehicle.year, deal.vehicle.make, deal.vehicle.model].filter(Boolean).join(" ") ||
      deal.vehicle.stockNumber
    : deal.vehicleId;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">
            Deal — {deal.customer?.name ?? deal.customerId.slice(0, 8)} · {vehicleDisplay}
          </h1>
          <p className="text-sm text-[var(--text-soft)] mt-1">
            Created {new Date(deal.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/deals">
            <Button variant="secondary">Back to list</Button>
          </Link>
          {canWrite && !isLocked && (
            <WriteGuard>
              <Button
                variant="secondary"
                onClick={() => setDeleteConfirmOpen(true)}
                aria-label="Delete deal"
              >
                Delete deal
              </Button>
            </WriteGuard>
          )}
        </div>
      </div>

      {isLocked && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3"
          role="alert"
        >
          Deal is contracted and locked. Financial fields and fees/trade cannot be changed.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} aria-label="Deal sections">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="overview" selected={activeTab === "overview"} onSelect={() => setActiveTab("overview")}>
                Overview
              </TabsTrigger>
              <TabsTrigger value="fees" selected={activeTab === "fees"} onSelect={() => setActiveTab("fees")}>
                Fees
              </TabsTrigger>
              <TabsTrigger value="trade" selected={activeTab === "trade"} onSelect={() => setActiveTab("trade")}>
                Trade
              </TabsTrigger>
              <TabsTrigger value="status" selected={activeTab === "status"} onSelect={() => setActiveTab("status")}>
                Status & History
              </TabsTrigger>
              <TabsTrigger value="documents" selected={activeTab === "documents"} onSelect={() => setActiveTab("documents")}>
                Documents
              </TabsTrigger>
              <TabsTrigger value="finance" selected={activeTab === "finance"} onSelect={() => setActiveTab("finance")}>
                Finance
              </TabsTrigger>
              <TabsTrigger value="lenders" selected={activeTab === "lenders"} onSelect={() => setActiveTab("lenders")}>
                Lenders
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" selected={activeTab === "overview"}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Structure</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {structureError && (
                    <p className="text-sm text-[var(--danger)]" role="alert">
                      {structureError}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Sale price ($)"
                      value={salePriceDollars}
                      onChange={(e) => setSalePriceDollars(e.target.value)}
                      disabled={!canEdit}
                    />
                    <Input
                      label="Tax rate (%)"
                      value={taxRatePercent}
                      onChange={(e) => setTaxRatePercent(e.target.value)}
                      disabled={!canEdit}
                    />
                    <Input
                      label="Doc fee ($)"
                      value={docFeeDollars}
                      onChange={(e) => setDocFeeDollars(e.target.value)}
                      disabled={!canEdit}
                    />
                    <Input
                      label="Down payment ($)"
                      value={downPaymentDollars}
                      onChange={(e) => setDownPaymentDollars(e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                  {canEdit && (
                    <MutationButton onClick={saveStructure} disabled={structureSaving}>
                      {structureSaving ? "Saving…" : "Save structure"}
                    </MutationButton>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fees" selected={activeTab === "fees"}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Fees</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!canEdit && (
                    <p className="text-sm text-[var(--text-soft)]">
                      Not allowed to add or edit fees.
                    </p>
                  )}
                  {canEdit && (
                    <form onSubmit={addFee} className="flex flex-wrap items-end gap-4">
                      <Input
                        label="Label"
                        value={feeLabel}
                        onChange={(e) => setFeeLabel(e.target.value)}
                        placeholder="e.g. Admin fee"
                        className="min-w-[120px]"
                      />
                      <Input
                        label="Amount ($)"
                        value={feeAmountDollars}
                        onChange={(e) => setFeeAmountDollars(e.target.value)}
                        placeholder="0.00"
                        className="min-w-[100px]"
                      />
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={feeTaxable}
                          onChange={(e) => setFeeTaxable(e.target.checked)}
                          className="rounded border-[var(--border)]"
                        />
                        <span className="text-sm">Taxable</span>
                      </label>
                      <MutationButton type="submit" disabled={feeSubmitting}>
                        Add fee
                      </MutationButton>
                    </form>
                  )}
                  {deal.fees && deal.fees.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Label</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Taxable</TableHead>
                          {canEdit && <TableHead></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deal.fees.map((f) => (
                          <TableRow key={f.id}>
                            {editingFeeId === f.id ? (
                              <>
                                <TableCell>
                                  <Input
                                    value={editFeeLabel}
                                    onChange={(e) => setEditFeeLabel(e.target.value)}
                                    className="max-w-[140px]"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={editFeeAmountDollars}
                                    onChange={(e) => setEditFeeAmountDollars(e.target.value)}
                                    className="max-w-[100px]"
                                  />
                                </TableCell>
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    checked={editFeeTaxable}
                                    onChange={(e) => setEditFeeTaxable(e.target.checked)}
                                    className="rounded border-[var(--border)]"
                                    aria-label="Taxable"
                                  />
                                </TableCell>
                                <TableCell>
                                  <MutationButton
                                    type="button"
                                    size="sm"
                                    onClick={() => updateFee(f.id)}
                                    disabled={feeSubmitting}
                                  >
                                    Save
                                  </MutationButton>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setEditingFeeId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell>{f.label}</TableCell>
                                <TableCell className="text-right">{formatCents(f.amountCents)}</TableCell>
                                <TableCell>{f.taxable ? "Yes" : "No"}</TableCell>
                                {canEdit && (
                                  <TableCell>
                                    <WriteGuard>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => {
                                          setEditingFeeId(f.id);
                                          setEditFeeLabel(f.label);
                                          setEditFeeAmountDollars(centsToDollarInput(f.amountCents));
                                          setEditFeeTaxable(f.taxable);
                                        }}
                                      >
                                        Edit
                                      </Button>
                                      <MutationButton
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => deleteFee(f.id)}
                                        disabled={feeSubmitting}
                                        className="ml-1"
                                      >
                                        Delete
                                      </MutationButton>
                                    </WriteGuard>
                                  </TableCell>
                                )}
                              </>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-[var(--text-soft)]">No fees added.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trade" selected={activeTab === "trade"}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Trade-in</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!canEdit && (
                    <p className="text-sm text-[var(--text-soft)]">
                      Not allowed to add or edit trade.
                    </p>
                  )}
                  {canEdit && (
                    <form onSubmit={addOrUpdateTrade} className="space-y-4">
                      <Input
                        label="Vehicle description"
                        value={editingTradeId ? editTradeDescription : tradeDescription}
                        onChange={(e) =>
                          editingTradeId
                            ? setEditTradeDescription(e.target.value)
                            : setTradeDescription(e.target.value)
                        }
                        placeholder="e.g. 2018 Honda Accord"
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Allowance ($)"
                          value={editingTradeId ? editTradeAllowanceDollars : tradeAllowanceDollars}
                          onChange={(e) =>
                            editingTradeId
                              ? setEditTradeAllowanceDollars(e.target.value)
                              : setTradeAllowanceDollars(e.target.value)
                          }
                          placeholder="0"
                        />
                        <Input
                          label="Payoff ($)"
                          value={editingTradeId ? editTradePayoffDollars : tradePayoffDollars}
                          onChange={(e) =>
                            editingTradeId
                              ? setEditTradePayoffDollars(e.target.value)
                              : setTradePayoffDollars(e.target.value)
                          }
                          placeholder="0"
                        />
                      </div>
                      <MutationButton type="submit" disabled={tradeSubmitting}>
                        {editingTradeId ? "Update trade" : "Add trade"}
                      </MutationButton>
                      {editingTradeId && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setEditingTradeId(null)}
                          className="ml-2"
                        >
                          Cancel
                        </Button>
                      )}
                    </form>
                  )}
                  {deal.trades && deal.trades.length > 0 && (
                    <div className="border-t border-[var(--border)] pt-4">
                      {deal.trades.map((t) => {
                        const allowanceNum = Number(t.allowanceCents);
                        const payoffNum = Number(t.payoffCents);
                        const netCents = allowanceNum - payoffNum;
                        return (
                          <div
                            key={t.id}
                            className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-[var(--border)] last:border-0"
                          >
                            <div>
                              <p className="font-medium">{t.vehicleDescription}</p>
                              <p className="text-sm text-[var(--text-soft)]">
                                Allowance {formatCents(t.allowanceCents)} − Payoff {formatCents(t.payoffCents)} = Net{" "}
                                {formatCents(String(netCents))}
                              </p>
                            </div>
                            {canEdit && editingTradeId !== t.id && (
                              <WriteGuard>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setEditingTradeId(t.id);
                                    setEditTradeDescription(t.vehicleDescription);
                                    setEditTradeAllowanceDollars(centsToDollarInput(t.allowanceCents));
                                    setEditTradePayoffDollars(centsToDollarInput(t.payoffCents));
                                  }}
                                >
                                  Edit
                                </Button>
                              </WriteGuard>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {(!deal.trades || deal.trades.length === 0) && !canEdit && (
                    <p className="text-sm text-[var(--text-soft)]">No trade-in.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" selected={activeTab === "documents"}>
              <DealDocumentsTab dealId={id} />
            </TabsContent>

            <TabsContent value="finance" selected={activeTab === "finance"}>
              <DealFinanceTab dealId={id} dealStatus={deal.status} />
            </TabsContent>

            <TabsContent value="lenders" selected={activeTab === "lenders"}>
              <DealLendersTab dealId={id} dealStatus={deal.status} />
            </TabsContent>

            <TabsContent value="status" selected={activeTab === "status"}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Status & History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-sm font-medium text-[var(--text)]">Current status: </span>
                    <span className={statusBadgeClass(deal.status)}>{deal.status}</span>
                  </div>
                  {canWrite && nextStatusOptions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-[var(--text-soft)]">Change to:</span>
                      {nextStatusOptions.map((s) => (
                        <MutationButton
                          key={s}
                          size="sm"
                          variant="secondary"
                          onClick={() => changeStatus(s)}
                          disabled={statusSubmitting}
                        >
                          {s}
                        </MutationButton>
                      ))}
                    </div>
                  )}
                  {!canWrite && (
                    <p className="text-sm text-[var(--text-soft)]">Not allowed to change status.</p>
                  )}
                  <div className="pt-4">
                    <h4 className="text-sm font-medium text-[var(--text)] mb-2">History</h4>
                    {historyLoading ? (
                      <Skeleton className="h-24 w-full" />
                    ) : history.length === 0 ? (
                      <p className="text-sm text-[var(--text-soft)]">No status changes yet.</p>
                    ) : (
                      <ul className="space-y-2" role="list">
                        {history.map((h) => (
                          <li
                            key={h.id}
                            className="text-sm flex flex-wrap gap-2 items-center"
                          >
                            <span className="text-[var(--text-soft)]">
                              {h.fromStatus ?? "—"} → {h.toStatus}
                            </span>
                            <span className="text-[var(--text-soft)]">
                              {new Date(h.createdAt).toLocaleString()}
                            </span>
                            {h.changedBy && (
                              <span className="text-[var(--text-soft)]">
                                (by {String(h.changedBy).slice(0, 8)})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-[var(--text-soft)]">Gross excludes tax (DealerCenter-style).</p>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt>Total fees</dt>
                  <dd>{formatCents(deal.totalFeesCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Tax</dt>
                  <dd>{formatCents(deal.taxCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Total due</dt>
                  <dd className="font-medium">{formatCents(deal.totalDueCents)}</dd>
                </div>
                <div className="flex justify-between pt-2 border-t border-[var(--border)]">
                  <dt>Front gross</dt>
                  <dd className="font-medium">{formatCents(deal.frontGrossCents)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogHeader>
          <DialogTitle>Delete deal?</DialogTitle>
          <DialogDescription>
            This will soft-delete the deal. You can no longer edit it. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <MutationButton
            variant="secondary"
            onClick={handleDelete}
            disabled={deleteLoading || isLocked}
          >
            {deleteLoading ? "Deleting…" : "Delete"}
          </MutationButton>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
