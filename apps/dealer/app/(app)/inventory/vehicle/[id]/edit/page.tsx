import EditVehicleUi from "./ui/EditVehicleUi";

export default async function InventoryVehicleEditRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditVehicleUi vehicleId={id} />;
}
