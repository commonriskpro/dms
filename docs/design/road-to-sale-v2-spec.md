# Road-to-Sale V2 — SPEC (Sprint 1)

**Module:** Road-to-Sale V2 (journey bar, signals, stage transitions)  
**Scope:** Spec-only. No code, no Prisma, no TypeScript, no UI implementation. Defines data model (conceptual), API contracts, RBAC, tenant scoping, and stage transition rules for a visual “journey” of the customer/opportunity through CRM stages.

**Context:** Multi-tenant DMS; auth via Supabase; RBAC `crm.read` / `crm.write`. Tenant isolation mandatory. Feature surfaces: (1) Customers module — Lead tab, (2) CRM Opportunities (pipeline).

---

## 1) SCOPE

### In scope

- **Journey bar data contract:** Input (customer or opportunity identifier), output (ordered stages, current stage id, segment states: completed / current / upcoming).
- **Current / completed / upcoming derivation:** From pipeline stage order + entity’s current stage id; read-only from API (ordered stage list + current index).
- **Signals data needs:** Which entities and fields support overdue tasks, appointment, stale lead; defined at data/contract level only.
- **Next best action contract:** Response field or key (e.g. `nextBestActionKey` or `suggestedAction`); rule-based or config-driven at data level only.
- **Stage transition rules:** Allowed transitions (conceptual state machine), validation on PATCH, terminal stages, regression rules (who can move backward, if at all).
- **Pipeline / stage model:** Conceptual only (pipeline, stage, order, how customer/opportunity references stage).

### Out of scope

- Audit logging design (will be Step 4).
- Specific UI components, CSS, or frontend implementation.
- Implementation of signals logic or next-best-action rules (only contracts and data needs).

### MVP

- **MVP:** Render journey bar and change stage from bar (GET journey data, PATCH stage with transition validation).
- **Signals and next best action:** Minimal for MVP (e.g. overdue tasks only); contracts and data needs still specified so backend can add later without contract change.

---

## 2) DATA MODEL (conceptual)

No Prisma. Entity names, purposes, relationships, and key fields only.

### 2.1 Pipeline

- **Purpose:** Container for an ordered set of stages; per tenant (dealership). One default pipeline per tenant (e.g. “Sales” or “Lead”).
- **Key concepts:** Pipeline has id, tenant id, name, optional “default” flag. Stages belong to exactly one pipeline.

### 2.2 Stage

- **Purpose:** One step in the journey; ordered within a pipeline.
- **Key concepts:** Stage has id, pipeline id, tenant id, display order (integer), name, optional icon/key for UI. Order defines “before” and “after” for completed vs upcoming.

### 2.3 Customer → Stage (optional)

- **Purpose:** For “Lead tab” journey bar, customer has a current position in a pipeline (e.g. lead pipeline).
- **Key concepts:** Customer has optional `stageId` (FK to Stage). If present, pipeline = stage’s pipeline. If tenant uses “lead” pipeline, customer’s journey bar is driven by this stage. Absence of `stageId` may mean “not in pipeline” or default to first stage—implementation choice; API must return consistent journey data.

### 2.4 Opportunity → Stage

- **Purpose:** Opportunity’s position in the pipeline (e.g. sales pipeline).
- **Key concepts:** Opportunity has `stageId` (FK to Stage). Pipeline = stage’s pipeline. Journey bar for opportunity is driven by opportunity’s `stageId` and that stage’s pipeline order.

### 2.5 Stage history (optional for V2 MVP)

- **Purpose:** Record who moved the entity to which stage and when (for audit and “stale” signal).
- **Key concepts:** Optional entity (e.g. StageHistory or activity log): entity type (customer/opportunity), entity id, fromStageId, toStageId, at (timestamp), by (user id). If not in MVP, “stale lead” can use last activity or updatedAt.

### 2.6 Tasks (for overdue signal)

- **Purpose:** Tasks linked to customer or opportunity; due date and status for “overdue” signal.
- **Key concepts:** Task (or CustomerTask / OpportunityTask) has: link to entity (customerId and/or opportunityId), `dueDate`, `status`. Overdue = `dueDate < today` and status not Done/Cancelled. Entity must be tenant-scoped.

### 2.7 Appointment / slot (for appointment signal)

- **Purpose:** Next or scheduled appointment for the entity.
- **Key concepts:** Appointment (or calendar slot) entity: link to customer and/or opportunity, scheduled start (and optionally end), optional status. “Next appointment” = soonest future appointment for that entity. If no such entity exists, placeholder or empty; API contract allows “next appointment” to be null or a minimal slot object.

### 2.8 Last-activity / stage-changed (for stale lead)

- **Purpose:** “Stale lead” = no activity or stage change since X days.
- **Key concepts:** Either: (a) `lastActivityAt` or `stageChangedAt` on customer/opportunity, or (b) derived from activity timeline / stage history (latest activity or stage-change timestamp). X is config (e.g. 7 days); threshold not stored, applied when computing signal.

---

## 3) API CONTRACTS

All list endpoints paginated (limit/offset or cursor). All inputs validated at edge (e.g. Zod). `dealership_id` from auth/session only; never from client body. IDOR: verify resource belongs to tenant on every read/update.

### 3.1 GET journey bar data

- **Purpose:** Return everything needed to render the segmented journey bar and optional signals / next best action.
- **Input:** Either `customerId` or `opportunityId` (one required; the other absent). Query params if any: e.g. none for MVP; later optional `includeSignals=true`.
- **Output (shape only):**
  - `stages`: ordered list of stage descriptors (id, name, order, optional icon/key, optional colorKey).
  - `currentStageId`: the entity’s current stage id.
  - **Derivation:** Client or server can derive completed = stages before current in order; current = the one matching currentStageId; upcoming = stages after current. Server may optionally return `currentIndex` or explicit `segmentState` per stage (completed | current | upcoming).
  - Optional for MVP, required by contract: `signals`: summary object (see 3.4).
  - Optional: `nextBestActionKey` or `suggestedAction` (string or key); source is rule-based or config-driven; no UI logic in spec.
- **Scoping:** Resolve entity by id; ensure entity belongs to tenant; resolve pipeline from entity’s stage; return that pipeline’s stages in order. If entity has no stage (e.g. customer without stageId), contract defines behavior: e.g. return default pipeline stages and currentStageId = null or first stage.

### 3.2 PATCH stage (stage transition)

- **Purpose:** Update entity’s current stage (e.g. from journey bar popover).
- **Input:** Entity identifier (customerId or opportunityId), body: `newStageId` (required).
- **Validation:** (1) Entity exists and belongs to tenant. (2) `newStageId` is a stage id in the same pipeline as the entity’s current stage. (3) Transition is allowed (see Section 5). (4) User has `crm.write`.
- **Output:** Success: updated entity (or 204). Error: `{ error: { code, message, details? } }` (e.g. invalid transition, stage not in pipeline, IDOR).
- **Side effects:** Entity’s stageId updated; optional stage history record created.

### 3.3 Signals: data needs and optional endpoints

- **Overdue tasks:** Need task list (or count) for entity filtered by: entity id, `dueDate < today`, status not in [Done, Cancelled]. Existing tasks list endpoint may be reused with filters; or dedicated “signals” endpoint returns summary (e.g. `overdueTaskCount`).
- **Appointment:** Need “next appointment” for entity: appointment/slot linked to customer/opportunity, minimal fields (e.g. start, id). If no appointment entity exists, contract allows null or placeholder.
- **Stale lead:** Need `lastActivityAt` or `stageChangedAt` (or equivalent) on entity or from activity/stage_history; threshold (X days) applied when computing signal. Can be returned in journey bar response as `signals.staleSince` or boolean `isStale`.

**Optional endpoint:** GET signals summary for entity (customerId or opportunityId) returning `overdueTaskCount`, `nextAppointment`, `lastActivityAt` / `isStale`—shape only; can be merged into GET journey bar response instead of separate call.

### 3.4 Response shapes (summary)

- **Journey bar success:** `{ data: { stages, currentStageId, currentIndex?, signals?: { overdueTaskCount?, nextAppointment?, lastActivityAt? | isStale? }, nextBestActionKey? } }`.
- **PATCH success:** `{ data: <entity> }` or 204.
- **Error:** `{ error: { code, message, details? } }`.

---

## 4) RBAC + TENANT

- **crm.read:** Required to fetch journey bar data and any signals or read-only stage/list data. Without it, return 403.
- **crm.write:** Required to change stage (PATCH). Without it, return 403.
- **Tenant:** All resources scoped by dealership (tenant). Every list/get/update/delete uses `dealership_id` from auth/session. No endpoint returns or mutates another tenant’s data.
- **IDOR prevention:** On every read/update by customerId or opportunityId, verify that customer/opportunity belongs to the authenticated tenant before returning or updating. Same for stageId (stage must belong to tenant and to the same pipeline as the entity).

---

## 5) STAGE TRANSITION RULES

- **Allowed transitions:** Defined conceptually (state machine). Options: (a) **Linear:** only to next/previous stage. (b) **Graph:** allow only certain (fromStage, toStage) pairs (e.g. stored or derived from pipeline order). (c) **Any within pipeline:** any stage in the same pipeline allowed. Spec recommends: at least validate that `newStageId` is in the same pipeline; optionally restrict to “next” stages only or to an explicit allowed-transition matrix.
- **Terminal stages:** Some stages (e.g. Won, Lost) may be terminal—no transition out. If entity is in terminal stage, PATCH to change stage may be forbidden or restricted (e.g. only reopen by Manager). Define per implementation; spec requires that terminal stages and any exception (e.g. “reopen”) be documented.
- **Regression (moving backward):** Allowed or not; if allowed, optionally restricted by role (e.g. Manager only). Spec: define at contract level (e.g. “regressionAllowed: boolean” or “allowedRolesForRegression: []”). Backend validates transition and role when processing PATCH.

---

## 6) DELIVERABLES CHECKLIST

- [x] **Scope:** In scope (journey bar contract, current/completed/upcoming, signals data needs, next best action contract, stage transition rules, pipeline/stage model). Out of scope (audit design, UI/CSS). MVP (journey bar + stage change; signals minimal).
- [x] **Data model (conceptual):** Pipeline, Stage (ordered), Customer optional stageId, Opportunity stageId; stage history optional; tasks, appointment/slot, last-activity/stage-changed for signals. No Prisma.
- [x] **API contracts:** GET journey bar (input: customerId or opportunityId; output: stages, currentStageId, optional signals, optional nextBestActionKey). PATCH stage (input: entity id, newStageId; validation: allowed transition; permission: crm.write). Signals endpoints/shape only.
- [x] **RBAC + tenant:** crm.read for journey/signals; crm.write for PATCH; all scoped by tenant; IDOR prevention documented.
- [x] **Stage transition rules:** Allowed transitions (linear/graph/any), terminal stages, regression (allowed or role-restricted) defined at conceptual level.

---

**Next step:** Backend implements schema, services, validation, and tests (including RBAC and tenant isolation). Audit logging design in Step 4.
