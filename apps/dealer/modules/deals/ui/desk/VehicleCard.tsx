"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DealDetail } from "../types";
import { inventoryDetailPath } from "@/lib/routes/detail-paths";

export interface VehicleCardProps {
  deal: DealDetail;
}

export function VehicleCard({ deal }: VehicleCardProps) {
  const v = deal.vehicle;
  const vehicleId = deal.vehicleId;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-[var(--text)]">Vehicle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {v ? (
          <>
            <p className="font-medium text-[var(--text)]">
              {[v.year, v.make, v.model].filter(Boolean).join(" ") || "—"}
            </p>
            <p className="text-[var(--muted-text)]">Stock #{v.stockNumber}</p>
            {v.vin && (
              <p className="text-[var(--muted-text)]">VIN: {v.vin}</p>
            )}
            <Link
              href={inventoryDetailPath(vehicleId)}
              className="text-[var(--muted-text)] underline hover:text-[var(--text)]"
            >
              View vehicle
            </Link>
          </>
        ) : (
          <p className="text-[var(--muted-text)]">No vehicle linked</p>
        )}
      </CardContent>
    </Card>
  );
}
