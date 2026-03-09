"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents, centsToDollarInput, parseDollarsToCents } from "@/lib/money";
import type { DealDetail } from "../types";

export type FeeDraftItem = { id?: string; label: string; amountCents: string; taxable: boolean };

export interface FeesCardProps {
  deal: DealDetail;
  feesDraft?: FeeDraftItem[];
  onFeesChange?: (fees: FeeDraftItem[]) => void;
  disabled?: boolean;
}

export function FeesCard({ deal, feesDraft, onFeesChange, disabled }: FeesCardProps) {
  const docFee = deal.docFeeCents;
  const fees = feesDraft ?? deal.fees ?? [];
  const totalFees = deal.totalFeesCents;
  const canEdit = onFeesChange != null && !disabled;

  const addFee = () => {
    if (!onFeesChange) return;
    onFeesChange([...fees, { label: "", amountCents: "0", taxable: false }]);
  };
  const removeFee = (index: number) => {
    if (!onFeesChange) return;
    onFeesChange(fees.filter((_, i) => i !== index));
  };
  const updateFee = (index: number, patch: Partial<FeeDraftItem>) => {
    if (!onFeesChange) return;
    onFeesChange(
      fees.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-[var(--text)]">Fees</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          <dt className="text-[var(--muted-text)]">Doc fee:</dt>
          <dd className="text-[var(--text)]">{formatCents(docFee)}</dd>
          {fees.map((f, i) => (
            <React.Fragment key={f.id ?? i}>
              {canEdit ? (
                <div className="col-span-2 flex items-center gap-2">
                  <Input
                    placeholder="Label"
                    value={f.label}
                    onChange={(e) => updateFee(i, { label: e.target.value })}
                    className="h-8 border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                  />
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="Amount"
                    value={centsToDollarInput(f.amountCents).replace(/^\$/, "")}
                    onChange={(e) => {
                      const cents = parseDollarsToCents(e.target.value);
                      updateFee(i, { amountCents: cents || "0" });
                    }}
                    className="h-8 w-24 border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                  />
                  <label className="flex items-center gap-1 text-[var(--muted-text)]">
                    <input
                      type="checkbox"
                      checked={f.taxable}
                      onChange={(e) => updateFee(i, { taxable: e.target.checked })}
                      className="rounded border-[var(--border)]"
                    />
                    Tax
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFee(i)}
                    className="text-[var(--muted-text)]"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <>
                  <dt className="text-[var(--muted-text)]">{f.label || "—"}:</dt>
                  <dd className="text-[var(--text)]">
                    {formatCents(f.amountCents)}
                    {f.taxable && " (T)"}
                  </dd>
                </>
              )}
            </React.Fragment>
          ))}
          <dt className="font-medium text-[var(--muted-text)]">Total fees:</dt>
          <dd className="font-medium text-[var(--text)]">{formatCents(totalFees)}</dd>
        </dl>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addFee}
            className="mt-2 border-[var(--border)] text-[var(--text)]"
          >
            Add fee
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
