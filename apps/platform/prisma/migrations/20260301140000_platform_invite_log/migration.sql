-- CreateTable
CREATE TABLE "platform_invite_logs" (
    "id" UUID NOT NULL,
    "recipient_hash" VARCHAR(64) NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_invite_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_invite_logs_recipient_hash_sent_at_idx" ON "platform_invite_logs"("recipient_hash", "sent_at");
