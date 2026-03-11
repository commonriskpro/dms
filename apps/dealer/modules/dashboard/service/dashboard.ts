import * as customersDb from "@/modules/customers/db/customers";
import * as tasksDb from "@/modules/customers/db/tasks";
import * as stageDb from "@/modules/crm-pipeline-automation/db/stage";
import { withCache } from "@/lib/infrastructure/cache/cacheHelpers";
import { dashboardV1Key, permissionsHash, paramsHash } from "@/lib/infrastructure/cache/cacheKeys";
import { customerDetailPath } from "@/lib/routes/detail-paths";

const DEFAULT_MY_TASKS_LIMIT = 10;
const MAX_MY_TASKS_LIMIT = 20;
const DEFAULT_NEW_PROSPECTS_LIMIT = 10;
const MAX_NEW_PROSPECTS_LIMIT = 20;
const DEFAULT_STALE_LEADS_LIMIT = 10;
const MAX_STALE_LEADS_LIMIT = 20;
const DEFAULT_STALE_LEADS_DAYS = 7;

function hasPermission(permissions: string[], key: string): boolean {
  return permissions.includes(key);
}

function canMyTasks(permissions: string[]): boolean {
  return hasPermission(permissions, "customers.read") || hasPermission(permissions, "crm.read");
}

function canNewProspects(permissions: string[]): boolean {
  return hasPermission(permissions, "customers.read");
}

function canPipelineFunnel(permissions: string[]): boolean {
  return hasPermission(permissions, "crm.read");
}

function canStaleLeads(permissions: string[]): boolean {
  return hasPermission(permissions, "customers.read") || hasPermission(permissions, "crm.read");
}

function canAppointments(permissions: string[]): boolean {
  return hasPermission(permissions, "crm.read");
}

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

export type GetDashboardOptions = {
  myTasksLimit?: number;
  newProspectsLimit?: number;
  staleLeadsDays?: number;
  staleLeadsLimit?: number;
};

/**
 * Returns dashboard sections for which the user has permission.
 * Only permitted sections are included; others are omitted.
 * If user has neither customers.read nor crm.read, returns {}.
 */
export async function getDashboard(
  dealershipId: string,
  userId: string,
  permissions: string[],
  options: GetDashboardOptions = {}
): Promise<DashboardData> {
  const permHash = permissionsHash(permissions);
  const optHash = paramsHash({ ...options, userId });
  const cacheKey = dashboardV1Key(dealershipId, permHash, optHash);

  return withCache(cacheKey, 15, () =>
    loadDashboardData(dealershipId, userId, permissions, options)
  );
}

async function loadDashboardData(
  dealershipId: string,
  userId: string,
  permissions: string[],
  options: GetDashboardOptions
): Promise<DashboardData> {
  const result: DashboardData = {};

  const myTasksLimit = Math.min(
    options.myTasksLimit ?? DEFAULT_MY_TASKS_LIMIT,
    MAX_MY_TASKS_LIMIT
  );
  const newProspectsLimit = Math.min(
    options.newProspectsLimit ?? DEFAULT_NEW_PROSPECTS_LIMIT,
    MAX_NEW_PROSPECTS_LIMIT
  );
  const staleLeadsDays = options.staleLeadsDays ?? DEFAULT_STALE_LEADS_DAYS;
  const staleLeadsLimit = Math.min(
    options.staleLeadsLimit ?? DEFAULT_STALE_LEADS_LIMIT,
    MAX_STALE_LEADS_LIMIT
  );

  const fetchers: Promise<void>[] = [];

  if (canMyTasks(permissions)) {
    fetchers.push(
      tasksDb.listMyTasks(dealershipId, userId, myTasksLimit).then((tasks) => {
        result.myTasks = tasks.map((t) => ({
          id: t.id,
          title: t.title,
          dueAt: t.dueAt ? t.dueAt.toISOString() : null,
          customerId: t.customerId,
          customerName: t.customerName,
          link: customerDetailPath(t.customerId),
        }));
      })
    );
  }

  if (canNewProspects(permissions)) {
    fetchers.push(
      customersDb.listNewProspects(dealershipId, newProspectsLimit).then((prospects) => {
        result.newProspects = prospects.map((p) => ({
          id: p.id,
          name: p.name,
          createdAt: p.createdAt.toISOString(),
          primaryPhone: p.primaryPhone,
          primaryEmail: p.primaryEmail,
        }));
      })
    );
  }

  if (canPipelineFunnel(permissions)) {
    fetchers.push(
      stageDb.getPipelineFunnelCounts(dealershipId).then((stages) => {
        result.pipelineFunnel = { stages };
      })
    );
  }

  if (canStaleLeads(permissions)) {
    fetchers.push(
      customersDb.listStaleLeads(dealershipId, staleLeadsDays, staleLeadsLimit).then((leads) => {
        result.staleLeads = leads.map((l) => ({
          id: l.id,
          name: l.name,
          lastActivityAt: l.lastActivityAt.toISOString(),
          daysSinceActivity: l.daysSinceActivity,
        }));
      })
    );
  }

  if (canAppointments(permissions)) {
    result.appointments = [];
  }

  await Promise.all(fetchers);
  return result;
}
