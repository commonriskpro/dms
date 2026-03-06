-- CreateEnum
CREATE TYPE "DealershipLifecycleStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- AlterTable
ALTER TABLE "Dealership" ADD COLUMN "platform_dealership_id" UUID,
ADD COLUMN "lifecycle_status" "DealershipLifecycleStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "ProvisioningIdempotency" (
    "idempotency_key" VARCHAR(255) NOT NULL,
    "platform_dealership_id" UUID NOT NULL,
    "dealer_dealership_id" UUID NOT NULL,
    "provisioned_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProvisioningIdempotency_pkey" PRIMARY KEY ("idempotency_key")
);

-- CreateTable
CREATE TABLE "InternalApiJti" (
    "jti" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalApiJti_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dealership_platform_dealership_id_key" ON "Dealership"("platform_dealership_id");

-- CreateIndex
CREATE INDEX "ProvisioningIdempotency_platform_dealership_id_idx" ON "ProvisioningIdempotency"("platform_dealership_id");

-- CreateIndex
CREATE INDEX "InternalApiJti_expires_at_idx" ON "InternalApiJti"("expires_at");

-- AddForeignKey
ALTER TABLE "ProvisioningIdempotency" ADD CONSTRAINT "ProvisioningIdempotency_dealer_dealership_id_fkey" FOREIGN KEY ("dealer_dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
