# Messaging & Marketplace Integrations — STEP 1 Spec (Architect)

**Sprint:** Messaging & Marketplace Integrations  
**Goal:** Enable dealerships to communicate with leads (SMS, email) and publish inventory to external marketplaces.  
**Decision:** Create `modules/integrations` with submodules sms, email, marketplace. Reuse customers (activity, timeline) and inventory (vehicle, photos, listings). New API under `/api/messages/*` and `/api/inventory/feed`.

---

## 1. Architecture overview

### 1.1 Current state

- **Customers:** CustomerActivity (activityType, metadata, actorId); timeline merges notes, activities, callbacks. Stub logSmsSent() logs sms_sent with empty metadata. POST /api/customers/[id]/sms (customers.write) calls stub.
- **Inventory:** Vehicle, VehiclePhoto, VehicleListing; listings service (publish/unpublish). No feed API.
- **No** Twilio, SendGrid, or modules/integrations.

### 1.2 Target state

- **modules/integrations:** New module with `service/sms.ts` (sendSmsMessage), `service/email.ts` (sendEmailMessage), `service/marketplace.ts` (buildFeed). Optional `db/` only if new tables needed (none for MVP: messages are timeline activity).
- **Messages:** POST /api/messages/sms and POST /api/messages/email (crm.write). Each sends via provider (Twilio/SendGrid), then appends CustomerActivity with activityType sms_sent | email_sent and metadata { direction: "outbound", contentPreview: truncated } (no full body in logs). Phone/email from request body; customerId from body; dealershipId from session.
- **Timeline:** Extend timeline to include SMS and email with direction, timestamp, sender (actor), content preview. Reuse listTimeline; activity types sms_sent, email_sent; metadata shape for conversation thread.
- **Feed:** GET /api/inventory/feed?format=facebook|autotrader. Service builds payload from vehicles (with photos, VIN, price, description); cache by dealershipId + format; TTL e.g. 5–10 min.
- **Frontend:** Customer detail: conversation panel with send SMS and send email (can extend existing SmsDialog and add EmailDialog; optionally call new /api/messages/*). Inventory: marketplace publish status indicator.

### 1.3 Layer boundaries

- **API routes:** Thin; getAuthContext → guardPermission(crm.write) → Zod → integrations service + customers activity → jsonResponse.
- **Integrations service:** Calls Twilio/SendGrid APIs; then calls customers/service/activity (appendActivity) or a dedicated logMessage() that writes CustomerActivity. No direct Prisma from integrations to customers db; use customers service.
- **Feed:** API route → inventory service (list vehicles with photos/listings) + integrations/marketplace (format payload) → cache → response. Or feed builder in inventory module if preferred; spec uses integrations/marketplace for format-specific logic.

---

## 2. Data model changes

### 2.1 No new Prisma models

- Messages are stored as **CustomerActivity** rows: activityType "sms_sent" | "email_sent", metadata JSON with direction, contentPreview (truncated), optional channel (sms|email). ActorId = userId who sent. No separate Message table for MVP.

### 2.2 CustomerActivity metadata shape (convention)

- **sms_sent / email_sent:**  
  `{ direction: "outbound" | "inbound", contentPreview?: string (max 80 chars), channel?: "sms" | "email" }`  
  Do not store full body, phone number, or email address in metadata (audit/log safety). Optional externalId (provider message SID) for idempotency or support.

### 2.3 Indexes

- Existing CustomerActivity indexes (dealershipId, customerId, createdAt) suffice. No new tables/indexes.

---

## 3. API endpoints

### 3.1 POST /api/messages/sms

- **Purpose:** Send SMS to a customer via Twilio and log to timeline.
- **Body (Zod):** customerId (UUID), phone (E.164 string), message (string, max length per Twilio).
- **Auth:** getAuthContext; guardPermission(ctx, "crm.write").
- **Logic:** Resolve customer in dealership (customers.getCustomer); validate phone; call integrations sendSmsMessage(dealershipId, customerId, phone, message, ctx.userId); return 201 { data: { activityId, success: true } } or provider error as 502/503.
- **Response:** 201 { data: { activityId: string, success: true } }. Errors: 400 validation, 403 crm.write, 404 customer not found, 502/503 provider failure.

### 3.2 POST /api/messages/email

- **Purpose:** Send email to a customer via SendGrid and log to timeline.
- **Body (Zod):** customerId (UUID), email (string), subject (string), body (string, reasonable max).
- **Auth:** getAuthContext; guardPermission(ctx, "crm.write").
- **Logic:** Resolve customer in dealership; call sendEmailMessage(dealershipId, customerId, email, subject, body, ctx.userId); return 201 { data: { activityId, success: true } }.
- **Response:** Same shape as SMS. No PII in logs.

### 3.3 GET /api/inventory/feed

- **Purpose:** Return inventory feed for marketplace (Facebook, AutoTrader-compatible).
- **Query:** format=facebook | autotrader (required); optional limit (default 100, max 500).
- **Auth:** getAuthContext; guardPermission(ctx, "inventory.read") (or inventory.feed.read if added later).
- **Logic:** Check cache (key: dealershipId + format); on miss build feed via marketplace service (list published vehicles with photos, price, VIN, description); cache TTL 5–10 min; return JSON.
- **Response:** 200 with feed payload (array of items). Format-specific shape (Facebook Marketplace vs AutoTrader JSON). Include vehicle id, price, photos (URLs), VIN, description.

---

## 4. Service-layer logic

### 4.1 modules/integrations/service/sms.ts — sendSmsMessage()

- **Inputs:** dealershipId, customerId, phone (E.164), message, userId.
- **Steps:**  
  1. Validate customer in dealership (call customers.service getCustomer; NOT_FOUND if wrong tenant).  
  2. Call Twilio API to send SMS (from env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER).  
  3. On success: append CustomerActivity via customers.service or activity.appendActivity(dealershipId, customerId, "sms_sent", "Customer", customerId, { direction: "outbound", contentPreview: message.slice(0, 80) }, userId).  
  4. Return { activityId }. On Twilio failure throw or return error; do not log message body.
- **Dependencies:** Twilio client (install twilio); customers service or activity db (prefer customers.service wrapper that calls appendActivity so no cross-module db).

### 4.2 modules/integrations/service/email.ts — sendEmailMessage()

- **Inputs:** dealershipId, customerId, email, subject, body, userId.
- **Steps:**  
  1. Validate customer in dealership.  
  2. Call SendGrid API (env: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL).  
  3. On success: append CustomerActivity activityType "email_sent", metadata { direction: "outbound", contentPreview: subject or body.slice(0, 80) }.  
  4. Return { activityId }. No PII in logs.
- **Dependencies:** @sendgrid/mail or similar; customers activity service.

### 4.3 modules/integrations/service/marketplace.ts — buildFeed()

- **Inputs:** dealershipId, format: "facebook" | "autotrader", options?: { limit }.
- **Steps:**  
  1. List vehicles for dealership that are published/listable (use inventory service or db: list vehicles with listing status; include photos, VIN, price, description).  
  2. Map to format-specific JSON (Facebook Marketplace schema vs AutoTrader-compatible).  
  3. Return serializable payload. No new tables; read-only from Vehicle, VehiclePhoto, VehicleListing (and Dealership for name if needed).
- **Dependencies:** inventory service (list vehicles with photos) or inventory db reads. Prefer service to avoid cross-module db; if inventory exposes listForFeed(dealershipId, limit) use that.

### 4.4 Customers activity

- **Extend allowed activity types:** Add "email_sent" alongside "sms_sent". Ensure appendActivity accepts metadata with direction and contentPreview. Audit: do not put message content in audit metadata.
- **Timeline:** In customers/db/timeline.ts map email_sent to a timeline type (e.g. SYSTEM or new type EMAIL). Expose in payloadJson: direction, contentPreview, sender (from actor). Same for sms_sent. Frontend can show as conversation thread.

---

## 5. UI plan

### 5.1 Customer detail — conversation panel

- **Location:** Existing customer detail (DetailPage) already has TimelineCard and SmsDialog.
- **Conversation panel:** Option A: Add a “Conversation” or “Messages” section that shows timeline filtered or labeled for SMS/email (direction, timestamp, sender, content preview). Option B: Use existing timeline and ensure SMS/email activities render with direction and preview.
- **Send SMS:** Either keep existing POST /api/customers/[id]/sms and enhance it to call Twilio (then log with preview), or add new “Send SMS” that calls POST /api/messages/sms with customerId, phone (from customer primary phone), message. Prefer new endpoint for clarity; optionally deprecate old stub or make it delegate to messages/sms.
- **Send email:** Add “Send email” button/dialog; form: to (prefill customer primary email), subject, body; submit POST /api/messages/email. Use design tokens; loading/error/empty states.

### 5.2 Inventory page — marketplace publish status

- **Location:** Inventory list or vehicle card/detail.
- **Indicator:** Show that a vehicle is “in marketplace feed” or “Listed on Facebook / AutoTrader” (or “Included in feed”). Can be a badge or small label. Data: from feed inclusion (vehicles that appear in feed) or from VehicleListing / listing status. If no listing status per channel, derive from “published” or “in feed” (feed builder decides which vehicles are included). Simple MVP: “In marketplace feed” when vehicle is published/listable.

### 5.3 Design

- Use existing enterprise layout, PageShell, design tokens (globals.css, lib/ui/tokens). No new UI system. Forms: existing patterns; tables: existing.

---

## 6. RBAC matrix

| Action | Permission |
|--------|------------|
| POST /api/messages/sms | crm.write |
| POST /api/messages/email | crm.write |
| GET /api/inventory/feed | inventory.read |
| GET /api/customers/[id]/timeline (messages) | customers.read |
| Customer conversation panel (send SMS/email) | crm.write (show send) + customers.read (view timeline) |

---

## 7. Audit events

| Event | When | Metadata (no PII) |
|-------|------|-------------------|
| message.sms_sent | After Twilio send + activity logged | customerId, activityId |
| message.email_sent | After SendGrid send + activity logged | customerId, activityId |

Do not include message body, phone, or email in audit metadata.

---

## 8. Security considerations

- Tenant isolation: every operation scoped by dealershipId from auth. Cross-tenant customerId → NOT_FOUND.
- RBAC: crm.write for sending messages; inventory.read for feed.
- Sensitive data: no message content, phone, or email in logs or audit. contentPreview truncated (e.g. 80 chars).
- Provider keys: Twilio/SendGrid secrets in env only; never in client or logs.

---

## 9. Acceptance criteria

### Feature set A — SMS

- [ ] sendSmsMessage(dealershipId, customerId, phone, message, userId) sends via Twilio and logs CustomerActivity (sms_sent, direction outbound, contentPreview truncated).
- [ ] POST /api/messages/sms with valid body returns 201 and message is sent and visible on timeline.
- [ ] Tenant isolation and crm.write enforced; no PII in audit/logs.

### Feature set B — Email

- [ ] sendEmailMessage(dealershipId, customerId, email, subject, body, userId) sends via SendGrid and logs CustomerActivity (email_sent, direction outbound, contentPreview).
- [ ] POST /api/messages/email with valid body returns 201 and email sent and visible on timeline.
- [ ] Same security as SMS.

### Feature set C — Conversation thread

- [ ] Customer timeline includes SMS and email activities with direction, timestamp, sender (actor), content preview.
- [ ] Existing listTimeline reused; activity types sms_sent, email_sent mapped; payloadJson includes direction, contentPreview.

### Feature set D — Marketplace feed

- [ ] GET /api/inventory/feed?format=facebook|autotrader returns JSON feed with vehicle, price, photos, VIN, description.
- [ ] Feed response cached by dealershipId + format; TTL configured.
- [ ] Pagination or limit (e.g. max 500) to avoid huge payloads.

### Frontend

- [ ] Customer detail: send SMS and send email (conversation panel or dialogs); messages appear in timeline.
- [ ] Inventory: marketplace publish status indicator (e.g. “In feed” or “Listed”).

### Testing

- [ ] Jest: SMS service (mock Twilio), email service (mock SendGrid), timeline message entries, feed generation (mock inventory). Tenant isolation tests for messages and feed.

---

## 10. Deferred / out of scope

- Inbound webhooks (Twilio/SendGrid inbound): can be added later; store as inbound with direction "inbound".
- Additional feed formats beyond Facebook and AutoTrader.
- Per-channel listing status (e.g. “listed on Facebook” vs “AutoTrader”) if not required for MVP; single “in feed” flag may suffice.

---

*End of STEP 1 Spec. Proceed to STEP 2 Backend.*
