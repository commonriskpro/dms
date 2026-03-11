import { unstable_noStore as noStore } from "next/cache";
import { getSessionContextOrNull } from "@/lib/api/handler";
import { OpportunitiesWorkspacePage } from "@/modules/crm-pipeline-automation/ui/OpportunitiesWorkspacePage";
import { normalizeCrmScope, normalizeCrmView } from "@/modules/crm-pipeline-automation/ui/query-state";
import { getOpportunitiesViewPreference } from "@/modules/crm-pipeline-automation/service/opportunities-view-preference";

type SearchParams = Promise<{
  view?: string;
  scope?: string;
  customerId?: string;
  pipelineId?: string;
  stageId?: string;
  ownerId?: string;
  status?: string;
  source?: string;
  q?: string;
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: string;
}>;

export default async function CrmOpportunitiesRoute({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  noStore();
  const params = await searchParams;
  const session = await getSessionContextOrNull();
  const dealershipId = session?.activeDealershipId ?? null;
  const userId = session?.userId ?? null;
  const savedView =
    dealershipId && userId
      ? await getOpportunitiesViewPreference({ dealershipId, userId })
      : null;
  const initialView = params.view ? normalizeCrmView(params.view) : savedView ?? "board";

  return (
    <OpportunitiesWorkspacePage
      initialQuery={{
        view: initialView,
        scope: normalizeCrmScope(params.scope),
        customerId: params.customerId,
        pipelineId: params.pipelineId,
        stageId: params.stageId,
        ownerId: params.ownerId,
        status: params.status,
        source: params.source,
        q: params.q,
        page: params.page ? Number(params.page) : 1,
        pageSize: params.pageSize ? Number(params.pageSize) : 25,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      }}
    />
  );
}
