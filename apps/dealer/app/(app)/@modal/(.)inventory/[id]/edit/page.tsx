"use client";

import { useParams } from "next/navigation";
import { ModalShell } from "@/components/modal/ModalShell";
import EditVehicleUi from "@/app/(app)/inventory/[id]/edit/ui/EditVehicleUi";

/**
 * Intercepting route: Edit Vehicle as modal when navigated from /inventory or /inventory/[id].
 * Direct visit to /inventory/[id]/edit still renders the full page.
 */
export default function EditVehicleModalPage() {
  const params = useParams();
  const id = params?.id as string | undefined;

  if (!id) {
    return (
      <ModalShell
        title="Edit vehicle"
        error={{ title: "Invalid vehicle", message: "Vehicle ID is missing." }}
        fallbackPath="/inventory"
      />
    );
  }

  return (
    <ModalShell
      size="3xl"
      title="Edit vehicle"
      fallbackPath={`/inventory/${id}`}
      hideHeader
    >
      <EditVehicleUi vehicleId={id} />
    </ModalShell>
  );
}
