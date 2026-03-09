-- CreateEnum
CREATE TYPE "VendorType" AS ENUM ('auction', 'transporter', 'repair', 'parts', 'detail', 'inspection', 'title_doc', 'other');

-- CreateTable
CREATE TABLE "vendor" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dealership_id" UUID NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "type" "VendorType" NOT NULL,
    "contact_name" VARCHAR(256),
    "phone" VARCHAR(64),
    "email" VARCHAR(256),
    "address" VARCHAR(512),
    "notes" VARCHAR(1000),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "vendor_pkey" PRIMARY KEY ("id")
);

-- AddColumn vehicle_cost_entry
ALTER TABLE "vehicle_cost_entry" ADD COLUMN "vendor_id" UUID;

-- CreateIndex
CREATE INDEX "vendor_dealership_id_idx" ON "vendor"("dealership_id");
CREATE INDEX "vendor_dealership_id_is_active_idx" ON "vendor"("dealership_id", "is_active");
CREATE INDEX "vendor_dealership_id_type_idx" ON "vendor"("dealership_id", "type");
CREATE INDEX "vendor_dealership_id_deleted_at_idx" ON "vendor"("dealership_id", "deleted_at");

CREATE INDEX "vehicle_cost_entry_vendor_id_idx" ON "vehicle_cost_entry"("vendor_id");

-- AddForeignKey
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicle_cost_entry" ADD CONSTRAINT "vehicle_cost_entry_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
