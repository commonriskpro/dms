# CRM Unified Inbox Implementation Spec

Implementation-facing follow-up to [CRM_UNIFIED_INBOX_SPEC.md](/Users/saturno/Downloads/dms/apps/dealer/docs/CRM_UNIFIED_INBOX_SPEC.md). This document translates the architecture into concrete Prisma models, enums, API slices, migration phases, and repo placement for the dealer app.

No code, tests, or migrations are included here. This is the execution spec that should drive the first implementation pass.

---

## 1. Implementation objective

Introduce a first-class inbox domain for all dealership communications while preserving the current SMS/email behavior during migration.

Key rule:

- `InboxConversation` and `InboxMessage` become the source of truth
- `CustomerActivity` remains a projection for customer timeline and audit-friendly CRM surfaces

This implementation must not break:

- Twilio SMS inbound/outbound
- SendGrid email inbound/outbound
- current `/crm/inbox` route
- customer timeline and command-center conversation surfaces

---

## 2. Prisma schema plan

### 2.1 New enums

Add these enums to `apps/dealer/prisma/schema.prisma`.

#### InboxChannel

```prisma
enum InboxChannel {
  SMS
  EMAIL
  WHATSAPP
  FACEBOOK_MESSENGER
  INSTAGRAM_DM
  WEB_CHAT
  MARKETPLACE_LEAD
  SYSTEM
}
```

#### InboxConversationStatus

```prisma
enum InboxConversationStatus {
  OPEN
  SNOOZED
  CLOSED
  ARCHIVED
  SPAM
}
```

#### InboxRoutingStatus

```prisma
enum InboxRoutingStatus {
  UNASSIGNED
  ASSIGNED
  ESCALATED
}
```

#### InboxWaitingOn

```prisma
enum InboxWaitingOn {
  NONE
  CUSTOMER
  TEAM
}
```

#### InboxMessageDirection

```prisma
enum InboxMessageDirection {
  INBOUND
  OUTBOUND
}
```

#### InboxMessageType

```prisma
enum InboxMessageType {
  TEXT
  MEDIA
  SYSTEM
  LEAD
  STATUS_UPDATE
}
```

#### InboxParticipantRole

```prisma
enum InboxParticipantRole {
  CUSTOMER
  REP
  SYSTEM
  EXTERNAL_PARTICIPANT
}
```

#### InboxMessageEventType

```prisma
enum InboxMessageEventType {
  QUEUED
  SENT
  DELIVERED
  READ
  FAILED
  BOUNCED
  OPENED
  CLICKED
  REPLIED
}
```

#### InboxChannelAccountStatus

```prisma
enum InboxChannelAccountStatus {
  ACTIVE
  PAUSED
  DISCONNECTED
}
```

### 2.2 New models

#### InboxConversation

```prisma
model InboxConversation {
  id                String                  @id @default(uuid()) @db.Uuid
  dealershipId      String                  @map("dealership_id") @db.Uuid
  customerId        String?                 @map("customer_id") @db.Uuid
  opportunityId     String?                 @map("opportunity_id") @db.Uuid
  channel           InboxChannel
  provider          String                  @db.VarChar(64)
  providerThreadId  String?                 @map("provider_thread_id") @db.VarChar(256)
  externalSubject   String?                 @map("external_subject") @db.VarChar(512)
  status            InboxConversationStatus @default(OPEN)
  routingStatus     InboxRoutingStatus      @default(UNASSIGNED) @map("routing_status")
  waitingOn         InboxWaitingOn          @default(NONE) @map("waiting_on")
  assignedToUserId  String?                 @map("assigned_to_user_id") @db.Uuid
  previewText       String?                 @map("preview_text") @db.VarChar(512)
  unreadCount       Int                     @default(0) @map("unread_count")
  lastMessageAt     DateTime?               @map("last_message_at")
  lastInboundAt     DateTime?               @map("last_inbound_at")
  lastOutboundAt    DateTime?               @map("last_outbound_at")
  lastMessageId     String?                 @map("last_message_id") @db.Uuid
  isResolved        Boolean                 @default(true) @map("is_resolved")
  metadataJson      Json?                   @map("metadata_json")
  createdAt         DateTime                @default(now()) @map("created_at")
  updatedAt         DateTime                @updatedAt @map("updated_at")
  deletedAt         DateTime?               @map("deleted_at")

  dealership        Dealership              @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  customer          Customer?               @relation(fields: [customerId], references: [id], onDelete: SetNull)
  opportunity       Opportunity?            @relation(fields: [opportunityId], references: [id], onDelete: SetNull)
  assignedTo        Profile?                @relation("InboxConversationAssignedTo", fields: [assignedToUserId], references: [id], onDelete: SetNull)
  participants      InboxParticipant[]
  messages          InboxMessage[]

  @@index([dealershipId])
  @@index([dealershipId, status])
  @@index([dealershipId, routingStatus])
  @@index([dealershipId, waitingOn])
  @@index([dealershipId, customerId])
  @@index([dealershipId, opportunityId])
  @@index([dealershipId, assignedToUserId])
  @@index([dealershipId, channel, status])
  @@index([dealershipId, lastMessageAt])
  @@index([dealershipId, isResolved])
  @@unique([dealershipId, provider, providerThreadId])
}
```

Notes:

- `providerThreadId` is nullable because SMS may initially not have a clean external thread id
- the composite unique should only be enforced when providerThreadId is present; implement with a partial unique index in SQL migration if Prisma cannot express the desired null behavior

#### InboxParticipant

```prisma
model InboxParticipant {
  id               String               @id @default(uuid()) @db.Uuid
  dealershipId     String               @map("dealership_id") @db.Uuid
  conversationId   String               @map("conversation_id") @db.Uuid
  role             InboxParticipantRole
  displayName      String?              @map("display_name") @db.VarChar(256)
  externalHandle   String?              @map("external_handle") @db.VarChar(256)
  email            String?              @db.VarChar(256)
  phone            String?              @db.VarChar(64)
  providerUserId   String?              @map("provider_user_id") @db.VarChar(256)
  customerId       String?              @map("customer_id") @db.Uuid
  profileId        String?              @map("profile_id") @db.Uuid
  isPrimary        Boolean              @default(false) @map("is_primary")
  createdAt        DateTime             @default(now()) @map("created_at")

  dealership       Dealership           @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  conversation     InboxConversation    @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  customer         Customer?            @relation(fields: [customerId], references: [id], onDelete: SetNull)
  profile          Profile?             @relation(fields: [profileId], references: [id], onDelete: SetNull)
  sentMessages     InboxMessage[]       @relation("InboxMessageSender")

  @@index([dealershipId])
  @@index([conversationId])
  @@index([dealershipId, customerId])
  @@index([dealershipId, profileId])
  @@index([dealershipId, providerUserId])
  @@index([dealershipId, email])
  @@index([dealershipId, phone])
}
```

#### InboxMessage

```prisma
model InboxMessage {
  id                String                @id @default(uuid()) @db.Uuid
  dealershipId      String                @map("dealership_id") @db.Uuid
  conversationId    String                @map("conversation_id") @db.Uuid
  customerId        String?               @map("customer_id") @db.Uuid
  channel           InboxChannel
  direction         InboxMessageDirection
  messageType       InboxMessageType      @default(TEXT) @map("message_type")
  provider          String                @db.VarChar(64)
  providerMessageId String?               @map("provider_message_id") @db.VarChar(256)
  providerThreadId  String?               @map("provider_thread_id") @db.VarChar(256)
  senderParticipantId String?             @map("sender_participant_id") @db.Uuid
  textBody          String?               @map("text_body") @db.Text
  bodyPreview       String?               @map("body_preview") @db.VarChar(512)
  normalizedPayloadJson Json?             @map("normalized_payload_json")
  sentAt            DateTime?             @map("sent_at")
  receivedAt        DateTime?             @map("received_at")
  createdAt         DateTime              @default(now()) @map("created_at")
  deletedAt         DateTime?             @map("deleted_at")

  dealership        Dealership            @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  conversation      InboxConversation     @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  customer          Customer?             @relation(fields: [customerId], references: [id], onDelete: SetNull)
  senderParticipant InboxParticipant?     @relation("InboxMessageSender", fields: [senderParticipantId], references: [id], onDelete: SetNull)
  attachments       InboxMessageAttachment[]
  events            InboxMessageEvent[]

  @@index([dealershipId])
  @@index([conversationId, createdAt])
  @@index([dealershipId, customerId, createdAt])
  @@index([dealershipId, provider, providerMessageId])
  @@index([dealershipId, channel, direction, createdAt])
}
```

#### InboxMessageAttachment

```prisma
model InboxMessageAttachment {
  id            String        @id @default(uuid()) @db.Uuid
  dealershipId  String        @map("dealership_id") @db.Uuid
  messageId     String        @map("message_id") @db.Uuid
  fileObjectId  String        @map("file_object_id") @db.Uuid
  mimeType      String?       @map("mime_type") @db.VarChar(256)
  filename      String?       @db.VarChar(512)
  sizeBytes     BigInt?       @map("size_bytes")
  attachmentType String?      @map("attachment_type") @db.VarChar(64)
  createdAt     DateTime      @default(now()) @map("created_at")

  dealership     Dealership   @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  message        InboxMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
  fileObject     FileObject   @relation(fields: [fileObjectId], references: [id], onDelete: Restrict)

  @@index([dealershipId])
  @@index([messageId])
  @@index([fileObjectId])
}
```

#### InboxMessageEvent

```prisma
model InboxMessageEvent {
  id              String                @id @default(uuid()) @db.Uuid
  dealershipId    String                @map("dealership_id") @db.Uuid
  messageId       String                @map("message_id") @db.Uuid
  eventType       InboxMessageEventType @map("event_type")
  provider        String                @db.VarChar(64)
  providerEventId String?               @map("provider_event_id") @db.VarChar(256)
  metadataJson    Json?                 @map("metadata_json")
  occurredAt      DateTime              @map("occurred_at")
  createdAt       DateTime              @default(now()) @map("created_at")

  dealership      Dealership            @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  message         InboxMessage          @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([dealershipId])
  @@index([messageId, occurredAt])
  @@index([dealershipId, provider, providerEventId])
}
```

#### InboxChannelAccount

```prisma
model InboxChannelAccount {
  id               String                   @id @default(uuid()) @db.Uuid
  dealershipId     String                   @map("dealership_id") @db.Uuid
  channel          InboxChannel
  provider         String                   @db.VarChar(64)
  externalAccountId String                  @map("external_account_id") @db.VarChar(256)
  displayName      String?                  @map("display_name") @db.VarChar(256)
  status           InboxChannelAccountStatus @default(ACTIVE)
  capabilitiesJson Json?                    @map("capabilities_json")
  configJson       Json?                    @map("config_json")
  createdAt        DateTime                 @default(now()) @map("created_at")
  updatedAt        DateTime                 @updatedAt @map("updated_at")

  dealership       Dealership               @relation(fields: [dealershipId], references: [id], onDelete: Cascade)

  @@index([dealershipId])
  @@index([dealershipId, channel, status])
  @@unique([dealershipId, provider, externalAccountId])
}
```

### 2.3 Changes to existing models

#### CustomerActivity

No schema removal in phase 1.

Keep:

- `providerMessageId`
- `deliveryStatus`
- `provider`

These remain useful for the transition window and timeline projections.

Possible optional later addition:

- `inboxMessageId String? @map("inbox_message_id") @db.Uuid`

That is not required for phase 1, but is recommended if timeline-to-message traceability becomes important.

#### Dealership

Add reverse relations:

- `inboxConversations InboxConversation[]`
- `inboxParticipants InboxParticipant[]`
- `inboxMessages InboxMessage[]`
- `inboxMessageAttachments InboxMessageAttachment[]`
- `inboxMessageEvents InboxMessageEvent[]`
- `inboxChannelAccounts InboxChannelAccount[]`

#### Customer

Add reverse relations:

- `inboxConversations InboxConversation[]`
- `inboxMessages InboxMessage[]`
- `inboxParticipants InboxParticipant[]`

#### Opportunity

Add reverse relation:

- `inboxConversations InboxConversation[]`

#### Profile

Add reverse relation:

- `assignedInboxConversations InboxConversation[] @relation("InboxConversationAssignedTo")`

---

## 3. Repo placement

### New module

Create a new domain under:

- `apps/dealer/modules/crm-inbox/db`
- `apps/dealer/modules/crm-inbox/service`
- `apps/dealer/modules/crm-inbox/ui`
- `apps/dealer/modules/crm-inbox/types.ts`

### Why a new module

Do not keep growing `modules/customers/service/inbox.ts` into a universal inbox layer.

Reason:

- current inbox is customer-activity derived
- new inbox is a distinct communications domain
- customer timeline stays in `modules/customers`
- message orchestration belongs in `modules/crm-inbox`

### Existing modules kept in place

- `modules/customers/service/activity.ts`
  - projection layer only
- `modules/integrations/service/sms.ts`
  - channel adapter for SMS outbound
- `modules/integrations/service/email.ts`
  - channel adapter for email outbound
- `modules/integrations/service/webhooks.ts`
  - temporary home for current SMS/email normalization until channel adapters are refactored into inbox-specific handlers

---

## 4. API slice plan

### Slice A: canonical read model

#### `GET /api/crm/inbox/conversations`

Purpose:

- list conversations from `InboxConversation`

Query:

- `limit`
- `offset`
- `channel`
- `status`
- `waitingOn`
- `assignedTo`
- `resolved`
- `q`

Response:

- queue items with:
  - conversation id
  - customer id/name if resolved
  - preview text
  - last message at
  - channel
  - waitingOn
  - assigned user summary
  - unread count
  - conversation status

#### `GET /api/crm/inbox/conversations/[id]`

Purpose:

- load the conversation shell + context

Payload:

- conversation
- customer summary if linked
- opportunity summary if linked
- channel account / capabilities summary

#### `GET /api/crm/inbox/conversations/[id]/messages`

Purpose:

- paginated message thread

Response:

- messages
- sender participant
- attachments
- most recent message event summary

### Slice B: outbound messaging

#### `POST /api/crm/inbox/conversations/[id]/messages`

Purpose:

- unified outbound send/reply endpoint

Body:

- `text`
- `attachments?`
- `replyToMessageId?`

Server behavior:

- resolve conversation and channel
- select provider adapter
- send outbound
- persist `InboxMessage`
- persist `InboxMessageEvent`
- project to `CustomerActivity`

### Slice C: routing and resolution

#### `PATCH /api/crm/inbox/conversations/[id]`

Purpose:

- assign owner
- change conversation status
- link/unlink opportunity
- snooze/archive

Body fields:

- `assignedToUserId?`
- `status?`
- `opportunityId?`
- `waitingOn?`

#### `POST /api/crm/inbox/conversations/[id]/resolve-customer`

Purpose:

- attach unresolved conversation to an existing customer
- or create a new customer and attach

Body:

- either `customerId`
- or `createCustomer: { ... }`

### Slice D: channel account control plane

#### `GET /api/crm/inbox/accounts`

Purpose:

- load active channel accounts/capabilities for the current dealership

#### `POST /api/crm/inbox/accounts`

Purpose:

- create or connect a dealership channel account

This likely stays partially admin-facing and may later move under `/api/integrations`.

---

## 5. Service layer plan

### `modules/crm-inbox/service/conversations.ts`

Responsibilities:

- list conversations
- get conversation
- patch routing/status/opportunity
- recompute conversation aggregate fields

### `modules/crm-inbox/service/messages.ts`

Responsibilities:

- create inbound message
- create outbound message
- append attachments
- append message events
- project to customer timeline

### `modules/crm-inbox/service/identity.ts`

Responsibilities:

- resolve customer by provider thread
- resolve customer by provider user id
- resolve customer by phone/email
- create unresolved conversations
- resolve later via manual action

### `modules/crm-inbox/service/providers/*.ts`

Examples:

- `providers/twilio.ts`
- `providers/sendgrid.ts`
- `providers/whatsapp.ts`
- `providers/meta-messenger.ts`
- `providers/meta-instagram.ts`

Responsibilities:

- provider-specific payload parsing
- outbound sending
- signature verification
- channel capability metadata

### `modules/crm-inbox/service/projections.ts`

Responsibilities:

- project inbound/outbound messages into `CustomerActivity`
- update command-center derived metrics if needed

---

## 6. Migration plan

### Phase 1: schema only

Add the new inbox tables and relations.

No inbox UI read switch yet.

### Phase 2: dual-write SMS/email

For existing SMS/email flows:

- outbound send writes:
  - `InboxConversation`
  - `InboxParticipant`
  - `InboxMessage`
  - `InboxMessageEvent`
  - `CustomerActivity` projection
- inbound webhook writes:
  - same inbox domain records
  - same `CustomerActivity` projection

Current inbox can still read from `CustomerActivity` at this stage if necessary.

### Phase 3: switch inbox reads

Update:

- `modules/customers/service/inbox.ts`
- `/api/crm/inbox/conversations`
- `InboxPageClient`

to read from the new inbox domain instead of aggregating `CustomerActivity`.

At this point, rename/move the inbox read logic into `modules/crm-inbox/service`.

### Phase 4: unresolved inbox threads

Enable:

- inbound messages without customer match
- conversation queue for unresolved identity
- manual attach/create customer

### Phase 5: new channels

Recommended order:

1. WhatsApp
2. Facebook Messenger
3. Instagram DM

Reason:

- WhatsApp maps closest to existing SMS workflow
- Meta Messenger and Instagram can share more adapter infrastructure

### Phase 6: timeline decoupling cleanup

By this point:

- inbox is fully canonical on new tables
- `CustomerActivity` is projection-only
- any old inbox-specific SQL over `CustomerActivity` can be removed

---

## 7. Current route mapping during migration

### Existing route kept

- `/api/crm/inbox/conversations`

Initially:

- same path
- new backend implementation behind it

This avoids front-end route churn.

### Existing outbound routes

- `/api/messages/sms`
- `/api/messages/email`

Migration behavior:

- keep them during phase 2
- make them dual-write into inbox domain
- inbox page may continue to use them temporarily

Later:

- inbox UI should move to `POST /api/crm/inbox/conversations/[id]/messages`
- customer detail quick actions may still call convenience wrappers, but those wrappers should internally delegate to the unified message service

---

## 8. Required changes to current code

### Replace inbox aggregation dependency

Current dependency:

- `modules/customers/service/inbox.ts`
- `modules/customers/db/activity.ts:listConversationsPage`

Target:

- replace with `modules/crm-inbox/service/conversations.ts`
- deprecate SQL aggregation of latest message from `CustomerActivity`

### Keep activity projection methods

Current useful methods:

- `logMessageSent`
- `logInboundMessage`

These should remain, but they become downstream projections called by the new inbox domain service instead of primary persistence entry points.

### Webhook handler changes

Current:

- `handleInboundSms`
- `handleInboundEmail`

Target:

- these functions should write inbox messages first
- then call timeline projection helpers

### Command center implications

Current command center includes conversations from the old inbox projection.

Target:

- command center should source conversation rows from the unified inbox service
- not from customer activity aggregation

---

## 9. Indexing and data access notes

### Critical indexes

These are required from day one:

- `InboxConversation(dealershipId, lastMessageAt)`
- `InboxConversation(dealershipId, status)`
- `InboxConversation(dealershipId, assignedToUserId)`
- `InboxConversation(dealershipId, channel, status)`
- `InboxMessage(conversationId, createdAt)`
- `InboxMessage(dealershipId, provider, providerMessageId)`
- `InboxParticipant(dealershipId, providerUserId)`
- `InboxParticipant(dealershipId, phone)`
- `InboxParticipant(dealershipId, email)`
- `InboxMessageEvent(messageId, occurredAt)`

### Thread identity note

For providers with thread ids:

- conversation lookup should use `(dealershipId, provider, providerThreadId)`

For providers without strong thread ids:

- create a derived conversation key at the channel adapter layer

Do not fall back to “one conversation per customer” globally.

---

## 10. API validation and RBAC

### Validation

All new routes should use Zod for:

- params
- query
- body

### Permissions

Use:

- `crm.read` for conversation read access
- `crm.write` for send/reply/assign/update

Use `integrations.read` / `integrations.write` if channel account management is exposed in dealer UI.

### Tenant isolation

Every query and mutation must scope by `dealershipId` from auth context only.

Webhook routes must derive tenant from:

- verified channel account mapping
- or resolved customer / configured channel account

Never trust dealership ids from webhook request bodies.

---

## 11. Test plan for implementation

### Schema and db integration

- create conversation/message/participant/event rows
- tenant isolation on all inbox tables
- provider message dedupe via provider ids

### Service tests

- inbound SMS creates conversation + message + activity projection
- inbound email creates conversation + message + activity projection
- outbound send creates message + sent event + activity projection
- unresolved inbound message creates unresolved conversation
- manual resolve attaches customer and updates queue state

### API tests

- list conversations with filters
- get conversation detail/messages
- send outbound reply
- assign conversation
- resolve customer

### Regression tests

- current `/crm/inbox` still works during migration
- current customer timeline still shows message activity
- current command-center due-now conversation items still work

### Provider tests

- Twilio signature verification path
- SendGrid inbound parse path
- WhatsApp adapter contract tests
- Meta Messenger / Instagram webhook normalization tests

---

## 12. Recommended first implementation milestone

The first safe milestone should be:

1. add schema
2. build `modules/crm-inbox/db` + `service`
3. dual-write SMS/email
4. switch only `/api/crm/inbox/conversations` to the new read model

Do not start with WhatsApp/Instagram first.

Reason:

- if SMS/email are not canonicalized first, every new channel will have to bridge two models
- this repo already has enough SMS/email plumbing to validate the architecture cheaply

---

## Summary

This repo should implement a new inbox domain, not stretch `CustomerActivity` further.

Concrete implementation direction:

- add `InboxConversation`, `InboxParticipant`, `InboxMessage`, `InboxMessageAttachment`, `InboxMessageEvent`, and `InboxChannelAccount`
- keep `CustomerActivity` as a projection surface
- dual-write current SMS/email flows first
- switch inbox reads to the new canonical store
- then add WhatsApp, Messenger, and Instagram on top of that shared model

That is the cleanest path to making `/crm/inbox` the standardized inbox for every future integration.
