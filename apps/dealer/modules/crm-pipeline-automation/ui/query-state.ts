import { buildQueryString } from "@/lib/url/buildQueryString";

export type CrmScope = "mine" | "team" | "all";
export type CrmOpportunityView = "board" | "list";

export type CrmWorkspaceQuery = {
  view?: CrmOpportunityView;
  scope?: CrmScope;
  customerId?: string;
  pipelineId?: string;
  stageId?: string;
  ownerId?: string;
  status?: string;
  source?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
};

export function buildCrmWorkspaceQuery(params: CrmWorkspaceQuery): string {
  return buildQueryString({
    ...(params.view ? { view: params.view } : {}),
    ...(params.scope ? { scope: params.scope } : {}),
    ...(params.customerId ? { customerId: params.customerId } : {}),
    ...(params.pipelineId ? { pipelineId: params.pipelineId } : {}),
    ...(params.stageId ? { stageId: params.stageId } : {}),
    ...(params.ownerId ? { ownerId: params.ownerId } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.source ? { source: params.source } : {}),
    ...(params.q?.trim() ? { q: params.q.trim() } : {}),
    ...(params.page ? { page: params.page } : {}),
    ...(params.pageSize ? { pageSize: params.pageSize } : {}),
    ...(params.sortBy ? { sortBy: params.sortBy } : {}),
    ...(params.sortOrder ? { sortOrder: params.sortOrder } : {}),
  });
}

export function normalizeCrmScope(scope?: string): CrmScope {
  if (scope === "mine" || scope === "team" || scope === "all") return scope;
  return "all";
}

export function normalizeCrmView(view?: string): CrmOpportunityView {
  if (view === "list" || view === "board") return view;
  return "board";
}
