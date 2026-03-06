# Customers Module — Full SPEC (Step 1/4)

**Module:** customers (CRM lite)  
**Scope:** Customer CRUD (tenant-scoped), lead source tracking, contact info, notes + activity timeline, basic tasks/reminders. No SSN/DOB/income storage.

References: AGENT_SPEC.md, DONE.md, MODULES.md, DMS Non-Negotiables, Coding Standards, core-platform-spec.md.

---

## 1) Data Model (Prisma-Ready)

### 1.1 Table Summary

| Table | Tenant-scoped? | Soft delete? | Audit (CUD) |
|-------|----------------|--------------|-------------|
| Customer | Yes | Yes (deletedAt, deletedBy) | Yes |
| CustomerPhone | Yes | No | No (child of Customer; audit via customer.updated) |
| CustomerEmail | Yes | No | No (child of Customer; audit via customer.updated) |
| CustomerNote | Yes | Optional (deletedAt) | Yes |
| CustomerTask | Yes | Optional (deletedAt) | Yes |
| CustomerActivity | Yes | No | No (append-only timeline; not critical CUD) |

**Design choices:**
- **Phones / emails:** Separate tables (`CustomerPhone`, `CustomerEmail`) for indexing and search (e.g. search by phone/email in list). Each row: type (e.g. mobile, work), value, optional label; unique per customer per value scoped by tenant.
- **Address:** Structured columns on `Customer`: `addressLine1`, `addressLine2`, `city`, `region`, `postalCode`, `country` (no JSON).
- **Tags:** `String[]` (PostgreSQL array) on `Customer` for simple filter/tag UI; no separate table.
- **Activity:** Separate `CustomerActivity` table for a unified timeline (note_added, task_created, task_completed, customer_updated); timeline can be built from this table ordered by `createdAt`. Alternative (not chosen): build timeline from notes + tasks + audit log; spec uses dedicated activity table for clearer UX and one place to query.

---

### 1.2 Customer

- **Purpose:** Tenant-scoped customer profile; lead source, status, assignment, contact structure.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `name` — String, required
  - `leadSource` — String?, optional (e.g. "Website", "Walk-in", "Referral")
  - `status` — Enum `CustomerStatus`: LEAD | ACTIVE | SOLD | INACTIVE
  - `assignedTo` — String?, UUID, FK → Profile (optional)
  - `addressLine1` — String?
  - `addressLine2` — String?
  - `city` — String?
  - `region` — String?
  - `postalCode` — String?
  - `country` — String?
  - `tags` — String[] (PostgreSQL array), default []
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
  - `deletedAt` — DateTime?
  - `deletedBy` — String?, UUID, FK → Profile
- **Relations:** Dealership, Profile (assignedTo), Profile (deletedBy), CustomerPhone[], CustomerEmail[], CustomerNote[], CustomerTask[], CustomerActivity[].
- **Indexes:**
  - `@@index([dealershipId])` — tenant scoping; every list/get by tenant.
  - `@@index([dealershipId, status])` — filter customers by status (e.g. LEAD, ACTIVE).
  - `@@index([dealershipId, createdAt])` — list by newest first; time-bounded lists.
  - `@@index([dealershipId, leadSource])` — filter by lead source.
  - `@@index([dealershipId, assignedTo])` — filter by assigned user.
  - `@@index([dealershipId, deletedAt])` — exclude soft-deleted in default lists (where deletedAt is null).
- **Soft delete:** Use `deletedAt` / `deletedBy`; exclude from default lists; retain for audit/restore.

**Prisma (camelCase, map snake_case where desired):**

```prisma
enum CustomerStatus {
  LEAD
  ACTIVE
  SOLD
  INACTIVE
}

model Customer {
  id           String         @id @default(uuid()) @db.Uuid
  dealershipId String         @map("dealership_id") @db.Uuid
  name         String
  leadSource   String?        @map("lead_source")
  status       CustomerStatus @default(LEAD)
  assignedTo   String?        @map("assigned_to") @db.Uuid
  addressLine1 String?        @map("address_line1")
  addressLine2 String?        @map("address_line2")
  city         String?
  region       String?
  postalCode   String?        @map("postal_code")
  country      String?
  tags         String[]       @default([])
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")
  deletedAt    DateTime?      @map("deleted_at")
  deletedBy    String?        @map("deleted_by") @db.Uuid

  dealership   Dealership     @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  assignedToProfile Profile?  @relation("CustomerAssignedTo", fields: [assignedTo], references: [id], onDelete: SetNull)
  deletedByProfile  Profile?   @relation("CustomerDeletedBy", fields: [deletedBy], references: [id])
  phones       CustomerPhone[]
  emails       CustomerEmail[]
  notes        CustomerNote[]
  tasks        CustomerTask[]
  activities   CustomerActivity[]

  @@index([dealershipId])
  @@index([dealershipId, status])
  @@index([dealershipId, createdAt])
  @@index([dealershipId, leadSource])
  @@index([dealershipId, assignedTo])
  @@index([dealershipId, deletedAt])
}
```

---

### 1.3 CustomerPhone

- **Purpose:** One row per phone number; supports search by phone and type/label.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership
  - `customerId` — String, UUID, FK → Customer
  - `kind` — String?, e.g. "mobile", "work", "home", "fax"
  - `value` — String, required (E.164 or display string)
  - `isPrimary` — Boolean, default false (one primary per customer optional)
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Indexes:**
  - `@@index([dealershipId])` — tenant scoping.
  - `@@index([customerId])` — list phones by customer.
  - `@@index([dealershipId, value])` — search customers by phone (list endpoint filter).
- **Constraints:** Unique `(customerId, value)` per customer to avoid duplicate numbers (optional; or allow duplicates with different kind).

**Prisma:**

```prisma
model CustomerPhone {
  id           String   @id @default(uuid()) @db.Uuid
  dealershipId String   @map("dealership_id") @db.Uuid
  customerId   String   @map("customer_id") @db.Uuid
  kind         String?  // mobile, work, home, fax
  value        String
  isPrimary    Boolean  @default(false) @map("is_primary")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  dealership Dealership @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  customer   Customer   @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([dealershipId])
  @@index([customerId])
  @@index([dealershipId, value])
}
```

---

### 1.4 CustomerEmail

- **Purpose:** One row per email; supports search by email.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership
  - `customerId` — String, UUID, FK → Customer
  - `kind` — String?, e.g. "work", "personal"
  - `value` — String, required
  - `isPrimary` — Boolean, default false
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Indexes:**
  - `@@index([dealershipId])` — tenant scoping.
  - `@@index([customerId])` — list emails by customer.
  - `@@index([dealershipId, value])` — search customers by email (list endpoint filter).
- **Constraints:** Unique `(customerId, value)` optional.

**Prisma:**

```prisma
model CustomerEmail {
  id           String   @id @default(uuid()) @db.Uuid
  dealershipId String   @map("dealership_id") @db.Uuid
  customerId   String   @map("customer_id") @db.Uuid
  kind         String?
  value        String
  isPrimary    Boolean  @default(false) @map("is_primary")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  dealership Dealership @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  customer   Customer   @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([dealershipId])
  @@index([customerId])
  @@index([dealershipId, value])
}
```

---

### 1.5 CustomerNote

- **Purpose:** Free-text notes on a customer; part of activity timeline.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership
  - `customerId` — String, UUID, FK → Customer
  - `body` — String, @db.Text, required
  - `createdBy` — String, UUID, FK → Profile
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
  - `deletedAt` — DateTime? (optional soft delete)
- **Indexes:**
  - `@@index([dealershipId])` — tenant scoping.
  - `@@index([customerId])` — list notes by customer.
  - `@@index([customerId, createdAt])` — list notes for customer timeline (newest first).
  - `@@index([dealershipId, customerId])` — tenant + customer list.
- **Audit:** Note create/update/delete are critical; write to AuditLog (customer.note.created, customer.note.updated, customer.note.deleted).

**Prisma:**

```prisma
model CustomerNote {
  id           String    @id @default(uuid()) @db.Uuid
  dealershipId String    @map("dealership_id") @db.Uuid
  customerId   String    @map("customer_id") @db.Uuid
  body         String    @db.Text
  createdBy    String    @map("created_by") @db.Uuid
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  deletedAt    DateTime? @map("deleted_at")

  dealership   Dealership @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  customer     Customer   @relation(fields: [customerId], references: [id], onDelete: Cascade)
  createdByProfile Profile @relation(fields: [createdBy], references: [id], onDelete: Restrict)

  @@index([dealershipId])
  @@index([customerId])
  @@index([customerId, createdAt])
  @@index([dealershipId, customerId])
}
```

---

### 1.6 CustomerTask

- **Purpose:** CRM-lite tasks/reminders per customer; status derived from `completedAt` (null = pending).
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership
  - `customerId` — String, UUID, FK → Customer
  - `title` — String, required
  - `description` — String?, @db.Text
  - `dueAt` — DateTime?
  - `completedAt` — DateTime?
  - `completedBy` — String?, UUID, FK → Profile
  - `createdBy` — String, UUID, FK → Profile
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
  - `deletedAt` — DateTime? (optional soft delete)
- **Indexes:**
  - `@@index([dealershipId])` — tenant scoping.
  - `@@index([customerId])` — list tasks by customer.
  - `@@index([customerId, createdAt])` — timeline order.
  - `@@index([dealershipId, completedAt])` — filter pending (completedAt null) vs completed; list overdue.
  - `@@index([dealershipId, customerId])` — tenant + customer list.
- **Audit:** Task create/update/complete/delete are critical; audit task.created, task.updated, task.completed, task.deleted.

**Prisma:**

```prisma
model CustomerTask {
  id           String    @id @default(uuid()) @db.Uuid
  dealershipId String    @map("dealership_id") @db.Uuid
  customerId   String    @map("customer_id") @db.Uuid
  title        String
  description  String?   @db.Text
  dueAt        DateTime? @map("due_at")
  completedAt  DateTime? @map("completed_at")
  completedBy  String?   @map("completed_by") @db.Uuid
  createdBy    String    @map("created_by") @db.Uuid
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  deletedAt    DateTime? @map("deleted_at")

  dealership     Dealership @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  customer       Customer   @relation(fields: [customerId], references: [id], onDelete: Cascade)
  createdByProfile  Profile  @relation("TaskCreatedBy", fields: [createdBy], references: [id], onDelete: Restrict)
  completedByProfile Profile? @relation("TaskCompletedBy", fields: [completedBy], references: [id], onDelete: SetNull)

  @@index([dealershipId])
  @@index([customerId])
  @@index([customerId, createdAt])
  @@index([dealershipId, completedAt])
  @@index([dealershipId, customerId])
}
```

---

### 1.7 CustomerActivity

- **Purpose:** Unified timeline per customer (note_added, task_created, task_completed, customer_updated). Read-only; written by service layer when notes/tasks/customer change.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership
  - `customerId` — String, UUID, FK → Customer
  - `activityType` — String (e.g. note_added, task_created, task_completed, customer_updated)
  - `entityType` — String (e.g. "Note", "Task", "Customer")
  - `entityId` — String?, UUID (id of the note, task, or customer)
  - `metadata` — Json? (e.g. { "field": "status", "from": "LEAD", "to": "ACTIVE" }; no PII)
  - `actorId` — String?, UUID, FK → Profile
  - `createdAt` — DateTime
- **Indexes:**
  - `@@index([dealershipId])` — tenant scoping.
  - `@@index([dealershipId, customerId, createdAt])` — timeline for customer detail (primary query).
  - `@@index([customerId, createdAt])` — same ordered by time.
- **No** updatedAt; append-only. No soft delete; retain for history.
- **Audit:** Activity table is not the audit log; AuditLog still records CUD on Customer/Note/Task. CustomerActivity is for UI timeline only.

**Prisma:**

```prisma
model CustomerActivity {
  id           String   @id @default(uuid()) @db.Uuid
  dealershipId String   @map("dealership_id") @db.Uuid
  customerId   String   @map("customer_id") @db.Uuid
  activityType String  @map("activity_type")  // note_added, task_created, task_completed, customer_updated
  entityType   String   @map("entity_type")    // Note, Task, Customer
  entityId     String?  @map("entity_id") @db.Uuid
  metadata     Json?
  actorId      String?  @map("actor_id") @db.Uuid
  createdAt    DateTime @default(now()) @map("created_at")

  dealership Dealership @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  customer   Customer   @relation(fields: [customerId], references: [id], onDelete: Cascade)
  actor      Profile?   @relation(fields: [actorId], references: [id], onDelete: SetNull)

  @@index([dealershipId])
  @@index([dealershipId, customerId, createdAt])
  @@index([customerId, createdAt])
}
```

---

### 1.8 Profile Relations (add to existing Profile model)

Add to `Profile` in `prisma/schema.prisma`:

- `customersAssignedTo` — Customer[] @relation("CustomerAssignedTo")
- `customersDeletedBy` — Customer[] @relation("CustomerDeletedBy")
- `customerNotesCreatedBy` — CustomerNote[]
- `customerTasksCreatedBy` — CustomerTask[] @relation("TaskCreatedBy")
- `customerTasksCompletedBy` — CustomerTask[] @relation("TaskCompletedBy")
- `customerActivities` — CustomerActivity[]

---

### 1.9 Dealership Relation

Add to `Dealership`:

- `customers` — Customer[]
- `customerPhones` — CustomerPhone[]
- `customerEmails` — CustomerEmail[]
- `customerNotes` — CustomerNote[]
- `customerTasks` — CustomerTask[]
- `customerActivities` — CustomerActivity[]

---

### 1.10 Index Summary (why each exists)

| Index | Purpose |
|-------|--------|
| Customer: dealershipId | Every query scoped by tenant. |
| Customer: (dealershipId, status) | Filter list by status (LEAD, ACTIVE, etc.). |
| Customer: (dealershipId, createdAt) | List by newest; time-bounded lists. |
| Customer: (dealershipId, leadSource) | Filter by lead source. |
| Customer: (dealershipId, assignedTo) | Filter by assigned user. |
| Customer: (dealershipId, deletedAt) | Exclude soft-deleted in default lists. |
| CustomerPhone/Email: dealershipId, customerId | Tenant scoping; list by customer. |
| CustomerPhone/Email: (dealershipId, value) | Search customers by phone or email. |
| CustomerNote/Task: customerId, (customerId, createdAt) | List by customer; timeline order. |
| CustomerNote/Task: (dealershipId, customerId) | Tenant + customer scoping. |
| CustomerTask: (dealershipId, completedAt) | Filter pending vs completed; overdue lists. |
| CustomerActivity: (dealershipId, customerId, createdAt) | Single query for customer timeline. |

---

## 2) RBAC Mapping

- **customers.read** — List customers, get customer, list notes, list tasks, get activity/timeline. All read routes require `customers.read`.
- **customers.write** — Create/update/delete customer, create/update/delete notes, create/update/delete/complete tasks. All write routes require `customers.write`.
- **No admin.*** in this module; no admin bypass. Map each route to read or write below.

| Route / action | Permission |
|----------------|------------|
| GET /api/customers (list) | customers.read |
| GET /api/customers/[id] | customers.read |
| POST /api/customers | customers.write |
| PATCH /api/customers/[id] | customers.write |
| DELETE /api/customers/[id] | customers.write |
| GET /api/customers/[id]/notes | customers.read |
| POST /api/customers/[id]/notes | customers.write |
| PATCH /api/customers/[id]/notes/[noteId] | customers.write |
| DELETE /api/customers/[id]/notes/[noteId] | customers.write |
| GET /api/customers/[id]/tasks | customers.read |
| POST /api/customers/[id]/tasks | customers.write |
| PATCH /api/customers/[id]/tasks/[taskId] | customers.write |
| DELETE /api/customers/[id]/tasks/[taskId] | customers.write |
| GET /api/customers/[id]/activity (if implemented) | customers.read |

**Tenant scoping:** `dealershipId` is always taken from auth/session (active dealership). Never from client body or path for tenant identity. List/get/update/delete are always scoped by that `dealershipId`.

---

## 3) API Contract List (No Code)

Standard error shape: `{ error: { code, message, details? } }`. Codes: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, CONFLICT, RATE_LIMITED, INTERNAL.

Pagination: `limit` (default 25, max 100), `offset` (0-based). Response: `{ data: T[], meta: { total, limit, offset } }`.

---

### 3.1 Customers

| Method | Path | Purpose | Permission | Audit |
|--------|------|---------|------------|--------|
| GET | /api/customers | List customers (paginated, filters) | customers.read | No |
| POST | /api/customers | Create customer | customers.write | customer.created |
| GET | /api/customers/[id] | Get customer by id (with phones, emails) | customers.read | No |
| PATCH | /api/customers/[id] | Update customer | customers.write | customer.updated |
| DELETE | /api/customers/[id] | Soft delete customer | customers.write | customer.deleted |

**GET /api/customers**
- Query (Zod): `listCustomersQuerySchema` — `limit` (number, min 1, max 100, default 25), `offset` (number, min 0, default 0), `status?` (CustomerStatus enum), `leadSource?` (string), `assignedTo?` (UUID), `search?` (string — search by name, email value, or phone value).
- Response: `{ data: CustomerListItem[], meta: { total, limit, offset } }`. CustomerListItem: id, name, status, leadSource, assignedTo?, createdAt; optional summary fields (e.g. primary phone/email) for table display.
- Permission: customers.read. Dealership from auth.

**POST /api/customers**
- Body (Zod): `createCustomerBodySchema` — `name` (string, required, min/max length), `leadSource?`, `status?` (default LEAD), `assignedTo?` (UUID), `addressLine1?`, `addressLine2?`, `city?`, `region?`, `postalCode?`, `country?`, `tags?` (string array), `phones?` (array of { kind?, value }), `emails?` (array of { kind?, value }).
- Response: `{ data: Customer }` (full customer with phones, emails).
- Permission: customers.write. Audit: entity Customer, action customer.created.

**GET /api/customers/[id]**
- Params (Zod): `customerIdParamSchema` — `id` (z.string().uuid()).
- Response: `{ data: Customer }` with phones, emails, assignedTo profile summary if present. 404 if not found or wrong tenant.
- Permission: customers.read.

**PATCH /api/customers/[id]**
- Params: `customerIdParamSchema` (id).
- Body (Zod): `updateCustomerBodySchema` — same fields as create, all optional (partial update). Include `phones?`, `emails?` as full replacement arrays for contact lists.
- Response: `{ data: Customer }`. Audit: customer.updated, metadata safe diff if desired.

**DELETE /api/customers/[id]**
- Params: `customerIdParamSchema` (id).
- Body: none. Response: 204 or 200. Soft delete: set deletedAt, deletedBy. Audit: customer.deleted.

---

### 3.2 Notes

| Method | Path | Purpose | Permission | Audit |
|--------|------|---------|------------|--------|
| GET | /api/customers/[id]/notes | List notes (paginated) | customers.read | No |
| POST | /api/customers/[id]/notes | Create note | customers.write | customer.note.created |
| PATCH | /api/customers/[id]/notes/[noteId] | Update note | customers.write | customer.note.updated |
| DELETE | /api/customers/[id]/notes/[noteId] | Soft delete note | customers.write | customer.note.deleted |

**GET /api/customers/[id]/notes**
- Params: `customerIdParamSchema`, path segment `id`.
- Query (Zod): `listNotesQuerySchema` — `limit`, `offset` (pagination, default 25, max 100).
- Response: `{ data: CustomerNote[], meta: { total, limit, offset } }`. Note: id, body, createdBy (id + summary), createdAt, updatedAt. Exclude soft-deleted (deletedAt null).
- Permission: customers.read. Tenant + customer scoping: customer must belong to tenant.

**POST /api/customers/[id]/notes**
- Params: customer id.
- Body (Zod): `createNoteBodySchema` — `body` (string, required, max length e.g. 10000).
- Response: `{ data: CustomerNote }`. Audit: customer.note.created. Emit activity: note_added.

**PATCH /api/customers/[id]/notes/[noteId]**
- Params: `customerIdParamSchema`, `noteIdParamSchema` (noteId: z.string().uuid()).
- Body (Zod): `updateNoteBodySchema` — `body` (string, optional, max length).
- Response: `{ data: CustomerNote }`. Audit: customer.note.updated.

**DELETE /api/customers/[id]/notes/[noteId]**
- Params: customer id, note id. Body: none. Response: 204. Soft delete: set deletedAt. Audit: customer.note.deleted.

---

### 3.3 Tasks

| Method | Path | Purpose | Permission | Audit |
|--------|------|---------|------------|--------|
| GET | /api/customers/[id]/tasks | List tasks (paginated, filter completed?) | customers.read | No |
| POST | /api/customers/[id]/tasks | Create task | customers.write | customer.task.created |
| PATCH | /api/customers/[id]/tasks/[taskId] | Update / complete task | customers.write | customer.task.updated / customer.task.completed |
| DELETE | /api/customers/[id]/tasks/[taskId] | Soft delete task | customers.write | customer.task.deleted |

**GET /api/customers/[id]/tasks**
- Params: customer id. Query (Zod): `listTasksQuerySchema` — `limit`, `offset`, `completed?` (boolean — filter by completedAt null vs non-null).
- Response: `{ data: CustomerTask[], meta: { total, limit, offset } }`. Task: id, title, description?, dueAt?, completedAt?, completedBy?, createdBy?, createdAt, updatedAt. Exclude soft-deleted.
- Permission: customers.read.

**POST /api/customers/[id]/tasks**
- Body (Zod): `createTaskBodySchema` — `title` (string, required), `description?`, `dueAt?` (ISO datetime).
- Response: `{ data: CustomerTask }`. Audit: customer.task.created. Emit activity: task_created.

**PATCH /api/customers/[id]/tasks/[taskId]**
- Body (Zod): `updateTaskBodySchema` — `title?`, `description?`, `dueAt?`, `completedAt?` (ISO datetime or null), `completedBy?` (UUID; typically set by server from auth when completing). If completedAt set (and was null), treat as complete; audit customer.task.completed and emit task_completed.
- Response: `{ data: CustomerTask }`. Audit: customer.task.updated and/or customer.task.completed.

**DELETE /api/customers/[id]/tasks/[taskId]**
- Body: none. Response: 204. Soft delete task. Audit: customer.task.deleted.

---

### 3.4 Activity (optional endpoint)

**GET /api/customers/[id]/activity**
- Params: customer id. Query: `limit`, `offset` (pagination).
- Response: `{ data: CustomerActivity[], meta: { total, limit, offset } }`. Ordered by createdAt desc.
- Permission: customers.read. Used for Activity tab on customer detail.

---

### 3.5 Pagination and Scoping

- Default `limit` 25, max 100 for all list endpoints.
- All endpoints scoped by `dealershipId` from auth (active dealership). No client-supplied dealership id for scoping.

---

## 4) UI Screen Map (For Later Implementation)

- **Customers list**
  - Table: columns e.g. name, status, lead source, assigned to, primary contact (phone/email), created date.
  - Filters: status, lead source, assigned to (user picker).
  - Search: name, email, or phone (debounced; calls list API with `search`).
  - Pagination: limit/offset or page size selector.
  - Empty state, loading state, error state.
  - Row action: navigate to customer detail.

- **Customer detail**
  - Tabs: Overview | Notes | Tasks | Activity.
  - **Overview:** Contact info (phones, emails), address, lead source, tags, status, assigned to; edit button → edit form.
  - **Notes:** List of notes (newest first), “Add note” form (body); edit/delete per note; pagination.
  - **Tasks:** List of tasks; filter by pending/completed; “Add task” form (title, description?, due date); complete action; edit/delete; pagination.
  - **Activity:** Timeline built from CustomerActivity (or from notes + tasks + audit if no activity table); show type, actor, time, metadata summary.

- **Create / Edit customer form**
  - Fields: name (required), phones (repeatable: kind, value), emails (repeatable: kind, value), address (line1, line2, city, region, postal code, country), lead source, tags (multi-select or input), status, assigned to (user picker).
  - Client validation (Zod) + server validation; clear error messages; loading/disabled on submit.

---

## 5) Events

**Emitted by customers module**
- `customer.created` — payload: `{ customerId, dealershipId }`. On customer create.
- `customer.updated` — payload: `{ customerId, dealershipId, changedFields? }`. On customer update.
- `customer.deleted` — payload: `{ customerId, dealershipId }`. On customer soft delete.
- `customer.note_added` — payload: `{ customerId, noteId, dealershipId, createdBy }`. On note create.
- `customer.task_created` — payload: `{ customerId, taskId, dealershipId, createdBy, dueAt? }`. On task create.
- `customer.task_completed` — payload: `{ customerId, taskId, dealershipId, completedBy }`. When task completedAt set.
- (Future) `customer.task.due` — for reminders; not designed in this spec.

**Consumed (cross-module)**
- Deals module may subscribe to `customer.created` / `customer.updated` to link deals to customers. No design of consumers in this document; events are defined for future use.

---

## 6) Module Boundary

- **Owns:** Customer, CustomerPhone, CustomerEmail, CustomerNote, CustomerTask, CustomerActivity. All under `/modules/customers/{db,service,ui,tests}`. Route handlers in `/app/api/customers/**` call customers service only.
- **Does not own:** Dealership, Profile (core-platform). Deals module will reference customer by id (foreign key or reference in deal); no direct DB access from deals to customers — use service or events.
- **Shared:** Permission keys `customers.read`, `customers.write` (defined in core-platform-spec; seeded by platform). Auth/session and RBAC helpers from core-platform.

---

## Backend implementation checklist

- [ ] Prisma: Add CustomerStatus enum; Customer, CustomerPhone, CustomerEmail, CustomerNote, CustomerTask, CustomerActivity models; all indexes and FKs; add relations on Dealership and Profile.
- [ ] Migration: Create and apply migration; verify indexes.
- [ ] DB layer: `/modules/customers/db` — crud for Customer (with phones/emails), CustomerNote, CustomerTask, CustomerActivity (insert only); all queries scoped by dealershipId.
- [ ] Service layer: `/modules/customers/service` — create/update/delete customer (phones/emails replace), notes, tasks; write CustomerActivity rows on note/task/customer events; emit domain events; no direct Prisma in routes.
- [ ] API routes: `/app/api/customers/**` — GET/POST list/create, GET/PATCH/DELETE by id; GET/POST/PATCH/DELETE notes and tasks; GET activity; Zod for params, query, body; guardPermission(customers.read | customers.write); dealershipId from getAuthContext().
- [ ] Audit: Log customer.created/updated/deleted, customer.note.created/updated/deleted, customer.task.created/updated/completed/deleted via platform audit helper.
- [ ] Pagination: All list endpoints use limit (default 25, max 100) and offset; return meta.total.
- [ ] Error shape: Use standard { error: { code, message, details? } }.
- [ ] Tests: Tenant isolation (Dealer A cannot see/update Dealer B customers); RBAC (forbidden when permission missing); audit entries created for CUD.

---

## Frontend implementation checklist

- [ ] Customers list page: table (name, status, lead source, assigned to, contact, created); filters (status, lead source, assigned to); search (name/email/phone); pagination; loading/empty/error states.
- [ ] Customer detail page: tabs Overview, Notes, Tasks, Activity; Overview shows contact, address, lead source, tags, status, assigned to; Notes list + add form; Tasks list + add form + complete; Activity timeline.
- [ ] Create/Edit customer form: name, phones, emails, address, lead source, tags, status, assigned to; validation (Zod); submit to POST/PATCH; error display.
- [ ] Shared components: use existing design system (shadcn); no duplicate patterns; labels, keyboard nav, focus states.
- [ ] Manual test checklist: list filters, search, create customer, edit customer, soft delete, add/edit/delete notes, add/complete/delete tasks, activity timeline, RBAC (read-only vs write), tenant isolation.
