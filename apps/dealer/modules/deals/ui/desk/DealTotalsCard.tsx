"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import type { DealDetail } from "../types";

export interface DealTotalsCardProps {
  deal: DealDetail;
}

export function DealTotalsCard({ deal }: DealTotalsCardProps) {
  const frontGross = deal.frontGrossCents;
  const backendGross = deal.dealFinance?.backendGrossCents ?? "0";
  const totalGross =
    BigInt(frontGross) + BigInt(backendGross);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-[var(--text)]">Gross summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          <dt className="text-[var(--muted-text)]">Selling price:</dt>
          <dd className="text-[var(--text)]">{formatCents(deal.salePriceCents)}</dd>
          <dt className="text-[var(--muted-text)]">Tax:</dt>
          <dd className="text-[var(--text)]">{formatCents(deal.taxCents)}</dd>
          <dt className="text-[var(--muted-text)]">Total due:</dt>
          <dd className="font-medium text-[var(--text)]">{formatCents(deal.totalDueCents)}</dd>
          <dt className="text-[var(--muted-text)]">Front gross:</dt>
          <dd className="text-[var(--text)]">{formatCents(frontGross)}</dd>
          <dt className="text-[var(--muted-text)]">Backend gross:</dt>
          <dd className="text-[var(--text)]">{formatCents(backendGross)}</dd>
          <dt className="font-medium text-[var(--muted-text)]">Total gross:</dt>
          <dd className="font-medium text-[var(--text)]">{formatCents(String(totalGross))}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
