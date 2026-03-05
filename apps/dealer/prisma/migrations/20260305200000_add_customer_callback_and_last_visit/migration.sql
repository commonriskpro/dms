-- CreateEnum
CREATE TYPE "CustomerCallbackStatus" AS ENUM ('SCHEDULED', 'DONE', 'CANCELLED');

-- AlterTable: Customer last-visit fields
ALTER TABLE "Customer" ADD COLUMN "last_visit_at" TIMESTAMP(3),
ADD COLUMN "last_visit_by_user_id" UUID;

-- CreateTable: CustomerCallback
CREATE TABLE "CustomerCallback" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "callback_at" TIMESTAMP(3) NOT NULL,
    "status" "CustomerCallbackStatus" NOT NULL DEFAULT 'SCHEDULED',
    "reason" VARCHAR(2000),
    "assigned_to_user_id" UUID,
    "snoozed_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerCallback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_last_visit_at_idx" ON "Customer"("dealership_id", "last_visit_at");

-- CreateIndex
CREATE INDEX "CustomerCallback_dealership_id_idx" ON "CustomerCallback"("dealership_id");
CREATE INDEX "CustomerCallback_dealership_id_customer_id_idx" ON "CustomerCallback"("dealership_id", "customer_id");
CREATE INDEX "CustomerCallback_dealership_id_status_callback_at_idx" ON "CustomerCallback"("dealership_id", "status", "callback_at");
CREATE INDEX "CustomerCallback_customer_id_created_at_idx" ON "CustomerCallback"("customer_id", "created_at");

-- AddForeignKey
ALTER TABLE "CustomerCallback" ADD CONSTRAINT "CustomerCallback_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerCallback" ADD CONSTRAINT "CustomerCallback_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerCallback" ADD CONSTRAINT "CustomerCallback_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
