# CRM Automation Engine — STEP 1 Spec (Architect)

**Sprint:** CRM Automation Engine  
**Goal:** Automated follow-up workflows for customer leads: automation rules, automated task generation, lead attribution, conversation timeline.  
**Architect decision:** Extend existing `crm-pipeline-automation` module and `AutomationRule`; no new `crm-automation` module or `CrmAutomationRule` table. Reuse customers module for tasks, activity, timeline.

---

## 1. Architecture overview

### 1.1 Current state

- **crm-pipeline-automation:** Holds `AutomationRule`, `AutomationRun`, `Job`; services `automation-rule`, `automation-engine`. Engine listens for `opportunity.created`, `opportunity.stage_changed`, `opportunity.status_changed`, `customer.task_completed`; runs actions `create_task`, `update_stage`, `add_tag`; supports immediate and delayed (Job) execution.
- **customers:** Customer (with `leadSource`), CustomerTask, CustomerActivity, CustomerNote, CustomerCallback; services task, activity, timeline. Timeline merges notes, activity (call, appointment, sms, task_created, etc.), callbacks. Emits `customer.created`, `customer.task_completed`.
- **API:** `/api/crm/automation-rules` (GET, POST), `/api/crm/automation-rules/[ruleId]` (GET, PATCH, DELETE). RBAC: `crm.read` / `crm.write`.
- **UI:** CRM under Marketing (`/crm`); `/crm/automations` renders AutomationRulesPage (table, create/edit, enable/disable).

### 1.2 Target state (this sprint)

- **Same module and model:** Continue using `AutomationRule` and `crm-pipeline-automation` for all CRM automations. No new Prisma model for “CrmAutomationRule.”
- **New triggers:** `customer.created`, `lead_created` (alias/condition for customer created as LEAD), `appointment_missed` (when defined and emitted).
- **New actions:** `assign_salesperson`, `send_message` (stub or integration point), `schedule_follow_up` (already supported via delayed Job; document and expose in UI).
- **Lead attribution:** Extend Customer with optional `leadCampaign`, `leadMedium`; expose aggregated lead sources via new GET endpoint.
- **Conversation timeline:** Keep using existing timeline; add `email_sent` (or similar) activity type and map to timeline; ensure tasks appear clearly (existing task_created is already in timeline as SYSTEM; optional explicit TASK type).
- **Execution:** Single automation engine (`processAutomationTrigger` / `executeRuleActions`) handles all triggers and actions; `runCrmAutomation()` is the existing engine run (no separate “runCrmAutomation” service name required; document that “run CRM automation” = processAutomationTrigger for the new events).

### 1.3 Layer boundaries

- **API routes:** Thin; getAuthContext → guardPermission → Zod parse → service → jsonResponse. No business logic in routes.
- **Service:** `crm-pipeline-automation` automation-rule + automation-engine; `customers` customer, task, activity, timeline. Cross-module: engine calls `customers/service/task`, `customers/service/customer` (and opportunity db) only via service/public API.
- **DB:** Tenant-scoped reads/writes; no cross-tenant access. All list/get by dealershipId.

---

## 2. Data model changes

### 2.1 Customer (lead attribution)

- **Add (optional):**
  - `lead_campaign` — String?, max length 200, mapped `lead_campaign`. Nullable. Index: not required for MVP (filtering by source is primary).
  - `lead_medium` — String?, max length 200, mapped `lead_medium`. Nullable.
- **Existing:** `lead_source` remains the primary attribution field; campaign and medium are optional refinements.
- **Migration:** Single additive migration; no backfill required. Existing rows keep null for new columns.

### 2.2 AutomationRule (no schema change)

- **Keep as-is:** id, dealershipId, name, triggerEvent, triggerConditions (Json), actions (Json), schedule, isActive, createdAt, updatedAt, deletedAt.
- **Trigger event values (allowed):** Existing plus `customer.created`, `lead_created`, `appointment_missed`. Validation in API/schema: allow these strings; engine matches by string.
- **Actions (JSON shape):** Existing plus:
  - `assign_salesperson`: params `{ userId: string }` (optional) or use opportunity/customer assignedTo.
  - `send_message`: params `{ channel?: string, template?: string }` — stub: log or no-op; no PII in logs.
  - `schedule_follow_up`: already represented by schedule "delayed" + first action with delayMinutes (or explicit action type that creates a delayed job). Document in API/spec; no new action payload required if current delayed flow suffices.

### 2.3 No new tables

- No CrmAutomationRule, no LeadSource table. Lead “sources” are derived by aggregating distinct (leadSource, leadCampaign, leadMedium) from Customer for the tenant.

### 2.4 Indexes

- **Customer:** Add composite index only if lead-sources query is slow: `@@index([dealershipId, leadSource])` exists; consider `@@index([dealershipId, leadSource, leadCampaign, leadMedium])` for distinct-aggregate if needed in performance pass.
- **AutomationRule:** Consider composite `@@index([dealershipId, triggerEvent, isActive])` for `listActiveRulesByTriggerEvent` (performance pass).

---

## 3. API endpoints

### 3.1 Existing (unchanged contract)

- **GET /api/crm/automation-rules** — List rules; query: limit, offset, isActive (optional). Response: data[], meta: { total, limit, offset }. Permission: crm.read.
- **POST /api/crm/automation-rules** — Create rule; body: name, triggerEvent, triggerConditions?, actions, schedule, isActive?. Permission: crm.write.
- **GET /api/crm/automation-rules/[ruleId]** — Get one rule. Permission: crm.read.
- **PATCH /api/crm/automation-rules/[ruleId]** — Update rule (partial). Permission: crm.write.
- **DELETE /api/crm/automation-rules/[ruleId]** — Soft-delete rule. Permission: crm.write.

**Schema extension:** Allow triggerEvent values: `customer.created`, `lead_created`, `appointment_missed` in addition to existing. Allow action types: `assign_salesperson`, `send_message`, `schedule_follow_up` in addition to existing (create_task, update_stage, add_tag). Validation: triggerEvent string max 100; actions array of { type, params? }.

### 3.2 New

- **GET /api/crm/lead-sources**
  - **Purpose:** Return distinct lead attribution values for the dealership (for filters, dropdowns, reporting).
  - **Query:** Optional: limit (default 100, max 100).
  - **Response:** `{ data: { source: string | null; campaign: string | null; medium: string | null }[] }` — distinct combinations present in Customer for that dealership. Exclude deleted (deletedAt null). Order: source, campaign, medium (stable).
  - **Permission:** crm.read.
  - **Tenant:** dealershipId from auth context only.

### 3.3 Customer create/update (customers API)

- **Extend** existing customer create/update request body to accept optional `leadCampaign`, `leadMedium` (strings, max 200). Existing `leadSource` unchanged. Enforce in customers module and API schemas.

### 3.4 Timeline (existing)

- **GET /api/customers/[id]/timeline** — No contract change. Backend may add mapping for new activity type `email_sent` (or equivalent) to a timeline event type (e.g. SYSTEM or new EMAIL) so conversation timeline shows emails when that activity is recorded.

---

## 4. Service-layer logic

### 4.1 Automation engine (crm-pipeline-automation)

- **Register listeners:** In `ensureAutomationHandlersRegistered()` add:
  - `customer.created` → processAutomationTrigger(dealershipId, "customer", payload.customerId, "customer.created", payload). Optionally also register `lead_created` with same payload when customer.status === LEAD (or treat lead_created as alias in engine that matches both customer.created and a condition status=LEAD).
  - `appointment_missed` → processAutomationTrigger(dealershipId, "appointment", payload.appointmentId or customerId, "appointment_missed", payload) when event exists. (If appointment_missed is not implemented in this sprint, document as deferred and do not register.)
- **Resolve customer for actions:** For entityType "customer", entityId is customerId. For "opportunity", already resolve customerId and ownerId. For "appointment_missed", payload must include customerId (or appointment entity with customerId) so that create_task / assign_salesperson have a target.
- **New actions in executeRuleActions:**
  - **assign_salesperson:** Params userId (UUID). Set customer.assignedTo = userId; if opportunity context, set opportunity.ownerId = userId. Use customers service update and opportunity db update; no direct Prisma from engine to customers db (use existing customer service).
  - **send_message:** Params channel?, template?. Stub: no-op or log only; no PII. No external API call in MVP.
  - **schedule_follow_up:** Already supported by schedule "delayed" and first action with delayMinutes; or explicit action that enqueues a Job with same payload. No change if current delayed-job behavior is sufficient; otherwise add one action that creates a follow-up task at dueAt.
- **Idempotency and guards:** Unchanged: AutomationRun per (entityType, entityId, eventKey, ruleId); max runs per entity per minute; origin/depth to prevent loops.

### 4.2 Lead sources (new in crm-pipeline-automation or customers)

- **Option A:** New function in customers module: `listLeadSourceValues(dealershipId, options?: { limit })` — query Customer where dealershipId, deletedAt null; select distinct leadSource, leadCampaign, leadMedium; return array of { source, campaign, medium }; limit 100. Called by CRM API route (route in app/api/crm/lead-sources).
- **Option B:** Same logic in crm-pipeline-automation service that uses Prisma on Customer (allowed for read-only aggregate; no write). Prefer **Option A** (customers module) so all Customer reads stay in one module; API route under /api/crm can call customers service for this read.

**Decision:** Implement `listLeadSourceValues` in **customers** module (db or service layer); GET /api/crm/lead-sources handler calls that and returns serialized result. Permission crm.read.

### 4.3 Customer create/update (customers)

- **Create/update:** When creating or updating customer, accept and persist leadCampaign, leadMedium in DB layer and service. Validation: optional strings, max 200 chars. Audit and existing tenant checks unchanged.

### 4.4 Timeline (customers)

- **Activity type:** If “email” touchpoint is added, use activityType e.g. `email_sent` and map in timeline DB to a timeline event type (e.g. EMAIL or SYSTEM). No requirement to add a new table; only activity type and mapping.
- **Tasks in timeline:** Current behavior (task_created as SYSTEM) is acceptable. Optional: add TASK timeline type and merge CustomerTask rows into timeline for “conversation” view; document as enhancement if not in scope.

---

## 5. UI plan

### 5.1 CRM → Automations page (existing, enhance)

- **Location:** `/crm/automations` (unchanged).
- **Enhancements:**
  - **Table columns:** Rule name, trigger (display label for triggerEvent), status (Active / Inactive from isActive). Existing schedule/actions can remain or be summarized.
  - **Create/Edit rule form:** Add trigger options: “Lead created”, “Customer created”, “Opportunity stage changed”, “Appointment missed” (if implemented). Map to triggerEvent values: lead_created, customer.created, opportunity.stage_changed, appointment_missed. Existing “Opportunity created”, “Customer task completed” remain.
  - **Action types in form:** Add “Assign salesperson” (with user/salesperson select), “Send message” (stub: template/channel optional), “Schedule follow-up” (delay; reuse existing delayed flow). Keep “Create task”, “Update stage”, “Add tag”.
  - **Loading / error / empty:** Already required; verify they exist.
- **No new page:** Reuse AutomationRulesPage; no separate “CRM Automations” product page.

### 5.2 Customer page — conversation timeline

- **Location:** Customer detail (existing); timeline is already in TimelineCard / CustomerDetailContent.
- **Behavior:** Timeline already shows notes, calls, callbacks, appointments, system events (SMS, task created). Ensure any new activity type (e.g. email_sent) is recorded and mapped so it appears. No new tab or section required unless product asks for a dedicated “Conversation” tab (then it is the same timeline with a label).
- **Lead attribution on customer:** Customer form and overview already show leadSource. Add optional fields for Lead source / Campaign / Medium (or single “Source” and “Campaign”, “Medium”) in customer create/edit and in overview/detail when lead attribution is shown.

### 5.3 Lead sources (optional UI)

- **Use case:** Filters or dropdowns that need distinct source/campaign/medium. If Automations or Customers filters use lead sources, add a small fetch to GET /api/crm/lead-sources and use in select or filter chips. Not required for MVP if not in acceptance criteria; document as optional.

### 5.4 Design and layout

- Use existing enterprise SaaS layout; design tokens from `lib/ui/tokens` and globals.css only. No new layout systems. Tables: existing Table + Pagination; forms: existing patterns (React Hook Form + Zod where applicable). Loading, error, empty states on all pages that fetch data.

---

## 6. RBAC matrix

| Resource / action | Permission | Notes |
|------------------|------------|--------|
| GET automation rules | crm.read | List and get one |
| POST automation rules | crm.write | Create |
| PATCH automation rules | crm.write | Update (enable/disable, edit) |
| DELETE automation rules | crm.write | Soft-delete |
| GET lead-sources | crm.read | Aggregated read from Customer |
| Customer create/update (including leadCampaign, leadMedium) | customers.write | Existing permission |
| GET customer timeline | customers.read | Unchanged |
| Automation execution (engine, jobs) | Server-side only; no user permission check at execution time; job payload includes dealershipId and is tenant-scoped | |

No new permissions. All CRM automation and lead-sources APIs use existing crm.read / crm.write.

---

## 7. Audit events

| Event | When | Metadata (no PII) |
|-------|------|--------------------|
| automation_rule.created | Rule created via API | ruleId, name, triggerEvent |
| automation_rule.updated | Rule updated (including isActive) | ruleId, name, fields changed |
| automation_rule.deleted | Rule soft-deleted | ruleId |
| customer.task.created | Task created (including by automation) | customerId, taskId (existing) |

Automation engine does not need to log every rule execution as audit (AutomationRun is the record). Optionally log automation_rule.triggered with ruleId and entityId in audit for compliance; if not in scope, leave for later.

---

## 8. Security considerations

- **Tenant isolation:** Every query and mutation scoped by dealershipId from auth context. Cross-tenant ID in path/body returns NOT_FOUND. Lead-sources aggregate only over current dealership’s customers.
- **Input validation:** triggerEvent and action types allowlisted in Zod. Params for assign_salesperson: userId must be UUID. No raw HTML or script in message stub.
- **Sensitive data:** send_message stub must not log message body or PII. Audit metadata must not include SSN, DOB, income, email, phone, tokens.
- **RBAC:** No bypass; guardPermission on every route. No client-supplied dealershipId.

---

## 9. Acceptance criteria

### Feature set A — CRM automations

- [ ] Rules can be created with triggerEvent one of: lead_created, customer.created, opportunity_stage_changed, appointment_missed (and existing triggers). Stored and returned by GET/PATCH.
- [ ] Rules can include actions: create task, assign salesperson, send message (stub), schedule follow-up (via delayed or explicit). Schema accepts these; engine executes create_task and assign_salesperson; send_message is no-op/stub; schedule_follow_up works via existing delayed mechanism.
- [ ] GET /api/crm/automation-rules and GET/PATCH /api/crm/automation-rules/[id] support new trigger and action values. List and get by id work with tenant isolation.

### Feature set B — Automated tasks

- [ ] When trigger customer.created (or lead_created) fires, a rule that has create_task action creates a CustomerTask for that customer. Same for opportunity-based triggers (existing behavior).
- [ ] runCrmAutomation (i.e. processAutomationTrigger) runs for customer.created when a customer is created; at least one test demonstrates task creation from a rule.

### Feature set C — Lead attribution

- [ ] Customer has leadCampaign and leadMedium (optional). Customer create/update API accepts and persists them.
- [ ] GET /api/crm/lead-sources returns distinct (source, campaign, medium) for the dealership; permission crm.read; tenant-scoped.

### Feature set D — Conversation timeline

- [ ] Customer timeline continues to show calls, SMS, tasks, appointments (existing). If email_sent activity type is added, it appears in timeline.
- [ ] Customer detail page shows the timeline (existing TimelineCard); no regression.

### Cross-cutting

- [ ] All new or touched API routes enforce RBAC (crm.read / crm.write or customers.read/write as applicable).
- [ ] All queries filter by dealershipId; cross-tenant access returns NOT_FOUND.
- [ ] Audit logging for rule create/update/delete (and optionally trigger); no PII in metadata.
- [ ] Tests: at least one automation execution test (e.g. customer.created → create_task), tenant isolation for automation and lead-sources, and validation errors for invalid trigger/action.

---

## 10. Deferred / out of scope

- **appointment_missed:** Emitting this event requires a definition of “missed” (e.g. appointment in the past with no completion). Deferred unless a simple definition is implemented (e.g. cron that checks appointments and emits).
- **send_message:** Real integration (SMS/email provider) out of scope; stub only.
- **Dedicated “Conversation” tab:** If product wants a separate tab, same timeline data can be shown under that label; no backend change.
- **New CrmAutomationRule table or crm-automation module:** Not used; extension of existing AutomationRule and engine only.

---

*End of STEP 1 Spec. No code in this step. Proceed to STEP 2 Backend.*
