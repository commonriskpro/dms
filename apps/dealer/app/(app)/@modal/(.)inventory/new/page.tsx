"use client";

import { AddVehiclePage } from "@/app/(app)/inventory/new/AddVehiclePage";
import { ModalShell } from "@/components/modal/ModalShell";

/**
 * Intercepting route: Add Vehicle as modal when navigated from /inventory.
 * Direct visit to /inventory/new still renders full page (no modal).
 */
export default function InventoryNewModalPage() {
  return (
    <ModalShell title="Add vehicle" fallbackPath="/inventory">
      <AddVehiclePage />
    </ModalShell>
  );
}
