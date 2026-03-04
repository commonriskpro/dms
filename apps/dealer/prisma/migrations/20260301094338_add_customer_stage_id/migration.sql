-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "stage_id" UUID;

-- CreateIndex
CREATE INDEX "Customer_dealership_id_stage_id_idx" ON "Customer"("dealership_id", "stage_id");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
