-- Inventory Depth Sprint Slice B: BulkImportJob for import progress
CREATE TYPE "BulkImportJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "BulkImportJob" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "status" "BulkImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "processed_rows" INTEGER NOT NULL DEFAULT 0,
    "errors_json" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "BulkImportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BulkImportJob_dealership_id_idx" ON "BulkImportJob"("dealership_id");

CREATE INDEX "BulkImportJob_dealership_id_created_at_idx" ON "BulkImportJob"("dealership_id", "created_at");

CREATE INDEX "BulkImportJob_dealership_id_status_idx" ON "BulkImportJob"("dealership_id", "status");

ALTER TABLE "BulkImportJob" ADD CONSTRAINT "BulkImportJob_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BulkImportJob" ADD CONSTRAINT "BulkImportJob_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
