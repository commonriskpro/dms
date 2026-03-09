# CRM Automation Engine — Repo Inspection Summary

**Sprint:** CRM Automation Engine  
**Goal:** Implement automated follow-up workflows for customer leads (automation rules, automated task generation, lead attribution, conversation timeline).  
**Date:** 2025-03-07

---

## 1. Repo structure and conventions

- **Monorepo:** `apps/dealer` (main dealer SaaS), `apps/platform`, `apps/mobile`, `packages/contracts`.
- **Stack:** Next.js App Router, Prisma, Supabase auth, Jest, shadcn/ui (per `.cursorrules` and ARCHITECTURE_MAP).
- **Modules:** Under `apps/dealer/modules/`. Each has `db/` (tenant-scoped Prisma), `service/` (business logic), optional `ui/`, `tests/`. Cross-module: service-to-service or domain events only; no module-A-db → module-B-db.
- **API:** Route → service → db. Pattern: `getAuthContext` → `guardPermission` → validate (Zod) → service → `jsonResponse`. Errors: `{ error: { code, message, details } }`; codes include UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR. All list APIs use `parsePagination` (default 25, max 100).
- **Tests:** Run from repo root: `npm run test:dealer`. Jest only (no Vitest/Playwright). Integration tests use `dotenv -e .env.test` where needed.

---

## 2. Existing CRM and automation surface

### 2.1 Module: `crm-pipeline-automation`

- **Location:** `apps/dealer/modules/crm-pipeline-automation/`
- **DB:** `db/automation-rule.ts`, `db/automation-run.ts`, `db/opportunity.ts`, `db/stage.ts`, `db/pipeline.ts`, `db/job.ts`, `db/sequence-*.ts`, `db/opportunity-activity.ts`
- **Services:** `service/automation-rule.ts`, `service/automation-engine.ts`, `service/opportunity.ts`, pipeline/stage/sequence/job-worker/journey-bar
- **Prisma:** `AutomationRule` (id, dealershipId, name, triggerEvent, triggerConditions (Json?), actions (Json), schedule (Varchar 50), isActive, createdAt, updatedAt, deletedAt). `AutomationRun` for idempotency per entity/event/rule.
- **Triggers today:** `opportunity.created`, `opportunity.stage_changed`, `opportunity.status_changed`, `customer.task_completed` (with alias `customer.task.completed`).
- **Actions today:** `create_task` (customer task via `customers/service/task`), `update_stage` (opportunity), `add_tag` (customer), delayed runs via `schedule: "delayed"` and Job queue.
- **Event wiring:** `ensureAutomationHandlersRegistered()` in `automation-engine.ts` registers listeners; called from `opportunity.ts` (create/update). No instrumentation.ts registration of automation handlers; handlers are registered when opportunity service is first used.

**Implication for sprint:** The sprint spec asks for a **new** model `CrmAutomationRule` and module `modules/crm-automation` with submodules rules, execution, timeline. The repo already has `AutomationRule` and a full automation engine under `crm-pipeline-automation`. Options: (A) **Extend existing** — add triggers `lead_created`, `customer_created`, `appointment_missed` and actions (assign salesperson, send message, schedule follow-up) to the current engine and optionally introduce a “CRM automation” naming/API surface; or (B) **New module** — add `crm-automation` with a separate `CrmAutomationRule` table and `runCrmAutomation()` that either reuses or mirrors the existing engine. The spec’s “Create model CrmAutomationRule” and “Create module modules/crm-automation” suggest (B); the spec’s “Reuse CRM services, customer models, activity logs” suggests reusing customers + existing automation patterns. **Recommendation:** Implement the sprint as an **extension of the existing crm-pipeline-automation** (same AutomationRule, same engine) with new trigger/action types and a dedicated “CRM Automations” product surface; only introduce a second model/module if product explicitly requires a separate rule type (e.g. “lead-only” vs “pipeline” rules). Document the choice in STEP 1 Spec.

### 2.2 API routes under `/api/crm/`

- **Existing:** `automation-rules` (GET, POST), `automation-rules/[ruleId]` (GET, PATCH, DELETE), pipelines, stages, opportunities, journey-bar, sequence-templates, sequence-instances, jobs, customers/[id]/sequences, customers/[id]/stage.
- **RBAC:** All use `guardPermission(ctx, "crm.read")` for GET and `guardPermission(ctx, "crm.write")` for mutations. No bypass.
- **Schemas:** `app/api/crm/schemas.ts` — `listAutomationRulesQuerySchema`, `createAutomationRuleBodySchema` (name, triggerEvent, triggerConditions, actions, schedule, isActive), `updateAutomationRuleBodySchema`.

**Implication:** New endpoints (if any) should live under `/api/crm/` and use the same handler pattern and `crm.read` / `crm.write`. The spec’s “GET/POST /api/crm/automations” and “PATCH /api/crm/automations/[id]” can map to the existing `automation-rules` routes or to new `/api/crm/automations` routes that delegate to the same service/db.

### 2.3 Frontend: CRM and Automations

- **Sidebar:** `components/app-shell/sidebar.tsx` — CRM is “Marketing” at `/crm`, permission `crm.read`.
- **App routes:** `app/(app)/crm/` — `page.tsx`, `layout.tsx`, `automations/page.tsx`, `opportunities/page.tsx`, `jobs/page.tsx`, `sequences/page.tsx`, `opportunities/[id]/page.tsx`. Layout is minimal (no subnav in layout).
- **Automations page:** `app/(app)/crm/automations/page.tsx` renders `AutomationRulesPage` from `modules/crm-pipeline-automation/ui/AutomationRulesPage.tsx`. Table: rules with name, trigger, schedule, actions; create/edit/delete; enable/disable; uses `apiFetch('/api/crm/automation-rules')`, `shouldFetchCrm(canRead)` guard, WriteGuard for mutations.

**Implication:** “CRM → Automations” page already exists. Sprint can enhance it (e.g. new trigger/action options, status column) and add any subnav under `/crm` if desired. No need to add a new top-level nav item for “Automations.”

---

## 3. Customers module and timeline

### 3.1 Customer and lead data

- **Prisma:** `Customer` has `leadSource` (String?, mapped `lead_source`), `status` (LEAD | ACTIVE | SOLD | INACTIVE), `assignedTo`, stageId, tags, etc. Indexes include `@@index([dealershipId, leadSource])`.
- **No** `campaign` or `medium` on Customer today. Lead attribution “source, campaign, medium” will require schema change (e.g. add `leadCampaign`, `leadMedium`) or a small attribution table/key-value. Existing usage: list/filter by `leadSource`, reports groupBy leadSource, saved filters/searches store leadSource.
- **Events:** `customer.created` is emitted from `modules/customers/service/customer.ts` on create (payload: customerId, dealershipId). No separate `lead_created` event; “lead” is status/role of Customer.

**Implication:** For “lead_created” trigger, use `customer.created` and optionally restrict by `Customer.status === 'LEAD'` in conditions. For lead attribution (Feature Set C), add fields (e.g. `leadCampaign`, `leadMedium`) or a single JSON field and expose GET `/api/crm/lead-sources` (aggregate distinct source/campaign/medium for the tenant).

### 3.2 Tasks and activity

- **CustomerTask:** Prisma model; created via `modules/customers/service/task.ts` — `createTask(dealershipId, userId, customerId, data)`. Audit: `customer.task.created`; activity: `task_created` appended to CustomerActivity.
- **CustomerActivity:** activityType, entityType, entityId, metadata, actorId. Used for timeline and dashboard (e.g. call, appointment_scheduled, sms_sent, disposition_set, task_created, note_added).
- **customer.task_completed:** Emitted from task service on completion; payload includes customerId, taskId, completedBy. Already consumed by automation engine.

**Implication:** Automated task generation (Feature Set B) should keep using `customers/service/task.createTask`. No new task model needed.

### 3.3 Timeline and conversation

- **DB:** `modules/customers/db/timeline.ts` — `listTimeline(dealershipId, customerId, options)` merge-sorts:
  - CustomerNote (NOTE)
  - CustomerActivity → mapped to CALL, APPOINTMENT, SYSTEM (call, appointment_scheduled, sms_sent, disposition_set, task_created, note_added)
  - CustomerCallback (CALLBACK)
- **Types:** `TimelineEventType = "NOTE" | "CALL" | "CALLBACK" | "APPOINTMENT" | "SYSTEM"`. No explicit “EMAIL” or “TASK” type; tasks appear as SYSTEM (task_created).
- **API:** `GET /api/customers/[id]/timeline` (pagination, optional type filter). Used by `TimelineCard` in customer detail.
- **UI:** `CustomerDetailContent` includes `TimelineCard` with `initialTimeline`; customer detail page passes `initialTimeline` from server for faster first paint.

**Implication:** Feature Set D (“conversation timeline: calls, SMS, emails, tasks, appointments”) is largely covered: calls and appointments and SMS and task_created are already in the timeline. Remaining work: (1) add an “email” activity type and ensure it’s mapped to a timeline type (e.g. EMAIL or SYSTEM); (2) optionally add a distinct TASK timeline type and include task created/completed in the merged list; (3) ensure all touchpoints (calls, SMS, emails, tasks, appointments) are recorded as CustomerActivity so they appear in the same timeline.

---

## 4. Events and automation execution

### 4.1 Event bus

- **Location:** `lib/infrastructure/events/eventBus.ts`
- **Typed events:** `DomainEventMap` includes `vehicle.*`, `deal.*`, `customer.created`, `customer.task_completed`, `opportunity.created`, `opportunity.stage_changed`, `opportunity.status_changed`, `bulk_import.requested`, `analytics.requested`.
- **Payloads:** All include `dealershipId`. No `lead_created` or `appointment_missed` yet.

**Implication:** Add `lead_created` only if we want a distinct event (e.g. when status is set to LEAD); otherwise treat `customer.created` as lead-creation when status is LEAD. Add `appointment_missed` when we have a defined rule (e.g. appointment in the past with no “done” activity); may require a small job or cron that checks appointments and emits the event.

### 4.2 Automation engine flow

- **Entry:** `processAutomationTrigger(dealershipId, entityType, entityId, eventName, payload)`.
- **Guards:** Tenant active for write; origin/depth to avoid loops; max runs per entity per minute (idempotency via AutomationRun + eventKey).
- **Lookup:** `listActiveRulesByTriggerEvent(dealershipId, triggerEvent)` (and alias handling for event names).
- **Execution:** Immediate: `executeRuleActions`; delayed: create Job with payload, then job worker runs actions later. Actions: create_task, update_stage, add_tag; “schedule_follow_up” is implemented via delayed job.

**Implication:** New triggers (e.g. `customer.created`, `appointment_missed`) require: (1) emitting the event from the right place; (2) registering a listener in the automation engine; (3) ensuring entityType/entityId resolve to a customer (or opportunity) so create_task/assign salesperson/send message/schedule follow-up have a customerId. New actions (assign salesperson, send message, schedule follow-up): implement in `executeRuleActions` (assign → customer.assignedTo or opportunity.ownerId; send message → stub or integration point; schedule follow-up → already exists as delayed job).

---

## 5. Security, multi-tenancy, RBAC

- **Tenant:** All business tables have `dealership_id`; queries use `ctx.dealershipId` from session (never client input). Cross-tenant ID returns NOT_FOUND.
- **RBAC:** Permissions `crm.read`, `crm.write` are seeded and used for all CRM routes. No admin bypass in handler layer.
- **Audit:** `auditLog` used for customer, deal, document, etc. Automation rule create/update/delete and task creation should be audited where not already.

**Implication:** New automation/lead-source/timeline code must stay tenant-scoped and permission-checked. No new permissions required if we stay under `crm.read`/`crm.write`.

---

## 6. Design and UI tokens

- **Tokens:** `lib/ui/tokens.ts` — `ui`, `spacing`, `radius`, `shadow`, `typography`, `dashboardTokens` (bg, surface, border, text, muted, primary, success, warning, danger, etc.). Use CSS vars only (e.g. `var(--surface)`, `var(--text)`).
- **Layout:** PageShell, PageHeader, card stack, mainGrid from `lib/ui/recipes/layout`. Tables: shadcn Table + Pagination; forms: React Hook Form + Zod.
- **States:** Every screen should have loading, empty, error states (per .cursorrules).

**Implication:** New or updated CRM Automations and customer timeline UI must use these tokens and existing layout components; no raw Tailwind palette colors.

---

## 7. Testing patterns

- **Unit/integration:** Jest; tests under `modules/*/tests/` or `app/api/**/*.test.ts`. Integration tests use Prisma and seed data where needed (e.g. permissions crm.read, crm.write).
- **CRM examples:** `modules/crm-pipeline-automation/tests/integration.test.ts` (pipelines, opportunities, journey-bar, RBAC); `ui/__tests__/crm-permissions.test.tsx`, `jobs-run-button.test.tsx`, `deep-link-guard.test.tsx` (permission gating, no fetch without crm.read).
- **Customers:** Tenant isolation tests in `modules/customers/tests/tenant-isolation.test.ts`; activity tests in `activity.test.ts`.

**Implication:** Add tests for automation rule execution (new triggers/actions), tenant isolation for automation and lead-sources, and task generation from rules. Reuse existing CRM permission tests pattern for any new pages.

---

## 8. Performance and indexes

- **N+1:** Avoid for-loop + findMany; use include/select, createMany/deleteMany, or Promise.all batches.
- **AutomationRule:** Indexes on `dealershipId`, `isActive`, `deletedAt`. Engine already uses `listActiveRulesByTriggerEvent(dealershipId, triggerEvent)` — index on `(dealershipId, triggerEvent)` (with isActive, deletedAt in where) would help; current schema has `@@index([dealershipId])`, `@@index([dealershipId, isActive])`, `@@index([dealershipId, deletedAt])`. Consider composite `@@index([dealershipId, triggerEvent, isActive])` for the automation list-by-trigger query.
- **List limits:** take max 100 (except jobs/exports/analytics); default 25.

**Implication:** Ensure automation and lead-sources list endpoints are paginated and use indexed filters; no unbounded queries.

---

## 9. Gaps and decisions for STEP 1 Spec

| Topic | Finding | Decision to confirm in spec |
|-------|--------|-----------------------------|
| **CrmAutomationRule vs AutomationRule** | Existing `AutomationRule` and engine in crm-pipeline-automation. | Extend existing model and engine vs new table/module (recommend extend). |
| **Trigger set** | Spec: lead_created, customer_created, opportunity_stage_changed, appointment_missed. Today: opportunity.*, customer.task_completed. | Add customer.created (and optionally lead_created alias); add appointment_missed when appointment-miss definition exists. |
| **Action set** | Spec: create task, assign salesperson, send message, schedule follow-up. Today: create_task, update_stage, add_tag, delayed. | Add assign_salesperson; send_message and schedule_follow_up (follow-up already via delayed job; message may be stub or integration). |
| **Lead attribution** | Customer has leadSource only. | Add leadCampaign, leadMedium (or JSON) and GET /api/crm/lead-sources aggregating distinct values. |
| **Conversation timeline** | Timeline already has notes, call, callback, appointment, system (sms, task_created). | Add email activity type; optionally TASK timeline type; ensure tasks/appointments/calls/SMS/emails all present. |
| **API path** | Spec says GET/POST /api/crm/automations, PATCH /api/crm/automations/[id]. | Keep using /api/crm/automation-rules and existing routes, or add /api/crm/automations as alias; document in spec. |

---

## 10. File and module checklist for implementation

- **Reuse as-is:** `modules/customers` (customer, task, activity, timeline), `modules/crm-pipeline-automation` (automation-rule db, automation-engine, opportunity), `app/api/crm/automation-rules/*`, `app/(app)/crm/automations/page.tsx`, event bus, handler/guardPermission, pagination, schemas.
- **Extend:** Prisma (optional CrmAutomationRule or extend AutomationRule; Customer lead attribution fields); event bus (new event names if any); automation-engine (new triggers, new actions); timeline (email/TASK if needed); AutomationRulesPage (new trigger/action options, status column).
- **Add:** GET /api/crm/lead-sources (and possibly customer create/update schema for campaign/medium); appointment_missed emission + listener (if required); tests for new automation flows and tenant isolation.

---

*End of repo inspection summary. Proceed to STEP 1 Spec to lock scope and data contracts.*
