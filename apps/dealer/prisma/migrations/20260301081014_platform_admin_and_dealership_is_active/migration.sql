-- AlterTable
ALTER TABLE "Dealership" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PlatformAdmin" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAdmin_user_id_key" ON "PlatformAdmin"("user_id");

-- CreateIndex
CREATE INDEX "PlatformAdmin_user_id_idx" ON "PlatformAdmin"("user_id");

-- AddForeignKey
ALTER TABLE "PlatformAdmin" ADD CONSTRAINT "PlatformAdmin_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformAdmin" ADD CONSTRAINT "PlatformAdmin_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AutomationRun_dealership_id_entity_type_entity_id_event_key_rul" RENAME TO "AutomationRun_dealership_id_entity_type_entity_id_event_key_key";
