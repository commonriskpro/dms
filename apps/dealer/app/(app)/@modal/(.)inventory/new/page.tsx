"use client";

import { ModalShell } from "@/components/modal/ModalShell";
import { CreateVehiclePage } from "@/modules/inventory/ui/CreateVehiclePage";

export default function InventoryNewModalPage() {
  return (
    <ModalShell title="New vehicle">
      <CreateVehiclePage />
    </ModalShell>
  );
}
