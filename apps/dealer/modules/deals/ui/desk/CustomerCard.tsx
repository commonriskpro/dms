"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DealDetail } from "../types";
import { customerDetailPath } from "@/lib/routes/detail-paths";

export interface CustomerCardProps {
  deal: DealDetail;
}

export function CustomerCard({ deal }: CustomerCardProps) {
  const customer = deal.customer;
  const customerId = deal.customerId;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-[var(--text)]">Customer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {customer ? (
          <>
            <p className="font-medium text-[var(--text)]">{customer.name}</p>
            <Link
              href={customerDetailPath(customerId)}
              className="text-[var(--muted-text)] underline hover:text-[var(--text)]"
            >
              View profile
            </Link>
          </>
        ) : (
          <p className="text-[var(--muted-text)]">No customer linked</p>
        )}
        <p className="pt-2 text-xs text-[var(--muted-text)]">Co-buyer: —</p>
      </CardContent>
    </Card>
  );
}
