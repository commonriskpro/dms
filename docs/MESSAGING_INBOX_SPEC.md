# Messaging Inbox — Inbound Messaging + Conversation Inbox Spec

**Sprint:** Inbound Messaging + Conversation Inbox  
**Goal:** Complete the messaging system with inbound webhooks, conversation threading, and delivery status tracking.

---

## 1. Repo inspection summary

### 1.1 Timeline / activity system

- **CustomerActivity** (Prisma): `id`, `dealershipId`, `customerId`, `activityType`, `entityType`, `entityId`, `metadata` (Json), `actorId`, `createdAt`. Indexes: `dealershipId`, `(dealershipId, customerId, createdAt)`, `(customerId, createdAt)`.
- **modules/customers/db/activity.ts**: `appendActivity()`, `listActivity()`, `countActivitiesByTypeToday()`.
- **modules/customers/service/activity.ts**: `listActivity`, `createActivity`, `logSmsSent`, `logMessageSent` (direction, contentPreview, channel in metadata), `logAppointmentScheduled`, `logCall`. Allowed activity types: `sms_sent`, `email_sent`, `appointment_scheduled`, `disposition_set`, `task_created`, `call`.
- **modules/customers/db/timeline.ts**: Aggregates CustomerNote, CustomerActivity, CustomerCallback into `TimelineEvent[]`; merge-sort by `createdAt` desc. Maps `sms_sent`/`email_sent` to timeline type via `ACTIVITY_TYPE_TO_TIMELINE` (→ `SYSTEM`). `payloadJson` includes metadata (direction, contentPreview, channel).
- **modules/customers/service/timeline.ts**: `listTimeline(dealershipId, customerId, options)` — tenant + customer check, then timeline db.
- **GET /api/customers/[id]/timeline**: `guardPermission(ctx, "customers.read")`, query params `limit`, `offset`, `type`.

### 1.2 Customer lookup patterns

- **modules/customers/db/customers.ts**: `getCustomerById(dealershipId, id)`, `listCustomers`, `searchCustomersByTerm` (name, any phone, any email). Phones/emails: `CustomerPhone`, `CustomerEmail` with `value`, `isPrimary`. Indexes: `(dealership_id, value)` on both.
- **No existing** “find customer by primary phone” or “find customer by primary email”. Required for inbound: resolve customer from webhook From (phone) or from/to (email). Plan: add `getCustomerIdByPrimaryPhone(dealershipId, normalizedPhone)` and `getCustomerIdByPrimaryEmail(dealershipId, normalizedEmail)` in customers db; return `customerId | null`. Tenant comes from customer row.

### 1.3 Integration modules

- **modules/integrations/service/sms.ts**: `sendSmsMessage(dealershipId, customerId, phone, message, userId)` — Twilio send, then `activityService.logMessageSent(..., "sms_sent", { direction: "outbound", contentPreview, channel: "sms" })`. Returns `{ activityId }`.
- **modules/integrations/service/email.ts**: `sendEmailMessage(..., subject, body, ...)` — SendGrid send, then `logMessageSent(..., "email_sent", { direction: "outbound", contentPreview, channel: "email" })`.
- No webhook handling today. New: **modules/integrations/webhooks** (or under integrations): Twilio/SendGrid inbound + status handlers.

### 1.4 RBAC usage

- **lib/api/handler.ts**: `getAuthContext(request)`, `guardPermission(ctx, "permission.key")`. Messages: `crm.write` for send (POST /api/messages/sms, email); timeline read: `customers.read`.
- **MODULE_REGISTRY**: `/api/customers/*` → customers.read/write; `/api/crm/*` → crm.read/write. Inbox and conversation UI will need `customers.read` (view) and `crm.write` (send). Webhooks are unauthenticated; tenant resolved from customer lookup only.

### 1.5 Webhook patterns

- No existing webhook routes in repo. Twilio/SendGrid docs: validate signature before processing. Twilio: `X-Twilio-Signature`, URL + body, validate with `twilio.validateRequest(authToken, signature, url, params)`. SendGrid Inbound Parse: signature/timestamp headers; verify with raw body (buffer).

---

## 2. Architecture overview

- **Inbound**: Twilio/SendGrid POST to `/api/webhooks/twilio` and `/api/webhooks/sendgrid`. Verify signature → parse payload → resolve customer by primary phone/email → append CustomerActivity (sms_sent/email_sent, direction=inbound, contentPreview truncated, providerMessageId). No auth; tenant = customer’s dealershipId.
- **Status**: POST `/api/webhooks/twilio/status` for Twilio status callbacks; validate signature → find activity by providerMessageId → update deliveryStatus in metadata (or column).
- **Inbox UI**: Server-first page `/crm/inbox`; list “conversations” (customers with recent SMS/email activity), thread view per customer (reuse timeline), composer (reuse SmsDialog/EmailDialog). Customer detail: “Open Conversation” → `/crm/inbox?customerId=...`.

---

## 3. Data model

### 3.1 Reuse existing

- **CustomerActivity** for all message events. Types: `sms_sent`, `email_sent`. Metadata convention (existing): `direction`, `contentPreview` (≤80 chars), `channel` (`sms` | `email`). No full body, phone, or email in metadata.

### 3.2 New/optional columns (CustomerActivity)

For delivery status and status-callback lookup add optional columns (migration):

- `provider_message_id` String? @map("provider_message_id") — Twilio SID / SendGrid message id; unique per dealership for lookup.
- `delivery_status` String? @map("delivery_status") — e.g. `queued`, `sent`, `delivered`, `failed`.
- `provider` String? — e.g. `twilio`, `sendgrid`.

Direction and channel remain in metadata. If we defer migration, store `providerMessageId` and `deliveryStatus` in metadata and find by JSON path for status callback (less efficient; acceptable for MVP).

### 3.3 Enums (application-level)

- **MessageChannel**: `sms` | `email`
- **MessageDirection**: `inbound` | `outbound`
- **DeliveryStatus**: `queued` | `sent` | `delivered` | `failed`

Stored in metadata and (where added) in `delivery_status` column.

---

## 4. API design

### 4.1 Webhooks (no auth; signature-only)

| Method | Path | Purpose |
|--------|------|--------|
| POST | /api/webhooks/twilio | Inbound SMS (Twilio) |
| POST | /api/webhooks/twilio/status | Twilio delivery status callback |
| POST | /api/webhooks/sendgrid | Inbound email (SendGrid Inbound Parse) |

- All return 200 on success (Twilio/SendGrid expect 2xx). On validation/signature failure: 401/400, no body or minimal.
- Tenant never from query/body; always from resolved customer (or no customer → ignore, return 200).

### 4.2 Inbox (authenticated)

| Method | Path | Purpose | Permission |
|--------|------|--------|------------|
| GET | /api/crm/inbox/conversations | List conversations (customers with message activity, last message, unread hint) | customers.read |
| GET | /api/customers/[id]/timeline | Existing; thread messages | customers.read |
| POST | /api/messages/sms | Existing; send SMS | crm.write |
| POST | /api/messages/email | Existing; send email | crm.write |

Optional: GET /api/crm/inbox/conversations?customerId= for pre-selecting one conversation.

---

## 5. Service layer plan

### 5.1 modules/integrations/webhooks (or integrations/service/webhooks)

- **handleInboundSms(parsedBody, signature, url)**: Verify Twilio signature; parse From, Body, MessageSid; normalize phone; getCustomerIdByPrimaryPhone(dealershipId) — but we don’t have dealershipId from webhook. So: must look up customer across tenants by primary phone (or single-tenant if Twilio number is per-dealership). Decision: one Twilio number per dealership → we need to map Twilio “To” number to dealershipId (e.g. env or table). Simpler MVP: **single dealership** from env (e.g. WEBHOOK_DEALERSHIP_ID) or **map To number → dealership**. Alternatively: find CustomerPhone by value (any dealership), then use that customer’s dealershipId. Prefer: **find customer by primary phone globally** (customer.phones where value=normalized and isPrimary), then use customer.dealershipId. That allows one webhook URL for all tenants if phone is unique across tenants; if not unique, take one (e.g. first). Document as “first match by primary phone” for MVP.
- **handleInboundEmail(parsedBody, rawBody, headers)**: Verify SendGrid signature if configured; parse to/from/body; find customer by primary email (same global lookup by email); append activity with direction=inbound.
- **handleTwilioStatusCallback(parsedBody, signature, url)**: Verify signature; MessageSid, MessageStatus; find activity by providerMessageId (or metadata); update deliveryStatus.

### 5.2 Customer resolution (customers db)

- **getCustomerByPrimaryPhone(dealershipId, normalizedPhone)**: Return customer id if CustomerPhone with value=normalizedPhone and isPrimary exists for a customer in that dealership. For webhook: we don’t have dealershipId — so **getCustomerIdAndDealershipByPrimaryPhone(normalizedPhone)** returning `{ customerId, dealershipId } | null` (first match by primary phone across tenants). Or restrict by configured “webhook dealership” to stay multi-tenant safe. Safer: **getCustomerIdByPrimaryPhone(dealershipId, phone)** and require dealership from Twilio “To” mapping. Spec: **Resolve by primary phone within a dealership.** So we need To number → dealershipId. Config: TWILIO_PHONE_NUMBER is per-dealer or shared; if shared, we need a table TwilioNumber -> dealershipId. Simplest: **one webhook URL per dealership** (e.g. path includes dealership id with signed token) or **single-tenant webhook** (WEBHOOK_DEALERSHIP_ID). Spec says “tenant resolution must come from customer lookup” — so lookup customer by phone; that customer’s dealershipId is the tenant. So: **getCustomerIdAndDealershipByPrimaryPhone(normalizedPhone)** that returns first customer (any tenant) with that primary phone. Risk: same phone in two tenants → ambiguity. Acceptable for MVP; document.
- **getCustomerIdAndDealershipByPrimaryEmail(normalizedEmail)**: Same for email.

Implement in customers db: `getCustomerIdAndDealershipByPrimaryPhone(phone)`, `getCustomerIdAndDealershipByPrimaryEmail(email)` returning `{ customerId, dealershipId } | null`. Query: customer with a primary phone/email matching the normalized value; return that customer’s id and dealershipId. If multiple tenants share the same phone/email, first match is used (acceptable for MVP). Used only by webhooks; tenant comes from customer record, not from request.

### 5.3 Activity creation (inbound)

- Reuse `activityService.logMessageSent` extended for inbound: **logInboundMessage(dealershipId, customerId, activityType, { direction: "inbound", contentPreview, channel, providerMessageId?, provider? })**. Or add `logMessageReceived` that doesn’t require userId (actorId null). Append CustomerActivity with actorId=null, metadata: direction, contentPreview, channel, providerMessageId, provider, deliveryStatus (optional). Customers activity service: add **appendInboundMessage** or extend appendActivity and call from webhook handler (customers service must not be called with untrusted dealershipId — webhook handler resolves dealership from customer, then calls customers.service with that resolved dealershipId).

---

## 6. UI plan

### 6.1 Page: /crm/inbox

- Server-first; list conversations (customers with recent sms_sent/email_sent activity). Components: **ConversationList**, **ConversationThread**, **MessageComposer**.
- **ConversationList**: Customer name, last message preview, timestamp, unread indicator (optional MVP: no unread yet). Click → select conversation, show thread.
- **ConversationThread**: Timeline of SMS/email for selected customer (reuse timeline aggregation; filter or show only message types). Reuse existing timeline API GET /api/customers/[id]/timeline.
- **MessageComposer**: Send SMS / Send Email. Reuse SmsDialog/EmailDialog logic (primary phone/email, submit to POST /api/messages/sms and /api/messages/email).

### 6.2 Customer detail

- Add “Open Conversation” button linking to `/crm/inbox?customerId=<id>`.

### 6.3 UI rules

- shadcn/ui only; existing dashboard layout; loading, empty, error states.

---

## 7. RBAC matrix

| Action | Permission |
|--------|------------|
| GET /api/crm/inbox/conversations | customers.read |
| GET /api/customers/[id]/timeline | customers.read |
| POST /api/messages/sms, /api/messages/email | crm.write |
| Webhooks (Twilio, SendGrid) | None (signature only) |

---

## 8. Security notes

- **Webhooks**: Validate provider signature before any processing. Never trust payload without verification. Tenant (dealershipId) only from customer lookup (phone/email → customer → dealershipId).
- **No PII in logs**: No full body, phone, or email in audit or app logs; contentPreview truncated (e.g. 80 chars).
- **Inbox**: All data scoped by getAuthContext → dealershipId; guardPermission(customers.read / crm.write).

---

## 9. Acceptance criteria

- [ ] POST /api/webhooks/twilio: valid signature + body → resolve customer by primary phone → create timeline activity (sms_sent, inbound, contentPreview); else 200 no-op or 401.
- [ ] POST /api/webhooks/twilio/status: valid signature → update message delivery status by provider SID.
- [ ] POST /api/webhooks/sendgrid: valid signature (if enabled) + parse body → resolve customer by primary email → create timeline activity (email_sent, inbound); else 200 no-op or 401.
- [ ] GET /api/crm/inbox/conversations: returns paginated list of conversations (customer, last message, time); RBAC customers.read.
- [ ] /crm/inbox page: ConversationList, ConversationThread, MessageComposer; loading/empty/error; open conversation by customerId query.
- [ ] Customer detail: “Open Conversation” → /crm/inbox?customerId=.
- [ ] Jest: webhook signature verification, customer resolution, activity creation, delivery status update, RBAC for inbox.

---

*End of spec. Proceed to STEP 2 Backend.*
