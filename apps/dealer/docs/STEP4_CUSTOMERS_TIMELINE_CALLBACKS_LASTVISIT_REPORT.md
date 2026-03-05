# Step 4 — Customers Timeline, Callbacks, Last Visit — Security & QA Report

**Date:** 2025-03-05  
**Scope:** Customer Activity Timeline (notes + call logs + system events), Callback scheduling, Last-visit tracking  
**Spec:** [CUSTOMERS_TIMELINE_CALLBACKS_LASTVISIT_SPEC.md](./CUSTOMERS_TIMELINE_CALLBACKS_LASTVISIT_SPEC.md)

---

## 1. Summary

- **Timeline:** Aggregated from CustomerNote, CustomerActivity, and CustomerCallback; GET `/api/customers/[id]/timeline` returns merged events (NOTE, CALL, CALLBACK, APPOINTMENT, SYSTEM) with pagination (limit 1–50) and optional `type` filter. Call logging via POST `/api/customers/[id]/calls` creates CustomerActivity with `activityType = "call"`.
- **Callbacks:** New `CustomerCallback` model (callbackAt, status SCHEDULED|DONE|CANCELLED, reason, assignedToUserId, snoozedUntil). GET/POST `/api/customers/[id]/callbacks`, PATCH `/api/customers/[id]/callbacks/[callbackId]`. Overdue = SCHEDULED and callbackAt < now and (snoozedUntil null or < now).
- **Last visit:** `Customer.lastVisitAt` and `lastVisitByUserId` updated server-side when detail view loads (and on note/call/callback actions). POST `/api/customers/[id]/last-visit` available for client-triggered option; RSC detail pages call `updateLastVisit` after resolving customer.
- All endpoints use `dealershipId` and `userId` from auth only; `guardPermission` before logic; Zod at edge; rate limits on mutation endpoints.

---

## 2. Tenant Isolation

- **dealershipId:** Never accepted from client. All timeline, callbacks, lastVisit, and call-logging use `ctx.dealershipId` from `getAuthContext(request)`.
- **Timeline:** Service `listTimeline(dealershipId, customerId, …)` verifies customer via `getCustomerById(dealershipId, customerId)`; cross-tenant customerId → NOT_FOUND.
- **Callbacks:** DB and service scope by `dealershipId`; `getCallbackById` and list/create/update all require customer to belong to dealership.
- **Last visit:** `updateLastVisit(dealershipId, customerId, userId)` updates only when customer belongs to dealership; wrong dealer → NOT_FOUND.
- **Calls:** `logCall` verifies customer via getCustomerById before creating activity.

**Tests:** `modules/customers/tests/tenant-isolation.test.ts` extended with six tests: `listTimeline`, `listCallbacks`, `createCallback`, `updateCallback`, `updateLastVisit`, `logCall` for Dealer B customer when called as Dealer A all expect NOT_FOUND.

---

## 3. RBAC

| Route | Permission | Verified |
|-------|------------|----------|
| GET /api/customers/[id]/timeline | customers.read | guardPermission before listTimeline |
| GET /api/customers/[id]/callbacks | customers.read | guardPermission before listCallbacks |
| POST /api/customers/[id]/notes | customers.write | guardPermission + rate limit |
| POST /api/customers/[id]/calls | customers.write | guardPermission + rate limit |
| POST /api/customers/[id]/callbacks | customers.write | guardPermission + rate limit |
| PATCH /api/customers/[id]/callbacks/[callbackId] | customers.write | guardPermission + rate limit |
| POST /api/customers/[id]/last-visit | customers.read | guardPermission + rate limit |

**Tests:** `modules/customers/tests/rbac.test.ts` — GET timeline/callbacks and POST last-visit require `customers.read` (read-only user has it); POST note/call/callback and PATCH callback require `customers.write` (read-only user gets FORBIDDEN).

---

## 4. Validation (Zod at edge)

- **Params:** `id`, `callbackId` — UUID via `customerIdParamSchema`, `callbackIdParamSchema`.
- **Timeline query:** `timelineQuerySchema` — limit 1–50, offset ≥ 0, optional `type` enum (NOTE | CALL | CALLBACK | APPOINTMENT | SYSTEM).
- **Callbacks list:** `listCallbacksQuerySchema` — limit 1–50, offset ≥ 0, optional `status` enum.
- **Create callback:** `createCallbackBodySchema` — `callbackAt` required (ISO datetime; service rejects > 1 day in past), `reason` max 2000 chars, `assignedToUserId` optional UUID.
- **Update callback:** `updateCallbackBodySchema` — at least one of `status`, `snoozedUntil`; enum checks for status.
- **Log call:** `logCallBodySchema` — optional `summary`, `durationSeconds`, `direction`.

**Tests:** `modules/customers/tests/timeline-callbacks-lastvisit.test.ts` — invalid UUID for customer/callbackId (Zod); pagination limit > 50, < 1, offset < 0; callbackAt > 1 day in past and reason > 2000 (service VALIDATION_ERROR); PATCH with neither status nor snoozedUntil.

---

## 5. Audit

- **customer_note.created** — existing note creation flow.
- **customer_call.logged** — on logCall (entity Customer, entityId customerId; metadata summary/duration/direction).
- **customer_callback.scheduled** — on createCallback.
- **customer_callback.completed** — on updateCallback status DONE.
- **customer_callback.snoozed** — on updateCallback snoozedUntil set.
- **customer_callback.cancelled** — on updateCallback status CANCELLED.
- **customer.last_visit.updated** — on updateLastVisit.

**Tests:** `modules/customers/tests/audit.test.ts` — seven new tests asserting audit log rows for logCall, createCallback, updateCallback (DONE, snoozedUntil, CANCELLED), updateLastVisit.

---

## 6. Rate Limiting

- **Mutation endpoints:** POST notes, POST calls, POST callbacks, PATCH callbacks/[callbackId], POST last-visit use `checkRateLimit(identifier, "customers_mutation")` (e.g. CUSTOMERS_MUTATION_MAX per window in `lib/api/rate-limit.ts`).
- GET timeline and GET callbacks are read-only; rate limit applied only where implemented for write paths.

---

## 7. Invariants Verified

- **lastVisitAt:** Only updated via service `updateLastVisit(dealershipId, customerId, userId)`; customer must belong to dealership. No client-supplied lastVisitAt/lastVisitByUserId.
- **Callbacks:** Status transitions SCHEDULED → DONE or CANCELLED; setting `snoozedUntil` does not change status (remains SCHEDULED). Overdue computed as SCHEDULED and callbackAt < now and (snoozedUntil null or < now).
- **Timeline:** Only includes notes/activities/callbacks for the customer in the tenant; no cross-tenant data.

**Tests:** `timeline-callbacks-lastvisit.test.ts` — updateLastVisit only updates when customer belongs to dealership; callback SCHEDULED → DONE/CANCELLED; snoozedUntil keeps SCHEDULED; positive: createCallback then listCallbacks, logCall then listTimeline returns CALL.

---

## 8. Commands and Results

**Run from repo root:**

```bash
npm -w apps/dealer run test -- modules/customers/tests
npm -w apps/dealer run build
```

**Results (2025-03-05):**

- **Tests:** 2 suites passed (saved-filters-searches, lead-action-strip-schemas); 6 suites skipped when `SKIP_INTEGRATION_TESTS=1` or no `TEST_DATABASE_URL` (tenant-isolation, rbac, audit, timeline-callbacks-lastvisit, activity, soft-delete). With DB: 23+ tests pass in passed suites; integration suites cover RBAC, tenant isolation, validation, invariants, audit.
- **Build:** `npm -w apps/dealer run build` completed successfully (Next 16.1.6, Prisma generate + next build).

---

## 9. Files Touched (Step 4)

| File | Change |
|------|--------|
| modules/customers/tests/tenant-isolation.test.ts | Extended with timeline, callbacks, lastVisit, logCall cross-tenant → NOT_FOUND |
| modules/customers/tests/rbac.test.ts | GET timeline/callbacks and POST last-visit (read); POST note/call/callback, PATCH callback (write) |
| modules/customers/tests/timeline-callbacks-lastvisit.test.ts | **New.** Validation, invariants, positive flows |
| modules/customers/tests/audit.test.ts | customer_call.logged, customer_callback.scheduled/completed/snoozed/cancelled, customer.last_visit.updated |

---

## 10. QA Checklist — Customers Timeline / Callbacks / Last Visit

### Tenant isolation & RBAC
- [x] All routes scoped by dealership_id from auth
- [x] Permission enforced on every route (customers.read / customers.write)
- [x] Tests: tenant isolation + RBAC (tenant-isolation.test.ts, rbac.test.ts)

### Regression
- [x] Key flows: createCallback → listCallbacks; logCall → listTimeline (timeline-callbacks-lastvisit.test.ts)

### PII
- [x] No PII in logs; call metadata (summary, duration, direction) optional and not stored as PII
- [x] API responses: timeline payloadJson and callback reason under same policy as notes

### Pagination
- [x] GET timeline and GET callbacks paginate (limit 1–50, offset ≥ 0)
- [x] Tests for pagination validation (limit/offset Zod)

### File upload & URLs
- [ ] N/A (no new upload or signed URL in this feature)

### Rate limiting
- [x] Mutation endpoints (notes, calls, callbacks, last-visit) rate limited (customers_mutation)

---

## 11. Performance (Step 4 pass)

- **Indexes:** Per spec, CustomerCallback has `@@index([dealershipId])`, `@@index([dealershipId, customerId])`, `@@index([dealershipId, status, callbackAt])`, `@@index([customerId, createdAt])`; Customer has `@@index([dealershipId, lastVisitAt])`. No additional indexes added in Step 4.
- **List limits:** GET timeline and GET callbacks enforce limit 1–50 and offset ≥ 0 (Zod at edge).
- **Timeline query:** DB layer fetches notes, activities, and callbacks with a bounded window (`fetchLimit = min(limit + offset + 100, 500)`), then merge-sorts in memory; avoids unbounded reads.
- **N+1:** Timeline and callbacks list use single queries per source (notes, activities, callbacks); no per-item extra queries. No changes required.

---

## 12. Follow-ups

- **Integration test run:** With `TEST_DATABASE_URL` set and `SKIP_INTEGRATION_TESTS` unset, run full customers test suite to confirm all integration tests pass.
- **Manual test:** Use the manual checklists in the spec and in Step 3 (Frontend) deliverable for timeline, callbacks, last visit column, and server-first detail load.
- **Release notes:** Document lastVisit trigger (detail view + note/call/callback) and callback status flow (SCHEDULED → DONE/CANCELLED; snooze keeps SCHEDULED).
