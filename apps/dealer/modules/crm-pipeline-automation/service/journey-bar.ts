import * as pipelineDb from "../db/pipeline";
import * as stageDb from "../db/stage";
import * as opportunityDb from "../db/opportunity";
import * as customersDb from "@/modules/customers/db/customers";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead } from "@/lib/tenant-status";

export type JourneyBarStage = {
  id: string;
  name: string;
  order: number;
  colorKey: string | null;
};

export type JourneyBarSignals = {
  overdueTaskCount: number;
  nextAppointment?: { id: string; start: string } | null;
  lastActivityAt?: string | null;
};

export type JourneyBarData = {
  stages: JourneyBarStage[];
  currentStageId: string | null;
  currentIndex: number;
  signals?: JourneyBarSignals;
  nextBestActionKey?: string | null;
};

export type JourneyBarInput =
  | { customerId: string; opportunityId?: never }
  | { opportunityId: string; customerId?: never };

function toStageDescriptor(stage: { id: string; name: string; order: number; colorKey: string | null }): JourneyBarStage {
  return { id: stage.id, name: stage.name, order: stage.order, colorKey: stage.colorKey };
}

/**
 * Returns journey bar payload for a customer or opportunity.
 * Tenant: verifies entity belongs to dealershipId (IDOR prevention).
 * Customer with no stageId: returns default pipeline stages and currentStageId = null.
 */
export async function getJourneyBarData(
  dealershipId: string,
  input: JourneyBarInput
): Promise<JourneyBarData> {
  await requireTenantActiveForRead(dealershipId);
  if ("customerId" in input && input.customerId) {
    return getJourneyBarForCustomer(dealershipId, input.customerId);
  }
  if ("opportunityId" in input && input.opportunityId) {
    return getJourneyBarForOpportunity(dealershipId, input.opportunityId);
  }
  throw new ApiError("VALIDATION_ERROR", "Exactly one of customerId or opportunityId is required");
}

async function getJourneyBarForCustomer(dealershipId: string, customerId: string): Promise<JourneyBarData> {
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");

  let pipelineId: string;
  let currentStageId: string | null = customer.stageId ?? null;

  if (customer.stage?.pipelineId) {
    pipelineId = customer.stage.pipelineId;
  } else {
    const defaultId = await pipelineDb.getDefaultPipelineId(dealershipId);
    if (!defaultId) throw new ApiError("NOT_FOUND", "No default pipeline found for dealership");
    pipelineId = defaultId;
  }

  const stageRows = await stageDb.listStagesByPipelineId(dealershipId, pipelineId);
  const stages: JourneyBarStage[] = stageRows.map(toStageDescriptor);

  let currentIndex = -1;
  if (currentStageId) {
    currentIndex = stageRows.findIndex((s) => s.id === currentStageId);
    if (currentIndex < 0) currentIndex = 0;
  } else {
    currentIndex = 0;
  }

  const overdueTaskCount = await customersDb.countOverdueTasksForCustomer(dealershipId, customerId);

  return {
    stages,
    currentStageId,
    currentIndex,
    signals: {
      overdueTaskCount,
      nextAppointment: null,
      lastActivityAt: null,
    },
    nextBestActionKey: null,
  };
}

async function getJourneyBarForOpportunity(dealershipId: string, opportunityId: string): Promise<JourneyBarData> {
  const opportunity = await opportunityDb.getOpportunityById(dealershipId, opportunityId);
  if (!opportunity) throw new ApiError("NOT_FOUND", "Opportunity not found");

  const pipelineId = opportunity.stage.pipelineId;
  const currentStageId = opportunity.stageId;

  const stageRows = await stageDb.listStagesByPipelineId(dealershipId, pipelineId);
  const stages: JourneyBarStage[] = stageRows.map(toStageDescriptor);

  const currentIndex = stageRows.findIndex((s) => s.id === currentStageId);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;

  const overdueTaskCount = await customersDb.countOverdueTasksForCustomer(
    dealershipId,
    opportunity.customerId
  );

  return {
    stages,
    currentStageId,
    currentIndex: safeIndex,
    signals: {
      overdueTaskCount,
      nextAppointment: null,
      lastActivityAt: null,
    },
    nextBestActionKey: null,
  };
}
