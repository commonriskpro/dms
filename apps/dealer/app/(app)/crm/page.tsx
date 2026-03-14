import { CrmCommandCenterPage } from "@/modules/crm-pipeline-automation/ui/CrmCommandCenterPage";
import { normalizeCrmScope } from "@/modules/crm-pipeline-automation/ui/query-state";
import { ModuleGuard } from "@/components/module-guard/ModuleGuard";

type SearchParams = Promise<{
  scope?: string;
  ownerId?: string;
  stageId?: string;
  status?: string;
  source?: string;
  q?: string;
}>;

export default async function CrmBoardRoute({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  return (
    <ModuleGuard moduleKey="crm" moduleName="CRM">
      <CrmCommandCenterPage
        initialQuery={{
          scope: normalizeCrmScope(params.scope),
          ownerId: params.ownerId,
          stageId: params.stageId,
          status: params.status,
          source: params.source,
          q: params.q,
        }}
      />
    </ModuleGuard>
  );
}
