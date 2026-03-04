-- AlterTable
ALTER TABLE "platform_users" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "platform_users" ADD COLUMN "disabled_at" TIMESTAMP(3);
