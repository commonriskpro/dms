-- Inventory Depth Sprint Slice A: VehiclePhoto join table for order + primary
CREATE TABLE "VehiclePhoto" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "file_object_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehiclePhoto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VehiclePhoto_dealership_id_vehicle_id_file_object_id_key" ON "VehiclePhoto"("dealership_id", "vehicle_id", "file_object_id");

CREATE UNIQUE INDEX "VehiclePhoto_file_object_id_key" ON "VehiclePhoto"("file_object_id");

CREATE INDEX "VehiclePhoto_dealership_id_idx" ON "VehiclePhoto"("dealership_id");

CREATE INDEX "VehiclePhoto_dealership_id_vehicle_id_idx" ON "VehiclePhoto"("dealership_id", "vehicle_id");

CREATE INDEX "VehiclePhoto_vehicle_id_idx" ON "VehiclePhoto"("vehicle_id");

ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_file_object_id_fkey" FOREIGN KEY ("file_object_id") REFERENCES "FileObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: create VehiclePhoto for existing inventory photos (one per vehicle, sortOrder by createdAt, first is primary)
INSERT INTO "VehiclePhoto" (id, dealership_id, vehicle_id, file_object_id, sort_order, is_primary, created_at)
SELECT
  gen_random_uuid(),
  f.dealership_id,
  f.entity_id,
  f.id,
  row_number() OVER (PARTITION BY f.dealership_id, f.entity_id ORDER BY f."createdAt" ASC) - 1,
  row_number() OVER (PARTITION BY f.dealership_id, f.entity_id ORDER BY f."createdAt" ASC) = 1,
  f."createdAt"
FROM "FileObject" f
WHERE f.bucket = 'inventory-photos'
  AND f.entity_type = 'Vehicle'
  AND f.entity_id IS NOT NULL
  AND f.deleted_at IS NULL
ON CONFLICT (dealership_id, vehicle_id, file_object_id) DO NOTHING;
