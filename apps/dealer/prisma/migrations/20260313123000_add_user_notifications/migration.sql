-- CreateTable
CREATE TABLE "user_notifications" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "body" TEXT,
    "kind" VARCHAR(128) NOT NULL,
    "read_at" TIMESTAMP(3),
    "entity_type" VARCHAR(64),
    "entity_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_notifications_dealership_id_idx" ON "user_notifications"("dealership_id");

-- CreateIndex
CREATE INDEX "user_notifications_user_id_idx" ON "user_notifications"("user_id");

-- CreateIndex
CREATE INDEX "user_notifications_dealership_id_user_id_created_at_idx" ON "user_notifications"("dealership_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "user_notifications_dealership_id_user_id_read_at_idx" ON "user_notifications"("dealership_id", "user_id", "read_at");

-- CreateIndex
CREATE INDEX "user_notifications_dealership_id_deleted_at_created_at_idx" ON "user_notifications"("dealership_id", "deleted_at", "created_at");

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
