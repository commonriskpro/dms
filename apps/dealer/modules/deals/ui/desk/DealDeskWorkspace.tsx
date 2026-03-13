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
  formatCents,
  parseDollarsToCents,
  percentToBps,
  bpsToPercent,
  isValidDollarInput,
} from "@/lib/money";
import { getDealMode, type DealDeskData, type DealDetail, type DealStatus } from "../types";
import { DealHeader } from "./DealHeader";
import { DealProgressStrip } from "./DealProgressStrip";
import { DealNextActionLine } from "./DealNextActionLine";
import { CustomerCard } from "./CustomerCard";
import { VehicleCard } from "./VehicleCard";
import { TradeCard } from "./TradeCard";
import { FeesCard } from "./FeesCard";
import { ProductsCard } from "./ProductsCard";
import { FinanceTermsCard } from "./FinanceTermsCard";
import { DealTotalsCard } from "./DealTotalsCard";
import { ActivityPanel } from "./ActivityPanel";
import { AuditPanel } from "./AuditPanel";
import {
  ActivityTimeline,
  SignalContextBlock,
  SignalExplanationItem,
  SignalHeaderBadgeGroup,
  TimelineItem,
  type SignalSurfaceItem,
} from "@/components/ui-system";
import {
  fetchSignalsByDomains,
  toContextSignals,
  toHeaderSignals,
  toSignalKeys,
} from "@/modules/intelligence/ui/surface-adapters";
import { toSignalExplanation } from "@/modules/intelligence/ui/explanation-adapters";
import { toTimelineSignalEvents } from "@/modules/intelligence/ui/timeline-adapters";

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
  const [surfaceSignals, setSurfaceSignals] = React.useState<SignalSurfaceItem[]>([]);

  const deal = desk.deal;
  const isLocked = deal.status === "CONTRACTED";
  const dealMode = getDealMode(deal);
  const isFinanceDeal = dealMode === "FINANCE";

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

  React.useEffect(() => {
    let mounted = true;
    fetchSignalsByDomains(["deals", "operations"], {
      includeResolved: true,
      limit: 40,
    })
      .then((signals) => {
        if (!mounted) return;
        setSurfaceSignals(signals);
      })
      .catch(() => {
        if (!mounted) return;
        setSurfaceSignals([]);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

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
      if (isFinanceDeal && termMonths != null) body.termMonths = termMonths;
      if (isFinanceDeal && aprPercent.trim()) body.aprBps = percentToBps(aprPercent);
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
      body.products = isFinanceDeal
        ? productsDraft
            .filter((p) => p.name.trim())
            .map((p) => ({
              ...(p.id && { id: p.id }),
              productType: p.productType,
              name: p.name.trim(),
              priceCents: p.priceCents || "0",
              costCents: null,
              taxable: false,
              includedInAmountFinanced: p.includedInAmountFinanced,
            }))
        : [];

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
  const entityScope = React.useMemo(
    () => ({ entityType: "Deal", entityId: id }),
    [id]
  );

  const headerSignals = React.useMemo(
    () =>
      toHeaderSignals(surfaceSignals, {
        maxVisible: 3,
        entity: entityScope,
      }),
    [surfaceSignals, entityScope]
  );
  const contextSignals = React.useMemo(
    () =>
      toContextSignals(surfaceSignals, {
        maxVisible: 5,
        entity: entityScope,
        suppressKeys: toSignalKeys(headerSignals),
      }),
    [surfaceSignals, entityScope, headerSignals]
  );
  const blockerSignals = React.useMemo(
    () =>
      contextSignals.filter((s) => s.severity === "warning" || s.severity === "danger").slice(0, 5),
    [contextSignals]
  );
  const timelineSignalEvents = React.useMemo(
    () =>
      toTimelineSignalEvents(surfaceSignals, {
        maxVisible: 8,
        entity: entityScope,
      }),
    [surfaceSignals, entityScope]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DealHeader
        deal={desk.deal}
        onStageChange={handleStageChange}
        stageSubmitting={stageSubmitting}
        signalHeader={<SignalHeaderBadgeGroup items={headerSignals} />}
      />
      <div className="flex-1 overflow-auto p-4">
        {blockerSignals.length > 0 ? (
          <div
            className="mb-4 rounded-lg border border-[var(--warning)]/50 bg-[var(--warning-surface)]/30 px-4 py-3"
            role="alert"
            aria-label="Blockers"
          >
            <SignalContextBlock title="Blockers" items={blockerSignals} maxVisible={3} />
          </div>
        ) : null}
        <div className="mb-4 flex flex-col gap-2">
          <DealProgressStrip deal={deal} dealId={id} blockerSignals={blockerSignals} />
          <DealNextActionLine blockerSignals={blockerSignals} />
        </div>
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
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] text-sm">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]">Notes</p>
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
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]">Selling price</p>
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
            {isFinanceDeal ? (
              <ProductsCard
                deal={desk.deal}
                productsDraft={productsDraft}
                onProductsChange={setProductsDraft}
                disabled={isLocked}
              />
            ) : (
              <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] text-sm">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]">
                  Cash execution
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-[var(--muted-text)]">Down payment</dt>
                  <dd className="text-[var(--text)]">{formatCents(deal.downPaymentCents)}</dd>
                  <dt className="text-[var(--muted-text)]">Balance due</dt>
                  <dd className="text-[var(--text)]">{formatCents(deal.totalDueCents)}</dd>
                  <dt className="text-[var(--muted-text)]">Funding track</dt>
                  <dd className="text-[var(--text-soft)]">Skipped for cash deals</dd>
                </dl>
              </div>
            )}
            <DealTotalsCard deal={desk.deal} />
          </div>
          {/* Right column */}
          <div className="space-y-4">
            <SignalContextBlock title="Deal intelligence" items={contextSignals} />
            {isFinanceDeal ? (
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
            ) : (
              <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] text-sm">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]">
                  Cash closeout
                </p>
                <p className="text-[var(--text-soft)]">
                  This deal uses the cash path. Keep the desk focused on pricing, fees, trade,
                  and the payment balance before delivery and title.
                </p>
                <div className="mt-3">
                  <label className="mb-1 block text-[var(--muted-text)]">Cash collected</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={downPaymentDollars}
                    onChange={(e) => setDownPaymentDollars(e.target.value)}
                    onBlur={saveDesk}
                    disabled={isLocked}
                    className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[var(--text)]"
                  />
                </div>
              </div>
            )}
            {!isLocked && (
              <Button
                onClick={saveDesk}
                disabled={saving}
                className="w-full border-[var(--border)] text-[var(--text)]"
              >
                {saving ? "Saving…" : "Save deal"}
              </Button>
            )}
            <ActivityTimeline
              title="Intelligence timeline"
              emptyTitle="No intelligence events"
              emptyDescription="Signal lifecycle events appear as they are created or resolved."
            >
              {timelineSignalEvents.map((event) => (
                <TimelineItem
                  key={event.key}
                  title={event.title}
                  timestamp={new Date(event.timestamp).toLocaleString()}
                  detail={
                    event.signal ? (
                      <SignalExplanationItem
                        explanation={toSignalExplanation(event.signal)}
                        kind={event.kind}
                      />
                    ) : (
                      event.detail
                    )
                  }
                />
              ))}
            </ActivityTimeline>
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
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] text-sm text-[var(--muted-text)]">
              Documents — coming soon
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
