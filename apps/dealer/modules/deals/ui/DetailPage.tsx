"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { PageShell } from "@/components/ui/page-shell";
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
import { DEAL_STATUS_OPTIONS, dealStatusToVariant, getDealMode } from "./types";
import { MutationButton, WriteGuard } from "@/components/write-guard";
import { StatusBadge } from "@/components/ui/status-badge";
import { DealDocumentsTab } from "@/modules/documents/ui/DealDocumentsTab";
import { DealFinanceTab } from "@/modules/finance-shell/ui/DealFinanceTab";
import { DealLendersTab } from "@/modules/lender-integration/ui/DealLendersTab";
import { DealCreditTab } from "@/modules/finance-core/ui/DealCreditTab";
import { DealDocumentVaultTab } from "@/modules/finance-core/ui/DealDocumentVaultTab";
import { DealComplianceTab } from "@/modules/finance-core/ui/DealComplianceTab";
import { DealProfitCard } from "@/modules/accounting-core/ui/DealProfitCard";
import { DealDeliveryFundingTab } from "./DealDeliveryFundingTab";
import { DealTitleDmvTab } from "./DealTitleDmvTab";
import { ActivityTimeline, TimelineItem } from "@/components/ui-system/timeline";
import { DealWorkspace, EntityHeader } from "@/components/ui-system/entities";
import { getDealWorkspaceHref } from "./deal-workspace-href";

const ALLOWED_NEXT: Record<DealStatus, DealStatus[]> = {
  DRAFT: ["STRUCTURED", "CANCELED"],
  STRUCTURED: ["APPROVED", "CANCELED"],
  APPROVED: ["CONTRACTED", "CANCELED"],
  CONTRACTED: ["CANCELED"],
  CANCELED: [],
};


export type DealDetailPageProps = {
  id: string;
  /** When provided, used as initial data and no client fetch is performed (server-first modal). */
  initialData?: DealDetail | null;
};

export function DealDetailPage({ id, initialData: initialDataProp }: DealDetailPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const { hasPermission } = useSession();
  const canRead = hasPermission("deals.read");
  const canWrite = hasPermission("deals.write");

  const [deal, setDeal] = React.useState<DealDetail | null>(initialDataProp ?? null);
  const [loading, setLoading] = React.useState(!initialDataProp);
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
  const [removeTradeId, setRemoveTradeId] = React.useState<string | null>(null);
  const [removeTradeLoading, setRemoveTradeLoading] = React.useState(false);
  const [cancelStatusConfirmOpen, setCancelStatusConfirmOpen] = React.useState(false);

  const isLocked = deal?.status === "CONTRACTED";
  const canEdit = canWrite && !isLocked;
  const dealMode = deal ? getDealMode(deal) : "FINANCE";
  const isFinanceDeal = dealMode === "FINANCE";

  React.useEffect(() => {
    const focus = searchParams.get("focus");
    if (focus === "delivery-funding" || focus === "title-dmv" || focus === "finance") {
      setActiveTab(focus);
    }
  }, [searchParams]);

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
    if (initialDataProp) {
      setDeal(initialDataProp);
      setStructureError(null);
      setSalePriceDollars(initialDataProp.salePriceCents ? centsToDollarInput(initialDataProp.salePriceCents) : "");
      setTaxRatePercent(bpsToPercent(initialDataProp.taxRateBps));
      setDocFeeDollars(initialDataProp.docFeeCents ? centsToDollarInput(initialDataProp.docFeeCents) : "");
      setDownPaymentDollars(initialDataProp.downPaymentCents ? centsToDollarInput(initialDataProp.downPaymentCents) : "");
      setError(null);
      setNotFound(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchDeal();
  }, [canRead, id, fetchDeal, initialDataProp]);

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

  const deleteTrade = async (tradeId: string) => {
    if (!canEdit) return;
    setRemoveTradeLoading(true);
    try {
      await apiFetch(`/api/deals/${id}/trade/${tradeId}`, {
        method: "DELETE",
        expectNoContent: true,
      });
      await fetchDeal();
      setRemoveTradeId(null);
      addToast("success", "Trade removed");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setRemoveTradeLoading(false);
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
      setCancelStatusConfirmOpen(false);
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

  const requestStatusChange = (newStatus: DealStatus) => {
    if (newStatus === "CANCELED") {
      setCancelStatusConfirmOpen(true);
    } else {
      changeStatus(newStatus);
    }
  };

  const confirmCancelDeal = () => {
    changeStatus("CANCELED");
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
      <PageShell>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
          <p className="text-[var(--text-soft)]">You don&apos;t have access to deals.</p>
        </div>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </PageShell>
    );
  }

  if (notFound || !deal) {
    return (
      <PageShell className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Deal</h1>
        <ErrorState title="Deal not found" onRetry={() => fetchDeal()} />
        <Link href="/deals">
          <Button variant="secondary">Back to Deals</Button>
        </Link>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Deal</h1>
        <ErrorState message={error} onRetry={() => fetchDeal()} />
      </PageShell>
    );
  }

  const nextStatusOptions = ALLOWED_NEXT[deal.status] ?? [];
  const vehicleDisplay = deal.vehicle
    ? [deal.vehicle.year, deal.vehicle.make, deal.vehicle.model].filter(Boolean).join(" ") ||
      deal.vehicle.stockNumber
    : deal.vehicleId;
  const fundingStatus = deal.dealFundings?.[0]?.fundingStatus ?? null;

  return (
    <PageShell className="space-y-6">
      <EntityHeader
        title={`Deal — ${deal.customer?.name ?? deal.customerId.slice(0, 8)} · ${vehicleDisplay}`}
        subtitle={`${isFinanceDeal ? "Finance" : "Cash"} deal · Created ${new Date(deal.createdAt).toLocaleDateString()}`}
        breadcrumbs={(
          <Link href="/deals" className="text-sm text-[var(--accent)] hover:underline">
            ← Back to deals
          </Link>
        )}
        status={(
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge variant={isFinanceDeal ? "info" : "neutral"}>
              {isFinanceDeal ? "Finance deal" : "Cash deal"}
            </StatusBadge>
            <StatusBadge variant={dealStatusToVariant(deal.status)}>{deal.status}</StatusBadge>
          </div>
        )}
        actions={(
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
        )}
      />

      {isLocked && (
        <div
          className="rounded-lg border border-[var(--warning)] bg-[var(--warning-surface)] text-[var(--warning-text)] px-4 py-3"
          role="alert"
        >
          Deal is contracted and locked. Financial fields and fees/trade cannot be changed.
        </div>
      )}

      <DealWorkspace
        main={(
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
              <TabsTrigger value="delivery-funding" selected={activeTab === "delivery-funding"} onSelect={() => setActiveTab("delivery-funding")}>
                {isFinanceDeal ? "Delivery & Funding" : "Delivery"}
              </TabsTrigger>
              <TabsTrigger value="title-dmv" selected={activeTab === "title-dmv"} onSelect={() => setActiveTab("title-dmv")}>
                Title & DMV
              </TabsTrigger>
              <TabsTrigger value="documents" selected={activeTab === "documents"} onSelect={() => setActiveTab("documents")}>
                Documents
              </TabsTrigger>
              {isFinanceDeal ? (
                <TabsTrigger value="finance" selected={activeTab === "finance"} onSelect={() => setActiveTab("finance")}>
                  Finance
                </TabsTrigger>
              ) : null}
              {isFinanceDeal ? (
                <TabsTrigger value="lenders" selected={activeTab === "lenders"} onSelect={() => setActiveTab("lenders")}>
                  Lenders
                </TabsTrigger>
              ) : null}
              {isFinanceDeal && hasPermission("finance.submissions.read") ? (
                <TabsTrigger value="credit" selected={activeTab === "credit"} onSelect={() => setActiveTab("credit")}>
                  Credit
                </TabsTrigger>
              ) : null}
              {isFinanceDeal && hasPermission("finance.submissions.read") ? (
                <TabsTrigger value="compliance" selected={activeTab === "compliance"} onSelect={() => setActiveTab("compliance")}>
                  Compliance
                </TabsTrigger>
              ) : null}
              <TabsTrigger value="totals" selected={activeTab === "totals"} onSelect={() => setActiveTab("totals")}>
                Totals
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" selected={activeTab === "overview"}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {isFinanceDeal ? "Finance track" : "Cash track"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">
                        {isFinanceDeal ? "Amount financed" : "Cash due at close"}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--text)]">
                        {formatCents(
                          isFinanceDeal
                            ? deal.dealFinance?.amountFinancedCents ?? "0"
                            : deal.totalDueCents
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">
                        {isFinanceDeal ? "Finance status" : "Payment posture"}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[var(--text)]">
                        {isFinanceDeal ? deal.dealFinance?.status ?? "DRAFT" : deal.status === "CONTRACTED" ? "Collected" : "Pending"}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">
                        {isFinanceDeal
                          ? fundingStatus
                            ? `Funding ${fundingStatus.toLowerCase()}`
                            : "Continue through lender and funding workflow."
                          : "Funding workflow is skipped for cash deals."}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">
                        Next step
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link href={getDealWorkspaceHref(id, isFinanceDeal ? "finance" : "delivery-funding")}>
                          <Button variant="secondary" size="sm">
                            {isFinanceDeal ? "Open finance" : "Open delivery"}
                          </Button>
                        </Link>
                        <Link href={getDealWorkspaceHref(id, "title-dmv")}>
                          <Button variant="secondary" size="sm">Open title</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {isFinanceDeal ? "Shared desk structure" : "Cash desk structure"}
                  </CardTitle>
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Fees summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt>Total fees</dt>
                      <dd>{formatCents(deal.totalFeesCents)}</dd>
                    </div>
                    {deal.fees && deal.fees.length > 0 && (
                      <ul className="list-disc list-inside text-[var(--text-soft)] mt-2 space-y-0.5" role="list">
                        {deal.fees.map((f) => (
                          <li key={f.id}>
                            {f.label}: {formatCents(f.amountCents)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </dl>
                  <p className="mt-3 text-sm text-[var(--text-soft)]">
                    {isFinanceDeal
                      ? "Desk values feed the finance, delivery, funding, and title workflow."
                      : "Desk values feed the cash closeout, delivery, and title workflow."}
                  </p>
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
                        const equityCents =
                          t.equityCents != null
                            ? Number(t.equityCents)
                            : Number(t.allowanceCents) - Number(t.payoffCents);
                        const isNegativeEquity = equityCents < 0;
                        return (
                          <div
                            key={t.id}
                            className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-[var(--border)] last:border-0"
                          >
                            <div>
                              <p className="font-medium">{t.vehicleDescription}</p>
                              <p className="text-sm text-[var(--text-soft)]">
                                Allowance {formatCents(t.allowanceCents)} − Payoff {formatCents(t.payoffCents)}
                                {" = "}
                                {isNegativeEquity ? (
                                  <>Negative equity ({formatCents(String(Math.abs(equityCents)))})</>
                                ) : (
                                  <>Equity {formatCents(String(equityCents))}</>
                                )}
                              </p>
                            </div>
                            {canEdit && editingTradeId !== t.id && (
                              <WriteGuard>
                                <div className="flex gap-1">
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
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setRemoveTradeId(t.id)}
                                    aria-label={`Remove trade ${t.vehicleDescription}`}
                                  >
                                    Remove
                                  </Button>
                                </div>
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
              {hasPermission("finance.submissions.read") ? (
                <DealDocumentVaultTab dealId={id} />
              ) : (
                <DealDocumentsTab dealId={id} />
              )}
            </TabsContent>

            <TabsContent value="totals" selected={activeTab === "totals"}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Totals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-[var(--text-soft)]">
                    Server-computed values. Gross excludes tax (DealerCenter-style).
                  </p>
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
                    {deal.dealFinance && (
                      <>
                        <div className="flex justify-between pt-2 border-t border-[var(--border)]">
                          <dt>Products total</dt>
                          <dd>{formatCents(deal.dealFinance.productsTotalCents)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Backend gross</dt>
                          <dd className="font-medium">{formatCents(deal.dealFinance.backendGrossCents)}</dd>
                        </div>
                      </>
                    )}
                  </dl>
                </CardContent>
              </Card>
            </TabsContent>

            {isFinanceDeal ? (
              <TabsContent value="finance" selected={activeTab === "finance"}>
                <DealFinanceTab dealId={id} dealStatus={deal.status} />
              </TabsContent>
            ) : null}

            {isFinanceDeal ? (
              <TabsContent value="lenders" selected={activeTab === "lenders"}>
                <DealLendersTab dealId={id} dealStatus={deal.status} />
              </TabsContent>
            ) : null}

            {isFinanceDeal && hasPermission("finance.submissions.read") && (
              <TabsContent value="credit" selected={activeTab === "credit"}>
                <DealCreditTab dealId={id} dealStatus={deal.status} />
              </TabsContent>
            )}
            {isFinanceDeal && hasPermission("finance.submissions.read") && (
              <TabsContent value="compliance" selected={activeTab === "compliance"}>
                <DealComplianceTab dealId={id} />
              </TabsContent>
            )}

            <TabsContent value="delivery-funding" selected={activeTab === "delivery-funding"}>
              {deal && (
                <DealDeliveryFundingTab
                  deal={deal}
                  dealId={id}
                  onDealUpdated={setDeal}
                  canWriteDeals={canWrite}
                  canWriteFunding={hasPermission("finance.submissions.write")}
                />
              )}
            </TabsContent>
            <TabsContent value="title-dmv" selected={activeTab === "title-dmv"}>
              {deal && (
                <DealTitleDmvTab
                  deal={deal}
                  dealId={id}
                  onDealUpdated={setDeal}
                  canWrite={canWrite}
                />
              )}
            </TabsContent>
            <TabsContent value="status" selected={activeTab === "status"}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Status & History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-sm font-medium text-[var(--text)]">Current status: </span>
                    <StatusBadge variant={dealStatusToVariant(deal.status)}>
                      {DEAL_STATUS_OPTIONS.find((o) => o.value === deal.status)?.label ?? deal.status}
                    </StatusBadge>
                  </div>
                  {canWrite && nextStatusOptions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-[var(--text-soft)]">Change to:</span>
                      {nextStatusOptions.map((s) => (
                        <MutationButton
                          key={s}
                          size="sm"
                          variant="secondary"
                          onClick={() => requestStatusChange(s)}
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
                    {historyLoading ? (
                      <Skeleton className="h-24 w-full" />
                    ) : (
                      <ActivityTimeline
                        title="History"
                        emptyTitle="No status changes yet"
                        emptyDescription="Status transitions will appear here."
                      >
                        {history.map((h) => (
                          <TimelineItem
                            key={h.id}
                            title={`${h.fromStatus ?? "—"} → ${h.toStatus}`}
                            timestamp={new Date(h.createdAt).toLocaleString()}
                            detail={h.changedBy ? `by ${String(h.changedBy).slice(0, 8)}` : undefined}
                          />
                        ))}
                      </ActivityTimeline>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
        rail={(
          <>
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
            <DealProfitCard dealId={id} />
          </>
        )}
      />

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

      <Dialog open={cancelStatusConfirmOpen} onOpenChange={(open) => !open && setCancelStatusConfirmOpen(false)}>
        <DialogHeader>
          <DialogTitle>Cancel deal?</DialogTitle>
          <DialogDescription>
            This will change the deal status to Canceled. You can no longer move it back to an active status.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setCancelStatusConfirmOpen(false)} disabled={statusSubmitting}>
            Keep
          </Button>
          <MutationButton variant="secondary" onClick={confirmCancelDeal} disabled={statusSubmitting}>
            {statusSubmitting ? "Updating…" : "Cancel deal"}
          </MutationButton>
        </DialogFooter>
      </Dialog>

      <Dialog open={removeTradeId !== null} onOpenChange={(open) => !open && !removeTradeLoading && setRemoveTradeId(null)}>
        <DialogHeader>
          <DialogTitle>Remove trade-in?</DialogTitle>
          <DialogDescription>
            This will remove the trade-in from the deal. Totals will recalculate.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setRemoveTradeId(null)} disabled={removeTradeLoading}>
            Cancel
          </Button>
          <MutationButton
            variant="secondary"
            onClick={() => removeTradeId && deleteTrade(removeTradeId)}
            disabled={removeTradeLoading}
          >
            {removeTradeLoading ? "Removing…" : "Remove"}
          </MutationButton>
        </DialogFooter>
      </Dialog>
    </PageShell>
  );
}
