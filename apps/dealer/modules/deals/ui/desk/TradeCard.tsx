"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents, centsToDollarInput, parseDollarsToCents } from "@/lib/money";
import type { DealDetail, DealTrade } from "../types";

export type TradeDraftItem = {
  vehicleDescription: string;
  allowanceCents: string;
  payoffCents: string;
} | null;

export interface TradeCardProps {
  deal: DealDetail;
  tradeDraft?: TradeDraftItem;
  onTradeChange?: (trade: TradeDraftItem) => void;
  disabled?: boolean;
}

export function TradeCard({ deal, tradeDraft, onTradeChange, disabled }: TradeCardProps) {
  const trades = deal.trades ?? [];
  const single = trades[0];
  const draft = tradeDraft ?? (single ? { vehicleDescription: single.vehicleDescription, allowanceCents: single.allowanceCents, payoffCents: single.payoffCents } : null);
  const canEdit = onTradeChange != null && !disabled;

  const addTrade = () => {
    if (!onTradeChange) return;
    onTradeChange({ vehicleDescription: "", allowanceCents: "0", payoffCents: "0" });
  };
  const removeTrade = () => onTradeChange?.(null);
  const update = (patch: Partial<NonNullable<TradeDraftItem>>) => {
    if (!onTradeChange || !draft) return;
    onTradeChange({ ...draft, ...patch });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-[var(--text)]">Trade-in</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {draft ? (
          canEdit ? (
            <div className="space-y-2">
              <Input
                placeholder="Vehicle description"
                value={draft.vehicleDescription}
                onChange={(e) => update({ vehicleDescription: e.target.value })}
                className="border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-[var(--muted-text)]">Allowance</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={centsToDollarInput(draft.allowanceCents).replace(/^\$/, "")}
                    onChange={(e) => update({ allowanceCents: parseDollarsToCents(e.target.value) || "0" })}
                    className="border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted-text)]">Payoff</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={centsToDollarInput(draft.payoffCents).replace(/^\$/, "")}
                    onChange={(e) => update({ payoffCents: parseDollarsToCents(e.target.value) || "0" })}
                    className="border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeTrade}
                className="text-[var(--muted-text)]"
              >
                Remove trade
              </Button>
            </div>
          ) : (
            <TradeRow trade={{ ...draft, allowanceCents: draft.allowanceCents, payoffCents: draft.payoffCents, vehicleDescription: draft.vehicleDescription }} />
          )
        ) : (
          <>
            {single && !canEdit ? (
              <TradeRow trade={single} />
            ) : (
              <p className="text-[var(--muted-text)]">No trade-in</p>
            )}
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTrade}
                className="border-[var(--border)] text-[var(--text)]"
              >
                Add trade-in
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TradeRow({ trade }: { trade: { vehicleDescription: string; allowanceCents: string; payoffCents: string } }) {
  const allowance = Number(trade.allowanceCents);
  const payoff = Number(trade.payoffCents);
  const equity = allowance - payoff;

  return (
    <div className="space-y-1">
      <p className="font-medium text-[var(--text)]">{trade.vehicleDescription || "—"}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[var(--muted-text)]">
        <dt>Allowance:</dt>
        <dd>{formatCents(trade.allowanceCents)}</dd>
        <dt>Payoff:</dt>
        <dd>{formatCents(trade.payoffCents)}</dd>
        <dt>Equity:</dt>
        <dd className={equity < 0 ? "text-[var(--ring)]" : ""}>
          {formatCents(String(equity))}
        </dd>
      </dl>
    </div>
  );
}
