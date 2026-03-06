import { VehicleDetailPage } from "@/modules/inventory/ui/VehicleDetailPage";

export const dynamic = "force-dynamic";

export default async function VehicleDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VehicleDetailPage vehicleId={id} />;
}
