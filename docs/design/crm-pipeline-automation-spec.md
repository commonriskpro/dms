# CRM Pipeline + Follow-up Automation — Full SPEC (Step 1/4)

**Module:** crm-pipeline-automation (CRM Pipeline, Opportunities, Automations, Follow-up Sequences)  
**Scope:** Pipeline/opportunities linked to Customer (required), optional Vehicle and Deal; pipelines and stages per dealership; automation rules with event triggers and DB-backed job queue; follow-up sequences (playbooks) with steps (Create Task, Send Email/SMS stubbed). Multi-tenant, RBAC, audit, deterministic scheduling. No implementation code.

References: DMS Non-Negotiables, Coding Standards, core-platform-spec.md, customers (notes, tasks, activity), deals-spec.md, inventory, documents, finance-shell, lender-integration, reports.

---

## Table Summary (at a glance)

| Table | Purpose | Tenant-scoped? | Soft delete? | Audit (CUD / critical) |
|-------|---------|----------------|--------------|-------------------------|
| Opportunity | Single opportunity; customer + optional vehicle/deal; stage, owner, status | Yes | No (status WON/LOST is terminal) | Yes |
| Pipeline | Pipeline definition per dealership; default flag | Yes | No | Yes |
| Stage | Stage within pipeline; order, name, colorKey | Yes | No | Yes (stage delete = reassign or block) |
| OpportunityActivity | Timeline: stage changes, touches, outcomes | Yes | No | No (append-only timeline) |
| AutomationRule | Rule: trigger (event + conditions), actions, schedule | Yes | Yes (deletedAt) | Yes |
| AutomationRun | Idempotency: same entity+event doesn’t double-trigger | Yes | No | No (operational) |
| Job | DB-backed queue: payload, runAt, retries, dead-letter | Yes | No | Yes (job.executed, job.failed; no PII) |
| SequenceTemplate | Playbook template (name, steps) | Yes | Yes (deletedAt) | Yes |
| SequenceStep | Step in template: type (task/email/sms), order, config | Yes | No | No (child of template) |
| SequenceInstance | Running instance on Opportunity or Customer | Yes | No | Yes (start/stop/pause) |
| SequenceStepInstance | Per-step state: scheduledAt, executedAt, status, error | Yes | No | No (child; audit via instance) |

**Money rule:** `estimatedValueCents` is **BigInt** in DB; API uses **string** (cents).  
**Pagination:** All list endpoints: `limit` (default 25, max 100), `offset` (0-based). Response: `data` + `meta: { total, limit, offset }`.  
**Dealership scoping:** `dealership_id` from auth/session only; never from client body or path params for tenant identity.

---

## 1) Prisma-Ready Data Model

### 1.1 Opportunity

- **Purpose:** Single opportunity (lead/prospect) linked to Customer; optionally to Vehicle and Deal. Tracks stage, owner, next action, status (OPEN | WON | LOST).
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `customerId` — String, UUID, FK → Customer, required
  - `vehicleId` — String?, UUID, FK → Vehicle, optional
  - `dealId` — String?, UUID, FK → Deal, optional
  - `stageId` — String, UUID, FK → Stage, required
  - `ownerId` — String?, UUID, FK → Profile, optional (assigned rep)
  - `source` — String? (lead source; e.g. website, walk-in; align with Customer.leadSource semantics)
  - `priority` — String? (e.g. high, medium, low; or enum if fixed set)
  - `estimatedValueCents` — BigInt? (BIGINT in DB; API string)
  - `notes` — String?, @db.Text
  - `nextActionAt` — DateTime?
  - `nextActionText` — String?
  - `status` — Enum: `OPEN` | `WON` | `LOST`
  - `lossReason` — String?, optional (when status = LOST)
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Relations:** Dealership, Customer, Vehicle?, Deal?, Stage, Profile? (owner), OpportunityActivity[].
- **Indexes:**
  - `@@index([dealershipId])`
  - `@@index([dealershipId, status])`
  - `@@index([dealershipId, stageId])`
  - `@@index([dealershipId, ownerId])`
  - `@@index([dealershipId, customerId])`
  - `@@index([dealershipId, nextActionAt])` (for scheduling / follow-up)
  - `@@index([dealershipId, createdAt])`
- **Audit:** Opportunity is critical. Audit: opportunity.created, opportunity.updated, opportunity.stage_changed, opportunity.status_changed (WON/LOST). No PII in audit metadata.

**Prisma (snippet):**

```prisma
enum OpportunityStatus {
  OPEN
  WON
  LOST
}

model Opportunity {
  id                   String            @id @default(uuid()) @db.Uuid
  dealershipId         String            @map("dealership_id") @db.Uuid
  customerId           String            @map("customer_id") @db.Uuid
  vehicleId            String?           @map("vehicle_id") @db.Uuid
  dealId               String?           @map("deal_id") @db.Uuid
  stageId              String            @map("stage_id") @db.Uuid
  ownerId              String?           @map("owner_id") @db.Uuid
  source               String?
  priority             String?
  estimatedValueCents  BigInt?           @map("estimated_value_cents")
  notes                String?           @db.Text
  nextActionAt         DateTime?         @map("next_action_at")
  nextActionText       String?           @map("next_action_text") @db.VarChar(500)
  status               OpportunityStatus @default(OPEN)
  lossReason           String?           @map("loss_reason") @db.VarChar(255)
  createdAt            DateTime          @default(now()) @map("created_at")
  updatedAt            DateTime          @updatedAt @map("updated_at")

  dealership   Dealership   @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  customer     Customer     @relation(fields: [customerId], references: [id], onDelete: Restrict)
  vehicle      Vehicle?     @relation(fields: [vehicleId], references: [id], onDelete: SetNull)
  deal         Deal?        @relation(fields: [dealId], references: [id], onDelete: SetNull)
  stage        Stage        @relation(fields: [stageId], references: [id], onDelete: Restrict)
  owner        Profile?     @relation(fields: [ownerId], references: [id], onDelete: SetNull)
  activities   OpportunityActivity[]
  sequenceInstances SequenceInstance[]

  @@index([dealershipId])
  @@index([dealershipId, status])
  @@index([dealershipId, stageId])
  @@index([dealershipId, ownerId])
  @@index([dealershipId, customerId])
  @@index([dealershipId, nextActionAt])
  @@index([dealershipId, createdAt])
}
```

### 1.2 Pipeline

- **Purpose:** One pipeline per dealership (default); name and isDefault. Custom pipelines possible later; at least one default per dealership.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `name` — String (e.g. "Sales Pipeline")
  - `isDefault` — Boolean (one default per dealership)
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Relations:** Dealership, Stage[].
- **Indexes:**
  - `@@index([dealershipId])`
  - `@@unique([dealershipId, isDefault])` — partial: only one row per dealership where isDefault = true (enforce in app or partial unique index in migration).
- **Constraint:** At most one default pipeline per dealership (application-level or partial unique index).
- **Audit:** pipeline.created, pipeline.updated (pipeline.deleted if soft delete added later).

**Prisma (snippet):**

```prisma
model Pipeline {
  id           String   @id @default(uuid()) @db.Uuid
  dealershipId String   @map("dealership_id") @db.Uuid
  name         String
  isDefault    Boolean  @default(false) @map("is_default")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  dealership Dealership @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  stages     Stage[]

  @@index([dealershipId])
}
```

### 1.3 Stage

- **Purpose:** Stage within a pipeline; ordered; name + colorKey (frontend maps to palette; no hard-coded colors in backend).
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `pipelineId` — String, UUID, FK → Pipeline, required
  - `order` — Int (display order; 0-based or 1-based consistent)
  - `name` — String (e.g. "New Lead", "Qualified", "Proposal")
  - `colorKey` — String? (e.g. "blue", "green"; frontend maps to hex)
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Relations:** Dealership, Pipeline, Opportunity[].
- **Indexes:**
  - `@@index([dealershipId])`
  - `@@index([dealershipId, pipelineId])`
  - `@@index([pipelineId, order])` — list stages in order
- **Stage deletion rules:**
  - **Option A (recommended):** If any Opportunity references this stage, forbid DELETE; return CONFLICT with message "Reassign opportunities to another stage first."
  - **Option B:** On delete, reassign all opportunities in this stage to a target stage (require targetStageId in DELETE body or query). Document chosen behavior in API.
- **Audit:** stage.created, stage.updated, stage.deleted (if hard delete after reassign).

**Prisma (snippet):**

```prisma
model Stage {
  id           String   @id @default(uuid()) @db.Uuid
  dealershipId String   @map("dealership_id") @db.Uuid
  pipelineId    String   @map("pipeline_id") @db.Uuid
  order        Int
  name         String
  colorKey     String?  @map("color_key") @db.VarChar(50)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  dealership   Dealership   @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  pipeline     Pipeline     @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  opportunities Opportunity[]

  @@index([dealershipId])
  @@index([dealershipId, pipelineId])
  @@index([pipelineId, order])
}
```

### 1.4 OpportunityActivity

- **Purpose:** Append-only timeline for an opportunity: stage changes, touches, outcomes. No soft delete.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `opportunityId` — String, UUID, FK → Opportunity, required
  - `activityType` — String (e.g. "stage_changed", "touch", "outcome", "note")
  - `fromStageId` — String?, UUID, FK → Stage, optional (for stage_changed)
  - `toStageId` — String?, UUID, FK → Stage, optional
  - `metadata` — Json? (e.g. outcome text, touch channel)
  - `actorId` — String?, UUID, FK → Profile, optional
  - `createdAt` — DateTime
- **Relations:** Dealership, Opportunity, Stage? (from/to), Profile? (actor).
- **Indexes:**
  - `@@index([dealershipId])`
  - `@@index([dealershipId, opportunityId, createdAt])` — timeline per opportunity
- **Audit:** No separate audit table; this table is the timeline. Critical stage/status changes also written to AuditLog (opportunity.stage_changed, opportunity.status_changed).

### 1.5 AutomationRule

- **Purpose:** Rule: trigger (event + optional conditions), actions (create task, update stage, add tag, schedule follow-up), schedule (immediate or delayed). Tenant-scoped.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `name` — String
  - `triggerEvent` — String (e.g. "opportunity.created", "opportunity.stage_changed", "customer.task.completed")
  - `triggerConditions` — Json? (optional filter: e.g. stageId, status; structure defined in service)
  - `actions` — Json (array of action descriptors: type, params; e.g. create_task, update_stage, add_tag, schedule_follow_up)
  - `schedule` — Enum or String: `immediate` | `delayed`; if delayed, delayMinutes or delayUntil expression in actions
  - `isActive` — Boolean, default true
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
  - `deletedAt` — DateTime? (soft delete)
- **Relations:** Dealership.
- **Indexes:**
  - `@@index([dealershipId])`
  - `@@index([dealershipId, isActive])` — worker filters active rules
  - `@@index([dealershipId, deletedAt])`
- **Audit:** automation_rule.created, automation_rule.updated, automation_rule.deleted.

### 1.6 AutomationRun

- **Purpose:** Idempotency for automation execution. Same (entityType, entityId, eventKey, optional eventAt window) must not double-trigger.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `entityType` — String (e.g. "opportunity", "customer")
  - `entityId` — String, UUID
  - `eventKey` — String (e.g. "opportunity.created", "opportunity.stage_changed:stageId")
  - `ruleId` — String, UUID, FK → AutomationRule, required
  - `runAt` — DateTime (when the run was executed or scheduled)
  - `status` — String (e.g. "completed", "failed", "skipped")
  - `createdAt` — DateTime
- **Relations:** Dealership, AutomationRule.
- **Indexes:**
  - `@@index([dealershipId])`
  - `@@unique([dealershipId, entityType, entityId, eventKey, ruleId])` — idempotency key (or composite without ruleId if one run per event can trigger multiple rules; then dedupe per rule: unique on [dealershipId, entityType, entityId, eventKey, ruleId])
- **Idempotency rule:** Before executing a rule for an event, insert AutomationRun (entityType, entityId, eventKey, ruleId). If unique violation, skip execution. Otherwise proceed and update status on completion/failure.
- **Audit:** No audit table for AutomationRun; job execution and failures audited via Job + AuditLog (job.executed, job.failed).

### 1.7 Job

- **Purpose:** DB-backed queue for delayed automations and sequence steps. Worker polls (cron or Vercel cron); retry, dead-letter, audit.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `queueType` — String (e.g. "automation", "sequence_step")
  - `payload` — Json (task-specific; no PII in payload or minimal identifiers only; no SSN/DOB)
  - `idempotencyKey` — String? (optional; dedupe by key within window)
  - `scheduledAt` — DateTime (when job was scheduled)
  - `runAt` — DateTime (when to run; worker picks runAt <= now)
  - `startedAt` — DateTime? (when worker started)
  - `completedAt` — DateTime? (when finished)
  - `status` — Enum: `pending` | `running` | `completed` | `failed` | `dead_letter`
  - `retryCount` — Int, default 0
  - `maxRetries` — Int, default 3
  - `errorMessage` — String?, @db.Text (no PII)
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Relations:** Dealership.
- **Indexes:**
  - `@@index([dealershipId])`
  - `@@index([dealershipId, status, runAt])` — worker query: status = pending AND runAt <= now
  - `@@index([dealershipId, queueType])` — optional filter by type
  - Optional: `@@unique([dealershipId, idempotencyKey])` where idempotencyKey is not null (if dedupe by key)
- **Audit:** job.executed (success), job.failed (with error code/message; no PII). Dead-letter after maxRetries; audit job.dead_letter.

### 1.8 SequenceTemplate

- **Purpose:** Playbook template: named set of steps (Create Task, Send Email, Send SMS — stubbed). Tenant-scoped.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `name` — String
  - `description` — String?, optional
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
  - `deletedAt` — DateTime? (soft delete)
- **Relations:** Dealership, SequenceStep[], SequenceInstance[].
- **Indexes:**
  - `@@index([dealershipId])`
  - `@@index([dealershipId, deletedAt])`
- **Audit:** sequence_template.created, sequence_template.updated, sequence_template.deleted.

### 1.9 SequenceStep

- **Purpose:** Step in a template: type (create_task, send_email, send_sms), order, config (e.g. task title, delay days).
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `templateId` — String, UUID, FK → SequenceTemplate, required
  - `order` — Int (step order)
  - `stepType` — String (e.g. "create_task", "send_email", "send_sms")
  - `config` — Json? (e.g. title, delayDays, templateId for email/sms stub)
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Relations:** Dealership, SequenceTemplate, SequenceStepInstance[].
- **Indexes:**
  - `@@index([dealershipId])`
  - `@@index([templateId, order])` — list steps in order
- **Audit:** Covered by template; step add/update can emit template.updated.

### 1.10 SequenceInstance

- **Purpose:** Running instance of a sequence attached to an Opportunity or Customer. Pause/stop when opportunity WON/LOST.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `templateId` — String, UUID, FK → SequenceTemplate, required
  - `opportunityId` — String?, UUID, FK → Opportunity, optional (one of opportunityId or customerId required)
  - `customerId` — String?, UUID, FK → Customer, optional
  - `status` — Enum: `active` | `paused` | `stopped` | `completed`
  - `startedAt` — DateTime
  - `stoppedAt` — DateTime?, optional
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Constraint:** Exactly one of opportunityId or customerId must be set. Enforce in app (Zod + service).
- **Relations:** Dealership, SequenceTemplate, Opportunity?, Customer?, SequenceStepInstance[].
- **Indexes:**
  - `@@index([dealershipId])`
  - `@@index([dealershipId, opportunityId])` — list by opportunity
  - `@@index([dealershipId, customerId])` — list by customer
  - `@@index([dealershipId, status])`
- **Audit:** sequence_instance.started, sequence_instance.stopped, sequence_instance.paused, sequence_instance.step_skipped (manual skip).

### 1.11 SequenceStepInstance

- **Purpose:** Per-step execution state for a sequence instance: scheduledAt, executedAt, status, error.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `instanceId` — String, UUID, FK → SequenceInstance, required
  - `stepId` — String, UUID, FK → SequenceStep, required
  - `scheduledAt` — DateTime
  - `executedAt` — DateTime?, optional
  - `status` — Enum: `pending` | `skipped` | `completed` | `failed`
  - `error` — String?, @db.Text (no PII)
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Relations:** Dealership, SequenceInstance, SequenceStep.
- **Indexes:**
  - `@@index([dealershipId])`
  - `@@index([instanceId, scheduledAt])` — list steps in order for instance
  - `@@index([dealershipId, instanceId])`
- **Audit:** Step execution outcomes can be summarized in sequence_instance audit (e.g. step_completed, step_failed); no separate audit table for each step row.

---

## 2) RBAC Mapping

### 2.1 Reuse customers.read / customers.write vs crm.read / crm.write

- **Recommendation: Introduce `crm.read` and `crm.write`.**

| Approach | Pros | Cons |
|----------|------|------|
| Reuse customers.read / customers.write | Fewer permissions; pipeline is “customer-centric” | Blurs customer profile vs pipeline/opportunity; cannot grant pipeline-only (e.g. BDC) without full customer write; automation/sequence management tied to customer write |
| New crm.read / crm.write | Clear boundary: pipeline, opportunities, automations, sequences; can assign pipeline/BDC roles without full customer write; audit and reporting align to “CRM” | Two permission sets to assign for full CRM (customers.* + crm.*) |

**Justification:** Pipeline and follow-up automation are distinct from “customer profile + notes + tasks.” Roles such as BDC or “pipeline only” may need crm.read/crm.write without customers.write. Automation rules and sequence templates are configuration that should be gated by crm.write, not customers.write. Therefore the spec defines:

- **crm.read** — List/get pipelines, stages, opportunities, opportunity activity; list/get automation rules, sequence templates, instances and step instances.
- **crm.write** — Create/update/delete opportunities; create/update/delete pipelines and stages (subject to stage-delete rules); create/update/delete automation rules; create/update/delete sequence templates and steps; start/stop/pause sequences; skip step; update next action.

**Sensitive reads:** Opportunity list/detail and activity timeline are CRM-sensitive; audit optional for detail view (per policy). Job list/status is operational; no PII.

**Permission seed (core-platform):** Add to permission catalog and seed: `crm.read`, `crm.write` (module: `crm`). Assign to Owner, Admin, Sales (and optionally BDC role) per default role matrix.

### 2.2 Route → Permission Matrix

| Route area | GET list/detail | POST/PATCH/DELETE | Permission |
|------------|-----------------|-------------------|------------|
| Pipelines | crm.read | crm.write | Pipelines, stages |
| Opportunities | crm.read | crm.write | Opportunities, opportunity activity |
| Automation rules | crm.read | crm.write | AutomationRule CRUD |
| Sequence templates & steps | crm.read | crm.write | Template/step CRUD |
| Sequence instances | crm.read | crm.write | Start, stop, pause, skip step |
| Jobs (queue status) | crm.read (optional: restrict to admin or same module) | — | Read-only for debugging/monitoring |

All routes require active dealership; `dealership_id` from auth only. No admin bypass; least privilege.

---

## 3) API Contract List

**Base path:** `/api/crm` (or `/api/pipelines`, `/api/opportunities`, etc.; choose one convention). Below uses `/api/crm` prefix for CRM-owned resources.

**Pagination:** Every list: `limit` (default 25, max 100), `offset` (0-based). Response: `data: T[]`, `meta: { total, limit, offset }`.  
**Money:** `estimatedValueCents` in API is **string** (cents).  
**Error shape:** `{ error: { code, message, details? } }`. Codes: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, CONFLICT, RATE_LIMITED, INTERNAL.

### 3.1 Route Table

| Method | Path | Purpose | Permission |
|--------|------|---------|------------|
| GET | /api/crm/pipelines | List pipelines (paginated) | crm.read |
| GET | /api/crm/pipelines/:pipelineId | Get pipeline with stages | crm.read |
| POST | /api/crm/pipelines | Create pipeline | crm.write |
| PATCH | /api/crm/pipelines/:pipelineId | Update pipeline | crm.write |
| DELETE | /api/crm/pipelines/:pipelineId | Delete pipeline (reassign or block if stages in use) | crm.write |
| GET | /api/crm/pipelines/:pipelineId/stages | List stages (ordered) | crm.read |
| POST | /api/crm/pipelines/:pipelineId/stages | Create stage | crm.write |
| PATCH | /api/crm/stages/:stageId | Update stage | crm.write |
| DELETE | /api/crm/stages/:stageId | Delete stage (block if opportunities exist; or body targetStageId to reassign) | crm.write |
| GET | /api/crm/opportunities | List opportunities (paginated; filter by pipeline, stage, owner, status) | crm.read |
| GET | /api/crm/opportunities/:opportunityId | Get opportunity (with recent activity) | crm.read |
| POST | /api/crm/opportunities | Create opportunity | crm.write |
| PATCH | /api/crm/opportunities/:opportunityId | Update opportunity (including stage, next action, status) | crm.write |
| GET | /api/crm/opportunities/:opportunityId/activity | List opportunity activity (paginated) | crm.read |
| GET | /api/crm/automation-rules | List automation rules (paginated; filter active) | crm.read |
| GET | /api/crm/automation-rules/:ruleId | Get rule | crm.read |
| POST | /api/crm/automation-rules | Create rule | crm.write |
| PATCH | /api/crm/automation-rules/:ruleId | Update rule | crm.write |
| DELETE | /api/crm/automation-rules/:ruleId | Soft delete rule | crm.write |
| GET | /api/crm/sequence-templates | List sequence templates (paginated) | crm.read |
| GET | /api/crm/sequence-templates/:templateId | Get template with steps | crm.read |
| POST | /api/crm/sequence-templates | Create template | crm.write |
| PATCH | /api/crm/sequence-templates/:templateId | Update template | crm.write |
| DELETE | /api/crm/sequence-templates/:templateId | Soft delete template | crm.write |
| POST | /api/crm/sequence-templates/:templateId/steps | Add step | crm.write |
| PATCH | /api/crm/sequence-steps/:stepId | Update step | crm.write |
| DELETE | /api/crm/sequence-steps/:stepId | Delete step | crm.write |
| POST | /api/crm/opportunities/:opportunityId/sequences | Start sequence (body: templateId) | crm.write |
| POST | /api/crm/customers/:customerId/sequences | Start sequence on customer (body: templateId) | crm.write |
| GET | /api/crm/opportunities/:opportunityId/sequences | List sequences for opportunity | crm.read |
| GET | /api/crm/customers/:customerId/sequences | List sequences for customer | crm.read |
| PATCH | /api/crm/sequence-instances/:instanceId | Pause / resume / stop sequence | crm.write |
| POST | /api/crm/sequence-instances/:instanceId/steps/:stepInstanceId/skip | Skip step | crm.write |
| GET | /api/crm/sequence-instances/:instanceId | Get instance with step instances | crm.read |
| GET | /api/crm/jobs | List jobs (paginated; filter status, queueType) — optional | crm.read |
| GET | /api/crm/jobs/:jobId | Get job status — optional | crm.read |

### 3.2 Query / Params / Body Schemas (Zod names and shapes)

- **listPipelinesQuerySchema:** `limit` (number, min 1, max 100, default 25), `offset` (number, min 0, default 0).
- **pipelineIdParamSchema:** `pipelineId` (z.string().uuid()).
- **createPipelineBodySchema:** `name` (string, required), `isDefault` (boolean, optional).
- **updatePipelineBodySchema:** `name?`, `isDefault?`.
- **listStagesQuerySchema:** (no extra; pipelineId in path).
- **createStageBodySchema:** `order` (number), `name` (string), `colorKey` (string, optional).
- **stageIdParamSchema:** `stageId` (z.string().uuid()).
- **updateStageBodySchema:** `order?`, `name?`, `colorKey?`.
- **deleteStageBodySchema (if reassign):** `targetStageId` (z.string().uuid()).
- **listOpportunitiesQuerySchema:** `limit`, `offset`, `pipelineId?`, `stageId?`, `ownerId?`, `status?` (enum OPEN|WON|LOST), `customerId?`, `sortBy?`, `sortOrder?`.
- **opportunityIdParamSchema:** `opportunityId` (z.string().uuid()).
- **createOpportunityBodySchema:** `customerId` (uuid, required), `vehicleId?`, `dealId?`, `stageId` (uuid, required), `ownerId?`, `source?`, `priority?`, `estimatedValueCents?` (string), `notes?`, `nextActionAt?` (ISO datetime), `nextActionText?`.
- **updateOpportunityBodySchema:** `stageId?`, `ownerId?`, `source?`, `priority?`, `estimatedValueCents?` (string), `notes?`, `nextActionAt?`, `nextActionText?`, `status?` (OPEN|WON|LOST), `lossReason?` (required when status=LOST).
- **listActivityQuerySchema:** `limit`, `offset`.
- **listAutomationRulesQuerySchema:** `limit`, `offset`, `isActive?` (boolean).
- **ruleIdParamSchema:** `ruleId` (z.string().uuid()).
- **createAutomationRuleBodySchema:** `name`, `triggerEvent`, `triggerConditions?` (object), `actions` (array), `schedule` (immediate|delayed), `isActive?`.
- **updateAutomationRuleBodySchema:** same fields optional.
- **listSequenceTemplatesQuerySchema:** `limit`, `offset`.
- **templateIdParamSchema:** `templateId` (z.string().uuid()).
- **createSequenceTemplateBodySchema:** `name`, `description?`.
- **updateSequenceTemplateBodySchema:** `name?`, `description?`.
- **createSequenceStepBodySchema:** `order`, `stepType` (create_task|send_email|send_sms), `config?` (object).
- **updateSequenceStepBodySchema:** `order?`, `stepType?`, `config?`.
- **startSequenceBodySchema:** `templateId` (uuid).
- **instanceIdParamSchema:** `instanceId` (z.string().uuid()).
- **stepInstanceIdParamSchema:** `stepInstanceId` (z.string().uuid()).
- **updateSequenceInstanceBodySchema:** `status` (active|paused|stopped).
- **listJobsQuerySchema:** `limit`, `offset`, `status?`, `queueType?`.
- **jobIdParamSchema:** `jobId` (z.string().uuid()).

All params and body validated with Zod at the edge. `dealership_id` never in body; from auth only.

---

## 4) UI Screen Map

- **Pipeline board** (e.g. `/crm` or `/crm/pipeline`): Kanban or list view of opportunities by stage; filter by pipeline, owner; drag-and-drop or dropdown to change stage; create opportunity; link to opportunity detail. Gated: crm.read (view), crm.write (create, move, edit).
- **Opportunity detail** (e.g. `/crm/opportunities/:id`): Overview (customer, vehicle, deal, stage, owner, source, priority, estimated value, notes, next action); activity timeline; start sequence; edit/update stage, status (WON/LOST), next action. Gated: crm.read / crm.write.
- **Automation rules** (e.g. `/crm/automations`): List rules; create/edit rule (trigger event, conditions, actions, schedule); enable/disable; soft delete. Gated: crm.read / crm.write.
- **Sequence runner status** (e.g. `/crm/sequences` or within opportunity/customer detail): List active/paused/stopped instances per opportunity or customer; step list with scheduledAt, executedAt, status; actions: pause, resume, stop, skip step. Gated: crm.read / crm.write.
- **Sequence templates** (e.g. `/crm/sequences/templates`): List templates; create/edit template; add/edit/delete steps (type, order, config). Gated: crm.read / crm.write.
- **Jobs (optional):** Read-only list of queue jobs (pending, running, completed, failed, dead_letter) for debugging; filter by type. Gated: crm.read (or admin-only if preferred).

---

## 5) Events (Internal) + Idempotency Rules

### 5.1 Emitted (this module)

- **opportunity.created** — Payload: opportunityId, customerId, stageId, dealershipId. Consumed by: automation engine (trigger rules), sequence (if sequence start is automated).
- **opportunity.updated** — Payload: opportunityId, changedFields. Consumed by: automation (e.g. condition on field change).
- **opportunity.stage_changed** — Payload: opportunityId, fromStageId, toStageId, dealershipId. Consumed by: automation engine; OpportunityActivity written.
- **opportunity.status_changed** — Payload: opportunityId, fromStatus, toStatus (WON/LOST), dealershipId. Consumed by: sequence runner (pause/stop when WON/LOST); automation engine.
- **pipeline.created** / **pipeline.updated** — Payload: pipelineId, dealershipId.
- **stage.created** / **stage.updated** / **stage.deleted** — Payload: stageId, pipelineId, dealershipId.
- **automation_rule.created** / **automation_rule.updated** / **automation_rule.deleted** — Payload: ruleId, dealershipId.
- **sequence_instance.started** / **sequence_instance.stopped** / **sequence_instance.paused** — Payload: instanceId, opportunityId or customerId, templateId.
- **job.executed** / **job.failed** / **job.dead_letter** — Payload: jobId, queueType, status; no PII in metadata.

### 5.2 Consumed (from other modules)

- **customer.task.completed** (customers module) — Trigger automation rules (e.g. “when task completed, move to next stage” or “schedule follow-up”).
- **deal.status_changed** (deals module) — Optional: when deal CONTRACTED, mark opportunity WON or link; when CANCELED, optional automation.
- (Phase 2: inbound reply, call tracking events.)

### 5.3 Idempotency

- **AutomationRun:** Unique (dealershipId, entityType, entityId, eventKey, ruleId). Before executing a rule for an event, insert row; on conflict skip. On success/failure update status.
- **Job:** Optional `idempotencyKey` per job; if provided, worker or enqueue logic can dedupe by (dealershipId, idempotencyKey) within a time window (e.g. 24h). Document in API if used for sequence steps (e.g. same step + instance + scheduledAt = one job).

---

## 6) Security Constraints

- **Tenant isolation:** Every query and mutation scoped by `dealership_id` from auth/session. No path param or body field for dealership identity. Cross-tenant access forbidden; return NOT_FOUND for wrong tenant.
- **No PII in audit:** AuditLog metadata and Job errorMessage must not contain SSN, DOB, full card data, or unnecessary PII. Use entity IDs and status codes only where sufficient.
- **Rate limiting:** Automation execution and job enqueue: rate limit per dealership (e.g. max N automation runs per minute; max N jobs enqueued per minute) to prevent abuse. Document limits in SECURITY.md or spec.
- **Validation:** All API inputs validated with Zod at the edge. No unvalidated request body or params.
- **Least privilege:** No admin bypass for CRM routes; crm.read / crm.write enforced per route table.

---

## 7) Backend Checklist

- [ ] Prisma: Add Opportunity, Pipeline, Stage, OpportunityActivity, AutomationRule, AutomationRun, Job, SequenceTemplate, SequenceStep, SequenceInstance, SequenceStepInstance; enums (OpportunityStatus, JobStatus, SequenceInstanceStatus, SequenceStepInstanceStatus); all tenant-scoped; estimatedValueCents BigInt; indexes and FKs; relations on Dealership, Customer, Vehicle, Deal, Profile.
- [ ] Migration: Create and apply; partial unique for default pipeline per dealership; unique for AutomationRun idempotency; indexes for worker (Job status + runAt).
- [ ] DB layer: `/modules/crm-pipeline-automation/db` — CRUD for all models; every query scoped by dealershipId.
- [ ] Service layer: Stage delete (block or reassign); opportunity status/stage transitions and OpportunityActivity writes; automation trigger evaluation and AutomationRun idempotency; job enqueue and worker (poll Job where status=pending and runAt<=now); sequence start/pause/stop and step skip; sequence step execution (create task via customers module; email/SMS stubbed); pause/stop sequence when opportunity WON/LOST.
- [ ] API routes: All routes in route table; Zod for params, query, body; requirePermission(crm.read | crm.write); dealershipId from auth; money as string in responses; pagination limit/offset.
- [ ] Audit: opportunity.*, pipeline.*, stage.*, automation_rule.*, sequence_template.*, sequence_instance.*, job.executed / job.failed / job.dead_letter; no PII in metadata.
- [ ] Worker: Deterministic job runner (cron or Vercel cron): poll Job, update status to running, execute, update completed/failed; retry with backoff; dead_letter after maxRetries; audit job.failed and job.dead_letter.
- [ ] Tests: Tenant isolation (Dealer A cannot see/mutate Dealer B data); RBAC (insufficient permission → 403); idempotency (same event+entity+rule does not double-run); stage delete (block or reassign); sequence pause on WON/LOST; audit entries for CUD and job outcomes.

---

## 8) Frontend Checklist

- [ ] Pipeline board: list opportunities by stage; filters (pipeline, owner, status); create opportunity; change stage (drag or dropdown); link to detail. Permission gating.
- [ ] Opportunity detail: overview, activity timeline, next action; edit stage, status (WON/LOST), loss reason; start sequence. Permission gating.
- [ ] Automation rules: list, create, edit, enable/disable, soft delete; trigger + actions + schedule. Permission gating.
- [ ] Sequence templates: list, create, edit, add/edit/delete steps (create_task, send_email, send_sms stubbed). Permission gating.
- [ ] Sequence runner: list instances per opportunity/customer; show step status (scheduledAt, executedAt, status); pause, resume, stop, skip step. Permission gating.
- [ ] Jobs (optional): read-only list for debugging; filter by status, queueType. Permission gating.
- [ ] Manual smoke: create pipeline/stages → create opportunity → move stage → trigger automation (if any) → start sequence → pause/stop/skip step; verify WON/LOST pauses sequence; tenant/RBAC negative checks.

---

## 9) MVP vs Phase 2

### MVP (in scope)

- Pipelines and stages (default pipeline per dealership; custom stages; stage delete = block or reassign).
- Opportunities (CRUD; link customer required, vehicle/deal optional; stage, owner, next action, status OPEN/WON/LOST; activity timeline).
- Automation rules (trigger event + conditions, actions: create task, update stage, add tag, schedule follow-up; immediate or delayed; AutomationRun idempotency; Job queue + polling worker; retry and dead-letter; audit job executed/failed).
- Follow-up sequences (templates with steps: Create Task, Send Email stub, Send SMS stub; instance on opportunity or customer; scheduledAt/executedAt/status/error; pause/stop on WON/LOST; manual skip step and stop sequence).
- RBAC: crm.read / crm.write. Tenant scoping; Zod at edge; pagination; standard error shape; audit as above; no PII in audit.

### Phase 2 (out of scope for this spec)

- Inbound reply handling (email/SMS reply → event → automation or sequence branching).
- Call tracking (call event → trigger or step).
- Rich email/SMS providers (replace stubs with real send; still no SSN/PII in payload).
- Multiple pipelines per dealership (e.g. Sales vs Service) with opportunity type or pipeline selector.
- Advanced conditions (e.g. time-on-stage, lead score) and branching in sequences.
- Dedicated “BDC” or “pipeline-only” default role in seed (permission set only; no schema change).

---

---

## 10) Module Boundary

- **Owns:** Opportunity, Pipeline, Stage, OpportunityActivity, AutomationRule, AutomationRun, Job, SequenceTemplate, SequenceStep, SequenceInstance, SequenceStepInstance. Code under `/modules/crm-pipeline-automation/{db,service,ui,tests}`. Route handlers under `/app/api/crm/**` (or chosen prefix) call this module’s service only.
- **Depends on:** core-platform (Dealership, Profile, RBAC, AuditLog); customers (Customer, CustomerTask for “create task” action and sequence step); deals (Deal — optional link); inventory (Vehicle — optional link). No direct DB writes to Customer/Deal/Vehicle from CRM db layer; use customers/deals/inventory services or Prisma relation scoped by dealership for reads and for creating tasks.
- **Shared:** Permissions `crm.read`, `crm.write` seeded in core-platform. Customers module remains owner of Customer, notes, tasks, activity; CRM creates tasks via customers service/API when automation or sequence step runs.

---

**End of SPEC. No implementation code.**
