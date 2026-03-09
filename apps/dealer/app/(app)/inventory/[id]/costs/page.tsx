import { VehicleCostsFullPage } from "@/modules/inventory/ui/VehicleCostsFullPage";

export const dynamic = "force-dynamic";

export default async function VehicleCostsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VehicleCostsFullPage vehicleId={id} />;
}
