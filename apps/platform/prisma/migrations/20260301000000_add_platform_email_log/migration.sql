-- CreateEnum
CREATE TYPE "PlatformEmailLogType" AS ENUM ('OWNER_INVITE');

-- CreateTable
CREATE TABLE "platform_email_logs" (
    "id" UUID NOT NULL,
    "platform_dealership_id" UUID NOT NULL,
    "type" "PlatformEmailLogType" NOT NULL,
    "recipient_hash" VARCHAR(64) NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "request_id" VARCHAR(255),

    CONSTRAINT "platform_email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_email_logs_platform_dealership_id_type_recipient_has_idx" ON "platform_email_logs"("platform_dealership_id", "type", "recipient_hash", "sent_at");
