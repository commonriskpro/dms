-- AlterTable
ALTER TABLE "applications" ADD COLUMN "dealership_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "applications_dealership_id_key" ON "applications"("dealership_id");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "platform_dealerships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
