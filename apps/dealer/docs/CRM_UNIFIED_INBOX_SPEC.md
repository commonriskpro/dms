# CRM Unified Inbox Spec

Single spec for evolving the current CRM inbox into a standardized omni-channel inbox for all current and future integrations. This document is architecture-first. It defines the domain model, ingestion pipeline, outbound pipeline, UI contract, rollout phases, and migration strategy. No application code, tests, or migrations are included in this document.

---

## 1. Problem statement

The current inbox is a thin queue over `CustomerActivity`:

- inbound and outbound `sms_sent` / `email_sent` activities are used as the only message source
- one inbox row is derived from the latest message activity per customer
- only `sms` and `email` are currently supported
- provider-specific inbound flows resolve a customer, then append timeline activity

That is enough for Twilio SMS and SendGrid email, but it is not sufficient for a unified inbox that must also support:

- WhatsApp
- Facebook Messenger
- Instagram DMs / Meta lead messaging
- future channels such as web chat, marketplace leads, and additional messaging providers

The main architectural limitation is that `CustomerActivity` is currently being used as both:

1. the CRM timeline/audit stream
2. the source of truth for messaging conversations

For a true omni-channel inbox, messaging needs its own normalized domain model. Timeline activity should become a downstream projection, not the primary message store.

---

## 2. Product goal

Create one standardized inbox for all customer-facing integrations.

The inbox should become the single operational surface for:

- inbound message triage
- outbound replies
- ownership and handoff
- conversation context
- opportunity context
- next-action execution

The rep workflow should stay the same regardless of channel:

- pick a conversation
- understand customer and opportunity context
- reply or take action
- log/update the next commitment

Channel-specific behavior must be normalized behind one shared inbox model.

---

## 3. Current-state repo summary

### Existing inbound/outbound channels

- SMS outbound: `apps/dealer/modules/integrations/service/sms.ts`
- Email outbound: `apps/dealer/modules/integrations/service/email.ts`
- Twilio inbound webhook: `apps/dealer/app/api/webhooks/twilio/route.ts`
- SendGrid inbound webhook: `apps/dealer/app/api/webhooks/sendgrid/route.ts`
- provider normalization helpers: `apps/dealer/modules/integrations/service/webhooks.ts`

### Existing inbox read path

- inbox API: `apps/dealer/app/api/crm/inbox/conversations/route.ts`
- inbox service: `apps/dealer/modules/customers/service/inbox.ts`
- message activity store: `apps/dealer/modules/customers/service/activity.ts`
- conversation SQL aggregation: `apps/dealer/modules/customers/db/activity.ts`
- inbox UI: `apps/dealer/app/(app)/crm/inbox/InboxPageClient.tsx`

### Current data model behavior

- message events are persisted as `CustomerActivity`
- activity types are `sms_sent` and `email_sent`
- channel and direction live inside activity metadata
- latest conversation per customer is derived via SQL over `CustomerActivity`

This means the system currently has:

- no durable conversation/thread table
- no durable message table
- no participant identity abstraction beyond customer primary phone/email lookup
- no provider-agnostic message lifecycle model

---

## 4. Target architecture

### Core principle

The inbox becomes a first-class communications system with its own storage model.

`CustomerActivity` remains important, but only as:

- a CRM timeline projection
- a compliance/audit event surface
- a summary surface for customer detail and reporting

It should no longer be the source of truth for inbox conversations.

### Architecture layers

1. Channel adapters
- provider-specific inbound webhooks and outbound sender implementations
- examples: Twilio SMS, SendGrid email, WhatsApp Business, Meta Messenger, Instagram DM

2. Inbox normalization layer
- converts provider payloads into normalized conversation/message commands
- resolves dealership, customer, and routing context

3. Unified inbox domain
- stores conversations, participants, messages, message events, attachments, and delivery state
- exposes channel-agnostic APIs to CRM UI

4. CRM projections
- customer timeline activity
- queue metrics and dashboard signals
- opportunity/ownership summaries

---

## 5. Domain model

### New top-level entities

#### InboxConversation

One logical thread in the unified inbox.

Suggested fields:

- `id`
- `dealershipId`
- `customerId` nullable initially, then backfilled/resolved
- `opportunityId` nullable
- `primaryChannel`
- `providerThreadId` nullable
- `status` (`OPEN`, `SNOOZED`, `CLOSED`, `SPAM`, `ARCHIVED`)
- `routingStatus` (`UNASSIGNED`, `ASSIGNED`, `ESCALATED`)
- `assignedToUserId` nullable
- `lastMessageAt`
- `lastInboundAt` nullable
- `lastOutboundAt` nullable
- `waitingOn` (`CUSTOMER`, `TEAM`, `NONE`)
- `subject` nullable
- `previewText`
- `createdAt`
- `updatedAt`
- `deletedAt` nullable

Notes:

- one customer may have multiple conversations
- conversation identity is provider-thread aware, not only customer-based
- a customer should not be the unique key for a conversation

#### InboxParticipant

Represents participants in a conversation.

Suggested fields:

- `id`
- `conversationId`
- `role` (`CUSTOMER`, `REP`, `SYSTEM`, `EXTERNAL_PARTICIPANT`)
- `displayName` nullable
- `externalHandle` nullable
- `email` nullable
- `phone` nullable
- `providerUserId` nullable
- `isPrimary`
- `createdAt`

This supports channels where the participant is not just a phone or email.

#### InboxMessage

One normalized inbound or outbound message.

Suggested fields:

- `id`
- `dealershipId`
- `conversationId`
- `customerId` nullable
- `channel`
- `direction` (`INBOUND`, `OUTBOUND`)
- `messageType` (`TEXT`, `MEDIA`, `SYSTEM`, `LEAD`, `STATUS_UPDATE`)
- `provider`
- `providerMessageId` nullable
- `providerThreadId` nullable
- `senderParticipantId` nullable
- `textBody` nullable
- `bodyPreview`
- `normalizedPayloadJson`
- `sentAt` nullable
- `receivedAt` nullable
- `createdAt`
- `deletedAt` nullable

Notes:

- `normalizedPayloadJson` stores provider-safe normalized metadata, not raw secrets
- raw provider payloads can be stored separately if compliance requires it

#### InboxMessageAttachment

Suggested fields:

- `id`
- `messageId`
- `fileObjectId`
- `mimeType`
- `filename`
- `sizeBytes`
- `attachmentType`
- `createdAt`

#### InboxMessageEvent

Delivery and lifecycle events.

Suggested fields:

- `id`
- `messageId`
- `eventType` (`QUEUED`, `SENT`, `DELIVERED`, `READ`, `FAILED`, `BOUNCED`, `CLICKED`, `OPENED`, `REPLIED`)
- `provider`
- `providerEventId` nullable
- `metadataJson`
- `occurredAt`
- `createdAt`

This keeps message state changes out of the main message row.

#### InboxChannelAccount

Per-dealership configured channel endpoint/account.

Suggested fields:

- `id`
- `dealershipId`
- `channel`
- `provider`
- `externalAccountId`
- `displayName`
- `status` (`ACTIVE`, `PAUSED`, `DISCONNECTED`)
- `configJson`
- `createdAt`
- `updatedAt`

This is the control plane for connected integrations.

---

## 6. Channel enum and capability model

### Channel enum

Recommended normalized channel enum:

- `sms`
- `email`
- `whatsapp`
- `facebook_messenger`
- `instagram_dm`
- `web_chat`
- `marketplace_lead`
- `system`

### Capability model

Each channel/account should declare capabilities, for example:

- `canReply`
- `canSendOutbound`
- `supportsAttachments`
- `supportsReadReceipts`
- `supportsTypingIndicators`
- `supportsTemplates`
- `supportsIdentityResolutionByPhone`
- `supportsIdentityResolutionByEmail`
- `supportsIdentityResolutionByProviderUserId`

The UI should render one normalized composer, then gate features by channel capability.

---

## 7. Inbound pipeline

### Standard flow

1. Provider webhook hits a channel-specific endpoint
2. Signature verification and provider auth validation run
3. Payload is normalized into an internal inbound event
4. Dealership/channel account is resolved
5. Customer is resolved or a pending identity record is created
6. Conversation is found or created
7. Message is stored
8. Message events are stored if applicable
9. CRM projections update:
   - customer timeline activity
   - inbox queue metrics
   - opportunity context refresh
10. automation hooks may run

### Identity resolution

Identity resolution should be explicit and layered:

1. exact provider thread binding
2. provider user id
3. exact phone
4. exact email
5. fuzzy/manual resolution queue

Do not rely only on customer primary phone/email for all channels. That is too brittle once Messenger, Instagram, and WhatsApp are added.

### Unresolved inbound messages

The system must support inbound messages before customer resolution.

Recommended behavior:

- create `InboxConversation` with no `customerId`
- mark conversation `routingStatus=UNASSIGNED`
- show it in an `Unresolved` queue or inbox filter
- allow manual match/create-customer workflow

This is required for social and messaging channels where identity may be partial.

---

## 8. Outbound pipeline

### Standard flow

1. CRM user replies from unified inbox
2. UI submits a normalized outbound message command
3. channel capability and permissions are validated
4. sender account is selected
5. provider-specific adapter sends outbound message
6. normalized `InboxMessage` is created
7. initial `InboxMessageEvent` entries are created (`QUEUED`, `SENT`)
8. later provider callbacks update lifecycle events
9. timeline projection updates customer activity

### Outbound API should not be channel-fragmented in the UI

Current model:

- `/api/messages/sms`
- `/api/messages/email`

Target model:

- `/api/crm/inbox/conversations/[id]/messages`

Body includes:

- `channel`
- `text`
- `attachments`
- optional `templateId`
- optional `replyToMessageId`

Provider-specific dispatch stays internal to the service layer.

---

## 9. CRM projection strategy

### Customer timeline

The timeline should continue to show:

- inbound and outbound communication
- calls
- appointments
- callbacks
- notes

But communication timeline entries should now be projections from `InboxMessage`, not direct authoring against `CustomerActivity`.

### Projection rules

For each inbound/outbound message:

- append a `CustomerActivity` projection with safe metadata:
  - `channel`
  - `direction`
  - `preview`
  - `provider`
- never store raw body, phone, or email in insecure audit metadata

This preserves current customer detail and reporting behavior while decoupling inbox storage from timeline storage.

---

## 10. API plan

### Read APIs

- `GET /api/crm/inbox/conversations`
  - list unified conversations with filters
- `GET /api/crm/inbox/conversations/[id]`
  - get conversation header and context
- `GET /api/crm/inbox/conversations/[id]/messages`
  - message list with pagination
- `GET /api/crm/inbox/accounts`
  - channel account availability/capabilities

### Write APIs

- `POST /api/crm/inbox/conversations/[id]/messages`
  - send/reply outbound message
- `PATCH /api/crm/inbox/conversations/[id]`
  - assign owner, link customer, link opportunity, change status
- `POST /api/crm/inbox/conversations/[id]/resolve-customer`
  - attach or create customer for unresolved thread
- `POST /api/crm/inbox/conversations/[id]/next-action`
  - optional helper for fast workflow updates

### Admin/integration APIs

- `POST /api/integrations/meta/webhooks/...`
- `POST /api/integrations/whatsapp/webhooks/...`
- `POST /api/integrations/instagram/webhooks/...`
- `GET/POST /api/integrations/channel-accounts`

### Query/filter requirements

Conversation list should support:

- `channel`
- `status`
- `waitingOn`
- `assignedTo`
- `customerResolved`
- `hasOpportunity`
- `search`
- `date range`
- `priority`

---

## 11. UI plan

### Keep the current inbox page as the standardized workspace

Current structure is directionally correct:

- queue left
- conversation center
- context rail right

That should remain.

### Required UI changes

#### Queue

Add per-conversation metadata:

- channel badge/icon
- unread count
- waiting state
- assignment state
- unresolved identity indicator
- last message preview

#### Conversation surface

Replace the current placeholder with a true message thread:

- inbound and outbound bubbles
- attachment rendering
- system events inline where useful
- send state / failure state
- composer that adapts by channel capability

#### Context rail

Keep:

- customer context
- active opportunity
- next action block

Add:

- channel metadata
- identity resolution controls for unresolved threads
- linked lead/ad source if applicable

### Cross-channel behavior

One inbox, one queue, one thread experience.

The channel should change:

- badge/icon
- allowed composer actions
- delivery/read indicators
- attachment constraints

It should not change the overall CRM workflow.

---

## 12. Security and tenant isolation

### Tenant isolation

- dealership/account ownership must be resolved server-side
- provider webhooks must never trust dealership ids from request bodies
- conversation/message queries must always scope by dealership

### Verification

- Twilio signature validation remains required
- SendGrid signature verification should be added
- Meta webhook verification and app secret validation must be required
- WhatsApp webhook verification must be required

### PII handling

- raw inbound payloads should be minimized or encrypted if stored
- previews may be stored for fast queue rendering
- sensitive metadata should not leak into audit logs
- existing customer activity safety rules should remain

---

## 13. Permissions

Recommended permissions:

- `crm.read`
  - read inbox queue, conversation, customer context
- `crm.write`
  - send/reply, assign, link opportunity, update next step
- `integrations.read`
  - view channel account health
- `integrations.write`
  - configure channel accounts and webhook settings

Do not create per-channel CRM permissions initially unless product explicitly requires them.

---

## 14. Migration strategy

### Phase 0: preserve existing SMS/email behavior

Do not break current:

- Twilio outbound/inbound
- SendGrid outbound/inbound
- customer timeline
- inbox page routing

### Phase 1: add unified inbox storage

Introduce new inbox tables while keeping existing `CustomerActivity` projections alive.

### Phase 2: dual-write SMS/email

For SMS/email:

- write canonical inbox message/conversation data
- continue projecting to `CustomerActivity`
- shift inbox reads to new inbox tables

### Phase 3: add unresolved thread support

Support conversations without a resolved customer.

### Phase 4: add WhatsApp

Best first new channel because it maps closest to SMS-style workflows.

### Phase 5: add Facebook Messenger and Instagram DM

Use the same normalized message + conversation pipeline.

### Phase 6: deprecate inbox reads from `CustomerActivity`

At this point:

- inbox queue comes entirely from unified inbox tables
- customer timeline remains a projection surface only

---

## 15. Rollout order

1. Spec approval
2. Schema for unified inbox domain
3. Read/write service layer and projection layer
4. Dual-write migration for SMS/email
5. Inbox UI switched to unified read APIs
6. Unresolved identity flow
7. WhatsApp integration
8. Facebook Messenger integration
9. Instagram DM integration
10. Reporting, automation hooks, dashboard metrics expansion

---

## 16. Acceptance criteria

### Architecture

- inbox no longer depends on `CustomerActivity` as source of truth
- new conversations/messages are stored in normalized inbox tables
- `CustomerActivity` is a projection for CRM timeline/reporting

### Product

- one inbox can show SMS, email, WhatsApp, Messenger, and Instagram threads
- reps can work multiple channels in one standardized UI
- unresolved inbound threads can be manually matched to customers
- opportunity/customer context remains visible from the inbox

### Reliability

- inbound webhook replay does not duplicate messages
- outbound send failures are visible in conversation state
- provider callbacks update message event state safely

### Security

- webhook verification is required for supported providers
- all inbox reads/writes are tenant-scoped
- no raw PII leakage into audit metadata

---

## 17. Implementation notes for this repo

### Why not keep building on `CustomerActivity`

Because the current design only supports:

- one latest-thread row per customer
- no first-class thread identity
- no unresolved identity state
- no attachment/message event model
- no provider-thread lifecycle

That will become fragile immediately with Meta channels and WhatsApp.

### Best repo-level approach

- keep `modules/customers/service/activity.ts` as the CRM projection layer
- create a new inbox domain, likely under:
  - `modules/crm-inbox/db`
  - `modules/crm-inbox/service`
  - `app/api/crm/inbox/...`
- move provider normalization into channel adapters that write to the new inbox domain
- keep the existing inbox page route, but rewire its data source incrementally

---

## Summary

The current inbox is the correct product surface, but the wrong storage model for a universal inbox.

To make it the standardized inbox for all integrations:

- add a normalized inbox domain with conversations, participants, messages, attachments, and message events
- treat provider webhooks and outbound sending as channel adapters
- keep `CustomerActivity` as a projection, not the message source of truth
- migrate SMS/email first with dual-write
- then add WhatsApp, Facebook Messenger, and Instagram on top of the same normalized architecture

That gives the dealership one CRM inbox instead of many disconnected communication surfaces.
