import * as stageDb from "../db/stage";
import * as opportunityDb from "../db/opportunity";
import * as activityDb from "../db/opportunity-activity";
import * as pipelineDb from "../db/pipeline";
import * as customersDb from "@/modules/customers/db/customers";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForWrite } from "@/lib/tenant-status";

export type TransitionEntityType = "customer" | "opportunity";

/**
 * Updates entity's stage (customer or opportunity).
 * Validation: (1) entity exists and belongs to tenant; (2) newStageId is in same pipeline as current stage;
 * (3) For opportunity: transition out of WON/LOST is forbidden (terminal).
 * Creates OpportunityActivity when opportunity stage changes.
 *
 * Audit: Stage transitions (and optionally journey-bar reads) are candidates for future audit
 * in Step 4 audit design; no audit logging implemented here.
 */
export async function transitionStage(
  dealershipId: string,
  userId: string,
  entityType: TransitionEntityType,
  entityId: string,
  newStageId: string
): Promise<{ id: string; stageId: string }> {
  await requireTenantActiveForWrite(dealershipId);
  const newStage = await stageDb.getStageById(dealershipId, newStageId);
  if (!newStage) throw new ApiError("NOT_FOUND", "Stage not found");

  if (entityType === "opportunity") {
    return transitionOpportunityStage(dealershipId, userId, entityId, newStageId, newStage.pipelineId);
  }
  return transitionCustomerStage(dealershipId, entityId, newStageId, newStage.pipelineId);
}

async function transitionOpportunityStage(
  dealershipId: string,
  userId: string,
  opportunityId: string,
  newStageId: string,
  newStagePipelineId: string
): Promise<{ id: string; stageId: string }> {
  const opportunity = await opportunityDb.getOpportunityById(dealershipId, opportunityId);
  if (!opportunity) throw new ApiError("NOT_FOUND", "Opportunity not found");

  if (opportunity.status === "WON" || opportunity.status === "LOST") {
    throw new ApiError("VALIDATION_ERROR", "Cannot change stage for an opportunity that is WON or LOST");
  }

  const currentPipelineId = opportunity.stage.pipelineId;
  if (currentPipelineId !== newStagePipelineId) {
    throw new ApiError("VALIDATION_ERROR", "New stage must be in the same pipeline as the current stage");
  }

  if (opportunity.stageId === newStageId) {
    return { id: opportunityId, stageId: newStageId };
  }

  const updated = await opportunityDb.updateOpportunity(dealershipId, opportunityId, {
    stageId: newStageId,
  });
  if (!updated) throw new ApiError("NOT_FOUND", "Opportunity not found");

  await activityDb.appendActivity(dealershipId, {
    opportunityId,
    activityType: "stage_changed",
    fromStageId: opportunity.stageId,
    toStageId: newStageId,
    actorId: userId,
  });

  return { id: opportunityId, stageId: updated.stageId };
}

async function transitionCustomerStage(
  dealershipId: string,
  customerId: string,
  newStageId: string,
  newStagePipelineId: string
): Promise<{ id: string; stageId: string }> {
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");

  let currentPipelineId: string;
  if (customer.stageId && customer.stage?.pipelineId) {
    currentPipelineId = customer.stage.pipelineId;
  } else {
    const defaultPipelineId = await pipelineDb.getDefaultPipelineId(dealershipId);
    if (!defaultPipelineId) throw new ApiError("NOT_FOUND", "No default pipeline found for dealership");
    currentPipelineId = defaultPipelineId;
  }

  if (currentPipelineId !== newStagePipelineId) {
    throw new ApiError("VALIDATION_ERROR", "New stage must be in the same pipeline as the current stage");
  }

  const updated = await customersDb.updateCustomerStageId(dealershipId, customerId, newStageId);
  if (!updated) throw new ApiError("NOT_FOUND", "Customer not found");

  return { id: customerId, stageId: updated.stageId! };
}
