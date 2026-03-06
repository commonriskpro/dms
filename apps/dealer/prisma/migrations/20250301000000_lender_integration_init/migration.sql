-- Lender Integration (docs/design/lender-integration-spec.md)
-- Enums: LenderType, LenderExternalSystem, FinanceApplicationStatus, FinanceApplicantRole,
-- FinanceSubmissionStatus, FinanceDecisionStatus, FinanceFundingStatus, FinanceStipulationType, FinanceStipulationStatus
-- Models: Lender, FinanceApplication, FinanceApplicant, FinanceSubmission, FinanceStipulation

CREATE TYPE "LenderType" AS ENUM ('BANK', 'CREDIT_UNION', 'CAPTIVE', 'OTHER');

CREATE TYPE "LenderExternalSystem" AS ENUM ('NONE', 'ROUTEONE', 'DEALERTRACK', 'CUDL', 'OTHER');

CREATE TYPE "FinanceApplicationStatus" AS ENUM ('DRAFT', 'COMPLETED');

CREATE TYPE "FinanceApplicantRole" AS ENUM ('PRIMARY', 'CO');

CREATE TYPE "FinanceSubmissionStatus" AS ENUM ('DRAFT', 'READY_TO_SUBMIT', 'SUBMITTED', 'DECISIONED', 'FUNDED', 'CANCELED');

CREATE TYPE "FinanceDecisionStatus" AS ENUM ('APPROVED', 'CONDITIONAL', 'DECLINED', 'PENDING');

CREATE TYPE "FinanceFundingStatus" AS ENUM ('PENDING', 'FUNDED', 'CANCELED');

CREATE TYPE "FinanceStipulationType" AS ENUM ('PAYSTUB', 'PROOF_RESIDENCE', 'INSURANCE', 'LICENSE', 'BANK_STATEMENT', 'OTHER');

CREATE TYPE "FinanceStipulationStatus" AS ENUM ('REQUESTED', 'RECEIVED', 'WAIVED');

CREATE TABLE "Lender" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "lender_type" "LenderType" NOT NULL,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "external_system" "LenderExternalSystem" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lender_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceApplication" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "status" "FinanceApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceApplicant" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "role" "FinanceApplicantRole" NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "employer_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceApplicant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceSubmission" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "lender_id" UUID NOT NULL,
    "status" "FinanceSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "decisioned_at" TIMESTAMP(3),
    "funded_at" TIMESTAMP(3),
    "amount_financed_cents" BIGINT NOT NULL,
    "term_months" INTEGER NOT NULL,
    "apr_bps" INTEGER NOT NULL,
    "payment_cents" BIGINT NOT NULL,
    "products_total_cents" BIGINT NOT NULL,
    "backend_gross_cents" BIGINT NOT NULL,
    "reserve_estimate_cents" BIGINT,
    "decision_status" "FinanceDecisionStatus",
    "approved_term_months" INTEGER,
    "approved_apr_bps" INTEGER,
    "approved_payment_cents" BIGINT,
    "max_advance_cents" BIGINT,
    "decision_notes" TEXT,
    "funding_status" "FinanceFundingStatus" NOT NULL DEFAULT 'PENDING',
    "funded_amount_cents" BIGINT,
    "reserve_final_cents" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceStipulation" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "stip_type" "FinanceStipulationType" NOT NULL,
    "status" "FinanceStipulationStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "document_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceStipulation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Lender_dealership_id_name_key" ON "Lender"("dealership_id", "name");
CREATE INDEX "Lender_dealership_id_idx" ON "Lender"("dealership_id");
CREATE INDEX "Lender_dealership_id_is_active_idx" ON "Lender"("dealership_id", "is_active");

CREATE INDEX "FinanceApplication_dealership_id_idx" ON "FinanceApplication"("dealership_id");
CREATE INDEX "FinanceApplication_dealership_id_deal_id_idx" ON "FinanceApplication"("dealership_id", "deal_id");
CREATE INDEX "FinanceApplication_dealership_id_created_at_idx" ON "FinanceApplication"("dealership_id", "created_at");

CREATE INDEX "FinanceApplicant_dealership_id_idx" ON "FinanceApplicant"("dealership_id");
CREATE INDEX "FinanceApplicant_dealership_id_application_id_idx" ON "FinanceApplicant"("dealership_id", "application_id");

CREATE INDEX "FinanceSubmission_dealership_id_idx" ON "FinanceSubmission"("dealership_id");
CREATE INDEX "FinanceSubmission_dealership_id_deal_id_idx" ON "FinanceSubmission"("dealership_id", "deal_id");
CREATE INDEX "FinanceSubmission_dealership_id_lender_id_idx" ON "FinanceSubmission"("dealership_id", "lender_id");
CREATE INDEX "FinanceSubmission_dealership_id_status_idx" ON "FinanceSubmission"("dealership_id", "status");
CREATE INDEX "FinanceSubmission_dealership_id_created_at_idx" ON "FinanceSubmission"("dealership_id", "created_at");

CREATE INDEX "FinanceStipulation_dealership_id_idx" ON "FinanceStipulation"("dealership_id");
CREATE INDEX "FinanceStipulation_dealership_id_submission_id_idx" ON "FinanceStipulation"("dealership_id", "submission_id");
CREATE INDEX "FinanceStipulation_dealership_id_status_idx" ON "FinanceStipulation"("dealership_id", "status");
CREATE INDEX "FinanceStipulation_dealership_id_stip_type_idx" ON "FinanceStipulation"("dealership_id", "stip_type");

ALTER TABLE "Lender" ADD CONSTRAINT "Lender_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinanceApplication" ADD CONSTRAINT "FinanceApplication_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceApplication" ADD CONSTRAINT "FinanceApplication_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceApplication" ADD CONSTRAINT "FinanceApplication_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinanceApplicant" ADD CONSTRAINT "FinanceApplicant_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceApplicant" ADD CONSTRAINT "FinanceApplicant_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "FinanceApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinanceSubmission" ADD CONSTRAINT "FinanceSubmission_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceSubmission" ADD CONSTRAINT "FinanceSubmission_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "FinanceApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceSubmission" ADD CONSTRAINT "FinanceSubmission_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceSubmission" ADD CONSTRAINT "FinanceSubmission_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "Lender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinanceStipulation" ADD CONSTRAINT "FinanceStipulation_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceStipulation" ADD CONSTRAINT "FinanceStipulation_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "FinanceSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceStipulation" ADD CONSTRAINT "FinanceStipulation_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
