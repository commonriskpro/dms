"use client";

import { AddVehiclePage } from "@/app/(app)/inventory/new/AddVehiclePage";
import { ModalShell } from "@/components/modal/ModalShell";

/**
 * Intercepting route: Add Vehicle as modal when navigated from /inventory.
 */
export default function InventoryNewModalPage() {
  return (
    <ModalShell
      title=""
      fallbackPath="/inventory"
      size="4xl"
      hideHeader
      flushBody
    >
      <AddVehiclePage autoFocusVin mode="modal" />
    </ModalShell>
  );
}
