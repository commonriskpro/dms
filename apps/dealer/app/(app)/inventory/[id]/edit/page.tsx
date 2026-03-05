import { EditVehiclePage } from "@/modules/inventory/ui/EditVehiclePage";

export default async function EditVehicleRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditVehiclePage id={id} />;
}
