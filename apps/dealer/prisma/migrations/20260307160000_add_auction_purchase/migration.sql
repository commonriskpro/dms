-- CreateEnum
CREATE TYPE "AuctionPurchaseStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "auction_purchase" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "auction_name" VARCHAR(256) NOT NULL,
    "lot_number" VARCHAR(128) NOT NULL,
    "purchase_price_cents" BIGINT NOT NULL,
    "fees_cents" BIGINT NOT NULL DEFAULT 0,
    "shipping_cents" BIGINT NOT NULL DEFAULT 0,
    "eta_date" TIMESTAMP(3),
    "status" "AuctionPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auction_purchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auction_purchase_dealership_id_idx" ON "auction_purchase"("dealership_id");

-- CreateIndex
CREATE INDEX "auction_purchase_dealership_id_status_idx" ON "auction_purchase"("dealership_id", "status");

-- CreateIndex
CREATE INDEX "auction_purchase_vehicle_id_idx" ON "auction_purchase"("vehicle_id");

-- AddForeignKey
ALTER TABLE "auction_purchase" ADD CONSTRAINT "auction_purchase_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "Dealership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_purchase" ADD CONSTRAINT "auction_purchase_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
