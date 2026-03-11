import { CustomerDetailPage } from "@/modules/customers/ui/DetailPage";

export default async function CustomerProfileRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerDetailPage id={id} />;
}
