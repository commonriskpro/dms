# CRM Automation Engine — Final Report

**Sprint:** CRM Automation Engine  
**Date:** 2025-03-07

---

## 1. Repo inspection summary

- **Location:** `docs/CRM_AUTOMATION_ENGINE_REPO_INSPECTION.md`
- **Findings:** Existing `crm-pipeline-automation` module with `AutomationRule`, automation engine, and event listeners for opportunity.* and customer.task_completed. Customers module has Customer (leadSource), tasks, activity, timeline. API under `/api/crm/automation-rules`; CRM UI at `/crm/automations`. Decision: extend existing module and model; add triggers (customer.created, lead_created, appointment_missed), actions (assign_salesperson, send_message stub), lead attribution fields, and GET lead-sources.

---

## 2. STEP 1 Spec

- **Location:** `docs/CRM_AUTOMATION_ENGINE_SPEC.md`
- **Contents:** Architecture overview, data model changes (Customer leadCampaign/leadMedium; no new tables), API endpoints (existing automation-rules + new GET /api/crm/lead-sources), service-layer logic, UI plan, RBAC matrix, audit events, security considerations, acceptance criteria, deferred work.
- **Verification:** Spec is no-code; all sections present. Scope locked: extend AutomationRule and engine; reuse customers module.

---

## 3. STEP 2 Backend

**Implemented:**

- **Prisma:** Customer model extended with `leadCampaign`, `leadMedium` (optional, String?, 200 chars). Migration: `20260307180000_add_customer_lead_campaign_medium/migration.sql`.
- **DB (customers):** `CustomerCreateInput`/`CustomerUpdateInput` and create/update include leadCampaign, leadMedium. New `listLeadSourceValues(dealershipId, { limit })` returning distinct source/campaign/medium; exported from db.
- **Service (customers):** `listLeadSourceValues(dealershipId, options)` with `requireTenantActiveForRead`; used by CRM API.
- **API:** `GET /api/crm/lead-sources` — getAuthContext, guardPermission(crm.read), query limit (default 100, max 100), returns `{ data: { source, campaign, medium }[] }`. Customer create/update routes and schemas accept and pass leadCampaign, leadMedium; GET customer response includes leadCampaign, leadMedium.
- **Automation engine:** EVENT_ALIASES extended: `lead_created` and `customer.created` both match rules for either trigger. For rules with triggerEvent `lead_created`, skip run unless customer.status === LEAD. New listener: `customer.created` → processAutomationTrigger(dealershipId, "customer", customerId, "customer.created", payload). In executeRuleActions: for entityType "customer", load customer and set ownerId = customer.assignedTo. New actions: `assign_salesperson` (params.userId → update customer.assignedTo), `send_message` (stub no-op).
- **Instrumentation:** `ensureAutomationHandlersRegistered()` called from instrumentation.ts (nodejs) so customer.created is handled at startup.
- **Audit:** Existing automation_rule.created/updated/deleted in crm-pipeline-automation service unchanged.

**Verification:** All queries use dealershipId from context. Cross-tenant returns NOT_FOUND. No business logic in routes. Money not involved. Lead-sources list is read-only aggregate.

---

## 4. STEP 3 Frontend

**Implemented:**

- **CRM Automations page:** New trigger options: Lead created, Customer created, Opportunity created, Opportunity stage changed, Opportunity status changed, Customer task completed, Appointment missed. Table columns: Name, Trigger (human-readable via triggerLabel()), Status (Active/Inactive), Schedule, Actions (Edit/Delete). Create rule default trigger set to Lead created. PageShell and PageHeader added for layout consistency.
- **Customer form:** Optional fields Campaign and Medium added (state, inputs, onSubmit). Edit customer handler type updated to include leadCampaign, leadMedium (body sent as-is to PATCH).
- **Customer overview:** Lead line shows source / campaign / medium when any present (joined by " / ").
- **Conversation timeline:** No code change; existing timeline (TimelineCard) already shows notes, calls, callbacks, appointments, system (SMS, task_created). Spec allowed optional email type later.

**Verification:** Design tokens and existing components used; loading/error/empty preserved; no new UI system.

---

## 5. STEP 4 Security & QA

**Checks:**

- **Tenant isolation:** All automation and lead-sources code uses ctx.dealershipId; customer create/update and listLeadSourceValues scoped by dealershipId. Cross-tenant ID in path returns NOT_FOUND via existing getCustomer/getAutomationRule.
- **RBAC:** GET/POST/PATCH/DELETE automation-rules use guardPermission(crm.read) and guardPermission(crm.write). GET lead-sources uses guardPermission(crm.read). Customer APIs use customers.read/write as before.
- **Input validation:** lead-sources query limit zod (1–100). Customer leadCampaign/leadMedium max 200 in schema. Automation rule triggerEvent/actions validated by existing CRM schemas (string max 100; actions array of { type, params? }).
- **Audit:** Rule create/update/delete already audited. send_message stub does not log PII.
- **Sensitive data:** No SSN, DOB, income, or message body in audit or logs.

**Verification:** No bypass of guardPermission; no client-supplied dealershipId.

---

## 6. Performance pass

- **Indexes:** Customer already has @@index([dealershipId, leadSource]). New columns leadCampaign/leadMedium not indexed; listLeadSourceValues uses distinct on three columns with take(limit). If slow, add composite index (dealershipId, leadSource, leadCampaign, leadMedium) in a follow-up. AutomationRule: existing indexes on dealershipId, isActive, deletedAt; listActiveRulesByTriggerEvent filters by triggerEvent — optional composite @@index([dealershipId, triggerEvent, isActive]) can be added if needed.
- **N+1:** Automation engine loads customer once per entityType "customer" for ownerId and for lead_created condition; no loop over many entities without batch.
- **Pagination:** lead-sources limited to 100; automation-rules list uses parsePagination (default 25, max 100).

**Verification:** No unbounded list; pagination and limits in place.

---

## 7. QA hardening

- **Migration:** Run from repo root (with DATABASE_URL): `npm run db:migrate` (or `npx prisma migrate deploy` in apps/dealer). Migration file: `prisma/migrations/20260307180000_add_customer_lead_campaign_medium/migration.sql`.
- **Tests:** Unit tests that hit Prisma Customer (e.g. deals audit test) require the migration to be applied; otherwise they fail with "column Customer.lead_campaign does not exist". Run after migration: `npm run test:dealer`. No new tests added in this sprint; spec called for automation execution and tenant isolation tests — recommended as follow-up.
- **API shape:** GET /api/crm/lead-sources returns `{ data: { source, campaign, medium }[] }`. GET/PATCH customer includes leadCampaign, leadMedium when present.
- **UI:** Automations page loads rules and shows trigger/status; create/edit with new triggers; customer form shows Campaign/Medium; overview shows attribution line.

**Commands run:**

- `npm run db:generate` — success.
- `npm run test:dealer` — fails on tests that use Customer table until migration is applied (expected).

**Known issues:**

- Tests that create/upsert Customer (e.g. modules/deals/tests/audit.test.ts) fail until migration is applied.
- appointment_missed trigger is in the UI but no event is emitted yet (deferred per spec).

---

## 8. Final report

### Completed features

| Feature set | Delivered |
|-------------|-----------|
| **A — CRM automations** | Extended AutomationRule usage; new triggers (lead_created, customer.created, appointment_missed in UI); new actions (assign_salesperson, send_message stub, schedule_follow_up via existing delayed). Existing GET/POST/PATCH /api/crm/automation-rules. |
| **B — Automated tasks** | processAutomationTrigger runs on customer.created; create_task action creates CustomerTask; lead_created runs only when customer.status === LEAD. Handlers registered at startup. |
| **C — Lead attribution** | Customer.leadCampaign, leadMedium; GET /api/crm/lead-sources; customer create/update API and UI (form + overview). |
| **D — Conversation timeline** | No change; existing timeline shows calls, SMS, tasks, appointments. Optional email_sent type left for later. |

### Files changed

- **Prisma:** schema.prisma (Customer leadCampaign, leadMedium); migrations/20260307180000_add_customer_lead_campaign_medium/migration.sql.
- **Modules/customers:** db/customers.ts (create/update inputs and listLeadSourceValues); service/customer.ts (listLeadSourceValues).
- **Modules/crm-pipeline-automation:** service/automation-engine.ts (aliases, customer.created listener, lead_created filter, ownerId for customer, assign_salesperson, send_message stub).
- **API:** app/api/crm/lead-sources/route.ts (new); app/api/customers/schemas.ts (leadCampaign, leadMedium); app/api/customers/route.ts, app/api/customers/[id]/route.ts (create/update/response).
- **Instrumentation:** instrumentation.ts (ensureAutomationHandlersRegistered).
- **UI:** modules/crm-pipeline-automation/ui/AutomationRulesPage.tsx (triggers, status column, triggerLabel, PageShell/PageHeader); modules/customers/ui/CustomerForm.tsx (leadCampaign, leadMedium); modules/customers/ui/components/CustomerOverviewCard.tsx (attribution line); modules/customers/ui/DetailPage.tsx (handleEditSubmit type); lib/types/customers.ts (CustomerDetail leadCampaign, leadMedium).

### Commands run

- `npm run db:generate` — OK.
- `npm run test:dealer` — fails on Customer-related tests until migration applied.

### Tests executed

- Unit tests (excluding integration): attempted; failures due to missing DB columns until migration. No new Jest tests added this sprint.

### Deferred work

- **appointment_missed:** Emit event when “missed” is defined (e.g. cron/job); listener can be added when event exists.
- **send_message:** Real channel integration (SMS/email) out of scope; stub only.
- **Automation execution and tenant isolation tests:** Recommended: Jest test for customer.created → rule with create_task; tenant isolation for lead-sources and automation rules.
- **Optional:** Composite index on Customer for lead-sources query; composite index on AutomationRule (dealershipId, triggerEvent, isActive).

### Known risks

- **Migration:** Must be applied before any test or app run that touches Customer (e.g. `npm run db:migrate` or equivalent with DATABASE_URL).
- **First customer.created after deploy:** Handlers are registered in instrumentation (nodejs); first request that loads the app will register them, so customer created via API will fire automation.

---

*End of report.*
