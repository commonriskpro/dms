-- CreateEnum
CREATE TYPE "DealerApplicationSource" AS ENUM ('invite', 'public_apply');

-- CreateEnum
CREATE TYPE "DealerApplicationStatus" AS ENUM ('draft', 'invited', 'submitted', 'under_review', 'approved', 'rejected', 'activation_sent', 'activated');

-- AlterTable DealershipInvite: add dealer_application_id
ALTER TABLE "DealershipInvite" ADD COLUMN IF NOT EXISTS "dealer_application_id" UUID;

-- CreateTable DealerApplication
CREATE TABLE "DealerApplication" (
    "id" UUID NOT NULL,
    "source" "DealerApplicationSource" NOT NULL,
    "status" "DealerApplicationStatus" NOT NULL DEFAULT 'draft',
    "invited_by_user_id" UUID,
    "invite_id" UUID,
    "owner_email" TEXT NOT NULL,
    "dealership_id" UUID,
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

    CONSTRAINT "DealerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable DealerApplicationProfile
CREATE TABLE "DealerApplicationProfile" (
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

    CONSTRAINT "DealerApplicationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealerApplicationProfile_application_id_key" ON "DealerApplicationProfile"("application_id");

-- CreateIndex
CREATE INDEX "DealerApplication_status_idx" ON "DealerApplication"("status");

-- CreateIndex
CREATE INDEX "DealerApplication_owner_email_idx" ON "DealerApplication"("owner_email");

-- CreateIndex
CREATE INDEX "DealerApplication_submitted_at_idx" ON "DealerApplication"("submitted_at");

-- CreateIndex
CREATE INDEX "DealerApplication_source_status_idx" ON "DealerApplication"("source", "status");

-- CreateIndex
CREATE INDEX "DealerApplication_dealership_id_idx" ON "DealerApplication"("dealership_id");

-- CreateIndex
CREATE INDEX "DealerApplication_invite_id_idx" ON "DealerApplication"("invite_id");

-- CreateIndex
CREATE INDEX "DealerApplicationProfile_application_id_idx" ON "DealerApplicationProfile"("application_id");

-- CreateIndex
CREATE INDEX "DealershipInvite_dealer_application_id_idx" ON "DealershipInvite"("dealer_application_id");

-- AddForeignKey DealerApplication.invite_id -> DealershipInvite
ALTER TABLE "DealerApplication" ADD CONSTRAINT "DealerApplication_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "DealershipInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey DealerApplication.dealership_id -> Dealership
ALTER TABLE "DealerApplication" ADD CONSTRAINT "DealerApplication_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey DealerApplicationProfile.application_id -> DealerApplication
ALTER TABLE "DealerApplicationProfile" ADD CONSTRAINT "DealerApplicationProfile_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "DealerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey DealershipInvite.dealer_application_id -> DealerApplication
ALTER TABLE "DealershipInvite" ADD CONSTRAINT "DealershipInvite_dealer_application_id_fkey" FOREIGN KEY ("dealer_application_id") REFERENCES "DealerApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
