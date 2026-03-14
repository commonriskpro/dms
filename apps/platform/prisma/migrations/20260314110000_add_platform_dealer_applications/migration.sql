-- CreateEnum
CREATE TYPE "PlatformDealerApplicationSource" AS ENUM ('invite', 'public_apply');

-- CreateEnum
CREATE TYPE "PlatformDealerApplicationStatus" AS ENUM ('draft', 'invited', 'submitted', 'under_review', 'approved', 'rejected', 'activation_sent', 'activated');

-- CreateTable
CREATE TABLE "platform_dealer_applications" (
    "id" UUID NOT NULL,
    "dealer_application_id" UUID NOT NULL,
    "source" "PlatformDealerApplicationSource" NOT NULL,
    "status" "PlatformDealerApplicationStatus" NOT NULL DEFAULT 'draft',
    "owner_email" TEXT NOT NULL,
    "dealer_invite_id" UUID,
    "invited_by_user_id" UUID,
    "dealer_dealership_id" UUID,
    "platform_application_id" UUID,
    "platform_dealership_id" UUID,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "activation_sent_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "reviewer_user_id" UUID,
    "review_notes" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_dealer_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_dealer_application_profiles" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "business_info" JSONB,
    "owner_info" JSONB,
    "primary_contact" JSONB,
    "additional_locations" JSONB,
    "pricing_package_interest" JSONB,
    "acknowledgments" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_dealer_application_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_api_jti" (
    "jti" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_api_jti_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_dealer_applications_dealer_application_id_key" ON "platform_dealer_applications"("dealer_application_id");

-- CreateIndex
CREATE INDEX "platform_dealer_applications_status_idx" ON "platform_dealer_applications"("status");

-- CreateIndex
CREATE INDEX "platform_dealer_applications_source_status_idx" ON "platform_dealer_applications"("source", "status");

-- CreateIndex
CREATE INDEX "platform_dealer_applications_owner_email_idx" ON "platform_dealer_applications"("owner_email");

-- CreateIndex
CREATE INDEX "platform_dealer_applications_platform_dealership_id_idx" ON "platform_dealer_applications"("platform_dealership_id");

-- CreateIndex
CREATE INDEX "platform_dealer_applications_dealer_dealership_id_idx" ON "platform_dealer_applications"("dealer_dealership_id");

-- CreateIndex
CREATE INDEX "platform_dealer_applications_submitted_at_idx" ON "platform_dealer_applications"("submitted_at");

-- CreateIndex
CREATE INDEX "platform_dealer_applications_created_at_idx" ON "platform_dealer_applications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_dealer_application_profiles_application_id_key" ON "platform_dealer_application_profiles"("application_id");

-- CreateIndex
CREATE INDEX "platform_dealer_application_profiles_application_id_idx" ON "platform_dealer_application_profiles"("application_id");

-- CreateIndex
CREATE INDEX "internal_api_jti_expires_at_idx" ON "internal_api_jti"("expires_at");

-- AddForeignKey
ALTER TABLE "platform_dealer_applications" ADD CONSTRAINT "platform_dealer_applications_platform_dealership_id_fkey" FOREIGN KEY ("platform_dealership_id") REFERENCES "platform_dealerships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_dealer_application_profiles" ADD CONSTRAINT "platform_dealer_application_profiles_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "platform_dealer_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
