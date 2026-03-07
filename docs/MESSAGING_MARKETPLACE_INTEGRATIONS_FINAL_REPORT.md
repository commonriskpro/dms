# Messaging & Marketplace Integrations — STEP 4 Security & QA — Final Report

**Sprint:** Messaging & Marketplace Integrations  
**Date:** 2026-03-07  
**Status:** Complete

---

## 1. Repo inspection summary

### APIs and call flow

| Endpoint | Handler | Service | Tenant source |
|----------|---------|---------|----------------|
| `POST /api/messages/sms` | `getAuthContext` → `guardPermission(ctx, "crm.write")` → Zod body → `smsService.sendSmsMessage(ctx.dealershipId, …)` | `modules/integrations/service/sms` | `ctx.dealershipId` only |
| `POST /api/messages/email` | Same pattern, `guardPermission(ctx, "crm.write")` → `emailService.sendEmailMessage(ctx.dealershipId, …)` | `modules/integrations/service/email` | `ctx.dealershipId` only |
| `GET /api/inventory/feed` | `getAuthContext` → `guardPermission(ctx, "inventory.read")` → Zod query → `withCache(key, 300, () => marketplaceService.buildFeed(ctx.dealershipId, …))` | `modules/integrations/service/marketplace` → `inventoryService.getFeedVehicles(dealershipId, limit)` | `ctx.dealershipId` only |

- **Auth context:** `getAuthContext(request)` returns `dealershipId` from session (`requireDealershipContext`), not from request body or query.
- **SMS/Email:** Services accept `dealershipId` from the route only. They call `customerService.getCustomer(dealershipId, customerId)`, which uses `customersDb.getCustomerById(dealershipId, id)` with `where: { id, dealershipId, deletedAt: null }`. Cross-tenant `customerId` → customer not found → `NOT_FOUND`.
- **Feed:** `buildFeed(dealershipId, format, options)` calls `inventoryService.getFeedVehicles(dealershipId, limit)`, which calls `vehicleDb.listVehiclesForFeed(dealershipId, limit)` with `where: { dealershipId, deletedAt: null, status: "AVAILABLE" }`. No client-supplied dealership scope.
- **Activity:** `logMessageSent(dealershipId, userId, customerId, …)` is called with route `ctx.dealershipId` and again validates customer via `getCustomerById(dealershipId, customerId)`. Activity is appended with the same `dealershipId`.

### Files inspected

- `apps/dealer/app/api/messages/sms/route.ts`
- `apps/dealer/app/api/messages/email/route.ts`
- `apps/dealer/app/api/inventory/feed/route.ts`
- `apps/dealer/modules/integrations/service/sms.ts`
- `apps/dealer/modules/integrations/service/email.ts`
- `apps/dealer/modules/integrations/service/marketplace.ts`
- `apps/dealer/modules/customers/service/customer.ts` (`getCustomer`)
- `apps/dealer/modules/customers/service/activity.ts` (`logMessageSent`, `logMessageSent` metadata)
- `apps/dealer/modules/customers/db/customers.ts` (`getCustomerById`)
- `apps/dealer/modules/customers/db/activity.ts` (`appendActivity`)
- `apps/dealer/modules/customers/db/timeline.ts` (activity → timeline, `payloadJson` from metadata)
- `apps/dealer/modules/inventory/service/vehicle.ts` (`getFeedVehicles`)
- `apps/dealer/modules/inventory/db/vehicle.ts` (`listVehiclesForFeed` where clause)
- `apps/dealer/lib/api/handler.ts` (`getAuthContext`, `guardPermission`, `handleApiError`)
- `apps/dealer/lib/api/errors.ts` (`toErrorPayload` — no request body)
- `apps/dealer/lib/infrastructure/cache/cacheKeys.ts` (`inventoryFeedKey`)

---

## 2. Security review

### 2.1 Tenant isolation

- **SMS / Email:** All operations use `ctx.dealershipId` from `getAuthContext`. No `dealershipId` in request body. Customer lookup is `getCustomerById(dealershipId, customerId)`; wrong tenant → null → `NOT_FOUND`. Activity is created with the same `dealershipId`.
- **Feed:** Cache key and `buildFeed` use `ctx.dealershipId`. `listVehiclesForFeed(dealershipId, limit)` filters by `dealershipId`. No client-controlled tenant scope.
- **Conclusion:** Tenant isolation is correct; cross-tenant access returns NOT_FOUND.

### 2.2 RBAC

- **POST /api/messages/sms:** `guardPermission(ctx, "crm.write")` before any logic. No bypass.
- **POST /api/messages/email:** `guardPermission(ctx, "crm.write")` before any logic. No bypass.
- **GET /api/inventory/feed:** `guardPermission(ctx, "inventory.read")` before any logic. No bypass.
- **Conclusion:** RBAC is enforced as specified (crm.write for messages, inventory.read for feed).

### 2.3 Sensitive data / log hygiene

- **Integrations module:** No `logger.*` or `console.*` in `modules/integrations`. No raw message body, phone, or email logged.
- **Activity metadata:** Only `direction`, `channel`, and `contentPreview` (max 80 chars) are stored; no phone, email, or full body. `logMessageSent` enforces `contentPreview.slice(0, 80)`.
- **API error handling:** `handleApiError` uses `toErrorPayload(e)` and `captureApiException(e, …)`. No request body or PII passed to error reporting. Twilio/SendGrid errors surface as generic 500/INTERNAL unless wrapped; no PII in error payloads.
- **Conclusion:** Log and storage hygiene is acceptable; timeline preview is truncated only.

---

## 3. Validation review

### 3.1 SMS (POST /api/messages/sms)

- **customerId:** `z.string().uuid()`.
- **phone:** `z.string().min(1).max(20)` (no format normalization; length bounded).
- **message:** `z.string().min(1).max(1600)` (required, length limit).
- Invalid body → ZodError → `validationErrorResponse` → **400** with `VALIDATION_ERROR`.

### 3.2 Email (POST /api/messages/email)

- **customerId:** `z.string().uuid()`.
- **email:** `z.string().email()`.
- **subject:** `z.string().min(1).max(500)`.
- **body:** `z.string().min(1).max(50000)`.
- Invalid body → **400** with `VALIDATION_ERROR`.

### 3.3 Feed (GET /api/inventory/feed)

- **format:** `z.enum(["facebook", "autotrader"])`.
- **limit:** `z.coerce.number().int().min(1).max(500).default(100)`.
- Invalid query → **400** with `VALIDATION_ERROR`.

**Conclusion:** Validation is in place and invalid requests return 400 with a validation error payload.

---

## 4. Test coverage review

### 4.1 Existing tests (pre–STEP 4)

- `modules/integrations/tests/sms.test.ts`: NOT_FOUND, missing Twilio config, success path (logMessageSent args), contentPreview truncation.
- `modules/integrations/tests/email.test.ts`: NOT_FOUND, missing SendGrid config, success path, body as contentPreview when subject empty.
- `modules/integrations/tests/marketplace.test.ts`: buildFeed shape, format, limit cap.

### 4.2 Tests added in STEP 4

- **RBAC and validation (route tests):**
  - `app/api/messages/sms/route.test.ts`: 403 when guardPermission throws; 400 for invalid body (empty message, non-UUID customerId); 201 with `ctx.dealershipId` passed to service.
  - `app/api/messages/email/route.test.ts`: 403 when guardPermission throws; 400 for invalid email, empty subject; 201 with `ctx.dealershipId` passed to service.
  - `app/api/inventory/feed/route.test.ts`: 403 when guardPermission throws; 400 for invalid format, invalid limit; 200 with `ctx.dealershipId` passed to buildFeed.
- **Failed provider → no activity:**
  - `modules/integrations/tests/sms.test.ts`: When Twilio `messages.create` rejects, `logMessageSent` is not called.
  - `modules/integrations/tests/email.test.ts`: When SendGrid `send` rejects, `logMessageSent` is not called.

### 4.3 Activity and timeline safety (verified by code + tests)

- SMS/email send: activity is created only after successful provider call; on throw, control never reaches `logMessageSent`.
- Timeline: activity metadata (direction, channel, contentPreview) is stored and surfaced in timeline; `contentPreview` is capped at 80 chars in `logMessageSent`.

---

## 5. Performance pass

- **Feed:** Single `listVehiclesForFeed(dealershipId, limit)` query with `where: { dealershipId, deletedAt: null, status: "AVAILABLE" }`, `take: Math.min(limit, 500)`, and nested `vehiclePhotos` with `fileObject` select. No N+1; one batch read.
- **Cache:** Feed response cached via `withCache(inventoryFeedKey(dealershipId, format), 300, …)` (TTL 5 minutes). Key is tenant- and format-specific.
- **Indexes:** Existing indexes on `Vehicle` (e.g. `dealershipId`, status) are sufficient for the feed query; no new indexes added.
- **Conclusion:** Feed is efficient and cached; no N+1 identified.

---

## 6. QA hardening

- Route tests mock `getAuthContext` and `guardPermission`; services are mocked so only route logic and RBAC/validation are tested. No duplicate permission checks.
- Integration-style tests for SMS/email mock Twilio and SendGrid; no real provider calls. Failed-provider tests ensure no activity is written on send failure.
- Validation tests cover representative invalid inputs (missing/invalid message, bad UUID, invalid email, empty subject, invalid format/limit).

---

## 7. Final report summary

### Completed security checks

- Tenant isolation: all three endpoints use only `ctx.dealershipId`; cross-tenant access yields NOT_FOUND.
- RBAC: crm.write for SMS/email routes; inventory.read for feed route; guardPermission used with no bypass.
- Log/PII: no raw message body, phone, or email in logs; activity metadata limited to direction, channel, and truncated contentPreview.
- Validation: Zod schemas and 400 responses for invalid body/query on all three routes.
- Activity: timeline activity created only after successful send; failed provider does not create activity (code path + tests).
- Timeline safety: direction, timestamp, channel, and content preview (max 80 chars) in activity/timeline.

### Files inspected (see §1)

- API routes (3), integration services (3), customer + activity + inventory services/db, handler, errors, cache keys, timeline.

### Tests added

- `app/api/messages/sms/route.test.ts` (RBAC + validation).
- `app/api/messages/email/route.test.ts` (RBAC + validation).
- `app/api/inventory/feed/route.test.ts` (RBAC + validation).
- `modules/integrations/tests/sms.test.ts`: one new test (Twilio throw → logMessageSent not called).
- `modules/integrations/tests/email.test.ts`: one new test (SendGrid throw → logMessageSent not called).

### Commands run

```bash
cd apps/dealer && npx jest app/api/messages/sms/route.test.ts app/api/messages/email/route.test.ts app/api/inventory/feed/route.test.ts modules/integrations/tests/sms.test.ts modules/integrations/tests/email.test.ts --no-cache
# Result: 5 test suites, 22 tests passed.
```

### Remaining risks

- **Twilio/SendGrid:** Provider errors (rate limits, invalid number/address) surface as 500 unless explicitly mapped; consider mapping known provider error codes to 4xx/429 if needed.
- **Phone normalization:** Phone is validated only by length (1–20); no E.164 or region normalization. Optional follow-up: add `.refine()` or transform for production.
- **Audit:** SMS/email send is not explicitly audited (e.g. `auditLog("message.sms_sent", …)`). Activity record provides an audit trail; add explicit audit events if required by policy.

### Follow-ups (optional)

- Add explicit audit events for `message.sms_sent` and `message.email_sent` (metadata without PII).
- Consider rate limiting for POST /api/messages/sms and POST /api/messages/email if not already covered by a global/auth rate limiter.
- Add integration test that cross-tenant customerId returns 404 from the route (with DB or full route mock).

---

**Document generated as part of STEP 4 Security & QA for the Messaging & Marketplace Integrations sprint.**
