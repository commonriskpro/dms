-- AlterTable
ALTER TABLE "Customer"
ADD COLUMN "is_draft" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Customer_dealership_id_is_draft_idx" ON "Customer"("dealership_id", "is_draft");
