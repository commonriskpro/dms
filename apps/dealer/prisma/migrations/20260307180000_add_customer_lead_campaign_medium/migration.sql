-- AlterTable
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lead_campaign" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lead_medium" TEXT;
