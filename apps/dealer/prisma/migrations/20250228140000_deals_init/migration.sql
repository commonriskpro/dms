-- Deals module (docs/design/deals-spec.md)
-- DealStatus enum, Deal, DealFee, DealTrade, DealHistory. All money BIGINT cents.
-- Partial unique: one active deal per (dealership_id, vehicle_id) WHERE deleted_at IS NULL AND status <> 'CANCELED'

CREATE TYPE "DealStatus" AS ENUM ('DRAFT', 'STRUCTURED', 'APPROVED', 'CONTRACTED', 'CANCELED');

CREATE TABLE "Deal" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "sale_price_cents" BIGINT NOT NULL,
    "purchase_price_cents" BIGINT NOT NULL,
    "tax_rate_bps" INTEGER NOT NULL,
    "tax_cents" BIGINT NOT NULL,
    "doc_fee_cents" BIGINT NOT NULL,
    "down_payment_cents" BIGINT NOT NULL,
    "total_fees_cents" BIGINT NOT NULL,
    "total_due_cents" BIGINT NOT NULL,
    "front_gross_cents" BIGINT NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DealFee" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealFee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DealTrade" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "vehicle_description" TEXT NOT NULL,
    "allowance_cents" BIGINT NOT NULL,
    "payoff_cents" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealTrade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DealHistory" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "from_status" "DealStatus",
    "to_status" "DealStatus" NOT NULL,
    "changed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealHistory_pkey" PRIMARY KEY ("id")
);

-- One active deal per vehicle: partial unique index
CREATE UNIQUE INDEX "Deal_dealership_id_vehicle_id_active_key" ON "Deal"("dealership_id", "vehicle_id")
WHERE "deleted_at" IS NULL AND "status" <> 'CANCELED';

CREATE INDEX "Deal_dealership_id_idx" ON "Deal"("dealership_id");
CREATE INDEX "Deal_dealership_id_status_idx" ON "Deal"("dealership_id", "status");
CREATE INDEX "Deal_dealership_id_created_at_idx" ON "Deal"("dealership_id", "created_at");
CREATE INDEX "Deal_dealership_id_customer_id_idx" ON "Deal"("dealership_id", "customer_id");
CREATE INDEX "Deal_dealership_id_vehicle_id_idx" ON "Deal"("dealership_id", "vehicle_id");
CREATE INDEX "Deal_dealership_id_deleted_at_idx" ON "Deal"("dealership_id", "deleted_at");

CREATE INDEX "DealFee_dealership_id_idx" ON "DealFee"("dealership_id");
CREATE INDEX "DealFee_dealership_id_deal_id_idx" ON "DealFee"("dealership_id", "deal_id");

CREATE INDEX "DealTrade_dealership_id_idx" ON "DealTrade"("dealership_id");
CREATE INDEX "DealTrade_dealership_id_deal_id_idx" ON "DealTrade"("dealership_id", "deal_id");

CREATE INDEX "DealHistory_dealership_id_idx" ON "DealHistory"("dealership_id");
CREATE INDEX "DealHistory_dealership_id_deal_id_created_at_idx" ON "DealHistory"("dealership_id", "deal_id", "created_at");

ALTER TABLE "Deal" ADD CONSTRAINT "Deal_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DealFee" ADD CONSTRAINT "DealFee_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealFee" ADD CONSTRAINT "DealFee_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DealTrade" ADD CONSTRAINT "DealTrade_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealTrade" ADD CONSTRAINT "DealTrade_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DealHistory" ADD CONSTRAINT "DealHistory_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealHistory" ADD CONSTRAINT "DealHistory_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealHistory" ADD CONSTRAINT "DealHistory_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
