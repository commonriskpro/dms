-- CreateEnum
CREATE TYPE "VehicleCostCategory" AS ENUM ('acquisition', 'auction_fee', 'transport', 'title_fee', 'doc_fee', 'recon_parts', 'recon_labor', 'detail', 'inspection', 'storage', 'misc');

-- CreateEnum
CREATE TYPE "VehicleCostDocumentKind" AS ENUM ('invoice', 'receipt', 'bill_of_sale', 'title_doc', 'other');

-- CreateTable
CREATE TABLE "vehicle_cost_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dealership_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "category" "VehicleCostCategory" NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "vendor_name" VARCHAR(256),
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "memo" VARCHAR(500),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "vehicle_cost_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_cost_document" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dealership_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "cost_entry_id" UUID,
    "file_object_id" UUID NOT NULL,
    "kind" "VehicleCostDocumentKind" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,

    CONSTRAINT "vehicle_cost_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_cost_entry_dealership_id_idx" ON "vehicle_cost_entry"("dealership_id");

-- CreateIndex
CREATE INDEX "vehicle_cost_entry_dealership_id_vehicle_id_idx" ON "vehicle_cost_entry"("dealership_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_cost_entry_vehicle_id_idx" ON "vehicle_cost_entry"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_cost_entry_dealership_id_occurred_at_idx" ON "vehicle_cost_entry"("dealership_id", "occurred_at");

-- CreateIndex
CREATE INDEX "vehicle_cost_entry_dealership_id_vehicle_id_category_idx" ON "vehicle_cost_entry"("dealership_id", "vehicle_id", "category");

-- CreateIndex
CREATE INDEX "vehicle_cost_document_dealership_id_idx" ON "vehicle_cost_document"("dealership_id");

-- CreateIndex
CREATE INDEX "vehicle_cost_document_dealership_id_vehicle_id_idx" ON "vehicle_cost_document"("dealership_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_cost_document_vehicle_id_idx" ON "vehicle_cost_document"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_cost_document_cost_entry_id_idx" ON "vehicle_cost_document"("cost_entry_id");

-- AddForeignKey
ALTER TABLE "vehicle_cost_entry" ADD CONSTRAINT "vehicle_cost_entry_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_cost_entry" ADD CONSTRAINT "vehicle_cost_entry_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_cost_entry" ADD CONSTRAINT "vehicle_cost_entry_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_cost_entry" ADD CONSTRAINT "vehicle_cost_entry_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_cost_document" ADD CONSTRAINT "vehicle_cost_document_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_cost_document" ADD CONSTRAINT "vehicle_cost_document_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_cost_document" ADD CONSTRAINT "vehicle_cost_document_cost_entry_id_fkey" FOREIGN KEY ("cost_entry_id") REFERENCES "vehicle_cost_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_cost_document" ADD CONSTRAINT "vehicle_cost_document_file_object_id_fkey" FOREIGN KEY ("file_object_id") REFERENCES "FileObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_cost_document" ADD CONSTRAINT "vehicle_cost_document_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
