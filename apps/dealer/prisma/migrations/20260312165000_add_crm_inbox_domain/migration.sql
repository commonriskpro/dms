CREATE TYPE "InboxChannel" AS ENUM (
  'SMS',
  'EMAIL',
  'WHATSAPP',
  'FACEBOOK_MESSENGER',
  'INSTAGRAM_DM',
  'WEB_CHAT',
  'MARKETPLACE_LEAD',
  'SYSTEM'
);

CREATE TYPE "InboxConversationStatus" AS ENUM (
  'OPEN',
  'SNOOZED',
  'CLOSED',
  'ARCHIVED',
  'SPAM'
);

CREATE TYPE "InboxRoutingStatus" AS ENUM (
  'UNASSIGNED',
  'ASSIGNED',
  'ESCALATED'
);

CREATE TYPE "InboxWaitingOn" AS ENUM (
  'NONE',
  'CUSTOMER',
  'TEAM'
);

CREATE TYPE "InboxMessageDirection" AS ENUM (
  'INBOUND',
  'OUTBOUND'
);

CREATE TYPE "InboxMessageType" AS ENUM (
  'TEXT',
  'MEDIA',
  'SYSTEM',
  'LEAD',
  'STATUS_UPDATE'
);

CREATE TYPE "InboxParticipantRole" AS ENUM (
  'CUSTOMER',
  'REP',
  'SYSTEM',
  'EXTERNAL_PARTICIPANT'
);

CREATE TYPE "InboxMessageEventType" AS ENUM (
  'QUEUED',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
  'BOUNCED',
  'OPENED',
  'CLICKED',
  'REPLIED'
);

CREATE TYPE "InboxChannelAccountStatus" AS ENUM (
  'ACTIVE',
  'PAUSED',
  'DISCONNECTED'
);

CREATE TABLE "InboxConversation" (
  "id" UUID NOT NULL,
  "dealership_id" UUID NOT NULL,
  "customer_id" UUID,
  "opportunity_id" UUID,
  "channel" "InboxChannel" NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "provider_thread_id" VARCHAR(256),
  "external_subject" VARCHAR(512),
  "status" "InboxConversationStatus" NOT NULL DEFAULT 'OPEN',
  "routing_status" "InboxRoutingStatus" NOT NULL DEFAULT 'UNASSIGNED',
  "waiting_on" "InboxWaitingOn" NOT NULL DEFAULT 'NONE',
  "assigned_to_user_id" UUID,
  "preview_text" VARCHAR(512),
  "unread_count" INTEGER NOT NULL DEFAULT 0,
  "last_message_at" TIMESTAMP(3),
  "last_inbound_at" TIMESTAMP(3),
  "last_outbound_at" TIMESTAMP(3),
  "last_message_id" UUID,
  "is_resolved" BOOLEAN NOT NULL DEFAULT true,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "InboxConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InboxParticipant" (
  "id" UUID NOT NULL,
  "dealership_id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "role" "InboxParticipantRole" NOT NULL,
  "display_name" VARCHAR(256),
  "external_handle" VARCHAR(256),
  "email" VARCHAR(256),
  "phone" VARCHAR(64),
  "provider_user_id" VARCHAR(256),
  "customer_id" UUID,
  "profile_id" UUID,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InboxParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InboxMessage" (
  "id" UUID NOT NULL,
  "dealership_id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "customer_id" UUID,
  "channel" "InboxChannel" NOT NULL,
  "direction" "InboxMessageDirection" NOT NULL,
  "message_type" "InboxMessageType" NOT NULL DEFAULT 'TEXT',
  "provider" VARCHAR(64) NOT NULL,
  "provider_message_id" VARCHAR(256),
  "provider_thread_id" VARCHAR(256),
  "sender_participant_id" UUID,
  "text_body" TEXT,
  "body_preview" VARCHAR(512),
  "normalized_payload_json" JSONB,
  "sent_at" TIMESTAMP(3),
  "received_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InboxMessageAttachment" (
  "id" UUID NOT NULL,
  "dealership_id" UUID NOT NULL,
  "message_id" UUID NOT NULL,
  "file_object_id" UUID NOT NULL,
  "mime_type" VARCHAR(256),
  "filename" VARCHAR(512),
  "size_bytes" BIGINT,
  "attachment_type" VARCHAR(64),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InboxMessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InboxMessageEvent" (
  "id" UUID NOT NULL,
  "dealership_id" UUID NOT NULL,
  "message_id" UUID NOT NULL,
  "event_type" "InboxMessageEventType" NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "provider_event_id" VARCHAR(256),
  "metadata_json" JSONB,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InboxMessageEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InboxChannelAccount" (
  "id" UUID NOT NULL,
  "dealership_id" UUID NOT NULL,
  "channel" "InboxChannel" NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "external_account_id" VARCHAR(256) NOT NULL,
  "display_name" VARCHAR(256),
  "status" "InboxChannelAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "capabilities_json" JSONB,
  "config_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InboxChannelAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InboxConversation_dealership_id_provider_provider_thread_id_key"
ON "InboxConversation"("dealership_id", "provider", "provider_thread_id");

CREATE INDEX "InboxConversation_dealership_id_idx" ON "InboxConversation"("dealership_id");
CREATE INDEX "InboxConversation_dealership_id_status_idx" ON "InboxConversation"("dealership_id", "status");
CREATE INDEX "InboxConversation_dealership_id_routing_status_idx" ON "InboxConversation"("dealership_id", "routing_status");
CREATE INDEX "InboxConversation_dealership_id_waiting_on_idx" ON "InboxConversation"("dealership_id", "waiting_on");
CREATE INDEX "InboxConversation_dealership_id_customer_id_idx" ON "InboxConversation"("dealership_id", "customer_id");
CREATE INDEX "InboxConversation_dealership_id_opportunity_id_idx" ON "InboxConversation"("dealership_id", "opportunity_id");
CREATE INDEX "InboxConversation_dealership_id_assigned_to_user_id_idx" ON "InboxConversation"("dealership_id", "assigned_to_user_id");
CREATE INDEX "InboxConversation_dealership_id_channel_status_idx" ON "InboxConversation"("dealership_id", "channel", "status");
CREATE INDEX "InboxConversation_dealership_id_last_message_at_idx" ON "InboxConversation"("dealership_id", "last_message_at");
CREATE INDEX "InboxConversation_dealership_id_is_resolved_idx" ON "InboxConversation"("dealership_id", "is_resolved");

CREATE INDEX "InboxParticipant_dealership_id_idx" ON "InboxParticipant"("dealership_id");
CREATE INDEX "InboxParticipant_conversation_id_idx" ON "InboxParticipant"("conversation_id");
CREATE INDEX "InboxParticipant_dealership_id_customer_id_idx" ON "InboxParticipant"("dealership_id", "customer_id");
CREATE INDEX "InboxParticipant_dealership_id_profile_id_idx" ON "InboxParticipant"("dealership_id", "profile_id");
CREATE INDEX "InboxParticipant_dealership_id_provider_user_id_idx" ON "InboxParticipant"("dealership_id", "provider_user_id");
CREATE INDEX "InboxParticipant_dealership_id_email_idx" ON "InboxParticipant"("dealership_id", "email");
CREATE INDEX "InboxParticipant_dealership_id_phone_idx" ON "InboxParticipant"("dealership_id", "phone");

CREATE INDEX "InboxMessage_dealership_id_idx" ON "InboxMessage"("dealership_id");
CREATE INDEX "InboxMessage_conversation_id_created_at_idx" ON "InboxMessage"("conversation_id", "created_at");
CREATE INDEX "InboxMessage_dealership_id_customer_id_created_at_idx" ON "InboxMessage"("dealership_id", "customer_id", "created_at");
CREATE INDEX "InboxMessage_dealership_id_provider_provider_message_id_idx" ON "InboxMessage"("dealership_id", "provider", "provider_message_id");
CREATE INDEX "InboxMessage_dealership_id_channel_direction_created_at_idx" ON "InboxMessage"("dealership_id", "channel", "direction", "created_at");

CREATE INDEX "InboxMessageAttachment_dealership_id_idx" ON "InboxMessageAttachment"("dealership_id");
CREATE INDEX "InboxMessageAttachment_message_id_idx" ON "InboxMessageAttachment"("message_id");
CREATE INDEX "InboxMessageAttachment_file_object_id_idx" ON "InboxMessageAttachment"("file_object_id");

CREATE INDEX "InboxMessageEvent_dealership_id_idx" ON "InboxMessageEvent"("dealership_id");
CREATE INDEX "InboxMessageEvent_message_id_occurred_at_idx" ON "InboxMessageEvent"("message_id", "occurred_at");
CREATE INDEX "InboxMessageEvent_dealership_id_provider_provider_event_id_idx" ON "InboxMessageEvent"("dealership_id", "provider", "provider_event_id");

CREATE INDEX "InboxChannelAccount_dealership_id_idx" ON "InboxChannelAccount"("dealership_id");
CREATE INDEX "InboxChannelAccount_dealership_id_channel_status_idx" ON "InboxChannelAccount"("dealership_id", "channel", "status");
CREATE UNIQUE INDEX "InboxChannelAccount_dealership_id_provider_external_account_id_key"
ON "InboxChannelAccount"("dealership_id", "provider", "external_account_id");

ALTER TABLE "InboxConversation"
  ADD CONSTRAINT "InboxConversation_dealership_id_fkey"
  FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxConversation"
  ADD CONSTRAINT "InboxConversation_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InboxConversation"
  ADD CONSTRAINT "InboxConversation_opportunity_id_fkey"
  FOREIGN KEY ("opportunity_id") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InboxConversation"
  ADD CONSTRAINT "InboxConversation_assigned_to_user_id_fkey"
  FOREIGN KEY ("assigned_to_user_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InboxParticipant"
  ADD CONSTRAINT "InboxParticipant_dealership_id_fkey"
  FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxParticipant"
  ADD CONSTRAINT "InboxParticipant_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "InboxConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxParticipant"
  ADD CONSTRAINT "InboxParticipant_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InboxParticipant"
  ADD CONSTRAINT "InboxParticipant_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InboxMessage"
  ADD CONSTRAINT "InboxMessage_dealership_id_fkey"
  FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxMessage"
  ADD CONSTRAINT "InboxMessage_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "InboxConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxMessage"
  ADD CONSTRAINT "InboxMessage_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InboxMessage"
  ADD CONSTRAINT "InboxMessage_sender_participant_id_fkey"
  FOREIGN KEY ("sender_participant_id") REFERENCES "InboxParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InboxMessageAttachment"
  ADD CONSTRAINT "InboxMessageAttachment_dealership_id_fkey"
  FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxMessageAttachment"
  ADD CONSTRAINT "InboxMessageAttachment_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "InboxMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxMessageAttachment"
  ADD CONSTRAINT "InboxMessageAttachment_file_object_id_fkey"
  FOREIGN KEY ("file_object_id") REFERENCES "FileObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InboxMessageEvent"
  ADD CONSTRAINT "InboxMessageEvent_dealership_id_fkey"
  FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxMessageEvent"
  ADD CONSTRAINT "InboxMessageEvent_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "InboxMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InboxChannelAccount"
  ADD CONSTRAINT "InboxChannelAccount_dealership_id_fkey"
  FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
