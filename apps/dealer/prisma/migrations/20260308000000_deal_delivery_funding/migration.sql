-- DeliveryStatus, DealFundingStatus enums; Deal.deliveryStatus, Deal.deliveredAt; DealFunding table
CREATE TYPE "DeliveryStatus" AS ENUM ('READY_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');

CREATE TYPE "DealFundingStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'FUNDED', 'FAILED');

ALTER TABLE "Deal" ADD COLUMN "delivery_status" "DeliveryStatus",
ADD COLUMN "delivered_at" TIMESTAMP(3);

CREATE TABLE "DealFunding" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "lender_application_id" UUID,
    "funding_status" "DealFundingStatus" NOT NULL DEFAULT 'PENDING',
    "funding_amount_cents" BIGINT NOT NULL,
    "funding_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealFunding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DealFunding_dealership_id_idx" ON "DealFunding"("dealership_id");
CREATE INDEX IF NOT EXISTS "DealFunding_dealership_id_deal_id_idx" ON "DealFunding"("dealership_id", "deal_id");
CREATE INDEX IF NOT EXISTS "DealFunding_dealership_id_funding_status_idx" ON "DealFunding"("dealership_id", "funding_status");
CREATE INDEX IF NOT EXISTS "DealFunding_dealership_id_created_at_idx" ON "DealFunding"("dealership_id", "created_at");
CREATE INDEX IF NOT EXISTS "Deal_dealership_id_delivery_status_idx" ON "Deal"("dealership_id", "delivery_status");

ALTER TABLE "DealFunding" ADD CONSTRAINT "DealFunding_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealFunding" ADD CONSTRAINT "DealFunding_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealFunding" ADD CONSTRAINT "DealFunding_lender_application_id_fkey" FOREIGN KEY ("lender_application_id") REFERENCES "LenderApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
