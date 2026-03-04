# Customers Module

## Purpose and scope

- Customer profiles (tenant-scoped).
- Lead source tracking, status (LEAD | ACTIVE | SOLD | INACTIVE), assignment.
- Contact info: phones and emails (searchable; at most one primary per customer, app-level).
- Notes (soft delete) and tasks (complete via completedAt/completedBy; optional soft delete).
- Append-only activity timeline (CustomerActivity).

No SSN/DOB/income storage. See docs/design/customers-spec.md.

## Routes

| Method | Path | Purpose | Permission | Audit |
|--------|------|---------|------------|--------|
| GET | /api/customers | List customers (paginated, filters, search) | customers.read | No |
| POST | /api/customers | Create customer | customers.write | customer.created |
| GET | /api/customers/[id] | Get customer by id (with phones, emails) | customers.read | No |
| PATCH | /api/customers/[id] | Update customer | customers.write | customer.updated |
| DELETE | /api/customers/[id] | Soft delete customer | customers.write | customer.deleted |
| GET | /api/customers/[id]/notes | List notes (paginated) | customers.read | No |
| POST | /api/customers/[id]/notes | Create note | customers.write | customer.note.created |
| PATCH | /api/customers/[id]/notes/[noteId] | Update note | customers.write | customer.note.updated |
| DELETE | /api/customers/[id]/notes/[noteId] | Soft delete note | customers.write | customer.note.deleted |
| GET | /api/customers/[id]/tasks | List tasks (paginated, filter completed?) | customers.read | No |
| POST | /api/customers/[id]/tasks | Create task | customers.write | customer.task.created |
| PATCH | /api/customers/[id]/tasks/[taskId] | Update / complete task | customers.write | customer.task.updated / customer.task.completed |
| DELETE | /api/customers/[id]/tasks/[taskId] | Soft delete task | customers.write | customer.task.deleted |
| GET | /api/customers/[id]/activity | List activity timeline (paginated) | customers.read | No |

## Permissions

- **customers.read** — List customers, get customer, list notes, list tasks, get activity.
- **customers.write** — Create/update/delete customer, notes, tasks.

No admin bypass. Dealership from auth (active dealership).

## Security guarantees

- **Tenant scoping**: All queries (customers, phones, emails, notes, tasks, activity) are scoped by `dealership_id` from the authenticated session. Cross-tenant access is impossible at the DB layer.
- **Cross-tenant customer id**: Requesting GET /api/customers/[id], notes, tasks, or activity with a customer id that belongs to another dealership returns **404 NOT_FOUND** (not 403), so existence of the resource is not leaked.
- **RBAC**: Every route enforces permission before performing the action. Missing `customers.read` or `customers.write` returns **403 FORBIDDEN**.
- **Soft delete**: Customers, notes, and tasks use soft delete. Soft-deleted customers are excluded from list and search; GET by id returns 404. Soft-deleted notes and tasks are excluded from their list endpoints.

## Search behavior

- List customers search (`?search=`) matches name and phone/email **value** within the current dealership only. Search is applied inside the tenant-scoped query; phone and email matches cannot return customers from another dealership.
- Pagination: all list endpoints support `limit` (max 100) and `offset`.

## Data model summary

- **Customer** — Tenant-scoped; soft delete (deletedAt, deletedBy). Status enum: LEAD | ACTIVE | SOLD | INACTIVE. Address fields, tags (array).
- **CustomerPhone** — kind, value, isPrimary (app-level at most one primary per customer). Searchable by value.
- **CustomerEmail** — kind, value, isPrimary. Searchable by value.
- **CustomerNote** — body, createdBy; soft delete (deletedAt, deletedBy).
- **CustomerTask** — title, description?, dueAt?, completedAt/completedBy; soft delete (deletedAt, deletedBy).
- **CustomerActivity** — Append-only; activityType, entityType, entityId, metadata (no PII), actorId.

## Indexes

| Table | Index | Purpose |
|-------|--------|--------|
| Customer | dealershipId | Tenant scoping |
| Customer | (dealershipId, status) | Filter by status |
| Customer | (dealershipId, createdAt) | List by newest |
| Customer | (dealershipId, leadSource) | Filter by lead source |
| Customer | (dealershipId, assignedTo) | Filter by assigned user |
| Customer | (dealershipId, deletedAt) | Exclude soft-deleted |
| CustomerPhone / CustomerEmail | dealershipId, customerId, (dealershipId, value) | Tenant + customer list; search by value |
| CustomerNote | dealershipId, customerId, (customerId, createdAt), (dealershipId, customerId) | List by customer; timeline order |
| CustomerTask | dealershipId, customerId, (customerId, createdAt), (dealershipId, completedAt), (dealershipId, customerId) | List; pending vs completed |
| CustomerActivity | dealershipId, (dealershipId, customerId, createdAt), (customerId, createdAt) | Customer timeline |

## Running integration tests

- Set **TEST_DATABASE_URL** and do not set **SKIP_INTEGRATION_TESTS=1** to run customer integration tests.
- Tests: tenant isolation (including search by phone/email cross-tenant), RBAC (customers.read / customers.write → 403), audit (customer and note/task create/update/delete), activity (note_added, task_created, task_completed), soft delete (list/search/GET exclude deleted).

## Manual smoke test checklist (API-level)

Use a session cookie (or Bearer token if applicable) after logging in. Replace `BASE`, `CUSTOMER_ID`, `NOTE_ID`, `TASK_ID` and ensure active dealership has `customers.read` and `customers.write`.

1. **List customers**  
   `GET BASE/api/customers?limit=25&offset=0`  
   Expect 200, `{ data: [], meta: { total, limit, offset } }`. Optional: `?status=LEAD&search=alice`.

2. **Create customer**  
   `POST BASE/api/customers`  
   Body: `{ "name": "Alice Smith", "status": "LEAD", "phones": [{ "value": "+15551234567", "isPrimary": true }], "emails": [{ "value": "alice@example.com" }] }`  
   Expect 201, `{ data: Customer }` with phones, emails. Check audit for `customer.created`.

3. **Get customer**  
   `GET BASE/api/customers/CUSTOMER_ID`  
   Expect 200, `{ data: Customer }`. Use wrong `CUSTOMER_ID` from another tenant → 404 (no existence leak).

4. **Update customer**  
   `PATCH BASE/api/customers/CUSTOMER_ID`  
   Body: `{ "name": "Alice Jones", "status": "ACTIVE" }` or `{ "phones": [...], "emails": [...] }` (replacement).  
   Expect 200. Check audit for `customer.updated`.

5. **Notes**  
   - `GET BASE/api/customers/CUSTOMER_ID/notes?limit=25&offset=0` → 200, `{ data, meta }`.  
   - `POST BASE/api/customers/CUSTOMER_ID/notes` Body: `{ "body": "Spoke with customer." }` → 201. Check audit `customer.note.created` and activity `note_added`.  
   - `PATCH BASE/api/customers/CUSTOMER_ID/notes/NOTE_ID` Body: `{ "body": "Updated note." }` → 200.  
   - `DELETE BASE/api/customers/CUSTOMER_ID/notes/NOTE_ID` → 204. Check audit `customer.note.deleted`.

6. **Tasks**  
   - `GET BASE/api/customers/CUSTOMER_ID/tasks?limit=25&offset=0&completed=false` → 200.  
   - `POST BASE/api/customers/CUSTOMER_ID/tasks` Body: `{ "title": "Follow up", "dueAt": "2025-03-01T12:00:00Z" }` → 201. Check audit `customer.task.created`.  
   - `PATCH BASE/api/customers/CUSTOMER_ID/tasks/TASK_ID` Body: `{ "completedAt": "2025-02-28T10:00:00Z" }` → 200. Check audit `customer.task.completed` and activity `task_completed`.  
   - `DELETE BASE/api/customers/CUSTOMER_ID/tasks/TASK_ID` → 204. Check audit `customer.task.deleted`.

7. **Activity**  
   `GET BASE/api/customers/CUSTOMER_ID/activity?limit=25&offset=0`  
   Expect 200, `{ data: CustomerActivity[], meta }` ordered by createdAt desc.

8. **Soft delete customer**  
   `DELETE BASE/api/customers/CUSTOMER_ID`  
   Expect 204. Check audit `customer.deleted`. GET same id → 404.

9. **RBAC**  
   As user with only `customers.read`: GET list/detail/notes/tasks/activity → 200; POST/PATCH/DELETE → 403.  
   As user without `customers.read`: GET list → 403.

10. **Tenant isolation**  
    As Dealer A, create customer; as Dealer B (switch session/dealership), GET list and GET by Dealer A’s customer id → list must not include it; get by id → 404.
