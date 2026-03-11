/**
 * API response types for CRM UI. Money fields from API are string cents.
 */

export type OpportunityStatus = "OPEN" | "WON" | "LOST";

export type Pipeline = {
  id: string;
  name: string;
  isDefault: boolean;
  dealershipId: string;
  createdAt: string;
  updatedAt: string;
};

export type Stage = {
  id: string;
  pipelineId: string;
  order: number;
  name: string;
  colorKey: string | null;
  dealershipId: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerRef = { id: string; name: string };
export type VehicleRef = {
  id: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
};
export type OwnerRef = { id: string; fullName: string | null; email: string };
export type StageRef = Stage;

export type Opportunity = {
  id: string;
  dealershipId: string;
  customerId: string;
  vehicleId: string | null;
  dealId: string | null;
  stageId: string;
  ownerId: string | null;
  source: string | null;
  priority: string | null;
  estimatedValueCents: string | null;
  notes: string | null;
  nextActionAt: string | null;
  nextActionText: string | null;
  status: OpportunityStatus;
  lossReason: string | null;
  createdAt: string;
  updatedAt: string;
  stage?: StageRef;
  customer?: CustomerRef;
  vehicle?: VehicleRef | null;
  owner?: OwnerRef | null;
};

export type OpportunityActivity = {
  id: string;
  opportunityId: string;
  activityType: string;
  fromStageId: string | null;
  toStageId: string | null;
  metadata: Record<string, unknown> | null;
  actorId: string | null;
  createdAt: string;
  fromStage?: { id: string; name: string } | null;
  toStage?: { id: string; name: string } | null;
  actor?: { id: string; fullName: string | null } | null;
};

export type SequenceTemplateRef = { id: string; name: string };
export type SequenceStepRef = { id: string; order: number; stepType: string; config: Record<string, unknown> | null };

export type SequenceStepInstance = {
  id: string;
  stepId: string;
  instanceId: string;
  scheduledAt: string;
  executedAt: string | null;
  status: string;
  errorMessage: string | null;
  step: SequenceStepRef;
};

export type SequenceInstance = {
  id: string;
  templateId: string;
  opportunityId: string | null;
  customerId: string | null;
  status: string;
  startedAt: string;
  stoppedAt: string | null;
  template: SequenceTemplateRef;
  stepInstances?: SequenceStepInstance[];
};

export type AutomationRule = {
  id: string;
  dealershipId: string;
  name: string;
  triggerEvent: string;
  triggerConditions: Record<string, unknown> | null;
  actions: { type: string; params?: Record<string, unknown> }[];
  schedule: "immediate" | "delayed";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SequenceTemplate = {
  id: string;
  dealershipId: string;
  name: string;
  description: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  steps?: SequenceStep[];
};

export type SequenceStep = {
  id: string;
  templateId: string;
  order: number;
  stepType: "create_task" | "send_email" | "send_sms";
  config: Record<string, unknown> | null;
  dealershipId: string;
  createdAt: string;
  updatedAt: string;
};

export type Job = {
  id: string;
  dealershipId: string;
  queueType: string;
  payload: Record<string, unknown>;
  idempotencyKey: string | null;
  scheduledAt: string;
  runAt: string;
  startedAt: string | null;
  completedAt: string | null;
  status: "pending" | "running" | "completed" | "failed" | "dead_letter";
  retryCount: number;
  maxRetries: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiListResponse<T> = { data: T[]; meta: { total: number; limit: number; offset: number } };
export type ApiDataResponse<T> = { data: T };

export type CommandCenterItem = {
  id: string;
  kind: "task" | "callback" | "conversation" | "opportunity" | "sequence";
  title: string;
  detail: string;
  customerId?: string;
  customerName?: string;
  opportunityId?: string;
  href: string;
  nextActionLabel: string;
  nextActionHref: string;
  whenLabel?: string | null;
  severity?: "info" | "warning" | "danger";
};

export type CommandCenterResponse = {
  kpis: {
    openOpportunities: number;
    dueNow: number;
    staleProspects: number;
    blockers: number;
    waitingConversations: number;
    sequenceExceptions: number;
  };
  filters: {
    owners: Array<{ value: string; label: string }>;
    stages: Array<{ value: string; label: string }>;
    sources: Array<{ value: string; label: string }>;
  };
  pressure: {
    overdueTasks: number;
    callbacksDueToday: number;
    inboundWaiting: number;
    noNextAction: number;
    failedJobs: number;
  };
  pipeline: {
    stages: Array<{ stageId: string; stageName: string; count: number }>;
  };
  sections: {
    dueNow: CommandCenterItem[];
    staleProspects: CommandCenterItem[];
    pipelineBlockers: CommandCenterItem[];
    sequenceExceptions: CommandCenterItem[];
  };
};

export type StatusVariant = "info" | "success" | "warning" | "danger" | "neutral";

export function opportunityStatusToVariant(status: OpportunityStatus): StatusVariant {
  if (status === "OPEN") return "info";
  if (status === "WON") return "success";
  return "neutral";
}
