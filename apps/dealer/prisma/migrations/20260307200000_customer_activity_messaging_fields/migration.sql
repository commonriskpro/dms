-- AlterTable
ALTER TABLE "CustomerActivity" ADD COLUMN IF NOT EXISTS "provider_message_id" VARCHAR(256),
ADD COLUMN IF NOT EXISTS "delivery_status" VARCHAR(32),
ADD COLUMN IF NOT EXISTS "provider" VARCHAR(32);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerActivity_dealership_id_provider_message_id_idx" ON "CustomerActivity"("dealership_id", "provider_message_id");
