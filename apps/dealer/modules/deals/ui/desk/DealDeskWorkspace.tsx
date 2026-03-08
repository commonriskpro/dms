"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  centsToDollarInput,
  parseDollarsToCents,
  percentToBps,
  bpsToPercent,
  isValidDollarInput,
} from "@/lib/money";
import type { DealDeskData, DealDetail, DealStatus } from "../types";
import { DealHeader } from "./DealHeader";
import { CustomerCard } from "./CustomerCard";
import { VehicleCard } from "./VehicleCard";
import { TradeCard } from "./TradeCard";
import { FeesCard } from "./FeesCard";
import { ProductsCard } from "./ProductsCard";
import { FinanceTermsCard } from "./FinanceTermsCard";
import { DealTotalsCard } from "./DealTotalsCard";
import { ActivityPanel } from "./ActivityPanel";
import { AuditPanel } from "./AuditPanel";

type FeeDraft = { id?: string; label: string; amountCents: string; taxable: boolean };
type TradeDraft = { vehicleDescription: string; allowanceCents: string; payoffCents: string } | null;
type ProductDraft = {
  id?: string;
  productType: string;
  name: string;
  priceCents: string;
  includedInAmountFinanced: boolean;
};

function feesFromDeal(deal: DealDetail): FeeDraft[] {
  return (deal.fees ?? []).map((f) => ({
    id: f.id,
    label: f.label,
    amountCents: f.amountCents,
    taxable: f.taxable,
  }));
}
function tradeFromDeal(deal: DealDetail): TradeDraft {
  const t = deal.trades?.[0];
  if (!t) return null;
  return {
    vehicleDescription: t.vehicleDescription,
    allowanceCents: t.allowanceCents,
    payoffCents: t.payoffCents,
  };
}
function productsFromDeal(deal: DealDetail): ProductDraft[] {
  return (deal.dealFinance?.products ?? []).map((p) => ({
    id: p.id,
    productType: p.productType,
    name: p.name,
    priceCents: p.priceCents,
    includedInAmountFinanced: p.includedInAmountFinanced,
  }));
}

export interface DealDeskWorkspaceProps {
  id: string;
  initialData: DealDeskData;
}

export function DealDeskWorkspace({ id, initialData }: DealDeskWorkspaceProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [desk, setDesk] = React.useState<DealDeskData>(initialData);
  const [saving, setSaving] = React.useState(false);
  const [stageSubmitting, setStageSubmitting] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("activity");

  const deal = desk.deal;
  const isLocked = deal.status === "CONTRACTED";

  const [salePriceDollars, setSalePriceDollars] = React.useState(
    () => centsToDollarInput(deal.salePriceCents)
  );
  const [docFeeDollars, setDocFeeDollars] = React.useState(
    () => centsToDollarInput(deal.docFeeCents)
  );
  const [downPaymentDollars, setDownPaymentDollars] = React.useState(
    () => centsToDollarInput(deal.downPaymentCents)
  );
  const [termMonths, setTermMonths] = React.useState<number | null>(
    deal.dealFinance?.termMonths ?? null
  );
  const [aprPercent, setAprPercent] = React.useState(
    () => (deal.dealFinance?.aprBps != null ? bpsToPercent(deal.dealFinance.aprBps) : "")
  );
  const [notesDraft, setNotesDraft] = React.useState(deal.notes ?? "");

  const [feesDraft, setFeesDraft] = React.useState<FeeDraft[]>(() => feesFromDeal(deal));
  const [tradeDraft, setTradeDraft] = React.useState<TradeDraft>(() => tradeFromDeal(deal));
  const [productsDraft, setProductsDraft] = React.useState<ProductDraft[]>(() => productsFromDeal(deal));

  React.useEffect(() => {
    setFeesDraft(feesFromDeal(desk.deal));
    setTradeDraft(tradeFromDeal(desk.deal));
    setProductsDraft(productsFromDeal(desk.deal));
    setNotesDraft(desk.deal.notes ?? "");
  }, [desk.deal]);

  const saveDesk = React.useCallback(async () => {
    setSaving(true);
    try {
      const saleCents = parseDollarsToCents(salePriceDollars);
      const docCents = parseDollarsToCents(docFeeDollars || "0");
      const downCents = parseDollarsToCents(downPaymentDollars || "0");
      if (!isValidDollarInput(salePriceDollars) && salePriceDollars.trim()) {
        addToast("error", "Enter a valid sale price.");
        return;
      }
      const body: Record<string, unknown> = {
        salePriceCents: saleCents || deal.salePriceCents,
        docFeeCents: docCents || "0",
        downPaymentCents: downCents || deal.downPaymentCents,
        notes: notesDraft.trim() || null,
      };
      if (termMonths != null) body.termMonths = termMonths;
      if (aprPercent.trim()) body.aprBps = percentToBps(aprPercent);
      if (downCents) body.cashDownCents = downCents;

      body.fees = feesDraft
        .filter((f) => f.label.trim())
        .map((f) => ({
          ...(f.id && { id: f.id }),
          label: f.label.trim(),
          amountCents: f.amountCents || "0",
          taxable: f.taxable,
        }));
      body.trade = tradeDraft
        ? {
            vehicleDescription: tradeDraft.vehicleDescription.trim(),
            allowanceCents: tradeDraft.allowanceCents || "0",
            payoffCents: tradeDraft.payoffCents || "0",
          }
        : null;
      body.products = productsDraft
        .filter((p) => p.name.trim())
        .map((p) => ({
          ...(p.id && { id: p.id }),
          productType: p.productType,
          name: p.name.trim(),
          priceCents: p.priceCents || "0",
          costCents: null,
          taxable: false,
          includedInAmountFinanced: p.includedInAmountFinanced,
        }));

      const res = await apiFetch<{ data: DealDetail }>(`/api/deals/${id}/desk`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setDesk((prev) => ({ ...prev, deal: res.data }));
      setSalePriceDollars(centsToDollarInput(res.data.salePriceCents));
      setDocFeeDollars(centsToDollarInput(res.data.docFeeCents));
      setDownPaymentDollars(centsToDollarInput(res.data.downPaymentCents));
      setTermMonths(res.data.dealFinance?.termMonths ?? null);
      setAprPercent(
        res.data.dealFinance?.aprBps != null ? bpsToPercent(res.data.dealFinance.aprBps) : ""
      );
      setFeesDraft(feesFromDeal(res.data));
      setTradeDraft(tradeFromDeal(res.data));
      setProductsDraft(productsFromDeal(res.data));
      setNotesDraft(res.data.notes ?? "");
      addToast("success", "Deal updated");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [
    id,
    deal.salePriceCents,
    deal.downPaymentCents,
    salePriceDollars,
    docFeeDollars,
    downPaymentDollars,
    termMonths,
    aprPercent,
    notesDraft,
    feesDraft,
    tradeDraft,
    productsDraft,
    addToast,
  ]);

  const handleStageChange = React.useCallback(
    async (status: DealStatus) => {
      setStageSubmitting(true);
      try {
        const res = await apiFetch<{ data: DealDetail }>(`/api/deals/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        setDesk((prev) => ({
          ...prev,
          deal: res.data,
          activity: [
            {
              id: `temp-${Date.now()}`,
              dealId: id,
              fromStatus: deal.status,
              toStatus: status,
              changedBy: null,
              createdAt: new Date().toISOString(),
            },
            ...prev.activity,
          ],
        }));
        addToast("success", "Status updated");
        router.refresh();
      } catch (e) {
        addToast("error", getApiErrorMessage(e));
      } finally {
        setStageSubmitting(false);
      }
    },
    [id, deal.status, addToast, router]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DealHeader
        deal={desk.deal}
        onStageChange={handleStageChange}
        stageSubmitting={stageSubmitting}
      />
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-4">
            <CustomerCard deal={desk.deal} />
            <TradeCard
              deal={desk.deal}
              tradeDraft={tradeDraft}
              onTradeChange={setTradeDraft}
              disabled={isLocked}
            />
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
              <p className="mb-1 font-medium text-[var(--muted-text)]">Notes</p>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={saveDesk}
                disabled={isLocked}
                rows={3}
                className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[var(--text)]"
              />
            </div>
          </div>
          {/* Center column */}
          <div className="space-y-4">
            <VehicleCard deal={desk.deal} />
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="mb-2 text-sm font-medium text-[var(--text)]">Selling price</p>
              <input
                type="text"
                inputMode="decimal"
                value={salePriceDollars}
                onChange={(e) => setSalePriceDollars(e.target.value)}
                onBlur={saveDesk}
                disabled={isLocked}
                className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[var(--text)]"
              />
            </div>
            <FeesCard
              deal={desk.deal}
              feesDraft={feesDraft}
              onFeesChange={setFeesDraft}
              disabled={isLocked}
            />
            <ProductsCard
              deal={desk.deal}
              productsDraft={productsDraft}
              onProductsChange={setProductsDraft}
              disabled={isLocked}
            />
            <DealTotalsCard deal={desk.deal} />
          </div>
          {/* Right column */}
          <div className="space-y-4">
            <FinanceTermsCard
              deal={desk.deal}
              cashDownDollars={downPaymentDollars}
              termMonths={termMonths}
              aprPercent={aprPercent}
              onCashDownChange={setDownPaymentDollars}
              onTermChange={setTermMonths}
              onAprChange={setAprPercent}
              onBlur={saveDesk}
              disabled={isLocked}
            />
            {!isLocked && (
              <Button
                onClick={saveDesk}
                disabled={saving}
                className="w-full border-[var(--border)] text-[var(--text)]"
              >
                {saving ? "Saving…" : "Save deal"}
              </Button>
            )}
          </div>
        </div>

        {/* Lower tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="border border-[var(--border)] bg-[var(--surface)]">
            <TabsTrigger value="activity" className="data-[state=active]:bg-[var(--ring)]">
              Activity
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-[var(--ring)]">
              Audit trail
            </TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:bg-[var(--ring)]">
              Documents
            </TabsTrigger>
          </TabsList>
          <TabsContent value="activity" className="mt-3">
            <ActivityPanel activity={desk.activity} total={desk.activityTotal} />
          </TabsContent>
          <TabsContent value="audit" className="mt-3">
            <AuditPanel audit={desk.audit} total={desk.auditTotal} />
          </TabsContent>
          <TabsContent value="documents" className="mt-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted-text)]">
              Documents — coming soon
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
