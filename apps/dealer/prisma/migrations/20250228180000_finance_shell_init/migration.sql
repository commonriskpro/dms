-- Finance Shell (docs/design/finance-shell-spec.md)
-- Enums: FinancingMode, DealFinanceStatus, DealFinanceProductType
-- DealFinance (1:1 Deal), DealFinanceProduct. All money BIGINT cents; aprBps Int.

CREATE TYPE "FinancingMode" AS ENUM ('CASH', 'FINANCE');

CREATE TYPE "DealFinanceStatus" AS ENUM ('DRAFT', 'STRUCTURED', 'PRESENTED', 'ACCEPTED', 'CONTRACTED', 'CANCELED');

CREATE TYPE "DealFinanceProductType" AS ENUM ('GAP', 'VSC', 'MAINTENANCE', 'TIRE_WHEEL', 'OTHER');

CREATE TABLE "DealFinance" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "financing_mode" "FinancingMode" NOT NULL,
    "term_months" INTEGER,
    "apr_bps" INTEGER,
    "cash_down_cents" BIGINT NOT NULL,
    "amount_financed_cents" BIGINT NOT NULL,
    "monthly_payment_cents" BIGINT NOT NULL,
    "total_of_payments_cents" BIGINT NOT NULL,
    "finance_charge_cents" BIGINT NOT NULL,
    "products_total_cents" BIGINT NOT NULL,
    "backend_gross_cents" BIGINT NOT NULL,
    "reserve_cents" BIGINT,
    "status" "DealFinanceStatus" NOT NULL DEFAULT 'DRAFT',
    "first_payment_date" DATE,
    "lender_name" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "DealFinance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DealFinanceProduct" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "deal_finance_id" UUID NOT NULL,
    "product_type" "DealFinanceProductType" NOT NULL,
    "name" TEXT NOT NULL,
    "price_cents" BIGINT NOT NULL,
    "cost_cents" BIGINT,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "included_in_amount_financed" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "DealFinanceProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DealFinance_deal_id_key" ON "DealFinance"("deal_id");

CREATE INDEX "DealFinance_dealership_id_idx" ON "DealFinance"("dealership_id");
CREATE INDEX "DealFinance_dealership_id_status_idx" ON "DealFinance"("dealership_id", "status");
CREATE INDEX "DealFinance_dealership_id_created_at_idx" ON "DealFinance"("dealership_id", "created_at");

CREATE INDEX "DealFinanceProduct_dealership_id_idx" ON "DealFinanceProduct"("dealership_id");
CREATE INDEX "DealFinanceProduct_dealership_id_deal_finance_id_idx" ON "DealFinanceProduct"("dealership_id", "deal_finance_id");

ALTER TABLE "DealFinance" ADD CONSTRAINT "DealFinance_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealFinance" ADD CONSTRAINT "DealFinance_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealFinance" ADD CONSTRAINT "DealFinance_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DealFinanceProduct" ADD CONSTRAINT "DealFinanceProduct_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealFinanceProduct" ADD CONSTRAINT "DealFinanceProduct_deal_finance_id_fkey" FOREIGN KEY ("deal_finance_id") REFERENCES "DealFinance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
