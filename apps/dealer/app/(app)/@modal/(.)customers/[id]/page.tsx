import { CustomerDetailModal } from "./CustomerDetailModal";

export default async function CustomerDetailModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerDetailModal customerId={id} />;
}
