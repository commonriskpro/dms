-- Finance & Accounting Core (FINANCE_ACCOUNTING_CORE_SPEC)
-- Enums
CREATE TYPE "CreditApplicationStatus" AS ENUM ('DRAFT', 'READY_TO_SUBMIT', 'SUBMITTED', 'APPROVED', 'DENIED', 'CONDITIONALLY_APPROVED', 'WITHDRAWN');
CREATE TYPE "LenderApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RECEIVED', 'APPROVED', 'DENIED', 'COUNTER_OFFER', 'STIP_PENDING', 'FUNDED', 'CANCELLED');
CREATE TYPE "LenderStipulationTypeNew" AS ENUM ('PROOF_OF_INCOME', 'DRIVER_LICENSE', 'RESIDENCE_PROOF', 'INSURANCE', 'REFERENCES', 'OTHER');
CREATE TYPE "LenderStipulationStatusNew" AS ENUM ('REQUESTED', 'RECEIVED', 'APPROVED', 'REJECTED', 'WAIVED');
CREATE TYPE "DealDocumentCategory" AS ENUM ('CONTRACT', 'ID', 'INSURANCE', 'STIPULATION', 'CREDIT', 'COMPLIANCE', 'OTHER');
CREATE TYPE "ComplianceFormType" AS ENUM ('PRIVACY_NOTICE', 'ODOMETER_DISCLOSURE', 'BUYERS_GUIDE', 'ARBITRATION', 'OTHER');
CREATE TYPE "ComplianceFormInstanceStatus" AS ENUM ('NOT_STARTED', 'GENERATED', 'REVIEWED', 'COMPLETED');
CREATE TYPE "AccountingAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE "AccountingReferenceType" AS ENUM ('DEAL', 'VEHICLE', 'EXPENSE', 'MANUAL', 'OTHER');
CREATE TYPE "AccountingEntryDirection" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "DealershipExpenseStatus" AS ENUM ('OPEN', 'POSTED', 'VOID');

-- CreditApplication
CREATE TABLE "CreditApplication" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "deal_id" UUID,
    "customer_id" UUID NOT NULL,
    "status" "CreditApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "applicant_first_name" VARCHAR(128) NOT NULL,
    "applicant_last_name" VARCHAR(128) NOT NULL,
    "dob" DATE,
    "ssn_encrypted" TEXT,
    "phone" VARCHAR(64),
    "email" VARCHAR(256),
    "address_line1" VARCHAR(256),
    "address_line2" VARCHAR(256),
    "city" VARCHAR(128),
    "state" VARCHAR(64),
    "postal_code" VARCHAR(20),
    "housing_status" VARCHAR(64),
    "housing_payment_cents" BIGINT,
    "years_at_residence" INTEGER,
    "employer_name" VARCHAR(256),
    "job_title" VARCHAR(128),
    "employment_years" INTEGER,
    "monthly_income_cents" BIGINT,
    "other_income_cents" BIGINT,
    "notes" TEXT,
    "submitted_at" TIMESTAMP(3),
    "decisioned_at" TIMESTAMP(3),
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditApplication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreditApplication_dealership_id_idx" ON "CreditApplication"("dealership_id");
CREATE INDEX "CreditApplication_dealership_id_deal_id_idx" ON "CreditApplication"("dealership_id", "deal_id");
CREATE INDEX "CreditApplication_dealership_id_customer_id_idx" ON "CreditApplication"("dealership_id", "customer_id");
CREATE INDEX "CreditApplication_dealership_id_status_idx" ON "CreditApplication"("dealership_id", "status");
CREATE INDEX "CreditApplication_dealership_id_created_at_idx" ON "CreditApplication"("dealership_id", "created_at");
ALTER TABLE "CreditApplication" ADD CONSTRAINT "CreditApplication_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditApplication" ADD CONSTRAINT "CreditApplication_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditApplication" ADD CONSTRAINT "CreditApplication_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- LenderApplication
CREATE TABLE "LenderApplication" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "credit_application_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "lender_name" VARCHAR(256) NOT NULL,
    "status" "LenderApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "external_application_ref" VARCHAR(256),
    "apr_bps" INTEGER,
    "max_amount_cents" BIGINT,
    "max_advance_bps" INTEGER,
    "term_months" INTEGER,
    "down_payment_required_cents" BIGINT,
    "decision_summary" TEXT,
    "raw_decision_json" JSONB,
    "submitted_at" TIMESTAMP(3),
    "decisioned_at" TIMESTAMP(3),
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LenderApplication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LenderApplication_dealership_id_idx" ON "LenderApplication"("dealership_id");
CREATE INDEX "LenderApplication_dealership_id_credit_application_id_idx" ON "LenderApplication"("dealership_id", "credit_application_id");
CREATE INDEX "LenderApplication_dealership_id_deal_id_idx" ON "LenderApplication"("dealership_id", "deal_id");
CREATE INDEX "LenderApplication_dealership_id_status_idx" ON "LenderApplication"("dealership_id", "status");
CREATE INDEX "LenderApplication_dealership_id_created_at_idx" ON "LenderApplication"("dealership_id", "created_at");
ALTER TABLE "LenderApplication" ADD CONSTRAINT "LenderApplication_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LenderApplication" ADD CONSTRAINT "LenderApplication_credit_application_id_fkey" FOREIGN KEY ("credit_application_id") REFERENCES "CreditApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LenderApplication" ADD CONSTRAINT "LenderApplication_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LenderStipulation
CREATE TABLE "LenderStipulation" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "lender_application_id" UUID NOT NULL,
    "type" "LenderStipulationTypeNew" NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "notes" TEXT,
    "status" "LenderStipulationStatusNew" NOT NULL DEFAULT 'REQUESTED',
    "required_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "created_by_user_id" UUID,
    "reviewed_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LenderStipulation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LenderStipulation_dealership_id_idx" ON "LenderStipulation"("dealership_id");
CREATE INDEX "LenderStipulation_dealership_id_lender_application_id_idx" ON "LenderStipulation"("dealership_id", "lender_application_id");
CREATE INDEX "LenderStipulation_dealership_id_status_idx" ON "LenderStipulation"("dealership_id", "status");
ALTER TABLE "LenderStipulation" ADD CONSTRAINT "LenderStipulation_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LenderStipulation" ADD CONSTRAINT "LenderStipulation_lender_application_id_fkey" FOREIGN KEY ("lender_application_id") REFERENCES "LenderApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DealDocument
CREATE TABLE "DealDocument" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "credit_application_id" UUID,
    "lender_application_id" UUID,
    "category" "DealDocumentCategory" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "file_object_id" UUID NOT NULL,
    "mime_type" VARCHAR(128) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DealDocument_dealership_id_idx" ON "DealDocument"("dealership_id");
CREATE INDEX "DealDocument_dealership_id_deal_id_idx" ON "DealDocument"("dealership_id", "deal_id");
CREATE INDEX "DealDocument_dealership_id_category_idx" ON "DealDocument"("dealership_id", "category");
ALTER TABLE "DealDocument" ADD CONSTRAINT "DealDocument_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealDocument" ADD CONSTRAINT "DealDocument_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealDocument" ADD CONSTRAINT "DealDocument_file_object_id_fkey" FOREIGN KEY ("file_object_id") REFERENCES "FileObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ComplianceFormInstance
CREATE TABLE "ComplianceFormInstance" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "form_type" "ComplianceFormType" NOT NULL,
    "status" "ComplianceFormInstanceStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "generated_payload_json" JSONB,
    "generated_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceFormInstance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ComplianceFormInstance_dealership_id_idx" ON "ComplianceFormInstance"("dealership_id");
CREATE INDEX "ComplianceFormInstance_dealership_id_deal_id_idx" ON "ComplianceFormInstance"("dealership_id", "deal_id");
CREATE INDEX "ComplianceFormInstance_dealership_id_form_type_idx" ON "ComplianceFormInstance"("dealership_id", "form_type");
CREATE INDEX "ComplianceFormInstance_dealership_id_status_idx" ON "ComplianceFormInstance"("dealership_id", "status");
ALTER TABLE "ComplianceFormInstance" ADD CONSTRAINT "ComplianceFormInstance_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceFormInstance" ADD CONSTRAINT "ComplianceFormInstance_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AccountingAccount
CREATE TABLE "AccountingAccount" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "type" "AccountingAccountType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccountingAccount_dealership_id_code_key" ON "AccountingAccount"("dealership_id", "code");
CREATE INDEX "AccountingAccount_dealership_id_idx" ON "AccountingAccount"("dealership_id");
CREATE INDEX "AccountingAccount_dealership_id_is_active_idx" ON "AccountingAccount"("dealership_id", "is_active");
ALTER TABLE "AccountingAccount" ADD CONSTRAINT "AccountingAccount_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AccountingTransaction
CREATE TABLE "AccountingTransaction" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "reference_type" "AccountingReferenceType" NOT NULL,
    "reference_id" UUID,
    "memo" VARCHAR(500),
    "posted_at" DATE NOT NULL,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccountingTransaction_dealership_id_idx" ON "AccountingTransaction"("dealership_id");
CREATE INDEX "AccountingTransaction_dealership_id_posted_at_idx" ON "AccountingTransaction"("dealership_id", "posted_at");
CREATE INDEX "AccountingTransaction_dealership_id_reference_type_reference_id_idx" ON "AccountingTransaction"("dealership_id", "reference_type", "reference_id");
ALTER TABLE "AccountingTransaction" ADD CONSTRAINT "AccountingTransaction_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AccountingEntry
CREATE TABLE "AccountingEntry" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "direction" "AccountingEntryDirection" NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "memo" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccountingEntry_dealership_id_idx" ON "AccountingEntry"("dealership_id");
CREATE INDEX "AccountingEntry_transaction_id_idx" ON "AccountingEntry"("transaction_id");
CREATE INDEX "AccountingEntry_account_id_idx" ON "AccountingEntry"("account_id");
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "AccountingTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "AccountingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DealershipExpense
CREATE TABLE "DealershipExpense" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "deal_id" UUID,
    "category" VARCHAR(128) NOT NULL,
    "vendor" VARCHAR(256),
    "description" TEXT,
    "amount_cents" BIGINT NOT NULL,
    "incurred_on" DATE NOT NULL,
    "status" "DealershipExpenseStatus" NOT NULL DEFAULT 'OPEN',
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealershipExpense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DealershipExpense_dealership_id_idx" ON "DealershipExpense"("dealership_id");
CREATE INDEX "DealershipExpense_dealership_id_status_idx" ON "DealershipExpense"("dealership_id", "status");
CREATE INDEX "DealershipExpense_dealership_id_incurred_on_idx" ON "DealershipExpense"("dealership_id", "incurred_on");
CREATE INDEX "DealershipExpense_dealership_id_vehicle_id_idx" ON "DealershipExpense"("dealership_id", "vehicle_id");
CREATE INDEX "DealershipExpense_dealership_id_deal_id_idx" ON "DealershipExpense"("dealership_id", "deal_id");
ALTER TABLE "DealershipExpense" ADD CONSTRAINT "DealershipExpense_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealershipExpense" ADD CONSTRAINT "DealershipExpense_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DealershipExpense" ADD CONSTRAINT "DealershipExpense_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TaxProfile
CREATE TABLE "TaxProfile" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "state" VARCHAR(64),
    "county" VARCHAR(128),
    "city" VARCHAR(128),
    "tax_rate_bps" INTEGER NOT NULL,
    "doc_fee_taxable" BOOLEAN NOT NULL DEFAULT true,
    "warranty_taxable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxProfile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TaxProfile_dealership_id_idx" ON "TaxProfile"("dealership_id");
ALTER TABLE "TaxProfile" ADD CONSTRAINT "TaxProfile_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
