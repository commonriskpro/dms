import { InventoryDetailPage } from "@/modules/inventory/ui/DetailPage";

export default async function VehicleDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InventoryDetailPage id={id} />;
}
