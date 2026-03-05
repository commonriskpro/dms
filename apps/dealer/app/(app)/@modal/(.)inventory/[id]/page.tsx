import { VehicleDetailModal } from "./VehicleDetailModal";

export default async function VehicleDetailModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VehicleDetailModal vehicleId={id} />;
}
