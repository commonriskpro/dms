# Messaging Inbox — Final Report

**Sprint:** Inbound Messaging + Conversation Inbox  
**Completed:** STEP 1 (Spec) through STEP 4 (Security & QA), performance pass, and this report.

---

## 1. Repo inspection summary

- **Timeline/activity:** CustomerActivity stores all message events (sms_sent, email_sent) with metadata (direction, contentPreview, channel). Timeline aggregates notes, activities, callbacks; SMS/email map to SYSTEM with payloadJson. Existing `logMessageSent` and timeline API reused.
- **Customer lookup:** No prior “by primary phone/email” lookup. Added `getCustomerIdAndDealershipByPrimaryPhone` and `getCustomerIdAndDealershipByPrimaryEmail` in customers db (raw query for phone digit normalization).
- **Integrations:** modules/integrations/service/sms.ts and email.ts for outbound; new webhooks handlers in modules/integrations/service/webhooks.ts. No prior webhook routes.
- **RBAC:** getAuthContext → guardPermission. Messages: crm.write; timeline/inbox: customers.read. Webhooks: no auth; tenant from customer lookup only.
- **Webhook patterns:** None previously. Twilio: validateRequest(authToken, signature, url, params). SendGrid Inbound Parse: multipart form; signature verification left for later when signing is configured.

---

## 2. STEP 1 — Spec

- **Deliverable:** `docs/MESSAGING_INBOX_SPEC.md`
- **Contents:** Architecture overview, data model (CustomerActivity + optional provider_message_id, delivery_status, provider), API design (webhooks + GET /api/crm/inbox/conversations), service layer plan, UI plan, RBAC matrix, security notes, acceptance criteria.

---

## 3. STEP 2 — Backend

### 3.1 Data model

- **Prisma:** CustomerActivity extended with optional `providerMessageId`, `deliveryStatus`, `provider`. Index `(dealershipId, providerMessageId)` for status callback lookup.
- **Migration:** `20260307200000_customer_activity_messaging_fields/migration.sql` (ADD COLUMN for the three fields + CREATE INDEX).

### 3.2 Customers module

- **db/customers.ts:** `getCustomerIdAndDealershipByPrimaryPhone(phoneValue)` (raw SQL, digit normalization), `getCustomerIdAndDealershipByPrimaryEmail(email)` (case-insensitive).
- **db/activity.ts:** `appendActivity(..., messageOptions?: AppendMessageOptions)`, `findActivityByProviderMessageId`, `findActivityByProviderMessageIdAny`, `updateActivityDeliveryStatus`, `listRecentMessageActivities`, `countConversations`, `listConversationsPage(dealershipId, limit, offset)` (raw SQL with CTE for latest per customer + pagination).
- **service/activity.ts:** `logMessageSent` extended with optional providerMessageId, provider, deliveryStatus; `logInboundMessage(dealershipId, customerId, activityType, data)` (no session); `updateMessageDeliveryStatus(providerMessageId, deliveryStatus, dealershipId?)`.
- **service/inbox.ts:** `listConversations(dealershipId, options)` using `listConversationsPage`.

### 3.3 Integrations webhooks

- **service/webhooks.ts:** `verifyTwilioSignature`, `handleInboundSms`, `handleTwilioStatusCallback`, `handleInboundEmail` (extractEmail helper). Tenant from customer only.
- **Outbound SMS:** modules/integrations/service/sms.ts updated to pass twilioSid, provider "twilio", deliveryStatus "sent" into `logMessageSent`.

### 3.4 API routes

- **POST /api/webhooks/twilio:** Read form body, verify Twilio signature, parse From/Body/MessageSid, call handleInboundSms; 200 on success or no customer, 401 on invalid signature, 400 on parse error.
- **POST /api/webhooks/twilio/status:** Verify signature, parse MessageSid/MessageStatus, call handleTwilioStatusCallback; 200/401.
- **POST /api/webhooks/sendgrid:** Parse form (from, to, subject, text, html), call handleInboundEmail; 200 (signature verification deferred).
- **GET /api/crm/inbox/conversations:** getAuthContext, guardPermission(ctx, "customers.read"), parse limit/offset, listConversations, jsonResponse.

---

## 4. STEP 3 — Frontend

- **Page:** `/crm/inbox` — server component passes `searchParams.customerId` to `InboxPageClient`.
- **InboxPageClient:** Conversation list (left) from GET /api/crm/inbox/conversations; conversation thread (right) from GET /api/customers/[id]/timeline filtered to SMS/email SYSTEM events; “Send SMS” / “Send email” open dialogs that call POST /api/messages/sms and POST /api/messages/email. Loading, empty, and error states. Link “View customer” to /customers/[id].
- **Sidebar:** “Inbox” nav item (MessageSquare icon, customers.read) linking to /crm/inbox.
- **Customer detail:** NextActionsCard given `customerId`; “Open Conversation” link to `/crm/inbox?customerId=...`.

---

## 5. STEP 4 — Security & QA

- **Tenant isolation:** Webhooks resolve customer by phone/email; dealershipId comes only from that customer row. Inbox and timeline use getAuthContext → dealershipId; listConversations and listTimeline are scoped by dealershipId.
- **RBAC:** GET /api/crm/inbox/conversations requires customers.read; POST /api/messages/sms and /api/messages/email require crm.write (unchanged). Webhooks use signature only, no auth.
- **Webhook signature:** Twilio validated with verifyTwilioSignature (twilio.validateRequest). SendGrid inbound: no verification in code (documented for when signing is enabled).
- **PII:** No full body, phone, or email in metadata; contentPreview truncated to 80 chars. Audit not extended for inbound (no actor); outbound unchanged.
- **Tests added:**
  - `app/api/webhooks/twilio/route.test.ts`: 401 when signature invalid/missing, 200 with valid signature and handler call, 200 when From/Body empty (no-op).
  - `app/api/webhooks/twilio/status/route.test.ts`: 401 when signature invalid, 200 and handleTwilioStatusCallback called.
  - `app/api/crm/inbox/conversations/route.test.ts`: 403 when FORBIDDEN, 200 and listConversations called with dealershipId and pagination.

### Commands run

- `npx prisma generate` (success).
- `npx prisma migrate deploy` (skipped in env without DATABASE_URL; migration file present).
- `npx jest app/api/webhooks/twilio/route.test.ts app/api/webhooks/twilio/status/route.test.ts app/api/crm/inbox/conversations/route.test.ts` — all 9 tests passed.

### Note on existing activity tests

- `modules/customers/tests/activity.test.ts` hits the real DB and fails if the new CustomerActivity columns are not applied. Run `npx prisma migrate deploy` (or equivalent) in test env so the migration is applied before running those tests.

---

## 6. Performance

- **Inbox list:** Single raw SQL `listConversationsPage` (CTE + JOIN + LIMIT/OFFSET); no N+1. Count is separate COUNT(DISTINCT customer_id).
- **Thread:** GET /api/customers/[id]/timeline uses existing listTimeline (parallel fetch of notes, activities, callbacks; merge-sort in memory; bounded fetchLimit). No N+1.
- **Conversation list fetch:** One GET /api/crm/inbox/conversations per load; pagination (default 25, max 100) supported.

---

## 7. Files created

| Path | Purpose |
|------|--------|
| docs/MESSAGING_INBOX_SPEC.md | Spec (architecture, data model, API, RBAC, security) |
| docs/MESSAGING_INBOX_FINAL_REPORT.md | This report |
| prisma/migrations/20260307200000_customer_activity_messaging_fields/migration.sql | New CustomerActivity columns + index |
| modules/integrations/service/webhooks.ts | Twilio/SendGrid webhook handlers + verification |
| modules/customers/service/inbox.ts | listConversations for inbox |
| app/api/webhooks/twilio/route.ts | Inbound SMS webhook |
| app/api/webhooks/twilio/status/route.ts | Twilio status callback |
| app/api/webhooks/sendgrid/route.ts | Inbound email webhook |
| app/api/crm/inbox/conversations/route.ts | GET conversations (paginated) |
| app/(app)/crm/inbox/page.tsx | Server page for inbox |
| app/(app)/crm/inbox/InboxPageClient.tsx | Inbox UI (list, thread, composer dialogs) |
| app/api/webhooks/twilio/route.test.ts | Twilio webhook tests |
| app/api/webhooks/twilio/status/route.test.ts | Twilio status tests |
| app/api/crm/inbox/conversations/route.test.ts | Inbox API RBAC + response tests |

### Files modified

- prisma/schema.prisma (CustomerActivity columns + index)
- modules/customers/db/activity.ts (appendActivity options, find/update by providerMessageId, listConversationsPage, countConversations, listRecentMessageActivities)
- modules/customers/db/customers.ts (getCustomerIdAndDealershipByPrimaryPhone, getCustomerIdAndDealershipByPrimaryEmail)
- modules/customers/service/activity.ts (logMessageSent options, logInboundMessage, updateMessageDeliveryStatus)
- modules/customers/service/index.ts (export inbox)
- modules/integrations/service/sms.ts (pass providerMessageId, provider, deliveryStatus to logMessageSent)
- modules/customers/ui/components/NextActionsCard.tsx (customerId prop, “Open Conversation” link)
- modules/customers/ui/CustomerDetailContent.tsx (pass customerId to NextActionsCard)
- components/app-shell/sidebar.tsx (Inbox nav item with MessageSquare)

---

## 8. Known risks / follow-up

- **Migration:** Run `npx prisma migrate deploy` (or apply migration in test DB) so CustomerActivity has provider_message_id, delivery_status, provider. Until then, activity tests that create rows will fail.
- **SendGrid signature:** Inbound Parse signature verification not implemented; add when SendGrid signing is configured (raw body required).
- **Unread indicator:** Spec mentioned unread; not implemented (no read/unread state on messages).
- **Twilio status URL:** Configure Twilio message creation to set statusCallback to POST /api/webhooks/twilio/status so delivery status updates are received (optional; outbound already stores SID).

---

*End of report.*
