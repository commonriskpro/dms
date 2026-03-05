"use client";

import * as React from "react";
import { AddVehiclePage } from "@/app/(app)/inventory/new/AddVehiclePage";
import { VinDecodeBar, type VinDecodeBarProps } from "@/app/(app)/inventory/new/components/VinDecodeBar";
import { ModalShell } from "@/components/modal/ModalShell";

/**
 * Intercepting route: Add Vehicle as modal when navigated from /inventory.
 * VIN decode bar is rendered in the modal header (no "Add vehicle" title).
 */
export default function InventoryNewModalPage() {
  const [vinBarProps, setVinBarProps] = React.useState<VinDecodeBarProps | null>(null);

  return (
    <ModalShell
      title={
        vinBarProps ? (
          <VinDecodeBar {...vinBarProps} inHeader />
        ) : (
          <div className="min-h-10 min-w-[200px]" aria-hidden />
        )
      }
      fallbackPath="/inventory"
      size="3xl"
    >
      <AddVehiclePage autoFocusVin onVinBarProps={setVinBarProps} />
    </ModalShell>
  );
}
