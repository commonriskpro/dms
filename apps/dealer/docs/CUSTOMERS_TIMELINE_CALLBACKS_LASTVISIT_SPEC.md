# Customers — Timeline, Callbacks, Last Visit (Spec)

**Project:** DMS Dealer App (`apps/dealer`)  
**Feature:** Customer Activity Timeline (notes + call logs + system events), Callback scheduling, Last-visit tracking  
**Stack:** Node 24, npm 11, Next 16 App Router, React 19, Prisma 6, Jest 30, TypeScript 5.9.  
**Non-negotiables:** Tenant isolation (dealershipId from auth only), RBAC (guardPermission before logic), Zod at edge, pagination 1–50, server-first, audit logging.

---

## 1. Scope

- **A) Customer Activity Timeline:** Single, paginated timeline combining notes, call logs, and optional system events (e.g. disposition_set, appointment_scheduled). One GET timeline API returning mixed event types.
- **B) Callback Scheduling:** New entity for callbacks: schedule, list, complete, snooze; overdue indicators. Status flow: SCHEDULED → DONE | CANCELLED; snooze keeps SCHEDULED with snoozedUntil.
- **C) Last Visit Tracking:** Server-side update when customer detail is viewed or on meaningful interaction; definition documented below.

---

## 2. Data Model (Prisma)

### 2.1 Timeline Source Decision: Aggregated (No New Event Table)

The timeline is **not** a new table. It is an **aggregated view** over existing and new sources:

- **CustomerNote** (existing) → timeline event type **NOTE**. Only rows with `deletedAt = null`.
- **CustomerActivity** (existing) → timeline event types **CALL**, **APPOINTMENT**, **SYSTEM** by mapping `activityType` (e.g. `call`, `sms_sent`, `appointment_scheduled`, `disposition_set`, `task_created` → SYSTEM).
- **CustomerCallback** (new) → timeline event type **CALLBACK** (one event per callback: created; optionally completed/snoozed/cancelled as additional events or as status change on same event — implementation may emit “scheduled” at create and “done”/“snoozed”/“cancelled” at update).

**GET timeline** behavior: Service layer queries CustomerNote, CustomerActivity, and CustomerCallback for the customer (scoped by dealershipId from auth), normalizes each to a common **TimelineEvent** shape (type, createdAt, createdByUserId optional, payloadJson, sourceId), merge-sorts by `createdAt` descending, then applies `limit` and `offset`. Pagination: limit 1–50, offset ≥ 0. Optional query filter `type` (NOTE | CALL | CALLBACK | APPOINTMENT | SYSTEM) filters the merged result by event type.

**Call logging:** Stored as **CustomerActivity** with `activityType = "call"`, `entityType = "call"`, `metadata` (e.g. duration, direction, summary). No new table. POST `/api/customers/[id]/calls` creates a CustomerActivity row and optionally triggers lastVisit update.

### 2.2 New Model: CustomerCallback

```prisma
model CustomerCallback {
  id              String    @id @default(uuid()) @db.Uuid
  dealershipId    String    @map("dealership_id") @db.Uuid
  customerId      String    @map("customer_id") @db.Uuid
  callbackAt      DateTime  @map("callback_at")
  status          CustomerCallbackStatus @default(SCHEDULED)
  reason          String?   @db.VarChar(2000)
  assignedToUserId String?  @map("assigned_to_user_id") @db.Uuid
  snoozedUntil    DateTime? @map("snoozed_until")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  dealership  Dealership @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  customer    Customer   @relation(fields: [customerId], references: [id], onDelete: Cascade)
  assignedTo  Profile?   @relation("CallbackAssignedTo", fields: [assignedToUserId], references: [id], onDelete: SetNull)

  @@index([dealershipId])
  @@index([dealershipId, customerId])
  @@index([dealershipId, status, callbackAt])
  @@index([customerId, createdAt])
}

enum CustomerCallbackStatus {
  SCHEDULED
  DONE
  CANCELLED
}
```

- **callbackAt:** Required; when the callback is due.
- **status:** SCHEDULED | DONE | CANCELLED. Snooze does not change status; it sets **snoozedUntil**. Overdue = `status = SCHEDULED` and `callbackAt < now()` and (`snoozedUntil` is null or `snoozedUntil < now()`).
- **reason:** Optional text, max 2000 chars (Zod + DB).
- **assignedToUserId:** Optional; who is responsible.
- **snoozedUntil:** Optional; when the callback is snoozed until (still SCHEDULED).

### 2.3 Customer: Last-Visit Fields

Add to **Customer**:

- **lastVisitAt** — `DateTime?` @map("last_visit_at")
- **lastVisitByUserId** — `String?` @map("last_visit_by_user_id") @db.Uuid

Index for list/sorts: `@@index([dealershipId, lastVisitAt])` (and retain existing indexes as needed).

**Definition of last visit:**  
Last visit is updated **when the customer detail is viewed** (server-side when the detail page/segment loads and the customer is successfully resolved for the tenant). Optionally, also update on **meaningful interactions**: e.g. adding a note, logging a call, completing a callback (product may choose “detail view only” for simplicity). This spec **recommends** updating on **detail view** and on **create note / log call / complete callback** so that “last visit” reflects both “last time someone opened this customer” and “last time someone did something.” Exact trigger set is implementation choice; both must be server-side using `dealershipId` and `userId` from auth.

---

## 3. API Routes

| Method | Path | Purpose | Query/Body (Zod names) | Pagination |
|--------|------|---------|-------------------------|------------|
| GET | `/api/customers/[id]/timeline` | List timeline events (notes + calls + callbacks + system) | Query: `limit` (1–50), `offset` (≥0), `type` (optional: NOTE \| CALL \| CALLBACK \| APPOINTMENT \| SYSTEM) | Yes: limit, offset |
| POST | `/api/customers/[id]/notes` | Create note (existing; creates NOTE in timeline) | Body: `body` (string, non-empty, max length per existing rules) | — |
| POST | `/api/customers/[id]/calls` | Log a call (creates CustomerActivity call; appears in timeline) | Body: e.g. `summary`, `durationSeconds?`, `direction?` (optional metadata); Zod schema | — |
| GET | `/api/customers/[id]/callbacks` | List callbacks for customer | Query: `status?` (SCHEDULED \| DONE \| CANCELLED), `limit` (1–50), `offset` (≥0) | Yes |
| POST | `/api/customers/[id]/callbacks` | Create callback | Body: `callbackAt` (required, ISO datetime), `reason?`, `assignedToUserId?` | — |
| PATCH | `/api/customers/[id]/callbacks/[callbackId]` | Update callback (status, snooze) | Body: `status?`, `snoozedUntil?` (optional); at least one required for update | — |
| POST | `/api/customers/[id]/last-visit` | Record last visit (alternative to server-component update) | Body: none (or empty); server uses auth userId + dealershipId | — |

**lastVisit implementation choice:** Either (1) **POST /api/customers/[id]/last-visit** called when the client mounts the detail view (or after load), or (2) **server-side only**: when the customer detail page/segment is rendered (Server Component or server action), after resolving the customer, call a service that updates `Customer.lastVisitAt` and `Customer.lastVisitByUserId`. This spec **recommends (2) server-side update on detail view** so no extra client round-trip and no risk of forgetting to call the endpoint. If the product wants “last visit only when user did something,” then update only from create-note / log-call / complete-callback flows. Document the chosen trigger in rollout notes.

---

## 4. RBAC Matrix

| Resource / Action | Permission |
|-------------------|------------|
| GET timeline, GET callbacks | `customers.read` |
| POST note, POST call, POST callback, PATCH callback | `customers.write` |
| POST last-visit (if used) / server-side lastVisit update | `customers.read` (viewing detail is read; updating lastVisit is a side effect of read or write per product choice) |

All routes MUST call `guardPermission(ctx, "customers.read")` or `guardPermission(ctx, "customers.write")` before any business logic. lastVisit update uses the same permission as the action that triggers it (read for “on view,” write for “on note/call/callback”).

---

## 5. Tenant Isolation

- **dealershipId** is taken **only** from auth/session (`ctx.dealershipId`); never from request body or query.
- Resolve customer by `id` from path; ensure `customer.dealershipId === ctx.dealershipId`. If not (e.g. cross-tenant customerId), return **404 NOT_FOUND** (do not leak existence).
- All reads/writes for notes, activities, callbacks, and lastVisit MUST be scoped by `ctx.dealershipId` and by customer belonging to that dealership.

---

## 6. Validation (Zod)

- **Path params:** `id`, `callbackId` — UUID (e.g. `z.string().uuid()`).
- **Pagination:** `limit` integer 1–50 (default 10 or 25), `offset` integer ≥ 0.
- **Timeline:** `type` optional enum: NOTE | CALL | CALLBACK | APPOINTMENT | SYSTEM.
- **Callbacks:**  
  - Create: `callbackAt` required, ISO datetime; not too far in the past (e.g. reject if &lt; now - 1 day or business rule). `reason` max 2000 chars; `assignedToUserId` optional UUID.  
  - PATCH: `status` optional enum SCHEDULED | DONE | CANCELLED; `snoozedUntil` optional ISO datetime.
- **List callbacks:** `status` optional enum; same as above.
- All request bodies and query params validated at route edge; invalid input → 400 with validation error shape `{ error: { code, message, details? } }`.

---

## 7. UI Plan (Brief)

- **Customer detail (modal/page):**
  - **Timeline panel:** Paginated list of timeline events (notes, calls, callbacks, system). “Add note” composer that POSTs to `/api/customers/[id]/notes` and refetches or appends to timeline. Optional “Log call” that POSTs to `/api/customers/[id]/calls`.
  - **Callbacks panel:** List callbacks (with overdue indicator: callbackAt &lt; now and SCHEDULED and not snoozed). Actions: Schedule (form → POST callbacks), Mark done (PATCH status DONE), Snooze (PATCH snoozedUntil), Cancel (PATCH status CANCELLED).
- **Customer list:** Show **lastVisitAt** column or chip (e.g. relative “2 days ago” with exact datetime in tooltip). Sort/filter by lastVisit already covered by list API (existing or extended with lastVisitAt on Customer).

---

## 8. Acceptance Criteria

- Timeline GET returns merged notes, call logs (CustomerActivity call), callbacks, and system activities, sorted by createdAt desc, paginated, optionally filtered by `type`.
- Notes create continues to work; new notes appear in timeline as NOTE.
- POST /calls creates a CustomerActivity call and appears in timeline as CALL.
- Callbacks: create (callbackAt, optional reason, optional assignedTo); list with status filter and pagination; PATCH for status and snoozedUntil; overdue computed as SCHEDULED and callbackAt &lt; now and (snoozedUntil null or &lt; now).
- lastVisit: Customer.lastVisitAt and lastVisitByUserId updated per chosen trigger (detail view and/or meaningful actions); list and detail show last visit; list can sort/filter by lastVisitAt.
- All endpoints enforce RBAC and tenant isolation; cross-tenant customerId returns 404.
- Validation: UUID params, limit 1–50, offset ≥ 0, callbackAt and reason/status enums per Zod; 400 for invalid input.

---

## 9. Test Plan

- **RBAC:** User without `customers.read` gets 403 on GET timeline and GET callbacks; without `customers.write` gets 403 on POST note, POST call, POST/PATCH callback.
- **Tenant isolation:** Customer B (dealership B) not visible to user in dealership A; GET/POST/PATCH for customer B’s id with dealer A auth → 404. No data from other dealership returned in list or timeline.
- **Validation:** Invalid UUID path → 400; limit &gt; 50 or &lt; 1 → 400; offset &lt; 0 → 400; invalid callbackAt (e.g. missing or too far past) → 400; reason &gt; 2000 chars → 400; invalid status enum → 400.
- **Invariants:** Callback status transitions (e.g. DONE/CANCELLED final); snoozedUntil does not change status; lastVisit only updated by server with auth userId/dealershipId; timeline only includes customer’s own notes/activities/callbacks for the tenant.

---

## 10. Rollout Notes

- **Timeline source:** Aggregated from CustomerNote, CustomerActivity, and CustomerCallback; no new CustomerActivityEvent table. GET timeline implemented in service layer with merge-sort and limit/offset.
- **lastVisit trigger:** Prefer server-side update when customer detail is loaded (and optionally on create note, log call, complete callback). Document final choice in release notes (e.g. “lastVisit updated on detail view and on note/call/callback”).
- **Callback status flow:** SCHEDULED → DONE or CANCELLED; snooze = set snoozedUntil, status remains SCHEDULED. Overdue = SCHEDULED and callbackAt &lt; now and (snoozedUntil null or &lt; now).
- Migration: Add CustomerCallback model and Customer.lastVisitAt / lastVisitByUserId; add index on Customer(dealershipId, lastVisitAt). Existing CustomerNote and CustomerActivity unchanged; timeline reads from them plus new callbacks.
- Audit: Log create/update/delete of callbacks; log lastVisit updates if required by audit policy (sensitive read or write).
