import { DealDetailPage } from "@/modules/deals/ui/DetailPage";

type Props = { params: Promise<{ id: string }> };

export default async function DealPage({ params }: Props) {
  const { id } = await params;
  return <DealDetailPage id={id} />;
}
