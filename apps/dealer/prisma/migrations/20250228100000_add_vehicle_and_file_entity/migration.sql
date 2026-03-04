-- Inventory: Vehicle model and FileObject entity link (entityType, entityId)
-- See docs/design/inventory-spec.md

-- AlterTable FileObject: add entity_type, entity_id
ALTER TABLE "FileObject" ADD COLUMN "entity_type" TEXT;
ALTER TABLE "FileObject" ADD COLUMN "entity_id" UUID;

-- CreateIndex for listing files by entity
CREATE INDEX "FileObject_dealership_id_bucket_entity_type_entity_id_idx" ON "FileObject"("dealership_id", "bucket", "entity_type", "entity_id");

-- CreateEnum VehicleStatus
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'PENDING', 'SOLD', 'WHOLESALE');

-- CreateTable Vehicle
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "vin" VARCHAR(17),
    "year" INTEGER,
    "make" TEXT,
    "model" TEXT,
    "trim" TEXT,
    "stock_number" TEXT NOT NULL,
    "mileage" INTEGER,
    "color" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "purchase_price" DECIMAL(12,2),
    "reconditioning_cost" DECIMAL(12,2),
    "other_costs" DECIMAL(12,2),
    "list_price" DECIMAL(12,2),
    "location_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex Vehicle
CREATE INDEX "Vehicle_dealership_id_idx" ON "Vehicle"("dealership_id");
CREATE INDEX "Vehicle_dealership_id_status_idx" ON "Vehicle"("dealership_id", "status");
CREATE INDEX "Vehicle_dealership_id_created_at_idx" ON "Vehicle"("dealership_id", "created_at");
CREATE INDEX "Vehicle_dealership_id_stock_number_idx" ON "Vehicle"("dealership_id", "stock_number");
CREATE INDEX "Vehicle_dealership_id_vin_idx" ON "Vehicle"("dealership_id", "vin");

-- AddForeignKey Vehicle
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "DealershipLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
