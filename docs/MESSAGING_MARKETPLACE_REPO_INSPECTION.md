# Messaging & Marketplace Integrations — Repo Inspection Summary

**Sprint:** Messaging & Marketplace Integrations  
**Goal:** Enable dealerships to communicate with leads (SMS, email) and publish inventory externally (marketplace feeds).  
**Date:** 2025-03-07

---

## 1. Verdict: **NOT IMPLEMENTED**

The following are **not** present; the sprint should proceed.

| Requirement | Status |
|-------------|--------|
| Twilio SMS integration / sendSmsMessage() | Not implemented (stub only) |
| POST /api/messages/sms | Does not exist |
| SendGrid email / sendEmailMessage() | Not implemented |
| POST /api/messages/email | Does not exist |
| Conversation thread (direction, preview, sender) | Timeline has sms_sent→SYSTEM only; no email_sent, no message metadata shape |
| GET /api/inventory/feed (Facebook/AutoTrader) | Does not exist |
| modules/integrations (sms, email, marketplace) | Module does not exist |
| Customer conversation panel (send SMS/email) | SmsDialog exists but calls stub; no email send UI |
| Inventory marketplace publish status indicator | Not implemented |

---

## 2. What exists (to reuse)

### 2.1 Customers & timeline

- **CustomerActivity:** activityType, entityType, entityId, metadata (Json), actorId, createdAt. Used for call, sms_sent, appointment_scheduled, disposition_set, task_created, note_added.
- **customers/service/activity.ts:** `logSmsSent()` — stub that appends activity with activityType "sms_sent", empty metadata (no message/phone per security). `appendActivity()` in db/activity.ts.
- **customers/db/timeline.ts:** Merges CustomerNote, CustomerActivity, CustomerCallback; ACTIVITY_TYPE_TO_TIMELINE maps call→CALL, sms_sent→SYSTEM, etc. Returns TimelineEvent (type, createdAt, createdByUserId, payloadJson, sourceId). No email_sent; no dedicated SMS/EMAIL type; payloadJson is activity metadata.
- **GET /api/customers/[id]/timeline:** Paginated; optional type filter. Used by TimelineCard on customer detail.

### 2.2 Existing SMS surface (stub)

- **POST /api/customers/[id]/sms:** guardPermission(customers.write); body smsStubBodySchema (optional message); calls activityService.logSmsSent(). Does not send via Twilio; only logs activity.
- **SmsDialog (DetailPage.tsx):** POST to /api/customers/{id}/sms with optional message; "Activity will be logged" in description. No real send.

### 2.3 Inventory

- **Vehicle, VehiclePhoto, VehicleListing:** Prisma models. Listings service (publish/unpublish) exists. Vehicle has VIN, year, make, model, status, etc.; photos linked; listing status per vehicle.
- **inventory/service/listings.ts, db/vehicle-listing.ts:** Publish/unpublish flows.
- **Cache:** cacheKeys.ts has inventoryPrefix, inventoryIntelKey; no feed key yet. withCache from cacheHelpers.

### 2.4 API & infra

- **Handler pattern:** getAuthContext → guardPermission → validate → service → jsonResponse. RBAC crm.read/crm.write, customers.read/write, inventory.read/write.
- **Audit:** auditLog(dealershipId, actorUserId, action, entity, entityId, metadata). No PII in metadata.
- **Pagination:** parsePagination (default 25, max 100).

---

## 3. Gaps to implement

1. **SMS:** Twilio client (or env-driven); sendSmsMessage(dealershipId, customerId, phone, message, userId); log activity with direction outbound + content preview (truncated, no PII in logs); POST /api/messages/sms (crm.write).
2. **Email:** SendGrid client; sendEmailMessage(dealershipId, customerId, email, subject, body, userId?); log activity; POST /api/messages/email (crm.write).
3. **Timeline:** Add activity types sms_sent, email_sent with metadata: direction (inbound/outbound), contentPreview (e.g. first 80 chars), optional senderId. Map to timeline (add SMS/EMAIL event types or keep SYSTEM with payload). Extend listTimeline to expose direction/preview/sender from metadata.
4. **Feed:** New module or inventory service: build feed payload (vehicle, price, photos, VIN, description) for format=facebook|autotrader; GET /api/inventory/feed?format=...; cache by dealershipId + format; inventory.read or dedicated permission.
5. **Module:** Create modules/integrations (or extend customers + inventory): submodules sms, email, marketplace; or keep integrations thin (Twilio/SendGrid wrappers) and call customers activity + inventory listings from API routes.
6. **Frontend:** Conversation panel on customer detail (send SMS, send email) — can extend existing SmsDialog and add EmailDialog; wire to new POST /api/messages/*. Inventory page: marketplace publish status indicator (e.g. “Listed on Facebook” / “AutoTrader” or feed status).

---

## 4. Security & constraints

- All queries scoped by dealershipId (session only).
- Cross-tenant → NOT_FOUND.
- Message body/content must not appear in audit or app logs (preview truncated, no PII).
- RBAC: crm.write for messages; inventory.read (or inventory.feed.read) for feed.
- .cursorrules: money in cents; no SSN/DOB in storage; audit on create/update/delete for relevant entities.

---

*End of repo inspection. Proceed to STEP 1 Spec.*
