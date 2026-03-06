# Customer + Dashboard Module — STEP 1 SPEC (Enterprise-Grade)

**Module:** customer-dashboard (Customer Detail + Sales Dashboard)  
**Scope:** Customer detail page (3-column layout, road-to-sale, stage history, lead tab, activity stream, tasks, interested vehicles); Dashboard page (appointments, sales metrics, funnel, new prospects, tasks, email/SMS). Architecture and contracts only; no implementation.

**References:** DMS Non-Negotiables, Coding Standards, core-platform (tenancy, RBAC), dealercenter-reference (UI/UX).

---

## 1) CLEAR SCOPE DEFINITION

### What is included

- **Customer Detail Page**
  - Three-column layout (lead/actions | main content | side panels).
  - Road-to-sale progress system: visual representation of current stage and progression; stage is a first-class attribute of the customer (or linked opportunity) with history.
  - Stage history tracking: immutable log of stage transitions with timestamp and actor.
  - Lead tab with action strip: primary actions (e.g. Phone, SMS, Email, Schedule appointment, Add task, Disposition) available in context of the lead.
  - Activity stream: time-ordered list of activities (calls, notes, tasks, stage changes, etc.) with filter by type and date range; paginated.
  - Tasks: create, list, update status, due date; shown in activity stream and in a tasks widget/panel.
  - Interested vehicles panel: list of vehicles the customer has expressed interest in (link customer to inventory items); list with basic metadata, paginated.

- **Dashboard Page**
  - Appointments widget: list of upcoming (and optionally past) appointments for the dealership or current user; paginated, scoped by tenant.
  - Sales activity metrics: aggregate counts or simple metrics (e.g. leads today, activities this week); read-only, tenant-scoped.
  - Funnel: placeholder metrics acceptable for MVP (e.g. counts per stage or per bucket); no complex analytics.
  - New prospects list: recent customers in lead/early stage; paginated, tenant-scoped.
  - Tasks widget: current user’s (or team’s) tasks due soon; paginated.
  - Email/SMS list: recent outbound communications or placeholders for MVP; paginated.

- **API surface** required to support the above: customer detail (GET), create activity (POST), create task (POST), update stage (PATCH), dashboard metrics (GET), plus list endpoints for activities, tasks, interested vehicles, appointments, prospects, and email/SMS as needed—all tenant-scoped and permission-guarded.

### What is explicitly excluded

- Full pipeline/opportunity management (separate module; this spec may reference “stage” on customer or a minimal link to opportunity where pipeline exists).
- SSN, DOB, income storage; lender flows are out of scope here.
- Raw payment or card data; no payment implementation.
- Audit logging design (handled in STEP 4 Security & QA; “future audit requirement” only).
- Real email/SMS sending infrastructure (MVP may use stub or metadata-only records).
- Complex reporting, BI, or export; dashboard is operational only.
- Cross-tenant reporting or platform-level analytics.

### MVP boundaries

- Road-to-sale: single linear stage progression per customer (or one opportunity per customer); no multi-pipeline or multi-opportunity in MVP.
- Funnel and sales metrics: predefined, non-configurable metrics; placeholder values acceptable.
- Email/SMS: list and metadata only for MVP; sending is optional or stubbed.
- Appointments: list and basic create/update sufficient for dashboard widget; full calendar/scheduling features can be deferred.

### Non-goals

- Replacing a full marketing automation or campaign platform.
- Deep analytics or data warehouse integration.
- Custom report builder or saved reports.
- Real-time collaboration (presence, live cursors).

### Performance expectations (reasonable SaaS targets)

- Customer detail load: p95 &lt; 2 s for detail + first page of activity + tasks + interested vehicles (single tenant).
- Dashboard load: p95 &lt; 2 s for widgets (metrics, lists) with default pagination.
- List endpoints: p95 &lt; 1 s for page size ≤ 50, tenant-scoped.
- No unbounded lists: all list APIs paginated (limit/offset or cursor) with sensible defaults and maximum page size.

### Scalability assumptions (multi-tenant growth)

- Tenants (dealerships) scale horizontally; every query filtered by `dealership_id`.
- No cross-tenant joins or cross-tenant queries.
- Indexing strategy supports tenant-first access patterns (dealership_id leading in composite indexes).
- Activity and stage history are append-heavy; read by customer_id + tenant; index for time-ordered, paginated reads.
- Dashboard metrics can be computed on read for MVP; future aggregation/caching is an option, not required in this spec.

---

## 2) DATA MODEL DESIGN (Conceptual Only)

No Prisma or DDL. Structure described in text.

### Entities

**Tenants (Dealership)**  
- **Purpose:** Root tenant; one row per dealership.  
- **Required fields:** id (UUID), name.  
- **Optional fields:** slug, settings (e.g. timezone, currency).  
- **Relationships:** One-to-many to locations, memberships, customers, and all tenant-scoped business entities.  
- **Indexing:** Primary key on id; unique on slug if present.  
- **Unique constraints:** id; slug when present.  
- **Soft delete:** Not used; tenant is top-level.  
- **Standard audit fields:** createdAt, updatedAt; createdBy/updatedBy optional at tenant level.

**Users (Profile)**  
- **Purpose:** User identity; id aligns with auth provider.  
- **Required fields:** id (UUID), email.  
- **Optional fields:** fullName, avatarUrl.  
- **Relationships:** Many-to-many to tenants via Memberships; can be assigned to customers (e.g. assignedTo), tasks (assignee), activities (actor).  
- **Indexing:** PK on id; unique on email.  
- **Unique constraints:** id, email.  
- **Soft delete:** Not used.  
- **Standard audit fields:** createdAt, updatedAt.

**Memberships (RBAC)**  
- **Purpose:** Links user to dealership with one or more roles; source of permissions for API and UI.  
- **Required fields:** id (UUID), user id, dealership id, role (or role id).  
- **Optional fields:** disabled_at (effective soft disable).  
- **Relationships:** FK to User (Profile), FK to Dealership; FK or enum to Role.  
- **Indexing:** Composite (dealership_id, user_id) for “user’s roles in this dealership”; (user_id) for “user’s dealerships.”  
- **Unique constraints:** One active membership per (user, dealership) or per (user, dealership, role) as per platform design.  
- **Soft delete strategy:** disabled_at; no row delete for audit trail.  
- **Standard audit fields:** createdAt, updatedAt; createdBy/updatedBy as per platform.

**Customers**  
- **Purpose:** Tenant-scoped customer/lead record; contact info, assignment, current stage.  
- **Required fields:** id (UUID), dealership_id (UUID), name.  
- **Optional fields:** leadSource, assignedTo (user id), address fields (line1, line2, city, region, postalCode, country), tags (array), current_stage (enum or FK to stage), phone(s), email(s) (or child entities), notes.  
- **Relationships:** Belongs to Dealership; optional FK to Profile (assignedTo); one-to-many to customer_stage_history, activities, tasks, interested_vehicles.  
- **Indexing:** dealership_id; (dealership_id, current_stage); (dealership_id, created_at); (dealership_id, assigned_to); (dealership_id, deleted_at) for soft-delete filtering.  
- **Unique constraints:** None beyond PK; contact uniqueness (e.g. phone/email) scoped by tenant if enforced.  
- **Soft delete strategy:** deleted_at, deleted_by; default lists exclude deleted; retain for restore/audit.  
- **Standard audit fields:** createdAt, createdBy, updatedAt, updatedBy, deletedAt, deletedBy.

**Customer_stage_history**  
- **Purpose:** Immutable log of stage transitions for road-to-sale and reporting.  
- **Required fields:** id (UUID), dealership_id, customer_id, from_stage (or null for initial), to_stage, changed_at, changed_by (user id).  
- **Optional fields:** note or reason.  
- **Relationships:** FK to Dealership, Customer; FK or reference to User (changed_by).  
- **Indexing:** (dealership_id, customer_id, changed_at) for time-ordered history per customer; (dealership_id, changed_at) for tenant-wide history.  
- **Unique constraints:** None (append-only).  
- **Soft delete:** Not used.  
- **Standard audit fields:** changed_at serves as event time; changed_by; no updatedAt (immutable).

**Activities**  
- **Purpose:** Unified activity stream (calls, notes, emails, tasks created/completed, stage changes, etc.).  
- **Required fields:** id (UUID), dealership_id, customer_id, type (ActivityType), occurred_at.  
- **Optional fields:** actor_id (user), subject, body/text, metadata (e.g. duration, direction), related_task_id or related_entity_id.  
- **Relationships:** FK to Dealership, Customer; optional FK to Profile (actor); optional FK to Task or other entity.  
- **Indexing:** (dealership_id, customer_id, occurred_at) for stream; (dealership_id, type, occurred_at) for filtered lists.  
- **Unique constraints:** None.  
- **Soft delete:** Not used; append-only timeline.  
- **Standard audit fields:** createdAt (or occurred_at); createdBy/actor_id.

**Tasks**  
- **Purpose:** To-do items tied to a customer (or optionally deal/opportunity); due date, status.  
- **Required fields:** id (UUID), dealership_id, customer_id, title, status (TaskStatus).  
- **Optional fields:** assignee_id (user), due_at, completed_at, description, priority.  
- **Relationships:** FK to Dealership, Customer; optional FK to Profile (assignee); may be referenced by Activities.  
- **Indexing:** (dealership_id, customer_id); (dealership_id, assignee_id, due_at); (dealership_id, status, due_at).  
- **Unique constraints:** None.  
- **Soft delete strategy:** Optional deleted_at; default lists exclude deleted.  
- **Standard audit fields:** createdAt, createdBy, updatedAt, updatedBy; completed_at for completion time.

**Interested_vehicles**  
- **Purpose:** Link between customer and inventory items the customer is interested in.  
- **Required fields:** id (UUID), dealership_id, customer_id, vehicle_id (FK to inventory/vehicle).  
- **Optional fields:** noted_at, note, source.  
- **Relationships:** FK to Dealership, Customer, Vehicle (inventory).  
- **Indexing:** (dealership_id, customer_id); (dealership_id, vehicle_id).  
- **Unique constraints:** At most one (customer_id, vehicle_id) per tenant to avoid duplicates.  
- **Soft delete:** Optional deleted_at.  
- **Standard audit fields:** createdAt, createdBy; updatedAt optional.

**Appointments** (for dashboard widget)  
- **Purpose:** Scheduled appointments; linked to customer and optionally user/location.  
- **Required fields:** id (UUID), dealership_id, customer_id, scheduled_at.  
- **Optional fields:** assignee_id, location_id, type, status, notes.  
- **Relationships:** FK to Dealership, Customer; optional FK to Profile, Location.  
- **Indexing:** (dealership_id, scheduled_at); (dealership_id, assignee_id, scheduled_at).  
- **Unique constraints:** None.  
- **Soft delete:** Optional cancelled_at or status.  
- **Standard audit fields:** createdAt, updatedAt, createdBy, updatedBy.

### Enums (conceptual only)

- **CRMStage:** Ordered set of stages for road-to-sale (e.g. New Lead, Contacted, Qualified, Proposal, Negotiation, Sold, Lost). Exact values per product; Sold and Lost are terminal.  
- **ActivityType:** e.g. call, note, email, sms, task_created, task_completed, stage_changed, appointment_scheduled.  
- **TaskStatus:** e.g. pending, in_progress, completed, cancelled.  
- **UserRole:** Role names used in RBAC (e.g. Admin, Manager, Sales, BDC); mapped to permissions via platform Role/Permission model.

### Future audit requirement

Critical tables (e.g. customers, customer_stage_history, tasks, appointments) will be subject to create/update/delete audit logging; customer and activity reads may be considered sensitive and audited. Exact design in STEP 4.

---

## 3) API CONTRACTS (Design Only)

No handler or Zod implementation. Shapes and rules only.

### GET customer detail

- **HTTP method:** GET.  
- **Path:** e.g. `GET /api/.../customers/:customerId` (or equivalent; tenant from auth).  
- **Required permissions:** View customer.  
- **Request:** Path param `customerId` (UUID). No body. Query params optional (e.g. include=activities,tasks,vehicles with pagination params for nested lists).  
- **Response shape:** Single customer resource with nested or referenced: current stage, stage history (paginated), recent activities (paginated), tasks (paginated), interested vehicles (paginated). Meta for nested pagination where applicable.  
- **Error cases:** 404 if customer not found or not in tenant; 403 if no permission.  
- **Pagination:** For nested lists (activities, tasks, interested vehicles): limit (default 20, max 50), offset or cursor; response includes meta (total, limit, offset or nextCursor).  
- **Concurrency:** Optional ETag or updatedAt in response for cache; no optimistic locking required for read.

### POST create activity

- **HTTP method:** POST.  
- **Path:** e.g. `POST /api/.../customers/:customerId/activities`.  
- **Required permissions:** Add activity.  
- **Request body schema (shape only):** type (ActivityType), occurred_at (ISO datetime), optional: subject, body, actor_id (default current user), metadata (object).  
- **Response shape:** Created activity (id, customer_id, type, occurred_at, actor_id, subject, body, metadata, created_at).  
- **Error cases:** 400 validation; 404 customer not found or wrong tenant; 403 no permission.  
- **Concurrency:** N/A (create only).

### POST create task

- **HTTP method:** POST.  
- **Path:** e.g. `POST /api/.../customers/:customerId/tasks`.  
- **Required permissions:** Add task.  
- **Request body schema (shape only):** title (string, required), optional: assignee_id, due_at, description, priority.  
- **Response shape:** Created task (id, customer_id, title, status, assignee_id, due_at, created_at, updated_at).  
- **Error cases:** 400 validation; 404 customer not found or wrong tenant; 403 no permission.  
- **Concurrency:** N/A (create only).

### PATCH update stage

- **HTTP method:** PATCH.  
- **Path:** e.g. `PATCH /api/.../customers/:customerId/stage` or `.../customers/:customerId` with body containing stage.  
- **Required permissions:** Update stage.  
- **Request body schema (shape only):** to_stage (CRMStage), optional: note/reason.  
- **Response shape:** Updated customer (including current_stage) and/or latest stage_history entry.  
- **Error cases:** 400 invalid transition or validation; 404 customer not found or wrong tenant; 403 no permission; 409 if transition not allowed (e.g. from Sold).  
- **Concurrency:** Optimistic locking: require customer.updatedAt (or version) in request; reject with 409 if stale. Alternatively enforce transition rules server-side and return 409 when transition is disallowed.

### GET dashboard metrics

- **HTTP method:** GET.  
- **Path:** e.g. `GET /api/.../dashboard/metrics` or `.../dashboard`.  
- **Required permissions:** View dashboard metrics.  
- **Request:** Query params optional (e.g. period=today|week). No body.  
- **Response shape:** Object with metrics: e.g. appointments_count, leads_today, activities_this_week, funnel (stage counts or placeholders), new_prospects_count. All tenant-scoped.  
- **Error cases:** 403 no permission.  
- **Pagination:** N/A (aggregates).  
- **Concurrency:** N/A (read-only).

### Additional list endpoints (design only)

- **Activities list:** GET `.../customers/:customerId/activities`. Query: limit, offset (or cursor), type, from_date, to_date. Paginated; permission: View customer or Add activity.  
- **Tasks list (dashboard):** GET `.../dashboard/tasks` or `.../tasks?assignee=me`. Paginated; permission: View dashboard or View customer.  
- **New prospects:** GET `.../dashboard/prospects` or `.../customers?stage=...`. Paginated; permission: View dashboard metrics.  
- **Appointments:** GET `.../dashboard/appointments`. Query: from, to, limit, offset. Paginated; permission: View dashboard.  
- **Email/SMS list:** GET `.../dashboard/communications` or per-customer. Paginated; permission: View customer or View dashboard.

### Validation philosophy

- All request bodies and path/query params validated at API boundary with Zod (or equivalent). Types: UUIDs, enums, date strings, string length, required/optional.  
- No unvalidated input passed to services.  
- Validation errors return 400 with structured details (field, message).

### Canonical error envelope

- **Shape:** `{ error: { code: string, message: string, details?: array } }`.  
- **Codes:** e.g. validation_error, not_found, forbidden, conflict (e.g. invalid stage transition).  
- **HTTP mapping:** 400 validation/ bad request; 403 forbidden; 404 not found; 409 conflict.

### Basic rate limiting philosophy

- Apply rate limits on auth and sensitive endpoints; list and read endpoints per tenant or per user to prevent abuse.  
- No specific limits defined here; design should allow per-route or per-tenant limits to be applied at gateway or route layer.

---

## 4) RBAC + TENANT ISOLATION RULES

### Roles

- **Admin:** Full access within dealership.  
- **Manager:** Manage team and customers; all customer and dashboard actions.  
- **Sales:** Own customers and activities; view/edit assigned; add activity/task; update stage within policy.  
- **BDC:** Business Development Center; often same as Sales for customer/lead actions; may be restricted to lead stage only (product decision).

### Permission matrix (resource × action × role)

| Permission / Action       | Admin | Manager | Sales | BDC |
|---------------------------|-------|---------|-------|-----|
| View customer             | Yes   | Yes     | Yes*  | Yes*|
| Edit customer             | Yes   | Yes     | Yes*  | Yes*|
| Add activity              | Yes   | Yes     | Yes   | Yes |
| Add task                  | Yes   | Yes     | Yes   | Yes |
| Update stage              | Yes   | Yes     | Yes** | Yes**|
| View dashboard metrics    | Yes   | Yes     | Yes   | Yes |

\* Optionally restricted to “assigned to me” or “my team” for Sales/BDC; Manager/Admin see all.  
\** May be restricted by stage (e.g. BDC cannot move to Sold) or by “assigned to me” (see Stage rules).

### Tenant rules

- Every business record includes `dealership_id` (tenant id).  
- Every list and get query filters by `dealership_id` derived from auth/session (never from client body or path for tenant identity).  
- No cross-tenant joins or cross-tenant data returned.  
- Services receive `dealership_id` (and user id) explicitly; no implicit tenant.  
- IDOR prevention: all mutations and reads validate that the resource’s `dealership_id` matches the caller’s tenant; 404 when resource not in tenant (no leak of existence).

### Enforcement

- **RBAC check location:** At API edge (before calling service) and optionally re-checked in service layer for sensitive actions.  
- **Tenant filtering:** Required in service layer; all DB access scoped by dealership_id.  
- **No raw Prisma (or DB) outside service:** Route handlers validate and call services only; services use db layer.  
- **Centralized authorization utility:** Single place to resolve permissions (e.g. from role/permissions) and to assert “can view customer”, “can update stage”, etc.

---

## 5) STAGE TRANSITION RULES

### Allowed transitions graph

- Stages are ordered linearly for road-to-sale (e.g. New Lead → Contacted → Qualified → Proposal → Negotiation → Sold | Lost).  
- **Forward transitions:** Any non-terminal stage can advance to the next stage(s) as defined by the graph; Sold and Lost are terminal.  
- **Allowed:** New Lead → Contacted → Qualified → … → Sold; or any stage → Lost (with optional reason).  
- Exact graph is product-defined; spec assumes a DAG or linear flow with well-defined “next” and “terminal” states.

### Disallowed transitions

- From terminal states (Sold, Lost): no further stage change (only possible via explicit “reopen” if product allows).  
- Skipping stages may be disallowed in strict mode (e.g. must pass Qualified before Proposal); product decision.  
- Moving “backward” (e.g. Proposal → Contacted) is a regression; see below.

### Terminal states

- **Sold:** Deal closed; no further stage moves unless reopen is defined.  
- **Lost:** Opportunity lost; no further stage moves unless reopen is defined.

### Regression (moving backward)

- **Allowed or not:** Product decision. If allowed, only certain roles (e.g. Manager, Admin) may perform regression; Sales/BDC may only move forward.  
- **Who can perform regression:** e.g. Manager, Admin only; or no one (no regression).

### How stage history is recorded

- On every stage change: append one row to customer_stage_history (or equivalent) with from_stage, to_stage, changed_at, changed_by.  
- History is immutable; no updates or deletes.  
- Current stage on customer (or opportunity) is updated; history is the source of truth for past states.

### Whether stage change creates activity entries

- **Yes.** A stage transition should create an activity entry (type e.g. stage_changed) so the activity stream shows “Stage changed from X to Y” with actor and time.  
- This keeps one unified timeline for the customer detail page.

---

## CHECKLIST

- **Scope defined:** In scope (customer detail + dashboard features), out of scope, MVP boundaries, non-goals, performance and scalability assumptions.  
- **Data model defined:** Entities (tenants, users, memberships, customers, customer_stage_history, activities, tasks, interested_vehicles, appointments), enums (CRMStage, ActivityType, TaskStatus, UserRole), relationships, indexing, unique constraints, soft delete and audit fields—conceptual only, no code.  
- **API contracts defined:** GET customer detail, POST create activity, POST create task, PATCH update stage, GET dashboard metrics; request/response shapes, errors, pagination, concurrency; validation and error envelope and rate limiting philosophy.  
- **RBAC + tenant rules defined:** Roles, permission matrix, tenant rules (dealership_id on every record/query, no cross-tenant, IDOR prevention), enforcement (API + service, centralized auth).  
- **Stage rules defined:** Allowed/disallowed transitions, terminal states, regression policy, history recording, activity entry on stage change.

**Next step:** Backend implements schema, services, validation, and tests.
