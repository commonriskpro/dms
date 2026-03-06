/**
 * Dashboard API response types. Matches GET /api/dashboard response.data.
 * Only sections the user has permission for are present.
 */

export type DashboardMyTask = {
  id: string;
  title: string;
  dueAt: string | null;
  customerId: string;
  customerName: string;
  link: string;
};

export type DashboardNewProspect = {
  id: string;
  name: string;
  createdAt: string;
  primaryPhone: string | null;
  primaryEmail: string | null;
};

export type DashboardPipelineStage = {
  stageId: string;
  stageName: string;
  count: number;
};

export type DashboardStaleLead = {
  id: string;
  name: string;
  lastActivityAt: string;
  daysSinceActivity: number;
};

export type DashboardData = {
  myTasks?: DashboardMyTask[];
  newProspects?: DashboardNewProspect[];
  pipelineFunnel?: { stages: DashboardPipelineStage[] };
  staleLeads?: DashboardStaleLead[];
  appointments?: unknown[];
};

export type DashboardApiResponse = { data: DashboardData };
