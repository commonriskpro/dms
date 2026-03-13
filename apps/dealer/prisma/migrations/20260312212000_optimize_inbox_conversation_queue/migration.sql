CREATE INDEX IF NOT EXISTS "inbox_conv_queue_idx"
  ON "InboxConversation" ("dealership_id", "deleted_at", "channel", "last_message_at" DESC);
