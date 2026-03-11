import { z } from "zod";
import { paginationQuerySchema } from "@/lib/api/pagination";

const opportunityStatusSchema = z.enum(["OPEN", "WON", "LOST"]);
const sequenceInstanceStatusSchema = z.enum(["active", "paused", "stopped"]);
const jobStatusSchema = z.enum(["pending", "running", "completed", "failed", "dead_letter"]);
const stepTypeSchema = z.enum(["create_task", "send_email", "send_sms"]);

const centsStringSchema = z.string().transform((s) => {
  const n = BigInt(s.trim());
  if (n < BigInt(0)) throw new Error("Cents must be non-negative");
  return n;
});

export const listPipelinesQuerySchema = paginationQuerySchema;
export const pipelineIdParamSchema = z.object({ pipelineId: z.string().uuid() });
export const createPipelineBodySchema = z.object({
  name: z.string().min(1).max(200),
  isDefault: z.boolean().optional(),
});
export const updatePipelineBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  isDefault: z.boolean().optional(),
});

export const createStageBodySchema = z.object({
  order: z.number().int().min(0),
  name: z.string().min(1).max(100),
  colorKey: z.string().max(50).optional().nullable(),
});
export const stageIdParamSchema = z.object({ stageId: z.string().uuid() });
export const updateStageBodySchema = z.object({
  order: z.number().int().min(0).optional(),
  name: z.string().min(1).max(100).optional(),
  colorKey: z.string().max(50).optional().nullable(),
});
export const deleteStageBodySchema = z.object({
  targetStageId: z.string().uuid().optional(),
});

export const listOpportunitiesQuerySchema = paginationQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(500).default(25),
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  status: opportunityStatusSchema.optional(),
  customerId: z.string().uuid().optional(),
  source: z.string().max(100).optional(),
  q: z.string().max(200).optional(),
  sortBy: z.enum(["createdAt", "nextActionAt", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});
export const opportunityIdParamSchema = z.object({ opportunityId: z.string().uuid() });
export const createOpportunityBodySchema = z.object({
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  stageId: z.string().uuid(),
  ownerId: z.string().uuid().optional().nullable(),
  source: z.string().max(100).optional().nullable(),
  priority: z.string().max(50).optional().nullable(),
  estimatedValueCents: z.string().optional().nullable().transform((s) => (s ? BigInt(s) : null)),
  notes: z.string().max(5000).optional().nullable(),
  nextActionAt: z.string().datetime().optional().nullable().transform((s) => (s ? new Date(s) : null)),
  nextActionText: z.string().max(500).optional().nullable(),
});
export const updateOpportunityBodySchema = z.object({
  stageId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional().nullable(),
  source: z.string().max(100).optional().nullable(),
  priority: z.string().max(50).optional().nullable(),
  estimatedValueCents: z.string().optional().nullable().transform((s) => (s ? BigInt(s) : null)),
  notes: z.string().max(5000).optional().nullable(),
  nextActionAt: z.string().datetime().optional().nullable().transform((s) => (s ? new Date(s) : null)),
  nextActionText: z.string().max(500).optional().nullable(),
  status: opportunityStatusSchema.optional(),
  lossReason: z.string().max(255).optional().nullable(),
});

export const listActivityQuerySchema = paginationQuerySchema;

export const listAutomationRulesQuerySchema = paginationQuerySchema.extend({
  isActive: z.coerce.boolean().optional(),
});
export const ruleIdParamSchema = z.object({ ruleId: z.string().uuid() });
export const createAutomationRuleBodySchema = z.object({
  name: z.string().min(1).max(200),
  triggerEvent: z.string().min(1).max(100),
  triggerConditions: z.record(z.unknown()).optional().nullable(),
  actions: z.array(z.object({ type: z.string(), params: z.record(z.unknown()).optional() })),
  schedule: z.enum(["immediate", "delayed"]),
  isActive: z.boolean().optional(),
});
export const updateAutomationRuleBodySchema = createAutomationRuleBodySchema.partial();

export const listSequenceTemplatesQuerySchema = paginationQuerySchema;
export const templateIdParamSchema = z.object({ templateId: z.string().uuid() });
export const createSequenceTemplateBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
});
export const updateSequenceTemplateBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
});
export const createSequenceStepBodySchema = z.object({
  order: z.number().int().min(0),
  stepType: stepTypeSchema,
  config: z.record(z.unknown()).optional().nullable(),
});
export const updateSequenceStepBodySchema = z.object({
  order: z.number().int().min(0).optional(),
  stepType: stepTypeSchema.optional(),
  config: z.record(z.unknown()).optional().nullable(),
});
export const stepIdParamSchema = z.object({ stepId: z.string().uuid() });

export const startSequenceBodySchema = z.object({ templateId: z.string().uuid() });
export const instanceIdParamSchema = z.object({ instanceId: z.string().uuid() });
export const stepInstanceIdParamSchema = z.object({ stepInstanceId: z.string().uuid() });
export const updateSequenceInstanceBodySchema = z.object({
  status: sequenceInstanceStatusSchema,
});

export const listJobsQuerySchema = paginationQuerySchema.extend({
  status: jobStatusSchema.optional(),
  queueType: z.string().max(50).optional(),
});
export const jobIdParamSchema = z.object({ jobId: z.string().uuid() });

// Journey bar (Road-to-Sale V2)
export const journeyBarQuerySchema = z
  .object({
    customerId: z.string().uuid().optional(),
    opportunityId: z.string().uuid().optional(),
  })
  .refine((q) => (q.customerId != null) !== (q.opportunityId != null), {
    message: "Exactly one of customerId or opportunityId is required",
  });

export const patchStageBodySchema = z.object({
  newStageId: z.string().uuid(),
});
export const customerIdParamSchemaForStage = z.object({ id: z.string().uuid() });
