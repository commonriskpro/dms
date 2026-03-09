"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/money";
import { bpsToPercent, centsToDollarInput } from "@/lib/money";
import type { DealDetail } from "../types";
import { paymentEstimate } from "@/modules/deals/service/deal-math";

export interface FinanceTermsCardProps {
  deal: DealDetail;
  /** Controlled inputs for editing (optional). When set, card shows inputs and onBlur/onChange. */
  cashDownDollars?: string;
  termMonths?: number | null;
  aprPercent?: string;
  onCashDownChange?: (value: string) => void;
  onTermChange?: (value: number | null) => void;
  onAprChange?: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
}

export function FinanceTermsCard({
  deal,
  cashDownDollars,
  termMonths,
  aprPercent,
  onCashDownChange,
  onTermChange,
  onAprChange,
  onBlur,
  disabled = false,
}: FinanceTermsCardProps) {
  const finance = deal.dealFinance;
  const cashDownCents = BigInt(finance?.cashDownCents ?? deal.downPaymentCents ?? "0");
  const term = termMonths ?? finance?.termMonths ?? null;
  const aprBps = finance?.aprBps ?? 0;
  const aprDisplay = aprPercent ?? (aprBps != null ? bpsToPercent(aprBps) : "");
  const amountFinancedCents = BigInt(finance?.amountFinancedCents ?? "0");
  const estimatedPayment =
    term != null && term > 0
      ? paymentEstimate(amountFinancedCents, aprBps ?? 0, term)
      : null;

  const showInputs = onCashDownChange != null || onTermChange != null || onAprChange != null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-[var(--text)]">Finance terms</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {showInputs ? (
          <>
            <div>
              <label className="mb-1 block text-[var(--muted-text)]">Down payment</label>
              <Input
                type="text"
                inputMode="decimal"
                value={cashDownDollars ?? centsToDollarInput(String(cashDownCents))}
                onChange={(e) => onCashDownChange?.(e.target.value)}
                onBlur={onBlur}
                disabled={disabled}
                className="border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[var(--muted-text)]">Term (months)</label>
              <Input
                type="number"
                min={1}
                max={84}
                value={term ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  onTermChange?.(v === "" ? null : parseInt(v, 10));
                }}
                onBlur={onBlur}
                disabled={disabled}
                className="border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[var(--muted-text)]">APR (%)</label>
              <Input
                type="text"
                inputMode="decimal"
                value={aprDisplay}
                onChange={(e) => onAprChange?.(e.target.value)}
                onBlur={onBlur}
                disabled={disabled}
                className="border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
              />
            </div>
          </>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            <dt className="text-[var(--muted-text)]">Down payment:</dt>
            <dd className="text-[var(--text)]">{formatCents(String(cashDownCents))}</dd>
            <dt className="text-[var(--muted-text)]">Term:</dt>
            <dd className="text-[var(--text)]">{term != null ? `${term} mo` : "—"}</dd>
            <dt className="text-[var(--muted-text)]">APR:</dt>
            <dd className="text-[var(--text)]">{aprBps != null ? bpsToPercent(aprBps) + "%" : "—"}</dd>
          </dl>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 border-t border-[var(--border)] pt-2">
          <dt className="text-[var(--muted-text)]">Amount financed:</dt>
          <dd className="text-[var(--text)]">{formatCents(String(amountFinancedCents))}</dd>
          <dt className="text-[var(--muted-text)]">Payment estimate:</dt>
          <dd className="text-[var(--text)]">
            {estimatedPayment != null ? formatCents(String(estimatedPayment)) : "—"}
          </dd>
        </dl>
        {finance?.lenderName && (
          <p className="text-xs text-[var(--muted-text)]">Lender: {finance.lenderName}</p>
        )}
      </CardContent>
    </Card>
  );
}
