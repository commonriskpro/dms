import EditVehicleUi from "./ui/EditVehicleUi";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditVehicleUi vehicleId={id} />;
}
