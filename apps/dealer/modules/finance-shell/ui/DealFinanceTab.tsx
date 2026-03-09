"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { Select, type SelectOption } from "@/components/ui/select";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { MutationButton, WriteGuard } from "@/components/write-guard";
import {
  formatCents,
  parseDollarsToCents,
  isValidDollarInput,
  percentToBps,
  bpsToPercent,
  centsToDollarInput,
} from "@/lib/money";
import type {
  DealFinance,
  DealFinanceProduct,
  FinanceStatus,
  ProductType,
  FinancingMode,
} from "@/lib/types/finance";
import {
  FINANCE_STATUS_NEXT,
  PRODUCT_TYPE_OPTIONS,
} from "@/lib/types/finance";
import {
  computeFinanceTotals,
  computeMonthlyPaymentCents,
} from "@/modules/finance-shell/service/calculations";

const TERM_MIN = 1;
const TERM_MAX = 84;

const MODE_OPTIONS: SelectOption[] = [
  { value: "CASH", label: "Cash" },
  { value: "FINANCE", label: "Finance" },
];

const PRODUCT_TYPE_SELECT_OPTIONS: SelectOption[] = PRODUCT_TYPE_OPTIONS.map(
  (t) => ({ value: t, label: t })
);

function financeStatusToVariant(status: FinanceStatus): "info" | "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "DRAFT":
      return "neutral";
    case "STRUCTURED":
    case "PRESENTED":
      return "info";
    case "ACCEPTED":
      return "warning";
    case "CONTRACTED":
      return "success";
    case "CANCELED":
      return "danger";
    default:
      return "neutral";
  }
}

export function DealFinanceTab({
  dealId,
  dealStatus,
}: {
  dealId: string;
  dealStatus: string;
}) {
  const { addToast } = useToast();
  const { hasPermission } = useSession();
  const canRead = hasPermission("finance.read");
  const canWrite = hasPermission("finance.write");

  const [finance, setFinance] = React.useState<DealFinance | null>(null);
  const [products, setProducts] = React.useState<DealFinanceProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [conflictBanner, setConflictBanner] = React.useState<string | null>(
    null
  );

  const [mode, setMode] = React.useState<FinancingMode>("FINANCE");
  const [termMonths, setTermMonths] = React.useState("");
  const [aprPercent, setAprPercent] = React.useState("");
  const [cashDownDollars, setCashDownDollars] = React.useState("");
  const [firstPaymentDate, setFirstPaymentDate] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saveLoading, setSaveLoading] = React.useState(false);

  const [statusSubmitting, setStatusSubmitting] = React.useState(false);

  const [productModalOpen, setProductModalOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] =
    React.useState<DealFinanceProduct | null>(null);
  const [productType, setProductType] = React.useState<ProductType>("GAP");
  const [productName, setProductName] = React.useState("");
  const [productPriceDollars, setProductPriceDollars] = React.useState("");
  const [productCostDollars, setProductCostDollars] = React.useState("");
  const [productIncluded, setProductIncluded] = React.useState(true);
  const [productSubmitting, setProductSubmitting] = React.useState(false);

  const [deleteProductId, setDeleteProductId] = React.useState<string | null>(
    null
  );
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false);
  const [productIncludedTogglingId, setProductIncludedTogglingId] = React.useState<string | null>(null);

  const isDealContracted = dealStatus === "CONTRACTED";
  const canEditFinance = canWrite && !isDealContracted;

  const fetchFinance = React.useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    setConflictBanner(null);
    try {
      const res = await apiFetch<{ data: DealFinance }>(
        `/api/deals/${dealId}/finance`
      );
      setFinance(res.data);
      setMode(res.data.financingMode as FinancingMode);
      setTermMonths(
        res.data.termMonths != null ? String(res.data.termMonths) : ""
      );
      setAprPercent(
        res.data.aprBps != null ? bpsToPercent(res.data.aprBps) : ""
      );
      setCashDownDollars(centsToDollarInput(res.data.cashDownCents));
      setFirstPaymentDate(
        res.data.firstPaymentDate
          ? res.data.firstPaymentDate.toString().slice(0, 10)
          : ""
      );
    } catch (e: unknown) {
      const status =
        e && typeof e === "object" && "status" in e
          ? (e as { status: number }).status
          : 0;
      if (status === 404) {
        setNotFound(true);
        setFinance(null);
      } else {
        setError(getApiErrorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  }, [dealId, canRead]);

  const fetchProducts = React.useCallback(async () => {
    if (!canRead || !finance) return;
    try {
      const res = await apiFetch<{
        data: DealFinanceProduct[];
        meta: { total: number; limit: number; offset: number };
      }>(`/api/deals/${dealId}/finance/products?limit=100&offset=0`);
      setProducts(res.data ?? []);
    } catch {
      setProducts([]);
    }
  }, [dealId, canRead, finance]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    fetchFinance();
  }, [canRead, dealId, fetchFinance]);

  React.useEffect(() => {
    if (finance && canRead) {
      fetchProducts();
    } else {
      setProducts([]);
    }
  }, [finance, canRead, fetchProducts]);

  const refetchAll = React.useCallback(() => {
    fetchFinance().then(() => {
      if (finance) fetchProducts();
    });
  }, [fetchFinance, fetchProducts, finance]);

  const baseAmountCents = finance?.baseAmountCents
    ? BigInt(finance.baseAmountCents)
    : BigInt(0);
  const financedProductsCents = React.useMemo(
    () =>
      products
        .filter((p) => p.includedInAmountFinanced)
        .reduce((sum, p) => sum + BigInt(p.priceCents), BigInt(0)),
    [products]
  );
  const cashDownCentsForm = parseDollarsToCents(cashDownDollars || "0");
  const termForm = (() => {
    const t = parseInt(termMonths, 10);
    return Number.isNaN(t) || t < TERM_MIN || t > TERM_MAX ? 0 : t;
  })();
  const aprBpsForm = percentToBps(aprPercent);
  const liveTotals = React.useMemo(() => {
    if (mode !== "FINANCE" || baseAmountCents <= BigInt(0)) return null;
    return computeFinanceTotals({
      financingMode: "FINANCE",
      baseAmountCents,
      financedProductsCents,
      cashDownCents: BigInt(cashDownCentsForm),
      termMonths: termForm || 36,
      aprBps: aprBpsForm >= 0 ? aprBpsForm : 0,
    });
  }, [
    mode,
    baseAmountCents,
    financedProductsCents,
    cashDownCentsForm,
    termForm,
    aprBpsForm,
  ]);
  const liveBackendGrossCents = React.useMemo(
    () =>
      products.reduce((sum, p) => {
        if (p.costCents == null) return sum;
        return sum + BigInt(p.priceCents) - BigInt(p.costCents);
      }, BigInt(0)),
    [products]
  );

  const saveFinance = async () => {
    if (!canEditFinance) return;
    setFormError(null);
    if (mode === "FINANCE") {
      const term = parseInt(termMonths, 10);
      if (
        !termMonths.trim() ||
        Number.isNaN(term) ||
        term < TERM_MIN ||
        term > TERM_MAX
      ) {
        setFormError(`Term must be ${TERM_MIN}–${TERM_MAX} months.`);
        return;
      }
      const bps = percentToBps(aprPercent);
      if (bps < 0 || bps > 9999) {
        setFormError("APR must be 0–99.99%.");
        return;
      }
    }
    const cashCents = parseDollarsToCents(cashDownDollars || "0");
    if (cashDownDollars.trim() && !isValidDollarInput(cashDownDollars)) {
      setFormError("Enter a valid cash down amount.");
      return;
    }
    setSaveLoading(true);
    try {
      const payload: {
        financingMode: FinancingMode;
        termMonths?: number | null;
        aprBps?: number | null;
        cashDownCents?: string;
        firstPaymentDate?: string;
      } = {
        financingMode: mode,
      };
      if (mode === "FINANCE") {
        payload.termMonths = parseInt(termMonths, 10) || null;
        payload.aprBps = percentToBps(aprPercent) || null;
      } else {
        payload.termMonths = null;
        payload.aprBps = null;
      }
      payload.cashDownCents = cashCents || "0";
      if (firstPaymentDate.trim()) {
        payload.firstPaymentDate = firstPaymentDate.trim();
      }
      const updated = await apiFetch<{ data: DealFinance }>(
        `/api/deals/${dealId}/finance`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );
      setFinance(updated.data);
      setConflictBanner(null);
      addToast("success", "Finance structure saved");
      refetchAll();
    } catch (e: unknown) {
      const err = e as { status?: number; code?: string };
      const msg = getApiErrorMessage(e);
      if (err.status === 409 || err.code === "CONFLICT") {
        setConflictBanner(
          "Deal is contracted and finance is locked. Changes not saved."
        );
        addToast("error", msg);
      } else {
        setFormError(msg);
        addToast("error", msg);
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const createFinance = async () => {
    if (!canEditFinance) return;
    setFormError(null);
    setSaveLoading(true);
    try {
      const payload: {
        financingMode: FinancingMode;
        termMonths?: number | null;
        aprBps?: number | null;
        cashDownCents: string;
        firstPaymentDate?: string;
      } = {
        financingMode: mode,
        cashDownCents: parseDollarsToCents(cashDownDollars || "0") || "0",
      };
      if (mode === "FINANCE") {
        const term = parseInt(termMonths, 10);
        payload.termMonths =
          !Number.isNaN(term) && term >= TERM_MIN && term <= TERM_MAX
            ? term
            : 36;
        payload.aprBps = percentToBps(aprPercent) || 0;
      } else {
        payload.termMonths = null;
        payload.aprBps = null;
      }
      if (firstPaymentDate.trim()) {
        payload.firstPaymentDate = firstPaymentDate.trim();
      }
      const res = await apiFetch<{ data: DealFinance }>(
        `/api/deals/${dealId}/finance`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );
      setFinance(res.data);
      setNotFound(false);
      setConflictBanner(null);
      addToast("success", "Finance structure created");
      refetchAll();
    } catch (e: unknown) {
      const err = e as { status?: number; code?: string };
      const msg = getApiErrorMessage(e);
      if (err.status === 409 || err.code === "CONFLICT") {
        setConflictBanner(
          "Deal is contracted and finance is locked. Cannot create finance."
        );
        addToast("error", msg);
      } else {
        setFormError(msg);
        addToast("error", msg);
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const patchStatus = async (newStatus: FinanceStatus) => {
    if (!canWrite || !finance) return;
    setStatusSubmitting(true);
    setConflictBanner(null);
    try {
      const updated = await apiFetch<{ data: DealFinance }>(
        `/api/deals/${dealId}/finance/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        }
      );
      setFinance(updated.data);
      addToast("success", `Status updated to ${newStatus}`);
      refetchAll();
    } catch (e: unknown) {
      const err = e as { status?: number; code?: string };
      const msg = getApiErrorMessage(e);
      if (err.status === 409 || err.code === "CONFLICT") {
        setConflictBanner(
          "Deal is contracted and finance is locked. Status change not allowed."
        );
      }
      addToast("error", msg);
    } finally {
      setStatusSubmitting(false);
    }
  };

  const openAddProduct = () => {
    setEditingProduct(null);
    setProductType("GAP");
    setProductName("");
    setProductPriceDollars("");
    setProductCostDollars("");
    setProductIncluded(true);
    setProductModalOpen(true);
  };

  const openEditProduct = (p: DealFinanceProduct) => {
    setEditingProduct(p);
    setProductType(p.productType as ProductType);
    setProductName(p.name);
    setProductPriceDollars(centsToDollarInput(p.priceCents));
    setProductCostDollars(p.costCents ? centsToDollarInput(p.costCents) : "");
    setProductIncluded(p.includedInAmountFinanced);
    setProductModalOpen(true);
  };

  const saveProduct = async () => {
    if (!finance || !canEditFinance) return;
    const priceCents = parseDollarsToCents(productPriceDollars || "0");
    if (!productName.trim()) {
      addToast("error", "Name is required.");
      return;
    }
    if (!isValidDollarInput(productPriceDollars || "0") && productPriceDollars) {
      addToast("error", "Enter a valid price.");
      return;
    }
    setProductSubmitting(true);
    try {
      if (editingProduct) {
        await apiFetch<{ data: DealFinanceProduct }>(
          `/api/deals/${dealId}/finance/products/${editingProduct.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              productType,
              name: productName.trim(),
              priceCents: priceCents || "0",
              costCents: productCostDollars.trim()
                ? parseDollarsToCents(productCostDollars) || null
                : null,
              includedInAmountFinanced: productIncluded,
            }),
          }
        );
        addToast("success", "Product updated");
      } else {
        await apiFetch<{ data: DealFinanceProduct }>(
          `/api/deals/${dealId}/finance/products`,
          {
            method: "POST",
            body: JSON.stringify({
              productType,
              name: productName.trim(),
              priceCents: priceCents || "0",
              costCents: productCostDollars.trim()
                ? parseDollarsToCents(productCostDollars) || null
                : null,
              includedInAmountFinanced: productIncluded,
            }),
          }
        );
        addToast("success", "Product added");
      }
      setProductModalOpen(false);
      refetchAll();
    } catch (e: unknown) {
      const err = e as { status?: number; code?: string };
      const msg = getApiErrorMessage(e);
      if (err.status === 409 || err.code === "CONFLICT") {
        setConflictBanner(
          "Deal is contracted and finance is locked. Product change not allowed."
        );
      }
      addToast("error", msg);
    } finally {
      setProductSubmitting(false);
    }
  };

  const confirmDeleteProduct = async (productId: string) => {
    if (!canEditFinance) return;
    setDeleteSubmitting(true);
    try {
      await apiFetch(`/api/deals/${dealId}/finance/products/${productId}`, {
        method: "DELETE",
        expectNoContent: true,
      });
      addToast("success", "Product removed");
      setDeleteProductId(null);
      refetchAll();
    } catch (e: unknown) {
      const err = e as { status?: number; code?: string };
      const msg = getApiErrorMessage(e);
      if (err.status === 409 || err.code === "CONFLICT") {
        setConflictBanner(
          "Deal is contracted and finance is locked. Delete not allowed."
        );
      }
      addToast("error", msg);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const toggleProductIncluded = async (p: DealFinanceProduct) => {
    if (!canEditFinance || isDealContracted) return;
    setProductIncludedTogglingId(p.id);
    try {
      await apiFetch(`/api/deals/${dealId}/finance/products/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          includedInAmountFinanced: !p.includedInAmountFinanced,
        }),
      });
      addToast("success", "Product updated");
      refetchAll();
    } catch (e: unknown) {
      const err = e as { status?: number; code?: string };
      const msg = getApiErrorMessage(e);
      if (err.status === 409 || err.code === "CONFLICT") {
        setConflictBanner(
          "Deal is contracted and finance is locked. Product change not allowed."
        );
      }
      addToast("error", msg);
    } finally {
      setProductIncludedTogglingId(null);
    }
  };

  if (!canRead) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-[var(--text-soft)]">
          You don&apos;t have access to finance.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load finance"
        message={error}
        onRetry={fetchFinance}
      />
    );
  }

  if (notFound && !finance) {
    return (
      <div className="space-y-4">
        {isDealContracted && (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3"
            role="alert"
          >
            Deal is contracted and finance is locked.
          </div>
        )}
        {canWrite ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Finance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <EmptyState
                title="No finance data"
                description="Create a finance structure to set cash vs finance, term, APR, and products."
              />
              {!isDealContracted && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select
                      label="Mode"
                      options={MODE_OPTIONS}
                      value={mode}
                      onChange={(v) => setMode(v as FinancingMode)}
                    />
                    <Input
                      label="Cash down ($)"
                      value={cashDownDollars}
                      onChange={(e) => setCashDownDollars(e.target.value)}
                      placeholder="0.00"
                    />
                    {mode === "FINANCE" && (
                      <>
                        <Input
                          label="Term (months)"
                          value={termMonths}
                          onChange={(e) => setTermMonths(e.target.value)}
                          placeholder="36"
                        />
                        <Input
                          label="APR (%)"
                          value={aprPercent}
                          onChange={(e) => setAprPercent(e.target.value)}
                          placeholder="0.00"
                        />
                      </>
                    )}
                    <Input
                      label="First payment date"
                      type="date"
                      value={firstPaymentDate}
                      onChange={(e) => setFirstPaymentDate(e.target.value)}
                    />
                  </div>
                  {formError && (
                    <p className="text-sm text-[var(--danger)]" role="alert">
                      {formError}
                    </p>
                  )}
                  <Button
                    onClick={createFinance}
                    disabled={saveLoading || isDealContracted}
                  >
                    {saveLoading ? "Creating…" : "Create finance structure"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
            <p className="text-[var(--text-soft)]">No finance data.</p>
          </div>
        )}
      </div>
    );
  }

  const nextStatuses = finance
    ? FINANCE_STATUS_NEXT[finance.status as FinanceStatus] ?? []
    : [];

  return (
    <div className="space-y-6">
      {conflictBanner && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3"
          role="alert"
        >
          {conflictBanner}
        </div>
      )}

      {isDealContracted && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3"
          role="alert"
        >
          Deal is contracted and finance is locked.
        </div>
      )}

      {finance && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Finance structure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canWrite && (
                <p className="text-sm text-[var(--text-soft)]">
                  Not allowed. You can only view finance data.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Mode"
                  options={MODE_OPTIONS}
                  value={finance.financingMode}
                  onChange={(v) => setMode(v as FinancingMode)}
                  disabled={!canEditFinance}
                />
                <Input
                  label="Cash down ($)"
                  value={cashDownDollars}
                  onChange={(e) => setCashDownDollars(e.target.value)}
                  disabled={!canEditFinance}
                />
                {mode === "FINANCE" && (
                  <>
                    <Input
                      label="Term (months)"
                      value={termMonths}
                      onChange={(e) => setTermMonths(e.target.value)}
                      placeholder="12–84"
                      disabled={!canEditFinance}
                    />
                    <Input
                      label="APR (%)"
                      value={aprPercent}
                      onChange={(e) => setAprPercent(e.target.value)}
                      placeholder="0.00"
                      disabled={!canEditFinance}
                    />
                  </>
                )}
                <Input
                  label="First payment date"
                  type="date"
                  value={firstPaymentDate}
                  onChange={(e) => setFirstPaymentDate(e.target.value)}
                  disabled={!canEditFinance}
                />
              </div>
              {mode === "CASH" && (
                <p className="text-sm text-[var(--text-soft)]">
                  Monthly payment: $0.00 (cash deal).
                </p>
              )}
              {formError && (
                <p className="text-sm text-[var(--danger)]" role="alert">
                  {formError}
                </p>
              )}
              {canEditFinance && (
                <MutationButton onClick={saveFinance} disabled={saveLoading}>
                  {saveLoading ? "Saving…" : "Save"}
                </MutationButton>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={
                  !isDealContracted && liveTotals
                    ? "grid grid-cols-1 sm:grid-cols-2 gap-6"
                    : ""
                }
              >
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-soft)] mb-2">
                    Saved
                  </h4>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt>Amount financed</dt>
                      <dd>{formatCents(finance.amountFinancedCents)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Monthly payment</dt>
                      <dd>{formatCents(finance.monthlyPaymentCents)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Total of payments</dt>
                      <dd>{formatCents(finance.totalOfPaymentsCents)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Finance charge</dt>
                      <dd>{formatCents(finance.financeChargeCents)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Products total</dt>
                      <dd>{formatCents(finance.productsTotalCents)}</dd>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-[var(--border)]">
                      <dt>Backend gross</dt>
                      <dd className="font-medium">
                        {formatCents(finance.backendGrossCents)}
                      </dd>
                    </div>
                  </dl>
                </div>
                {!isDealContracted && liveTotals && (
                  <div>
                    <h4 className="text-sm font-medium text-[var(--accent)] mb-2">
                      Current (live)
                    </h4>
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt>Amount financed</dt>
                        <dd>{formatCents(String(liveTotals.amountFinancedCents))}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Monthly payment</dt>
                        <dd>{formatCents(String(liveTotals.monthlyPaymentCents))}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Total of payments</dt>
                        <dd>{formatCents(String(liveTotals.totalOfPaymentsCents))}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Finance charge</dt>
                        <dd>{formatCents(String(liveTotals.financeChargeCents))}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Products total</dt>
                        <dd>{formatCents(String(financedProductsCents))}</dd>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-[var(--border)]">
                        <dt>Backend gross</dt>
                        <dd className="font-medium">
                          {formatCents(String(liveBackendGrossCents))}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {mode === "FINANCE" && (liveTotals ?? finance) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">APR impact</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--text-soft)] mb-3">
                  Monthly payment at different APRs (same amount financed and term).
                </p>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt>At 0% APR</dt>
                    <dd>
                      {formatCents(
                        String(
                          computeMonthlyPaymentCents(
                            liveTotals?.amountFinancedCents ?? BigInt(finance.amountFinancedCents),
                            0,
                            termForm || finance.termMonths || 36
                          )
                        )
                      )}
                      /mo
                    </dd>
                  </div>
                  <div className="flex justify-between font-medium">
                    <dt>At current APR ({bpsToPercent(aprBpsForm >= 0 ? aprBpsForm : (finance.aprBps ?? 0))}%)</dt>
                    <dd>
                      {formatCents(
                        String(
                          liveTotals?.monthlyPaymentCents ?? finance.monthlyPaymentCents
                        )
                      )}
                      /mo
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>At +3% APR</dt>
                    <dd>
                      {formatCents(
                        String(
                          computeMonthlyPaymentCents(
                            liveTotals?.amountFinancedCents ?? BigInt(finance.amountFinancedCents),
                            (aprBpsForm >= 0 ? aprBpsForm : finance.aprBps ?? 0) + 300,
                            termForm || finance.termMonths || 36
                          )
                        )
                      )}
                      /mo
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Status</CardTitle>
              <StatusBadge variant={financeStatusToVariant(finance.status as FinanceStatus)}>
                {finance.status}
              </StatusBadge>
            </CardHeader>
            <CardContent className="space-y-2">
              {canWrite && !isDealContracted && nextStatuses.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-[var(--text-soft)]">
                    Change to:
                  </span>
                  {nextStatuses.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant="secondary"
                      onClick={() => patchStatus(s)}
                      disabled={statusSubmitting}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              )}
              {canWrite && !isDealContracted && nextStatuses.length === 0 && (
                <p className="text-sm text-[var(--text-soft)]">
                  No further status transitions.
                </p>
              )}
              {!canWrite && (
                <p className="text-sm text-[var(--text-soft)]">
                  Not allowed to change status.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Products</CardTitle>
              {canEditFinance && (
                <WriteGuard>
                  <Button size="sm" onClick={openAddProduct}>
                    Add product
                  </Button>
                </WriteGuard>
              )}
            </CardHeader>
            <CardContent>
              {!canWrite && (
                <p className="text-sm text-[var(--text-soft)] mb-2">
                  Not allowed to add or edit products.
                </p>
              )}
              {products.length === 0 ? (
                <p className="text-sm text-[var(--text-soft)]">
                  No products added.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead>Included in amount financed</TableHead>
                      {canEditFinance && <TableHead></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.productType}</TableCell>
                        <TableCell>{p.name}</TableCell>
                        <TableCell className="text-right">
                          {formatCents(p.priceCents)}
                        </TableCell>
                        <TableCell className="text-right">
                          {p.costCents != null
                            ? formatCents(p.costCents)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {canEditFinance && !isDealContracted ? (
                            <WriteGuard>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={p.includedInAmountFinanced}
                                  onChange={() => toggleProductIncluded(p)}
                                  disabled={productIncludedTogglingId === p.id}
                                  className="rounded border-[var(--border)]"
                                  aria-label="Included in amount financed"
                                />
                                <span className="text-sm">
                                  {p.includedInAmountFinanced ? "Yes" : "No"}
                                </span>
                              </label>
                            </WriteGuard>
                          ) : (
                            <span className="text-sm">
                              {p.includedInAmountFinanced ? "Yes" : "No"}
                            </span>
                          )}
                        </TableCell>
                        {canEditFinance && (
                          <TableCell>
                            <WriteGuard>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => openEditProduct(p)}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => setDeleteProductId(p.id)}
                                className="ml-1"
                              >
                                Delete
                              </Button>
                            </WriteGuard>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog
        open={productModalOpen}
        onOpenChange={(open) => {
          if (!productSubmitting) setProductModalOpen(open);
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {editingProduct ? "Edit product" : "Add product"}
          </DialogTitle>
          <DialogDescription>
            {editingProduct
              ? "Update product details. Totals will recalculate after save."
              : "Add a backend product (GAP, VSC, etc.). Totals will recalculate."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Select
            label="Type"
            options={PRODUCT_TYPE_SELECT_OPTIONS}
            value={productType}
            onChange={(v) => setProductType(v as ProductType)}
          />
          <Input
            label="Name"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g. GAP Waiver"
          />
          <Input
            label="Price ($)"
            value={productPriceDollars}
            onChange={(e) => setProductPriceDollars(e.target.value)}
            placeholder="0.00"
          />
          <Input
            label="Cost ($) optional"
            value={productCostDollars}
            onChange={(e) => setProductCostDollars(e.target.value)}
            placeholder="0.00"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={productIncluded}
              onChange={(e) => setProductIncluded(e.target.checked)}
              className="rounded border-[var(--border)]"
              aria-label="Included in amount financed"
            />
            <span className="text-sm">Included in amount financed</span>
          </label>
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => setProductModalOpen(false)}
            disabled={productSubmitting}
          >
            Cancel
          </Button>
          <MutationButton onClick={saveProduct} disabled={productSubmitting}>
            {productSubmitting ? "Saving…" : editingProduct ? "Save" : "Add"}
          </MutationButton>
        </DialogFooter>
      </Dialog>

      <Dialog
        open={deleteProductId !== null}
        onOpenChange={(open) => {
          if (!open && !deleteSubmitting) setDeleteProductId(null);
        }}
      >
        <DialogHeader>
          <DialogTitle>Delete product?</DialogTitle>
          <DialogDescription>
            This will remove the product from the deal. Totals will recalculate.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => setDeleteProductId(null)}
            disabled={deleteSubmitting}
          >
            Cancel
          </Button>
          <MutationButton
            variant="secondary"
            onClick={() =>
              deleteProductId && confirmDeleteProduct(deleteProductId)
            }
            disabled={deleteSubmitting}
          >
            {deleteSubmitting ? "Deleting…" : "Delete"}
          </MutationButton>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
