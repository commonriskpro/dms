-- Inventory Depth Sprint Slice C: InventoryAlertDismissal for per-user dismiss/snooze
CREATE TYPE "InventoryAlertType" AS ENUM ('MISSING_PHOTOS', 'STALE', 'RECON_OVERDUE');

CREATE TYPE "InventoryAlertDismissalAction" AS ENUM ('DISMISSED', 'SNOOZED');

CREATE TABLE "InventoryAlertDismissal" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "alert_type" "InventoryAlertType" NOT NULL,
    "action" "InventoryAlertDismissalAction" NOT NULL,
    "snoozed_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAlertDismissal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryAlertDismissal_dealership_id_user_id_vehicle_id_alert_type_key" ON "InventoryAlertDismissal"("dealership_id", "user_id", "vehicle_id", "alert_type");

CREATE INDEX "InventoryAlertDismissal_dealership_id_idx" ON "InventoryAlertDismissal"("dealership_id");

CREATE INDEX "InventoryAlertDismissal_dealership_id_user_id_idx" ON "InventoryAlertDismissal"("dealership_id", "user_id");

CREATE INDEX "InventoryAlertDismissal_vehicle_id_idx" ON "InventoryAlertDismissal"("vehicle_id");

CREATE INDEX "InventoryAlertDismissal_dealership_id_alert_type_idx" ON "InventoryAlertDismissal"("dealership_id", "alert_type");

ALTER TABLE "InventoryAlertDismissal" ADD CONSTRAINT "InventoryAlertDismissal_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryAlertDismissal" ADD CONSTRAINT "InventoryAlertDismissal_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryAlertDismissal" ADD CONSTRAINT "InventoryAlertDismissal_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
