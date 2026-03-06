-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('PLATFORM_OWNER', 'PLATFORM_COMPLIANCE', 'PLATFORM_SUPPORT');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PlatformDealershipStatus" AS ENUM ('APPROVED', 'PROVISIONING', 'PROVISIONED', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateTable
CREATE TABLE "platform_users" (
    "id" UUID NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "legal_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT,
    "notes" TEXT,
    "review_notes" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_dealerships" (
    "id" UUID NOT NULL,
    "legal_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "plan_key" TEXT NOT NULL,
    "limits" JSONB DEFAULT '{}',
    "status" "PlatformDealershipStatus" NOT NULL DEFAULT 'APPROVED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_dealerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealership_mapping" (
    "id" UUID NOT NULL,
    "platform_dealership_id" UUID NOT NULL,
    "dealer_dealership_id" UUID NOT NULL,
    "provisioned_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealership_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_audit_logs" (
    "id" UUID NOT NULL,
    "actor_platform_user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID,
    "before_state" JSONB,
    "after_state" JSONB,
    "reason" TEXT,
    "request_id" VARCHAR(255),
    "idempotency_key" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- CreateIndex
CREATE INDEX "applications_created_at_idx" ON "applications"("created_at");

-- CreateIndex
CREATE INDEX "platform_dealerships_status_idx" ON "platform_dealerships"("status");

-- CreateIndex
CREATE UNIQUE INDEX "dealership_mapping_platform_dealership_id_key" ON "dealership_mapping"("platform_dealership_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealership_mapping_dealer_dealership_id_key" ON "dealership_mapping"("dealer_dealership_id");

-- CreateIndex
CREATE INDEX "platform_audit_logs_actor_platform_user_id_idx" ON "platform_audit_logs"("actor_platform_user_id");

-- CreateIndex
CREATE INDEX "platform_audit_logs_target_type_target_id_idx" ON "platform_audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "platform_audit_logs_created_at_idx" ON "platform_audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "dealership_mapping" ADD CONSTRAINT "dealership_mapping_platform_dealership_id_fkey" FOREIGN KEY ("platform_dealership_id") REFERENCES "platform_dealerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
