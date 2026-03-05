import { OpportunityDetailPage } from "@/modules/crm-pipeline-automation/ui/OpportunityDetailPage";

type Props = { params: Promise<{ id: string }> };

export default async function CrmOpportunityDetailRoute({ params }: Props) {
  const { id } = await params;
  return <OpportunityDetailPage opportunityId={id} />;
}
