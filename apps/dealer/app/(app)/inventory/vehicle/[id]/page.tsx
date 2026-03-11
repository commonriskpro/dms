import { VehicleDetailPage } from "@/modules/inventory/ui/VehicleDetailPage";

export default async function InventoryVehicleDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VehicleDetailPage vehicleId={id} />;
}
