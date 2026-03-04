-- CRM Pipeline + Follow-up Automation (docs/design/crm-pipeline-automation-spec.md)
-- Enums: OpportunityStatus, JobStatus, SequenceInstanceStatus, SequenceStepInstanceStatus
-- Models: Pipeline, Stage, Opportunity, OpportunityActivity, AutomationRule, AutomationRun, Job, SequenceTemplate, SequenceStep, SequenceInstance, SequenceStepInstance

CREATE TYPE "OpportunityStatus" AS ENUM ('OPEN', 'WON', 'LOST');

CREATE TYPE "JobStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'dead_letter');

CREATE TYPE "SequenceInstanceStatus" AS ENUM ('active', 'paused', 'stopped', 'completed');

CREATE TYPE "SequenceStepInstanceStatus" AS ENUM ('pending', 'skipped', 'completed', 'failed');

CREATE TABLE "Pipeline" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Stage" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "pipeline_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "color_key" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Opportunity" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "deal_id" UUID,
    "stage_id" UUID NOT NULL,
    "owner_id" UUID,
    "source" TEXT,
    "priority" TEXT,
    "estimated_value_cents" BIGINT,
    "notes" TEXT,
    "next_action_at" TIMESTAMP(3),
    "next_action_text" VARCHAR(500),
    "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "loss_reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpportunityActivity" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "activity_type" TEXT NOT NULL,
    "from_stage_id" UUID,
    "to_stage_id" UUID,
    "metadata" JSONB,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationRule" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_event" TEXT NOT NULL,
    "trigger_conditions" JSONB,
    "actions" JSONB NOT NULL,
    "schedule" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationRun" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "rule_id" UUID NOT NULL,
    "run_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Job" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "queue_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotency_key" VARCHAR(255),
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "run_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SequenceTemplate" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "SequenceTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SequenceStep" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "step_type" TEXT NOT NULL,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SequenceInstance" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "opportunity_id" UUID,
    "customer_id" UUID,
    "status" "SequenceInstanceStatus" NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMP(3) NOT NULL,
    "stopped_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceInstance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SequenceStepInstance" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "instance_id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "executed_at" TIMESTAMP(3),
    "status" "SequenceStepInstanceStatus" NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceStepInstance_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Stage" ADD CONSTRAINT "Stage_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Stage" ADD CONSTRAINT "Stage_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OpportunityActivity" ADD CONSTRAINT "OpportunityActivity_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpportunityActivity" ADD CONSTRAINT "OpportunityActivity_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpportunityActivity" ADD CONSTRAINT "OpportunityActivity_from_stage_id_fkey" FOREIGN KEY ("from_stage_id") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OpportunityActivity" ADD CONSTRAINT "OpportunityActivity_to_stage_id_fkey" FOREIGN KEY ("to_stage_id") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OpportunityActivity" ADD CONSTRAINT "OpportunityActivity_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Job" ADD CONSTRAINT "Job_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SequenceTemplate" ADD CONSTRAINT "SequenceTemplate_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "SequenceTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SequenceInstance" ADD CONSTRAINT "SequenceInstance_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SequenceInstance" ADD CONSTRAINT "SequenceInstance_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "SequenceTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SequenceInstance" ADD CONSTRAINT "SequenceInstance_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SequenceInstance" ADD CONSTRAINT "SequenceInstance_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SequenceStepInstance" ADD CONSTRAINT "SequenceStepInstance_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SequenceStepInstance" ADD CONSTRAINT "SequenceStepInstance_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "SequenceInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SequenceStepInstance" ADD CONSTRAINT "SequenceStepInstance_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "SequenceStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Pipeline_dealership_id_idx" ON "Pipeline"("dealership_id");

CREATE INDEX "Stage_dealership_id_idx" ON "Stage"("dealership_id");

CREATE INDEX "Stage_dealership_id_pipeline_id_idx" ON "Stage"("dealership_id", "pipeline_id");

CREATE INDEX "Stage_pipeline_id_order_idx" ON "Stage"("pipeline_id", "order");

CREATE INDEX "Opportunity_dealership_id_idx" ON "Opportunity"("dealership_id");

CREATE INDEX "Opportunity_dealership_id_status_idx" ON "Opportunity"("dealership_id", "status");

CREATE INDEX "Opportunity_dealership_id_stage_id_idx" ON "Opportunity"("dealership_id", "stage_id");

CREATE INDEX "Opportunity_dealership_id_owner_id_idx" ON "Opportunity"("dealership_id", "owner_id");

CREATE INDEX "Opportunity_dealership_id_customer_id_idx" ON "Opportunity"("dealership_id", "customer_id");

CREATE INDEX "Opportunity_dealership_id_next_action_at_idx" ON "Opportunity"("dealership_id", "next_action_at");

CREATE INDEX "Opportunity_dealership_id_created_at_idx" ON "Opportunity"("dealership_id", "created_at");

CREATE INDEX "OpportunityActivity_dealership_id_idx" ON "OpportunityActivity"("dealership_id");

CREATE INDEX "OpportunityActivity_dealership_id_opportunity_id_created_at_idx" ON "OpportunityActivity"("dealership_id", "opportunity_id", "created_at");

CREATE INDEX "AutomationRule_dealership_id_idx" ON "AutomationRule"("dealership_id");

CREATE INDEX "AutomationRule_dealership_id_is_active_idx" ON "AutomationRule"("dealership_id", "is_active");

CREATE INDEX "AutomationRule_dealership_id_deleted_at_idx" ON "AutomationRule"("dealership_id", "deleted_at");

CREATE UNIQUE INDEX "AutomationRun_dealership_id_entity_type_entity_id_event_key_rule_id_key" ON "AutomationRun"("dealership_id", "entity_type", "entity_id", "event_key", "rule_id");

CREATE INDEX "AutomationRun_dealership_id_idx" ON "AutomationRun"("dealership_id");

CREATE INDEX "Job_dealership_id_idx" ON "Job"("dealership_id");

CREATE INDEX "Job_dealership_id_status_run_at_idx" ON "Job"("dealership_id", "status", "run_at");

CREATE INDEX "Job_dealership_id_queue_type_idx" ON "Job"("dealership_id", "queue_type");

CREATE INDEX "SequenceTemplate_dealership_id_idx" ON "SequenceTemplate"("dealership_id");

CREATE INDEX "SequenceTemplate_dealership_id_deleted_at_idx" ON "SequenceTemplate"("dealership_id", "deleted_at");

CREATE INDEX "SequenceStep_dealership_id_idx" ON "SequenceStep"("dealership_id");

CREATE INDEX "SequenceStep_template_id_order_idx" ON "SequenceStep"("template_id", "order");

CREATE INDEX "SequenceInstance_dealership_id_idx" ON "SequenceInstance"("dealership_id");

CREATE INDEX "SequenceInstance_dealership_id_opportunity_id_idx" ON "SequenceInstance"("dealership_id", "opportunity_id");

CREATE INDEX "SequenceInstance_dealership_id_customer_id_idx" ON "SequenceInstance"("dealership_id", "customer_id");

CREATE INDEX "SequenceInstance_dealership_id_status_idx" ON "SequenceInstance"("dealership_id", "status");

CREATE INDEX "SequenceStepInstance_dealership_id_idx" ON "SequenceStepInstance"("dealership_id");

CREATE INDEX "SequenceStepInstance_instance_id_scheduled_at_idx" ON "SequenceStepInstance"("instance_id", "scheduled_at");

CREATE INDEX "SequenceStepInstance_dealership_id_instance_id_idx" ON "SequenceStepInstance"("dealership_id", "instance_id");
